import { NextResponse } from "next/server";
import { searchPlaces, getPlaceDetails } from "@/lib/googlePlaces";
import { checkForInstagram } from "@/lib/instagramCheck";
import { searchInstagramOnGoogle } from "@/lib/instagramSearch";
import { checkReview } from "@/lib/complaintDetection";
import { upsertCompany, clearReviewsForCompany, insertReview } from "@/lib/db";

// Allow this route up to 60s — checking several companies' websites/reviews
// per run takes longer than Vercel's default 10s function timeout.
export const maxDuration = 60;

// Cap how many places we fully process per search call, so a single request
// can't run past the function time limit. Re-run with a narrower query/city
// to pull more.
const MAX_PLACES_PER_SEARCH = 15;

// Belt-and-suspenders time budget: the Instagram check can now hit up to 4
// pages per company (homepage + 3 subpaths), so a handful of slow/unresponsive
// sites in one run could otherwise stack up and risk hitting Vercel's hard
// maxDuration cutoff (which kills the function with no response at all). We
// stop picking up new companies once we're past this budget and return
// partial results gracefully instead.
const TIME_BUDGET_MS = 45000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query: string = body.query?.trim() || "construction company";
    const location: string = body.location?.trim();

    if (!location) {
      return NextResponse.json({ ok: false, error: "location is required" }, { status: 400 });
    }

    const places = await searchPlaces(query, location);
    const toProcess = places.slice(0, MAX_PLACES_PER_SEARCH);

    const results = [];
    const startTime = Date.now();
    let stoppedForTime = false;

    for (const place of toProcess) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        stoppedForTime = true;
        break;
      }

      try {
        const details = await getPlaceDetails(place.placeId);

        // Step 1: check their website for an Instagram link.
        // string = link found, false = no link, null = site unreachable.
        const websiteResult = details.website ? await checkForInstagram(details.website) : false;

        let hasInstagram: boolean | null = websiteResult === null ? null : Boolean(websiteResult);
        let instagramUrl: string | null = typeof websiteResult === "string" ? websiteResult : null;
        let instagramSource: "website" | "google" | null = instagramUrl ? "website" : null;
        let googleChecked = false;

        // Step 2: no link on the website (or no website / site down) — search
        // Google for their Instagram account. Skipped if SERPER_API_KEY isn't set.
        if (!instagramUrl) {
          const google = await searchInstagramOnGoogle(details.name, location);
          if (google.checked) {
            googleChecked = true;
            if (google.url) {
              hasInstagram = true;
              instagramUrl = google.url;
              instagramSource = "google";
            } else if (details.website && websiteResult === null) {
              // Website couldn't be read and Google found nothing — still not sure.
              hasInstagram = null;
            } else {
              hasInstagram = false;
            }
          }
        }

        const companyId = await upsertCompany({
          place_id: details.placeId,
          name: details.name,
          phone: details.phone,
          website: details.website,
          address: details.address,
          city: location,
          has_instagram: hasInstagram,
          instagram_url: instagramUrl,
          instagram_source: instagramSource,
          google_checked: googleChecked,
        });

        await clearReviewsForCompany(companyId);

        let flaggedCount = 0;
        for (const review of details.reviews) {
          if (!review.text) continue;
          const check = checkReview(review.text, review.rating);
          if (check.flagged) flaggedCount++;
          await insertReview({
            company_id: companyId,
            source: "google",
            review_text: review.text,
            rating: review.rating,
            review_date: review.publishTime,
            flagged_social_complaint: check.flagged,
            flag_reason: check.reason,
          });
        }

        results.push({
          name: details.name,
          hasInstagram,
          instagramUrl,
          flaggedReviewCount: flaggedCount,
        });
      } catch (err: any) {
        // One bad place (e.g. details fetch failure) shouldn't kill the whole batch.
        results.push({ name: place.name, error: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      city: location,
      totalFound: places.length,
      processed: results.length,
      note: stoppedForTime
        ? `Stopped early after ${results.length} companies to stay within the time limit (some websites were slow to respond). Re-run the same search to pick up the rest.`
        : places.length > MAX_PLACES_PER_SEARCH
          ? `Google returned ${places.length} results; only the first ${MAX_PLACES_PER_SEARCH} were processed this run to stay within the time limit. Re-run with a more specific query to reach others.`
          : undefined,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
