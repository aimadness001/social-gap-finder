"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type Company = {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string;
  has_instagram: boolean | null; // final answer (your answer wins over the automatic one)
  auto_has_instagram: boolean | null;
  instagram_url: string | null;
  instagram_source: "website" | "google" | null;
  google_checked: boolean;
  manual_instagram: boolean | null;
  contacted_at: string | null; // date Email 1 was sent
  emails_sent: number; // how many of the 3 sequence emails were sent (0-3)
  google_rating: number | null; // Google star rating, e.g. 4.8
  google_review_count: number | null; // total Google reviews (null = not loaded yet)
};

type SortBy = "most" | "fewest" | "name";

type Tab = "leads" | "noig" | "hasig" | "contacted";

// Leads     = new companies you haven't checked yet (and not known to have Instagram)
// No IG     = you confirmed they have no Instagram
// Has IG    = they have Instagram (found automatically or confirmed by you)
// Contacted = you marked them as contacted (they leave the other tabs)
function inTab(c: Company, tab: Tab): boolean {
  if (tab === "contacted") return c.contacted_at !== null;
  if (c.contacted_at !== null) return false;
  if (tab === "hasig") return c.has_instagram === true;
  if (tab === "noig") return c.manual_instagram === false;
  return c.manual_instagram === null && c.has_instagram !== true;
}

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "leads", label: "Leads", hint: "New companies to check" },
  { id: "noig", label: "No IG", hint: "You confirmed they have no Instagram" },
  { id: "hasig", label: "Has IG", hint: "Companies that have Instagram" },
  { id: "contacted", label: "Contacted", hint: "Companies you've reached out to" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---- 3-email outreach sequence (Day 1 / Day 4 / Day 8) ----
type Step = 1 | 2 | 3;
const STEP_NAME: Record<Step, string> = { 1: "Email 1 · Cold outreach", 2: "Email 2 · Follow-up", 3: "Email 3 · Final" };
const STEP_DAY_OFFSET: Record<Step, number> = { 1: 0, 2: 3, 3: 7 };

function sentCount(c: Company): number {
  return c.contacted_at ? Math.max(c.emails_sent || 0, 1) : 0;
}

function startOfDay(d: Date | string) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// The next email this company is waiting for, and when it's due.
function nextFollowUp(c: Company): { step: Step; due: Date; daysLeft: number } | null {
  const sent = sentCount(c);
  if (sent === 0 || sent >= 3 || !c.contacted_at) return null;
  const step = (sent + 1) as Step;
  const due = startOfDay(c.contacted_at);
  due.setDate(due.getDate() + STEP_DAY_OFFSET[step]);
  const daysLeft = Math.round((due.getTime() - startOfDay(new Date()).getTime()) / 864e5);
  return { step, due, daysLeft };
}

function isDue(c: Company) {
  const f = nextFollowUp(c);
  return f !== null && f.daysLeft <= 0;
}

type BulkDraft = {
  companyId: number;
  companyName: string;
  step?: Step;
  subject: string;
  body: string;
  error?: string;
};

const styles = {
  page: { maxWidth: 1160, margin: "0 auto", padding: "0 20px 80px" } as React.CSSProperties,
  card: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    padding: 20,
    boxShadow: "var(--shadow-card)",
  } as React.CSSProperties,
  badgeGap: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: "var(--brass-soft)",
    color: "var(--brass)",
    border: "1px solid var(--brass-border)",
  } as React.CSSProperties,
  badgeOk: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: "var(--sage-soft)",
    color: "var(--sage)",
    border: "1px solid var(--sage-border)",
  } as React.CSSProperties,
  badgeUnknown: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    color: "var(--muted)",
    border: "1px dashed var(--line)",
  } as React.CSSProperties,
  status: { fontSize: 14, color: "var(--muted)", marginTop: 12 } as React.CSSProperties,
  error: { fontSize: 14, color: "var(--rust)", marginTop: 12 } as React.CSSProperties,
  overlay: {
    position: "fixed",
    inset: 0,
    background: "var(--overlay)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 50,
  } as React.CSSProperties,
  modal: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    padding: 28,
    maxWidth: 580,
    width: "100%",
    maxHeight: "85vh",
    overflowY: "auto" as const,
    boxShadow: "var(--shadow-modal)",
  } as React.CSSProperties,
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  } as React.CSSProperties,
  modalTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 400,
    fontSize: 26,
    lineHeight: 1.15,
  } as React.CSSProperties,
  label: { fontSize: 13, color: "var(--muted)", fontWeight: 500 } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 260,
    background: "var(--field-bg)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    padding: 14,
    color: "var(--text)",
    fontSize: 14,
    lineHeight: 1.6,
    fontFamily: "inherit",
    resize: "vertical" as const,
  } as React.CSSProperties,
  subCard: {
    background: "var(--field-bg)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    padding: 16,
    marginBottom: 14,
  } as React.CSSProperties,
};

