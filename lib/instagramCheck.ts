// Fetches a company's website HTML and checks for any instagram.com link.
// Fails soft: if the site can't be fetched (timeout, blocks bots, SSL issue, etc.)
// we return null (unknown) rather than falsely flagging them as "no Instagram."
//
// Known limitations (real, not bugs):
// 1. This only detects whether the WEBSITE links to Instagram, not whether the
//    business actually has an Instagram account. A business can have an active
//    account and simply never add the link to their site.
// 2. This reads raw server-sent HTML — it doesn't run JavaScript. A site that
//    injects its footer/social links client-side (common in some React/Vue
//    builds) can have a link we never see. Most site builders (Wix,
//    Squarespace, WordPress) render this server-side, so this mainly affects
//    custom-built JS-heavy sites.

const INSTAGRAM_PATTERN = /instagram\.com\/([a-zA-Z0-9._]+)/gi;
const NON_PROFILE = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts", "sharer"]);

// Returns the first Instagram profile URL linked in the HTML, or false if none.
function findInstagramLink(html: string): string | false {
  for (const m of Array.from(html.matchAll(INSTAGRAM_PATTERN))) {
    const handle = m[1].replace(/\.+$/, "");
    if (handle && !NON_PROFILE.has(handle.toLowerCase())) {
      return `https://www.instagram.com/${handle}/`;
    }
  }
  // Link to a post/reel only — still means they have Instagram.
  return /instagram\.com\//i.test(html) ? "https://www.instagram.com/" : false;
}
const HOMEPAGE_TIMEOUT_MS = 8000;
const SUBPAGE_TIMEOUT_MS = 5000;
// Checked only if the homepage was reachable but had no Instagram link —
// some sites only put social icons in the footer of these specific pages.
const SUBPATHS_TO_CHECK = ["/contact", "/contact-us", "/about"];

function normalizeUrl(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

// string = Instagram URL found, false = page loaded but no link, null = couldn't load.
async function fetchAndCheck(url: string, timeoutMs: number): Promise<string | false | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SocialGapFinder/1.0; +https://vercel.app)",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    return findInstagramLink(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Returns the Instagram URL found on the site, false if the site has no link,
// or null if the site couldn't be reached (unknown).
export async function checkForInstagram(website: string | null): Promise<string | false | null> {
  if (!website) return null;

  const homepageUrl = normalizeUrl(website);
  const homepageResult = await fetchAndCheck(homepageUrl, HOMEPAGE_TIMEOUT_MS);

  // Homepage unreachable entirely — don't bother trying subpages on the same
  // domain, and don't penalize the business for our tool's connectivity issue.
  if (homepageResult === null) return null;
  if (homepageResult) return homepageResult;

  // Homepage was reachable but had no Instagram link — check a couple of
  // common secondary pages before concluding "no Instagram."
  let origin: string;
  try {
    origin = new URL(homepageUrl).origin;
  } catch {
    return false;
  }

  // Run subpage checks in parallel rather than one-by-one — same total
  // network work, but worst-case wait time is one timeout instead of three
  // stacked timeouts.
  const subpageResults = await Promise.all(
    SUBPATHS_TO_CHECK.map((path) => fetchAndCheck(`${origin}${path}`, SUBPAGE_TIMEOUT_MS))
  );

  return subpageResults.find((r): r is string => typeof r === "string") || false;
}
