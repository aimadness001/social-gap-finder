// Keyword-based detection of reviews that complain about a company's online /
// social media presence. No AI call needed for v1 — cheap, fast, and good
// enough to surface candidates worth reading. Swap in an AI classification
// pass later (see README) if you want higher precision at higher cost.

const COMPLAINT_PHRASES = [
  "no website",
  "don't have a website",
  "doesn't have a website",
  "no social media",
  "not on social media",
  "no instagram",
  "no facebook",
  "couldn't find them online",
  "couldn't find them on",
  "can't find them online",
  "hard to find online",
  "hard to find them online",
  "no online presence",
  "not online",
  "hard to reach",
  "hard to get in touch",
  "never responded",
  "never got back to me",
  "no way to contact",
  "outdated website",
  "website doesn't work",
  "website is down",
  "couldn't book online",
  "no way to book online",
];

export type ComplaintCheckResult = {
  flagged: boolean;
  reason: string | null;
};

export function checkReviewForComplaint(reviewText: string): ComplaintCheckResult {
  const text = reviewText.toLowerCase();

  for (const phrase of COMPLAINT_PHRASES) {
    if (text.includes(phrase)) {
      return { flagged: true, reason: `matched phrase: "${phrase}"` };
    }
  }

  return { flagged: false, reason: null };
}
