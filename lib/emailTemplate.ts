// Builds a ready-to-edit outreach email draft from a company's data —
// no AI call needed, just fill-in-the-blanks logic based on what we found.

export type DraftInput = {
  name: string;
  hasInstagram: boolean | null;
  website: string | null;
  flaggedReviews: { review_text: string | null; flag_reason: string | null }[];
};

export type EmailDraft = {
  subject: string;
  body: string;
};

function trimReview(text: string, maxLen = 160): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > maxLen ? clean.slice(0, maxLen).trim() + "…" : clean;
}

export function generateOutreachEmail(input: DraftInput): EmailDraft {
  const { name, hasInstagram, website, flaggedReviews } = input;

  const hooks: string[] = [];

  if (hasInstagram === false) {
    hooks.push(
      website
        ? `While researching local contractors, I checked out ${website} and noticed ${name} doesn't have an Instagram presence yet.`
        : `While researching local contractors, I noticed ${name} doesn't seem to have a website or Instagram presence I could find.`
    );
  }

  if (flaggedReviews.length > 0) {
    const quote = flaggedReviews[0].review_text ? trimReview(flaggedReviews[0].review_text) : null;
    if (quote) {
      hooks.push(`I also came across a customer review that mentioned: "${quote}"`);
    }
  }

  if (hooks.length === 0) {
    hooks.push(
      `While researching local contractors, ${name} came up as a business that could benefit from a stronger online presence.`
    );
  }

  const subject = `Quick idea for ${name}'s online presence`;

  const body = `Hi ${name} team,

${hooks.join(" ")}

Homeowners increasingly check social media before choosing a contractor, and businesses with an active, well-presented Instagram tend to win more of those first impressions. I help construction and renovation companies build exactly that — from setting up a professional profile to running it day-to-day — so you can stay focused on the work while a stronger online presence brings in more inquiries.

Would you be open to a quick 10-15 minute call this week to see if it's a fit?

Best,
[Your name]
[Your phone / email]`;

  return { subject, body };
}
