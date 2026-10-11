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
// ---- Email finding ----
// Picks up addresses from mailto: links, plain text, and Cloudflare-protected
// emails (data-cfemail). Ignores image names, tracking/placeholder addresses.
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_EMAIL_PARTS = [
  "example.", "domain.com", "yourdomain", "yoursite", "email.com", "sentry", "wixpress",
  "noreply", "no-reply", "donotreply", "do-not-reply", "@2x", "godaddy", "squarespace.com",
  "wordpress", "schema.org", "placeholder", "test@", "name@", "user@", "john@doe", "jane@",
];
const BAD_ENDINGS = /\.(png|jpe?g|gif|svg|webp|avif|css|js|ico)$/i;
const GOOD_PREFIXES = ["info", "contact", "office", "hello", "admin", "sales", "quotes", "quote", "estimates", "estimate", "inquiries", "enquiries", "service"];
const WEAK_PREFIXES = ["careers", "jobs", "hr", "privacy", "billing", "accounts", "accounting", "invoices", "webmaster"];

function decodeCfEmail(hex: string): string | null {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch {
    return null;
  }
}

// Turns &#105;&#110;&#102;&#111; / &#x40; / &commat; style codes back into text.
function decodeEntities(html: string): string {
  return html
    .replace(/&#(\d+);?/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&amp;/gi, "&");
}

// "info [at] company [dot] com" / "info(at)company(dot)com" -> info@company.com
function undoObfuscation(text: string): string {
  return text
    .replace(/\s*[\[(\{]\s*at\s*[\])\}]\s*/gi, "@")
    .replace(/\s*[\[(\{]\s*dot\s*[\])\}]\s*/gi, ".")
    .replace(/(@[a-z0-9-]+)\s+dot\s+(?=[a-z]{2,}\b)/gi, "$1.");
}

function findEmails(rawHtml: string): string[] {
  const html = decodeEntities(rawHtml);
  const found: string[] = [];
  for (const m of Array.from(html.matchAll(/mailto:([^"'?\s<>]+)/gi))) {
    try {
      found.push(decodeURIComponent(m[1]));
    } catch {
      found.push(m[1]);
    }
  }
  for (const m of Array.from(html.matchAll(/data-cfemail="([0-9a-f]+)"/gi))) {
    const e = decodeCfEmail(m[1]);
    if (e) found.push(e);
  }
  for (const m of Array.from(html.matchAll(EMAIL_PATTERN))) found.push(m[0]);
  // Only in visible text (tags removed), to avoid false matches inside code.
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  for (const m of Array.from(undoObfuscation(text).matchAll(EMAIL_PATTERN))) found.push(m[0]);

  const clean = new Set<string>();
  for (const raw of found) {
    const e = raw.trim().toLowerCase().replace(/^[.\-]+|[.\-]+$/g, "");
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) continue;
    if (BAD_ENDINGS.test(e)) continue;
    if (BAD_EMAIL_PARTS.some((b) => e.includes(b))) continue;
    clean.add(e);
  }
  return Array.from(clean);
}

// Best address to pitch to: same domain as the website, then info@/contact@ style.
function pickEmail(emails: string[], website: string): string | null {
  if (emails.length === 0) return null;
  let host = "";
  try {
    host = new URL(normalizeUrl(website)).hostname.replace(/^www\./, "");
  } catch {}
  const score = (e: string) => {
    const [local, dom] = e.split("@");
    let s = 0;
    if (host && (dom === host || host.endsWith("." + dom) || dom.endsWith("." + host))) s += 10;
    if (GOOD_PREFIXES.includes(local)) s += 5;
    if (WEAK_PREFIXES.includes(local)) s -= 5;
    return s;
  };
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

const HOMEPAGE_TIMEOUT_MS = 8000;
const SUBPAGE_TIMEOUT_MS = 5000;
// Checked when the homepage didn't have everything — social icons and email
// addresses often only appear on these pages.
const SUBPATHS_TO_CHECK = ["/contact", "/contact-us", "/about"];
// Links on the homepage whose address or text looks like a contact/quote page.
const CONTACT_LINK_WORDS = /(contact|get-in-touch|get-a-quote|quote|estimate|reach-us|connect|about)/i;
const MAX_EXTRA_PAGES = 5;

// Finds same-site links that probably lead to a contact page, e.g. /contact.html,
// /get-a-free-quote, /pages/contact-us.
function findContactLinks(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const out = new Set<string>();
  for (const m of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
    const href = m[1].trim();
    const label = m[2].replace(/<[^>]+>/g, " ");
    if (!CONTACT_LINK_WORDS.test(href) && !CONTACT_LINK_WORDS.test(label)) continue;
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const u = new URL(href, pageUrl);
      if (u.origin !== origin) continue;
      if (/\.(pdf|jpe?g|png|gif|zip)$/i.test(u.pathname)) continue;
      out.add(u.origin + u.pathname);
    } catch {}
  }
  return Array.from(out);
}

function normalizeUrl(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

// null = page couldn't be loaded.
async function fetchPage(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Look like a normal browser — many sites block unknown visitors.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Bump when email finding improves, so companies with no email get re-checked.
export const EMAIL_SCAN_VERSION = 2;

export type WebsiteScan = {
  // string = Instagram URL found, false = site loaded but no link, null = couldn't load.
  instagram: string | false | null;
  // Best email address found on the site, or null.
  email: string | null;
  // True if the site could be read at all (so "no email" is a real answer).
  reachable: boolean;
};

// Reads the homepage (and contact/about pages if needed) once, looking for
// both an Instagram link and an email address.
export async function scanWebsite(website: string | null): Promise<WebsiteScan> {
  if (!website) return { instagram: null, email: null, reachable: false };

  const homepageUrl = normalizeUrl(website);
  const home = await fetchPage(homepageUrl, HOMEPAGE_TIMEOUT_MS);
  // Homepage unreachable — don't try subpages, and don't penalize the business.
  if (home === null) return { instagram: null, email: null, reachable: false };

  let instagram: string | false = findInstagramLink(home);
  const emails = findEmails(home);

  // Look further if there's no Instagram link yet, or only weak emails
  // (careers@, billing@…) — the contact page usually has the right one.
  const hasGoodEmail = emails.some((e) => !WEAK_PREFIXES.includes(e.split("@")[0]));
  if (!instagram || !hasGoodEmail) {
    let origin = "";
    try {
      origin = new URL(homepageUrl).origin;
    } catch {}
    if (origin) {
      // Contact-looking links from the homepage first, then the usual paths.
      // In parallel: worst-case wait is one timeout, not several.
      const urls = Array.from(
        new Set([...findContactLinks(home, homepageUrl), ...SUBPATHS_TO_CHECK.map((p) => origin + p)])
      )
        .filter((u) => u.replace(/\/$/, "") !== homepageUrl.replace(/\/$/, ""))
        .slice(0, MAX_EXTRA_PAGES);
      const pages = await Promise.all(urls.map((u) => fetchPage(u, SUBPAGE_TIMEOUT_MS)));
      for (const html of pages) {
        if (!html) continue;
        if (!instagram) instagram = findInstagramLink(html);
        emails.push(...findEmails(html));
      }
    }
  }

  return { instagram, email: pickEmail(Array.from(new Set(emails)), website), reachable: true };
}

// Kept for older callers: Instagram result only.
export async function checkForInstagram(website: string | null): Promise<string | false | null> {
  return (await scanWebsite(website)).instagram;
}
