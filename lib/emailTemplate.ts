// Hameem's 3-email outreach sequence for Lens by AI.
// Email 1 = Day 1 (cold outreach), Email 2 = Day 4 (follow-up), Email 3 = Day 8 (final).
// Only the company name changes per company; everything else is fixed wording.

export type EmailDraft = {
  subject: string;
  body: string;
};

export type SequenceStep = 1 | 2 | 3;

export const SAMPLE_LINK = "https://www.instagram.com/reel/DdIcBgmNxT9/";

// Days after Email 1 that each email is due (Day 1, Day 4, Day 8).
export const STEP_DAY_OFFSET: Record<SequenceStep, number> = { 1: 0, 2: 3, 3: 7 };

export const STEP_LABEL: Record<SequenceStep, string> = {
  1: "Email 1 · Cold outreach",
  2: "Email 2 · Follow-up",
  3: "Email 3 · Final",
};

const SIGNATURE = `Hameem Nayyer
Cinematic Video Creator for Renovation & Construction Companies
Instagram: @hameemnayyer`;

// "Smith Renovations" -> "Smith Renovations'", "Peel Homes Inc" -> "Peel Homes Inc's"
function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`;
}

// Google names often carry extra keywords: "Teamwork Home Designs - General
// Contractor Austin" -> "Teamwork Home Designs". Only splits on spaced
// separators, so names like "Jean-Paul Renovations" stay whole.
export function cleanCompanyName(name: string): string {
  const first = name.split(/\s+[-–—|•]\s+|\s*\|\s*|:\s+/)[0].trim();
  return first.length >= 2 ? first : name.trim();
}

export function generateSequenceEmail(step: SequenceStep, fullName: string): EmailDraft {
  const companyName = cleanCompanyName(fullName);
  const greeting = `Hi ${companyName} team,`;
  const companys = possessive(companyName);

  if (step === 1) {
    return {
      subject: `Quick question about ${companys} project photos`,
      body: `${greeting}

Most renovation companies I talk to have hundreds of project photos sitting on their phone doing nothing.

Meanwhile, their competitors are posting cinematic content and winning clients that should be theirs.

I fix that.

I transform your existing project photos into cinematic videos ready to post on Instagram and TikTok within 2-4 days — no camera crew, no site visits, no extra filming needed.

Here's a recent example: ${SAMPLE_LINK}

Worth a look? If not, no worries.

${SIGNATURE}`,
    };
  }

  if (step === 2) {
    return {
      subject: `Re: Quick question about ${companys} project photos`,
      body: `${greeting}

Just following up on my email from a few days ago.

I know things get busy on site — totally understand.

Quick question — do you have any upcoming projects where cinematic video content could help showcase your work?

Even one video can make a significant difference in how premium your brand looks online.

Here's the example again if you missed it: ${SAMPLE_LINK}

If the timing isn't right, no worries at all.

${SIGNATURE}`,
    };
  }

  return {
    subject: "Last one from me",
    body: `${greeting}

Last email from me — I promise.

If you ever want to see what your renovation projects could look like as cinematic social media videos — entirely from your existing photos — feel free to reach out anytime.

Here's my work if you're ever curious: ${SAMPLE_LINK}

Wishing you continued success with your projects.

${SIGNATURE}`,
  };
}
