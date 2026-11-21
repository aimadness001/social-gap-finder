// Hameem's 3-email outreach sequences.
// Email 1 = Day 1 (cold outreach), Email 2 = Day 4 (follow-up), Email 3 = Day 8 (final).
// Only the company name changes per company; everything else is fixed wording.
//
// Two templates:
//  - "renovation": cinematic videos (Lens by AI) for renovation & construction companies
//  - "plumber":    AI receptionist for plumbing companies
// The plumber template is used automatically when the search that found the
// company (or the company's name) mentions plumbing.

export type EmailDraft = {
  subject: string;
  body: string;
};

export type SequenceStep = 1 | 2 | 3;

export type TemplateId = "renovation" | "plumber";

export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  renovation: "Renovation · Cinematic videos",
  plumber: "Plumber · AI receptionist",
};

// Picks the template from the search that found the company, falling back to
// its name (companies saved before searches were recorded have no search).
export function pickTemplate(searchQuery: string | null | undefined, companyName: string): TemplateId {
  const text = `${searchQuery || ""} ${companyName || ""}`.toLowerCase();
  return /plumb/.test(text) ? "plumber" : "renovation";
}

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
Instagram: @hameemnayyer

If you'd prefer not to hear from me, just reply "no thanks."`;

const PLUMBER_SIGNATURE = `Hameem Nayyer
AI Receptionists for Plumbing Companies
Instagram: @hameemnayyer

If you'd prefer not to hear from me, just reply "no thanks."`;

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

export function generateSequenceEmail(
  step: SequenceStep,
  fullName: string,
  template: TemplateId = "renovation"
): EmailDraft {
  if (template === "plumber") return plumberEmail(step, fullName);

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

// AI receptionist sequence for plumbing companies.
function plumberEmail(step: SequenceStep, fullName: string): EmailDraft {
  const companyName = cleanCompanyName(fullName);
  const greeting = `Hi ${companyName} team,`;
  const companys = possessive(companyName);

  if (step === 1) {
    return {
      subject: `Quick question about ${companys} missed calls`,
      body: `${greeting}

Quick question — what happens when a customer calls while you're under a sink or on another job?

For most plumbing companies, that call goes to voicemail, and the customer calls the next plumber on Google. With leaks and burst pipes, people rarely wait for a callback.

I fix that.

I set up an AI receptionist that answers every call 24/7 — including nights and weekends — books the job into your calendar, and texts you the customer's details right away. Emergency calls can be transferred straight to your cell.

Want me to set up a free demo with your company name, so you can call it and hear it for yourself?

If not, no worries.

${PLUMBER_SIGNATURE}`,
    };
  }

  if (step === 2) {
    return {
      subject: `Re: Quick question about ${companys} missed calls`,
      body: `${greeting}

Just following up on my email from a few days ago.

I know you're busy on jobs — and that's exactly when calls get missed.

Quick question — roughly how many calls go to voicemail in a typical week?

Even one or two extra booked jobs a month can make a real difference.

My offer of a free demo with your company name still stands — no cost and no commitment.

If the timing isn't right, no worries at all.

${PLUMBER_SIGNATURE}`,
    };
  }

  return {
    subject: "Last one from me",
    body: `${greeting}

Last email from me — I promise.

If you ever want every call answered — nights, weekends, and while you're on a job — feel free to reach out anytime. I'm happy to set up a free demo with your company name so you can hear how it sounds.

Wishing you a busy season ahead.

${PLUMBER_SIGNATURE}`,
  };
}
