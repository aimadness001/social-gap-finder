// Keyword-based detection of reviews that complain about a company's online /
// social media presence. No AI call needed for v1 — cheap, fast, and good
// enough to surface candidates worth reading. Swap in an AI classification
// pass later (see README) if you want higher precision at higher cost.

const COMPLAINT_PHRASES = [
  // No website
  "no website",
  "don't have a website",
  "doesn't have a website",
  "didn't have a website",
  "no site",
  "without a website",
  "not even a website",

  // No social media / social presence
  "no social media",
  "not on social media",
  "no instagram",
  "no facebook",
  "no facebook page",
  "no online presence",
  "no digital presence",
  "not online",
  "don't have social media",
  "no online portfolio",
  "no photos online",
  "couldn't see their work online",
  "couldn't see any photos",
  "no reviews online",
  "no online reviews",

  // Hard to find / hard to research
  "couldn't find them online",
  "couldn't find them on",
  "can't find them online",
  "can't find any info",
  "couldn't find any information",
  "hard to find online",
  "hard to find them online",
  "hard to find any information",
  "hard to research",
  "nothing comes up when i search",
  "nothing came up when i searched",
  "not searchable",
  "not listed online",
  "no listing online",

  // Unresponsive / hard to reach
  "hard to reach",
  "hard to get in touch",
  "hard to get ahold of",
  "hard to get a hold of",
  "never responded",
  "never got back to me",
  "never called back",
  "never called me back",
  "didn't call back",
  "didn't return my call",
  "did not return my call",
  "no response to my message",
  "no response to messages",
  "ignored my message",
  "ignored my messages",
  "no way to contact",
  "no way to reach them",
  "no way to get in touch",
  "couldn't get in touch",
  "couldn't reach anyone",
  "phone number doesn't work",
  "phone number didn't work",
  "wrong phone number",
  "voicemail was full",
  "no one answers the phone",
  "no one ever answers",

  // Outdated / broken web presence
  "outdated website",
  "website is outdated",
  "website doesn't work",
  "website is down",
  "website was down",
  "broken website",
  "broken link",
  "website is broken",
  "old website",
  "hasn't been updated",
  "not been updated in years",
  "looks outdated",

  // No online booking / scheduling
  "couldn't book online",
  "no way to book online",
  "can't book online",
  "no online booking",
  "no online scheduling",
  "had to call to book",
  "only way to book is by phone",

  // Word-of-mouth-only signals
  "only found out through a friend",
  "heard about them from a neighbor",
  "word of mouth only",
  "no way to look them up",
];

export type ComplaintCheckResult = {
  flagged: boolean;
  reason: string | null;
};

// Reviews at or below this star rating get flagged automatically, regardless
// of what they say — an unhappy customer is worth a look on its own, and
// Google only ever gives us up to 5 reviews with no way to ask for the
// negative ones specifically, so this is how we surface them among what we
// do get.
const LOW_RATING_THRESHOLD = 2;

export function checkReviewForComplaint(reviewText: string): ComplaintCheckResult {
  const text = reviewText.toLowerCase();

  for (const phrase of COMPLAINT_PHRASES) {
    if (text.includes(phrase)) {
      return { flagged: true, reason: `matched phrase: "${phrase}"` };
    }
  }

  return { flagged: false, reason: null };
}

// Combines the keyword check with a low-rating check. Use this one from the
// search pipeline; checkReviewForComplaint stays available on its own for
// text-only checks.
export function checkReview(reviewText: string, rating: number | null): ComplaintCheckResult {
  const keywordResult = checkReviewForComplaint(reviewText);
  if (keywordResult.flagged) return keywordResult;

  if (rating !== null && rating <= LOW_RATING_THRESHOLD) {
    return { flagged: true, reason: `low rating (${rating}/5)` };
  }

  return { flagged: false, reason: null };
}
