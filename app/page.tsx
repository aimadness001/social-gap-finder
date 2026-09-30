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
  contacted_at: string | null;
  flagged_review_count: number;
  social_gap_score: number;
};

type Review = {
  id: number;
  review_text: string | null;
  rating: number | null;
  review_date: string | null;
  flag_reason: string | null;
  flagged_social_complaint?: boolean;
};

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

type BulkDraft = {
  companyId: number;
  companyName: string;
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
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [reviewsCompany, setReviewsCompany] = useState<Company | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsShowingAll, setReviewsShowingAll] = useState(false);
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
        const gapPoints = (v: boolean | null) => (v === false ? 2 : 0);
        return {
          ...c,
          manual_instagram: value,
          has_instagram: finalAnswer,
          social_gap_score: c.social_gap_score - gapPoints(c.has_instagram) + gapPoints(finalAnswer),
        };
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
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, contacted_at: stamp } : c)));
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
    const after = { ...c, contacted_at: contacted ? new Date().toISOString() : null };
    announceMove(c, after, () => handleSetContacted(after, !contacted));
    handleSetContacted(c, contacted);
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

  const visibleCompanies = useMemo(
    () => filteredCompanies.filter((c) => inTab(c, tab)),
    [filteredCompanies, tab]
  );

  const tabCounts = useMemo(() => {
    const counts = {} as Record<Tab, number>;
    for (const t of TABS) counts[t.id] = filteredCompanies.filter((c) => inTab(c, t.id)).length;
    return counts;
  }, [filteredCompanies]);

  async function handleDraftEmail(company: Company) {
    setDraftCompany(company);
    setDraftSubject("");
    setDraftBody("");
    setDraftError(null);
    setCopyStatus(null);
    setDraftLoading(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/draft`);
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

  async function handleDraftAllVisible() {
    const leads = visibleCompanies.filter((c) => c.social_gap_score > 0);

    if (leads.length === 0) {
      setBulkError(
        "No companies with a social gap score above 0 in the current view — nothing to draft."
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

  async function handleViewReviews(company: Company, all: boolean) {
    setReviewsCompany(company);
    setReviews([]);
    setReviewsError(null);
    setReviewsShowingAll(all);
    setReviewsLoading(true);
    try {
      const url = `/api/companies/${company.id}/reviews${all ? "?all=true" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setReviews(data.reviews);
    } catch (err: any) {
      setReviewsError(err.message);
    } finally {
      setReviewsLoading(false);
    }
  }

  function closeReviewsModal() {
    setReviewsCompany(null);
  }

  const filtersActive = Boolean(cityFilter || websiteFilter);
  const emptyMessage: Record<Tab, string> = {
    leads: "No new companies to check. Search another city to find more.",
    noig: "None yet. Click \"No IG\" on a company in Leads to move it here.",
    hasig: "No companies with Instagram here yet.",
    contacted: "No one contacted yet. Use \"Mark contacted\" after you reach out to a company.",
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
            Draft emails for all leads
          </button>
          <button className="sg-btn sg-btn-quiet" onClick={handleExport}>
            Export CSV
          </button>
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
                <th>Reviews</th>
                <th title="Higher = bigger social media gap = better lead">Score</th>
                <th>Contact</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {visibleCompanies.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "56px 16px", textAlign: "center", color: "var(--muted)" }}>
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

                  <td>
                    <div className="sg-num" style={{ fontSize: 14 }}>
                      {c.flagged_review_count > 0 ? (
                        <span style={{ color: "var(--brass)", fontWeight: 600 }}>
                          {c.flagged_review_count} flagged
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>None flagged</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      {c.flagged_review_count > 0 && (
                        <button className="sg-btn sg-btn-quiet" style={{ fontSize: 13 }} onClick={() => handleViewReviews(c, false)}>
                          View flagged
                        </button>
                      )}
                      <button className="sg-btn sg-btn-quiet" style={{ fontSize: 13 }} onClick={() => handleViewReviews(c, true)}>
                        View all
                      </button>
                    </div>
                  </td>

                  <td>
                    <span
                      className="sg-num"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 34,
                        height: 34,
                        borderRadius: 999,
                        fontWeight: 700,
                        fontSize: 15,
                        background: c.social_gap_score > 0 ? "var(--brass-soft)" : "transparent",
                        color: c.social_gap_score > 0 ? "var(--brass)" : "var(--muted)",
                        border: c.social_gap_score > 0 ? "1px solid var(--brass-border)" : "1px solid var(--line)",
                      }}
                    >
                      {c.social_gap_score}
                    </span>
                  </td>

                  <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noreferrer">
                        Visit website
                      </a>
                    ) : (
                      <span style={{ color: "var(--brass)" }}>No website</span>
                    )}
                    <div className="sg-num" style={{ color: "var(--muted)", marginTop: 4 }}>
                      {c.phone || "No phone listed"}
                    </div>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
                      <button className="sg-btn sg-btn-ghost" style={{ fontSize: 13, padding: "8px 14px" }} onClick={() => handleDraftEmail(c)}>
                        Draft email
                      </button>
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
                      ) : (
                        <button
                          className="sg-btn sg-btn-quiet"
                          style={{ fontSize: 13 }}
                          onClick={() => markContacted(c, true)}
                        >
                          Mark contacted
                        </button>
                      )}
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
              <div style={styles.modalTitle}>Outreach draft — {draftCompany.name}</div>
              <button className="sg-btn sg-btn-ghost" onClick={closeDraftModal}>
                Close
              </button>
            </div>

            {draftLoading && <div style={styles.status}>Generating…</div>}
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
                  <button className="sg-btn sg-btn-primary" onClick={handleOpenInEmailApp}>
                    Open in email app
                  </button>
                </div>

                {copyStatus && <div style={styles.status}>{copyStatus}</div>}
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                  "Open in email app" launches your default email program (Outlook, Mail, etc.)
                  with the subject and body already filled in — just add the recipient's address
                  and hit send. This is a starting point — personalize it before sending, and fill
                  in your name and contact info at the bottom.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {reviewsCompany && (
        <div className="sg-overlay" style={styles.overlay} onClick={closeReviewsModal}>
          <div className="sg-modal" style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                {reviewsShowingAll ? "All reviews" : "Flagged reviews"} — {reviewsCompany.name}
              </div>
              <button className="sg-btn sg-btn-ghost" onClick={closeReviewsModal}>
                Close
              </button>
            </div>

            {reviewsLoading && <div style={styles.status}>Loading…</div>}
            {reviewsError && <div style={styles.error}>{reviewsError}</div>}

            {!reviewsLoading && !reviewsError && reviews.length === 0 && (
              <div style={styles.status}>
                {reviewsShowingAll
                  ? "No reviews were saved for this company (Google may not have returned any)."
                  : "No flagged reviews found."}
              </div>
            )}

            {!reviewsLoading &&
              !reviewsError &&
              reviews.map((r) => (
                <div
                  key={r.id}
                  style={{
                    ...styles.subCard,
                    borderColor: r.flagged_social_complaint ? "var(--brass)" : "var(--line)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    {r.rating !== null && <span>Rating: {r.rating}/5</span>}
                    {r.review_date && <span style={{ marginLeft: 12 }}>{r.review_date}</span>}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 6 }}>{r.review_text}</div>
                  {r.flag_reason && (
                    <div style={{ fontSize: 11, color: "var(--brass)" }}>Flagged: {r.flag_reason}</div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="sg-overlay" style={styles.overlay} onClick={closeBulkModal}>
          <div className="sg-modal" style={{ ...styles.modal, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Draft outreach emails — all leads in current view</div>
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
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{d.companyName}</div>

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
                        <button className="sg-btn sg-btn-primary" onClick={() => openInEmailApp(d.subject, d.body)}>
                          Open in email app
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

            {copyStatus && <div style={styles.status}>{copyStatus}</div>}

            {!bulkLoading && bulkDrafts.length > 0 && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Only companies with a social gap score above 0 in your current filtered view are
                included. Personalize each one before sending, and fill in your name/contact info.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
