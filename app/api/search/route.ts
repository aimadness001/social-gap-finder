import { NextResponse } from "next/server";
import { searchPlaces, getPlaceDetails } from "@/lib/googlePlaces";
import { checkForInstagram } from "@/lib/instagramCheck";
import { checkReviewForComplaint } from "@/lib/complaintDetection";
import { upsertCompany, clearReviewsForCompany, insertReview } from "@/lib/db";

// Allow this route up to 60s — checking several companies' websites/reviews
// per run takes longer than Vercel's default 10s function timeout.
export const maxDuration = 60;

// Cap how many places we fully process per search call, so a single request
// can't run past the function time limit. Re-run with a narrower query/city
// to pull more.
const MAX_PLACES_PER_SEARCH = 15;

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

    for (const place of toProcess) {
      try {
        const details = await getPlaceDetails(place.placeId);

        // No website at all = automatic "no discoverable Instagram" flag.
        // Website present but unreachable/blocked = unknown, don't penalize.
        const hasInstagram = details.website ? await checkForInstagram(details.website) : false;

        const companyId = await upsertCompany({
          place_id: details.placeId,
          name: details.name,
          phone: details.phone,
          website: details.website,
          address: details.address,
          city: location,
          has_instagram: hasInstagram,
        });

        await clearReviewsForCompany(companyId);

        let flaggedCount = 0;
        for (const review of details.reviews) {
          if (!review.text) continue;
          const check = checkReviewForComplaint(review.text);
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
      note:
        places.length > MAX_PLACES_PER_SEARCH
          ? `Google returned ${places.length} results; only the first ${MAX_PLACES_PER_SEARCH} were processed this run to stay within the time limit. Re-run with a more specific query to reach others.`
          : undefined,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
