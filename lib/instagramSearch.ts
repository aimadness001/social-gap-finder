// Second-chance Instagram check: searches Google (via Serper.dev) for the
// company's Instagram account. Used when the website check didn't find a
// link — many businesses have an active account but never link it on their
// site.
//
// Needs SERPER_API_KEY set in Vercel. If it isn't set, this quietly does
// nothing and the app behaves exactly like before (website check only).
//
// Returns:
//   { checked: false }                    — no key / search failed; result unknown
//   { checked: true, url: null }          — searched, no matching account found
//   { checked: true, url: "https://..." } — found a matching account

export type InstagramSearchResult = { checked: boolean; url: string | null };

const SERPER_URL = "https://google.serper.dev/search";
const TIMEOUT_MS = 8000;

// instagram.com paths that are NOT profile pages.
const NON_PROFILE_PATHS = new Set([
  "p", "reel", "reels", "explore", "stories", "tv", "accounts", "about",
  "developer", "legal", "directory", "web", "popular", "tags", "locations",
]);

// Words that say nothing about WHICH company it is. Matching only on these
// ("construction", "renovations") would pick up random accounts.
const GENERIC_WORDS = new Set([
  "inc", "ltd", "llc", "corp", "corporation", "co", "company", "limited", "the",
  "and", "of", "group", "services", "service", "construction", "constructions",
  "contracting", "contractor", "contractors", "renovation", "renovations", "reno",
  "renos", "remodeling", "remodelling", "homes", "home", "building", "builders",
  "builder", "general", "design", "designs", "build", "solutions", "canada",
  "kitchen", "kitchens", "bath", "baths", "bathroom", "roofing", "improvement",
  "improvements", "interiors", "projects", "developments", "development",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// Pulls the profile handle out of an instagram.com URL, or null if the link
// is a post/reel/etc rather than a profile.
function profileHandle(link: string): string | null {
  try {
    const u = new URL(link);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const first = u.pathname.split("/").filter(Boolean)[0];
    if (!first || NON_PROFILE_PATHS.has(first.toLowerCase())) return null;
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(first)) return null;
    return first.toLowerCase();
  } catch {
    return null;
  }
}

// Does this search result look like it belongs to this company?
// Checks the company name's words against the result title + handle
// (handles squash words together, e.g. "abcrenovations", so we check
// substrings of the handle too).
function looksLikeCompany(companyName: string, title: string, handle: string): boolean {
  const words = Array.from(new Set(tokenize(companyName)));
  if (words.length === 0) return false;

  const hay = `${tokenize(title).join(" ")} ${handle.replace(/[._]/g, "")}`;
  const hits = words.filter((w) => hay.includes(w));

  const distinctive = words.filter((w) => !GENERIC_WORDS.has(w));
  if (distinctive.length > 0) {
    // Must match the words that actually identify the business
    // (e.g. "Smith" in "Smith Renovations"), at least most of them.
    const distinctiveHits = distinctive.filter((w) => hay.includes(w));
    return distinctiveHits.length / distinctive.length >= 0.6;
  }
  // Name is all generic words ("Quality Renovations Group") — require all of them.
  return hits.length === words.length;
}

export async function searchInstagramOnGoogle(
  companyName: string,
  city: string
): Promise<InstagramSearchResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return { checked: false, url: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(SERPER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: `site:instagram.com ${companyName} ${city}`, num: 10 }),
    });
    if (!res.ok) return { checked: false, url: null };

    const data = await res.json();
    const organic: { link?: string; title?: string }[] = data.organic || [];

    for (const r of organic) {
      if (!r.link) continue;
      const handle = profileHandle(r.link);
      if (!handle) continue;
      if (looksLikeCompany(companyName, r.title || "", handle)) {
        return { checked: true, url: `https://www.instagram.com/${handle}/` };
      }
    }
    return { checked: true, url: null };
  } catch {
    return { checked: false, url: null };
  } finally {
    clearTimeout(timeout);
  }
}
