// Fetches a company's website HTML and checks for any instagram.com link.
// Fails soft: if the site can't be fetched (timeout, blocks bots, SSL issue, etc.)
// we return null (unknown) rather than falsely flagging them as "no Instagram."

const INSTAGRAM_PATTERN = /instagram\.com\/[a-zA-Z0-9._]+/i;
const FETCH_TIMEOUT_MS = 8000;

export async function checkForInstagram(website: string | null): Promise<boolean | null> {
  if (!website) return null;

  let url = website;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
    return INSTAGRAM_PATTERN.test(html);
  } catch {
    // Site unreachable, blocked us, or timed out — treat as unknown, not "no Instagram."
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