export default function Home() {
  const [query, setQuery] = useState("construction company");
  const [location, setLocation] = useState("Austin, TX");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState(""); // "" = show all cities
  const [websiteFilter, setWebsiteFilter] = useState(""); // "" | "has" | "none"
  const [tab, setTab] = useState<Tab>("leads");
  const [toast, setToast] = useState<{ id: number; message: string; undo: () => void } | null>(null);

  // Hide the "moved to…" message after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const [draftCompany, setDraftCompany] = useState<Company | null>(null);
  const [draftStep, setDraftStep] = useState<Step>(1);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("most");
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<BulkDraft[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const loadCompanies = useCallback(async (city?: string) => {
    try {
      const url = city ? `/api/companies?city=${encodeURIComponent(city)}` : "/api/companies";
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setCompanies(data.companies);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  async function handleInitDb() {
    setInitializing(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/init-db", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStatus("Database ready.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInitializing(false);
    }
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStatus(
        `Processed ${data.processed} of ${data.totalFound} companies found in ${data.city}. ` +
          `Showing all cities below — use the filter to narrow it down.` +
          (data.note ? ` ${data.note}` : "")
      );
      // Reload everything (not just this city) so past search results stay visible.
      await loadCompanies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetInstagram(company: Company, value: boolean | null) {
    setError(null);
    // Update the screen right away, then save.
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== company.id) return c;
        const finalAnswer = value === null ? c.auto_has_instagram : value;
        return { ...c, manual_instagram: value, has_instagram: finalAnswer };
      })
    );
    try {
      const res = await fetch(`/api/companies/${company.id}/instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch (err: any) {
      setError(`Couldn't save your Instagram answer: ${err.message}`);
      await loadCompanies();
    }
  }

  async function handleSetContacted(company: Company, contacted: boolean) {
    setError(null);
    const stamp = contacted ? new Date().toISOString() : null;
    setCompanies((prev) =>
      prev.map((c) => (c.id === company.id ? { ...c, contacted_at: stamp, emails_sent: contacted ? 1 : 0 } : c))
    );
    try {
      const res = await fetch(`/api/companies/${company.id}/contacted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacted }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch (err: any) {
      setError(`Couldn't save "contacted": ${err.message}`);
      await loadCompanies();
    }
  }

  // Where a company ends up after a change, in plain words for the message.
  function destinationLabel(c: Company): string {
    const t = TABS.find((t) => inTab(c, t.id));
    return t ? t.label : "Leads";
  }

  // If a change moves the company out of the tab you're looking at,
  // show a message saying where it went, with an Undo button.
  function announceMove(before: Company, after: Company, undo: () => void) {
    if (inTab(after, tab)) return;
    setToast({
      id: Date.now(),
      message: `${before.name} moved to ${destinationLabel(after)}`,
      undo,
    });
  }

  function markInstagram(c: Company, value: boolean | null) {
    const previous = c.manual_instagram;
    const finalAnswer = value === null ? c.auto_has_instagram : value;
    announceMove(c, { ...c, manual_instagram: value, has_instagram: finalAnswer }, () =>
      handleSetInstagram({ ...c, manual_instagram: value, has_instagram: finalAnswer }, previous)
    );
    handleSetInstagram(c, value);
  }

  function markContacted(c: Company, contacted: boolean) {
    const after = { ...c, contacted_at: contacted ? new Date().toISOString() : null, emails_sent: contacted ? 1 : 0 };
    announceMove(c, after, () => handleSetContacted(after, !contacted));
    handleSetContacted(c, contacted);
  }

  // Records that follow-up Email 2 or 3 was sent.
  async function saveEmailsSent(company: Company, sent: number) {
    setError(null);
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, emails_sent: sent } : c)));
    try {
      const res = await fetch(`/api/companies/${company.id}/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sent }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch (err: any) {
      setError(`Couldn't save the email status: ${err.message}`);
      await loadCompanies();
    }
  }

  // "Mark Email N as sent" — Email 1 moves the company to Contacted,
  // Emails 2 and 3 move it along the sequence.
  function markEmailSent(c: Company, step: Step) {
    if (step === 1) {
      if (!c.contacted_at) markContacted(c, true);
      return;
    }
    const previous = sentCount(c);
    saveEmailsSent(c, step);
    setToast({
      id: Date.now(),
      message: step === 3 ? `${c.name}: sequence finished` : `${c.name}: Email ${step} marked as sent`,
      undo: () => saveEmailsSent(c, previous),
    });
  }

  function instagramLookupUrl(c: Company) {
    // Instagram's own search needs you to be logged in and can't be linked to,
    // so this searches Google for their Instagram page instead.
    return `https://www.google.com/search?q=${encodeURIComponent(`${c.name} ${c.city} instagram`)}`;
  }

  function handleExport() {
    const url = cityFilter ? `/api/export?city=${encodeURIComponent(cityFilter)}` : "/api/export";
    window.open(url, "_blank");
  }

  const cities = useMemo(() => {
    const set = new Set(companies.map((c) => c.city));
    return Array.from(set).sort();
  }, [companies]);

  // City/website filters apply to every tab.
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (cityFilter && c.city !== cityFilter) return false;
      if (websiteFilter === "has" && !c.website) return false;
      if (websiteFilter === "none" && c.website) return false;
      return true;
    });
  }, [companies, cityFilter, websiteFilter]);

  const visibleCompanies = useMemo(() => {
    const list = filteredCompanies.filter((c) => inTab(c, tab));
    if (tab !== "contacted") {
      const count = (c: Company) => c.google_review_count ?? -1; // not loaded yet = last
      return [...list].sort((a, b) =>
        sortBy === "name"
          ? a.name.localeCompare(b.name)
          : sortBy === "fewest"
            ? (a.google_review_count ?? 1e9) - (b.google_review_count ?? 1e9) || a.name.localeCompare(b.name)
            : count(b) - count(a) || a.name.localeCompare(b.name)
      );
    }
    // Contacted tab: follow-ups due soonest at the top, finished sequences last.
    const order = (c: Company) => {
      const f = nextFollowUp(c);
      return f ? f.daysLeft : 9999;
    };
    return [...list].sort((a, b) => order(a) - order(b));
  }, [filteredCompanies, tab, sortBy]);

  const missingCounts = useMemo(() => companies.filter((c) => c.google_review_count === null).length, [companies]);

  // Fills in Google rating + review count for companies saved before the app
  // collected them (40 per round, repeats until done).
  async function handleLoadReviewCounts() {
    setLoadingCounts(true);
    setError(null);
    setStatus(null);
    try {
      let rounds = 0;
      while (rounds < 10) {
        rounds++;
        const res = await fetch("/api/review-counts", { method: "POST" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        await loadCompanies();
        if (data.remaining === 0 || data.updated === 0) {
          setStatus(
            data.remaining === 0
              ? "Google review counts loaded for all companies."
              : `Loaded what Google returned; ${data.remaining} still missing.`
          );
          break;
        }
      }
    } catch (err: any) {
      setError(`Couldn't load review counts: ${err.message}`);
    } finally {
      setLoadingCounts(false);
    }
  }

  const dueCount = useMemo(() => filteredCompanies.filter(isDue).length, [filteredCompanies]);

  const tabCounts = useMemo(() => {
    const counts = {} as Record<Tab, number>;
    for (const t of TABS) counts[t.id] = filteredCompanies.filter((c) => inTab(c, t.id)).length;
    return counts;
  }, [filteredCompanies]);

  async function handleDraftEmail(company: Company, step?: Step) {
    const s = step ?? (Math.min(sentCount(company) + 1, 3) as Step);
    setDraftCompany(company);
    setDraftStep(s);
    setDraftSubject("");
    setDraftBody("");
    setDraftError(null);
    setCopyStatus(null);
    setDraftLoading(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/draft?step=${s}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setDraftSubject(data.draft.subject);
      setDraftBody(data.draft.body);
    } catch (err: any) {
      setDraftError(err.message);
    } finally {
      setDraftLoading(false);
    }
  }

  function closeDraftModal() {
    setDraftCompany(null);
  }

  function openInEmailApp(subject: string, body: string) {
    // Encoded by hand (not URLSearchParams) because mailto links need %20 for
    // spaces — URLSearchParams uses "+" instead, which some desktop mail
    // clients (e.g. Outlook) leave as a literal plus sign instead of a space.
    const subjectParam = encodeURIComponent(subject);
    const bodyParam = encodeURIComponent(body);
    // Leading "?" with no address before it — opens a new blank-recipient
    // message with subject/body prefilled, ready for you to add the address
    // and hit send yourself.
    window.location.href = `mailto:?subject=${subjectParam}&body=${bodyParam}`;
  }

  function handleOpenInEmailApp() {
    openInEmailApp(draftSubject, draftBody);
  }

  // Opens a new Gmail message in a new tab with subject and body filled in.
  function openInGmail(subject: string, body: string) {
    const url =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      `&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener");
  }

  async function handleDraftAllVisible() {
    const leads =
      tab === "contacted"
        ? visibleCompanies.filter(isDue)
        : visibleCompanies;

    if (leads.length === 0) {
      setBulkError(
        tab === "contacted"
          ? "No follow-ups are due today in this view."
          : "No companies in the current view — nothing to draft."
      );
      setBulkOpen(true);
      setBulkDrafts([]);
      return;
    }

    setBulkOpen(true);
    setBulkLoading(true);
    setBulkError(null);
    setBulkDrafts([]);

    try {
      const results = await Promise.all(
        leads.map(async (c): Promise<BulkDraft> => {
          try {
            const res = await fetch(`/api/companies/${c.id}/draft`);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            return {
              companyId: c.id,
              companyName: c.name,
              step: data.step,
              subject: data.draft.subject,
              body: data.draft.body,
            };
          } catch (err: any) {
            return {
              companyId: c.id,
              companyName: c.name,
              subject: "",
              body: "",
              error: err.message,
            };
          }
        })
      );
      setBulkDrafts(results);
    } catch (err: any) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  }

  function closeBulkModal() {
    setBulkOpen(false);
  }

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus("Couldn't copy — select and copy manually.");
    }
  }


  const filtersActive = Boolean(cityFilter || websiteFilter);
  const emptyMessage: Record<Tab, string> = {
    leads: "No new companies to check. Search another city to find more.",
    noig: "None yet. Click \"No IG\" on a company in Leads to move it here.",
    hasig: "No companies with Instagram here yet.",
    contacted: "No one contacted yet. Open a company's email and click \"Mark Email 1 as sent\" after sending it.",
  };

  return (
    <div style={styles.page}>
      <header className="sg-hero">
        <h1 className="sg-title">Social Gap Finder</h1>
        <p className="sg-lede">
          Find renovation and construction companies that are hard to find online, then reach
          out with a pitch that fits.
        </p>
      </header>

      <section style={styles.card} aria-label="Search">
        <div className="sg-search-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="sg-field"
            style={{ flex: "2 1 240px" }}
            placeholder="What to search, e.g. home renovation"
            aria-label="Search term"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            className="sg-field"
            style={{ flex: "1.4 1 200px" }}
            placeholder="City, e.g. Mississauga, ON"
            aria-label="City"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) handleSearch();
            }}
          />
          <button className="sg-btn sg-btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? "Searching…" : "Find companies"}
          </button>
        </div>

        {status && <div style={styles.status}>{status}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <div
          style={{
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--line-soft)",
          }}
        >
          <button className="sg-btn sg-btn-quiet" onClick={handleDraftAllVisible}>
            {tab === "contacted" ? "Draft all due follow-ups" : "Draft emails for all leads"}
          </button>
          <button className="sg-btn sg-btn-quiet" onClick={handleExport}>
            Export CSV
          </button>
          {missingCounts > 0 && (
            <button
              className="sg-btn sg-btn-quiet"
              onClick={handleLoadReviewCounts}
              disabled={loadingCounts}
              title="Fetches the Google star rating and number of reviews for companies saved earlier"
            >
              {loadingCounts ? "Loading review counts…" : `Load Google review counts (${missingCounts})`}
            </button>
          )}
          <button
            className="sg-btn sg-btn-quiet"
            style={{ marginLeft: "auto" }}
            onClick={handleInitDb}
            disabled={initializing}
          >
            {initializing ? "Setting up…" : "Set up database"}
          </button>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          margin: "40px 0 16px",
        }}
      >
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 34, margin: 0, lineHeight: 1.1 }}>
            Your leads
          </h2>
          <p className="sg-num" style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
            <span style={{ color: "var(--brass)", fontWeight: 600 }}>{tabCounts.leads}</span> to check,{" "}
            {tabCounts.noig} with no Instagram, {tabCounts.contacted} contacted
            {dueCount > 0 && (
              <>
                {" · "}
                <button
                  className="sg-btn sg-btn-quiet"
                  style={{ color: "var(--rust)", fontWeight: 600, fontSize: 14, padding: 0 }}
                  onClick={() => setTab("contacted")}
                  title="Show the Contacted tab — due follow-ups are at the top"
                >
                  {dueCount} follow-up{dueCount === 1 ? "" : "s"} due
                </button>
              </>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            className="sg-field"
            aria-label="Filter by city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="">All cities ({companies.length})</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city} ({companies.filter((c) => c.city === city).length})
              </option>
            ))}
          </select>
          <select
            className="sg-field"
            aria-label="Sort companies"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            disabled={tab === "contacted"}
            title={tab === "contacted" ? "Contacted is sorted by follow-up due date" : undefined}
          >
            <option value="most">Most Google reviews</option>
            <option value="fewest">Fewest Google reviews</option>
            <option value="name">Name A–Z</option>
          </select>
          <select
            className="sg-field"
            aria-label="Filter by website"
            value={websiteFilter}
            onChange={(e) => setWebsiteFilter(e.target.value)}
          >
            <option value="">Any website</option>
            <option value="has">Has website</option>
            <option value="none">No website</option>
          </select>
        </div>
      </div>

      <section style={{ ...styles.card, padding: 0, overflow: "hidden" }} aria-label="Companies">
        <div className="sg-tabs" role="tablist" aria-label="Lead stages">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`sg-tab${tab === t.id ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
              title={t.hint}
            >
              {t.label}
              <span className="sg-tab-count sg-num">{tabCounts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="sg-table-wrap">
          <table className="sg-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Instagram</th>
                <th>Google reviews</th>
                <th>Contact</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {visibleCompanies.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "56px 16px", textAlign: "center", color: "var(--muted)" }}>
                    {companies.length === 0
                      ? "No companies yet. Search a city above to find your first leads."
                      : filtersActive && filteredCompanies.length === 0
                        ? "No companies match these filters. Try changing or clearing them."
                        : emptyMessage[tab]}
                  </td>
                </tr>
              )}
              {visibleCompanies.map((c) => (
                <tr key={c.id}>
                  <td style={{ maxWidth: 260 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                    {c.address && (
                      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{c.address}</div>
                    )}

                  </td>

                  <td style={{ minWidth: 230 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {c.has_instagram === false && (
                        <span style={styles.badgeGap}>
                          {c.manual_instagram === false
                            ? "No Instagram"
                            : c.google_checked
                              ? "No Instagram found"
                              : "No IG link on website"}
                        </span>
                      )}
                      {c.has_instagram === true && <span style={styles.badgeOk}>Has Instagram</span>}
                      {c.has_instagram === null && <span style={styles.badgeUnknown}>Not sure</span>}
                      {c.manual_instagram !== null && (
                        <span style={{ fontSize: 12, color: "var(--sage)" }} title="You confirmed this yourself">
                          ✓ Checked by you
                        </span>
                      )}
                    </div>

                    {c.instagram_url && c.has_instagram === true && (
                      <div style={{ marginTop: 6, fontSize: 13 }}>
                        <a href={c.instagram_url} target="_blank" rel="noreferrer">
                          {c.instagram_url.replace(/^https:\/\/www\.instagram\.com\/?/, "@").replace(/\/$/, "") ||
                            "Instagram"}
                        </a>
                        {c.manual_instagram === null && (
                          <span style={{ color: "var(--muted)" }}>
                            {" "}
                            on {c.instagram_source === "google" ? "Google" : "their website"}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      <a
                        className="sg-chip"
                        href={instagramLookupUrl(c)}
                        target="_blank"
                        rel="noreferrer"
                        title="Opens a Google search for their Instagram in a new tab"
                      >
                        Check Instagram
                      </a>
                      {c.manual_instagram === null ? (
                        <>
                          <button
                            className="sg-chip"
                            onClick={() => markInstagram(c, true)}
                            title="I checked: they DO have Instagram"
                          >
                            Has IG
                          </button>
                          <button
                            className="sg-chip"
                            onClick={() => markInstagram(c, false)}
                            title="I checked: they do NOT have Instagram"
                          >
                            No IG
                          </button>
                        </>
                      ) : (
                        <button
                          className="sg-chip"
                          onClick={() => markInstagram(c, null)}
                          title="Remove your answer and go back to the automatic result"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </td>


                  <td style={{ whiteSpace: "nowrap" }}>
                    {c.google_review_count === null ? (
                      <span style={{ fontSize: 13, color: "var(--muted)" }} title="Click “Load Google review counts” above">
                        Not loaded
                      </span>
                    ) : c.google_review_count === 0 ? (
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>No reviews</span>
                    ) : (
                      <>
                        <div className="sg-num" style={{ fontSize: 16, fontWeight: 600 }}>
                          {c.google_review_count.toLocaleString()}
                          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}> reviews</span>
                        </div>
                        {c.google_rating !== null && (
                          <div className="sg-num" style={{ fontSize: 13, color: "var(--brass)", marginTop: 3 }}>
                            ★ {c.google_rating.toFixed(1)}
                          </div>
                        )}
                      </>
                    )}
                  </td>

                  <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noreferrer">
                        Visit website
                      </a>
                    ) : (
                      <span
                        style={{ ...styles.badgeGap, color: "var(--rust)", background: "transparent", borderColor: "var(--rust)" }}
                        title="Google has no website listed for this company"
                      >
                        ⚑ No website
                      </span>
                    )}
                    <div className="sg-num" style={{ color: "var(--muted)", marginTop: 4 }}>
                      {c.phone || "No phone listed"}
                    </div>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
                      {(() => {
                        const sent = sentCount(c);
                        const f = nextFollowUp(c);
                        if (!c.contacted_at) {
                          return (
                            <button className="sg-btn sg-btn-ghost" style={{ fontSize: 13, padding: "8px 14px" }} onClick={() => handleDraftEmail(c, 1)}>
                              Draft email
                            </button>
                          );
                        }
                        if (!f) {
                          return (
                            <>
                              <div style={{ fontSize: 12, color: "var(--sage)", textAlign: "center" }}>✓ Sequence finished</div>
                              <button className="sg-btn sg-btn-quiet" style={{ fontSize: 13 }} onClick={() => handleDraftEmail(c, 3)}>
                                View emails
                              </button>
                            </>
                          );
                        }
                        const due = f.daysLeft <= 0;
                        return (
                          <>
                            <div
                              style={{
                                fontSize: 12,
                                textAlign: "center",
                                fontWeight: due ? 600 : 400,
                                color: due ? "var(--rust)" : "var(--muted)",
                              }}
                            >
                              {f.daysLeft < 0
                                ? `Email ${f.step} overdue (${formatDate(f.due.toISOString())})`
                                : f.daysLeft === 0
                                  ? `Email ${f.step} due today`
                                  : `Email ${f.step} due ${formatDate(f.due.toISOString())}`}
                            </div>
                            <button
                              className={`sg-btn ${due ? "sg-btn-primary" : "sg-btn-ghost"}`}
                              style={{ fontSize: 13, padding: "8px 14px" }}
                              onClick={() => handleDraftEmail(c, f.step)}
                            >
                              {f.step === 2 ? "Draft follow-up" : "Draft final email"}
                            </button>
                            <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                              {sent} of 3 sent
                            </div>
                          </>
                        );
                      })()}
                      {c.contacted_at ? (
                        <div style={{ fontSize: 12, color: "var(--sage)", textAlign: "center" }}>
                          ✓ Contacted {formatDate(c.contacted_at)}
                          <button
                            className="sg-btn sg-btn-quiet"
                            style={{ fontSize: 12, marginLeft: 8 }}
                            onClick={() => markContacted(c, false)}
                            title="Move back out of Contacted"
                          >
                            Undo
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {toast && (
        <div className="sg-toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          <button
            className="sg-btn sg-btn-quiet"
            style={{ color: "var(--brass)", fontWeight: 600 }}
            onClick={() => {
              toast.undo();
              setToast(null);
            }}
          >
            Undo
          </button>
          <button
            className="sg-btn sg-btn-quiet"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}

      {draftCompany && (
        <div className="sg-overlay" style={styles.overlay} onClick={closeDraftModal}>
          <div className="sg-modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{draftCompany.name}</div>
              <button className="sg-btn sg-btn-ghost" onClick={closeDraftModal}>
                Close
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }} role="tablist" aria-label="Email in sequence">
              {([1, 2, 3] as Step[]).map((n) => {
                const sent = sentCount(draftCompany) >= n;
                return (
                  <button
                    key={n}
                    role="tab"
                    aria-selected={draftStep === n}
                    className="sg-chip"
                    style={
                      draftStep === n
                        ? { background: "var(--brass-soft)", borderColor: "var(--brass)", color: "var(--brass)", fontWeight: 600 }
                        : undefined
                    }
                    onClick={() => handleDraftEmail(draftCompany, n)}
                  >
                    {sent ? "✓ " : ""}
                    {STEP_NAME[n]}
                  </button>
                );
              })}
            </div>

            {draftLoading && <div style={styles.status}>Loading…</div>}
            {draftError && <div style={styles.error}>{draftError}</div>}

            {!draftLoading && !draftError && (
              <>
                <label style={styles.label}>Subject</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 16 }}>
                  <input className="sg-field" style={{ flex: 1 }} value={draftSubject} readOnly />
                  <button className="sg-btn sg-btn-ghost" onClick={() => handleCopy(draftSubject, "Subject")}>
                    Copy
                  </button>
                </div>

                <label style={styles.label}>Body</label>
                <textarea style={{ ...styles.textarea, marginTop: 4 }} value={draftBody} readOnly />
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="sg-btn sg-btn-ghost" onClick={() => handleCopy(draftBody, "Body")}>
                    Copy body
                  </button>
                  <button className="sg-btn sg-btn-primary" onClick={() => openInGmail(draftSubject, draftBody)}>
                    Open in Gmail
                  </button>
                  <button className="sg-btn sg-btn-quiet" onClick={handleOpenInEmailApp}>
                    Other email app
                  </button>
                </div>

                {copyStatus && <div style={styles.status}>{copyStatus}</div>}

                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: "1px solid var(--line-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {(() => {
                    const live = companies.find((x) => x.id === draftCompany.id) ?? draftCompany;
                    const sent = sentCount(live);
                    if (sent >= draftStep) {
                      return (
                        <span style={{ fontSize: 13, color: "var(--sage)" }}>
                          ✓ Email {draftStep} marked as sent
                          {draftStep === 1 && live.contacted_at ? ` on ${formatDate(live.contacted_at)}` : ""}
                        </span>
                      );
                    }
                    if (draftStep > sent + 1) {
                      return (
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>
                          Send Email {sent + 1} first.
                        </span>
                      );
                    }
                    return (
                      <>
                        <button
                          className="sg-btn sg-btn-ghost"
                          onClick={() => {
                            markEmailSent(live, draftStep);
                            setDraftCompany({
                              ...live,
                              contacted_at: live.contacted_at ?? new Date().toISOString(),
                              emails_sent: draftStep,
                            });
                          }}
                        >
                          Mark Email {draftStep} as sent
                        </button>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {draftStep === 1
                            ? "Moves the company to Contacted. Follow-up is due in 3 days."
                            : draftStep === 2
                              ? "The final email will be due 4 days later."
                              : "Finishes the sequence for this company."}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {bulkOpen && (
        <div className="sg-overlay" style={styles.overlay} onClick={closeBulkModal}>
          <div className="sg-modal" style={{ ...styles.modal, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                {tab === "contacted" ? "Follow-ups due today" : "Email 1 for all leads in this view"}
              </div>
              <button className="sg-btn sg-btn-ghost" onClick={closeBulkModal}>
                Close
              </button>
            </div>

            {bulkLoading && <div style={styles.status}>Generating drafts for every lead…</div>}
            {bulkError && <div style={styles.error}>{bulkError}</div>}

            {!bulkLoading &&
              bulkDrafts.map((d) => (
                <div
                  key={d.companyId}
                  style={styles.subCard}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    {d.companyName}
                    {d.step && (
                      <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                        {STEP_NAME[d.step]}
                      </span>
                    )}
                  </div>

                  {d.error ? (
                    <div style={styles.error}>Couldn't generate a draft: {d.error}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                        Subject: {d.subject}
                      </div>
                      <textarea
                        style={{ ...styles.textarea, minHeight: 140 }}
                        value={d.body}
                        readOnly
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="sg-btn sg-btn-ghost"
                          onClick={() => handleCopy(d.subject, `${d.companyName} subject`)}
                        >
                          Copy subject
                        </button>
                        <button
                          className="sg-btn sg-btn-ghost"
                          onClick={() => handleCopy(d.body, `${d.companyName} body`)}
                        >
                          Copy body
                        </button>
                        <button className="sg-btn sg-btn-primary" onClick={() => openInGmail(d.subject, d.body)}>
                          Open in Gmail
                        </button>
                        {(() => {
                          const live = companies.find((x) => x.id === d.companyId);
                          if (!live || !d.step) return null;
                          return sentCount(live) >= d.step ? (
                            <span style={{ fontSize: 13, color: "var(--sage)", alignSelf: "center" }}>✓ Marked as sent</span>
                          ) : (
                            <button className="sg-btn sg-btn-ghost" onClick={() => markEmailSent(live, d.step!)}>
                              Mark as sent
                            </button>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              ))}

            {copyStatus && <div style={styles.status}>{copyStatus}</div>}

            {!bulkLoading && bulkDrafts.length > 0 && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {tab === "contacted"
                  ? "Only follow-ups that are due today or overdue are included."
                  : "Only companies with a social gap score above 0 in your current filtered view are included."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
