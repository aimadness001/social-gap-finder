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

type BulkDraft = {
  companyId: number;
  companyName: string;
  subject: string;
  body: string;
  error?: string;
};

const styles = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "32px 20px" } as React.CSSProperties,
  h1: { fontSize: 24, marginBottom: 4 } as React.CSSProperties,
  subtitle: { color: "#9a9a9a", marginBottom: 28, fontSize: 14 } as React.CSSProperties,
  card: {
    background: "#181b22",
    border: "1px solid #262a33",
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
  } as React.CSSProperties,
  row: { display: "flex", gap: 12, flexWrap: "wrap" } as React.CSSProperties,
  input: {
    background: "#0f1115",
    border: "1px solid #333844",
    borderRadius: 6,
    padding: "10px 12px",
    color: "#e6e6e6",
    fontSize: 14,
    flex: 1,
    minWidth: 180,
  } as React.CSSProperties,
  button: {
    background: "#3b6fd6",
    border: "none",
    borderRadius: 6,
    padding: "10px 18px",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,
  buttonSecondary: {
    background: "transparent",
    border: "1px solid #333844",
    borderRadius: 6,
    padding: "10px 18px",
    color: "#e6e6e6",
    fontSize: 14,
    cursor: "pointer",
  } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: {
    textAlign: "left" as const,
    padding: "10px 8px",
    borderBottom: "1px solid #262a33",
    color: "#9a9a9a",
    fontWeight: 600,
  },
  td: { padding: "10px 8px", borderBottom: "1px solid #1c1f26" },
  badgeGap: {
    background: "#3b2020",
    color: "#ff8a8a",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 12,
  } as React.CSSProperties,
  badgeOk: {
    background: "#1e3320",
    color: "#7fdb8a",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 12,
  } as React.CSSProperties,
  badgeUnknown: {
    background: "#2a2a2a",
    color: "#aaa",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 12,
  } as React.CSSProperties,
  status: { fontSize: 13, color: "#9a9a9a", marginTop: 10 } as React.CSSProperties,
  error: { fontSize: 13, color: "#ff8a8a", marginTop: 10 } as React.CSSProperties,
  linkButton: {
    background: "transparent",
    border: "1px solid #333844",
    borderRadius: 6,
    padding: "4px 10px",
    color: "#7aa2ff",
    fontSize: 12,
    cursor: "pointer",
  } as React.CSSProperties,
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 50,
  } as React.CSSProperties,
  modal: {
    background: "#181b22",
    border: "1px solid #262a33",
    borderRadius: 10,
    padding: 24,
    maxWidth: 560,
    width: "100%",
    maxHeight: "80vh",
    overflowY: "auto" as const,
  } as React.CSSProperties,
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 260,
    background: "#0f1115",
    border: "1px solid #333844",
    borderRadius: 6,
    padding: 12,
    color: "#e6e6e6",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
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
  const [instagramFilter, setInstagramFilter] = useState(""); // "" | "has" | "none" | "unknown"
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

  const visibleCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (cityFilter && c.city !== cityFilter) return false;

      if (websiteFilter === "has" && !c.website) return false;
      if (websiteFilter === "none" && c.website) return false;

      if (instagramFilter === "has" && c.has_instagram !== true) return false;
      if (instagramFilter === "none" && c.has_instagram !== false) return false;
      if (instagramFilter === "unknown" && c.has_instagram !== null) return false;

      return true;
    });
  }, [companies, cityFilter, websiteFilter, instagramFilter]);

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

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Social Gap Finder</h1>
      <p style={styles.subtitle}>
        Finds construction/renovation companies with no Instagram or with customer reviews
        complaining about their online presence — ranked as sales leads.
      </p>

      <div style={styles.card}>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Search term, e.g. construction company"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="City, e.g. Austin, TX"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <button style={styles.button} onClick={handleSearch} disabled={loading}>
            {loading ? "Searching…" : "Run Search"}
          </button>
        </div>
        <div style={styles.row}>
          <button style={styles.buttonSecondary} onClick={handleInitDb} disabled={initializing}>
            {initializing ? "Setting up…" : "First time? Initialize database"}
          </button>
          <button style={styles.buttonSecondary} onClick={handleExport}>
            Export CSV
          </button>
          <button style={styles.buttonSecondary} onClick={handleDraftAllVisible}>
            Draft all outreach emails
          </button>
        </div>
        {status && <div style={styles.status}>{status}</div>}
        {error && <div style={styles.error}>{error}</div>}
      </div>

      <div style={{ ...styles.row, marginBottom: 12, alignItems: "center" }}>
        <label style={{ fontSize: 13, color: "#9a9a9a" }}>City:</label>
        <select
          style={{ ...styles.input, flex: "none", minWidth: 180 }}
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

        <label style={{ fontSize: 13, color: "#9a9a9a" }}>Website:</label>
        <select
          style={{ ...styles.input, flex: "none", minWidth: 150 }}
          value={websiteFilter}
          onChange={(e) => setWebsiteFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="has">Has website</option>
          <option value="none">No website</option>
        </select>

        <label style={{ fontSize: 13, color: "#9a9a9a" }}>Instagram:</label>
        <select
          style={{ ...styles.input, flex: "none", minWidth: 150 }}
          value={instagramFilter}
          onChange={(e) => setInstagramFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="has">Has Instagram</option>
          <option value="none">No Instagram (leads)</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Company</th>
              <th style={styles.th}>Instagram</th>
              <th style={styles.th}>Flagged Reviews</th>
              <th style={styles.th}>Score</th>
              <th style={styles.th}>Website</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Outreach</th>
            </tr>
          </thead>
          <tbody>
            {visibleCompanies.length === 0 && (
              <tr>
                <td style={styles.td} colSpan={7}>
                  {companies.length === 0
                    ? "No companies yet. Run a search above."
                    : "No companies match this city filter."}
                </td>
              </tr>
            )}
            {visibleCompanies.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
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
                        <span style={{ fontSize: 11, color: "#7fdb8a" }} title="You confirmed this yourself">
                          ✔ checked by you
                        </span>
                      )}
                    </div>

                    {c.instagram_url && c.has_instagram === true && (
                      <a
                        href={c.instagram_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#7aa2ff", fontSize: 12 }}
                      >
                        {c.instagram_url.replace(/^https:\/\/www\.instagram\.com\/?/, "@").replace(/\/$/, "") || "Instagram"}
                        {c.manual_instagram === null && (
                          <span style={{ color: "#777" }}>
                            {" "}
                            (found on {c.instagram_source === "google" ? "Google" : "their website"})
                          </span>
                        )}
                      </a>
                    )}

                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <a
                        href={instagramLookupUrl(c)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...styles.linkButton, textDecoration: "none" }}
                        title="Opens a Google search for their Instagram in a new tab"
                      >
                        Check Instagram
                      </a>
                      {c.manual_instagram === null ? (
                        <>
                          <button
                            style={styles.linkButton}
                            onClick={() => handleSetInstagram(c, true)}
                            title="I checked — they DO have Instagram"
                          >
                            Yes, has IG
                          </button>
                          <button
                            style={styles.linkButton}
                            onClick={() => handleSetInstagram(c, false)}
                            title="I checked — they do NOT have Instagram"
                          >
                            No, confirmed
                          </button>
                        </>
                      ) : (
                        <button
                          style={styles.linkButton}
                          onClick={() => handleSetInstagram(c, null)}
                          title="Remove your answer and go back to the automatic result"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{c.flagged_review_count}</span>
                    {c.flagged_review_count > 0 && (
                      <button style={styles.linkButton} onClick={() => handleViewReviews(c, false)}>
                        view flagged
                      </button>
                    )}
                    <button style={styles.linkButton} onClick={() => handleViewReviews(c, true)}>
                      view all
                    </button>
                  </div>
                </td>
                <td style={styles.td}>{c.social_gap_score}</td>
                <td style={styles.td}>
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noreferrer" style={{ color: "#7aa2ff" }}>
                      site
                    </a>
                  ) : (
                    <span style={styles.badgeGap}>No website</span>
                  )}
                </td>
                <td style={styles.td}>{c.phone || "—"}</td>
                <td style={styles.td}>
                  <button style={styles.linkButton} onClick={() => handleDraftEmail(c)}>
                    Draft email
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draftCompany && (
        <div style={styles.overlay} onClick={closeDraftModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <strong>Outreach draft — {draftCompany.name}</strong>
              <button style={styles.buttonSecondary} onClick={closeDraftModal}>
                Close
              </button>
            </div>

            {draftLoading && <div style={styles.status}>Generating…</div>}
            {draftError && <div style={styles.error}>{draftError}</div>}

            {!draftLoading && !draftError && (
              <>
                <label style={{ fontSize: 12, color: "#9a9a9a" }}>Subject</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 16 }}>
                  <input style={styles.input} value={draftSubject} readOnly />
                  <button style={styles.buttonSecondary} onClick={() => handleCopy(draftSubject, "Subject")}>
                    Copy
                  </button>
                </div>

                <label style={{ fontSize: 12, color: "#9a9a9a" }}>Body</label>
                <textarea style={{ ...styles.textarea, marginTop: 4 }} value={draftBody} readOnly />
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={styles.buttonSecondary} onClick={() => handleCopy(draftBody, "Body")}>
                    Copy body
                  </button>
                  <button style={styles.button} onClick={handleOpenInEmailApp}>
                    Open in email app
                  </button>
                </div>

                {copyStatus && <div style={styles.status}>{copyStatus}</div>}
                <p style={{ fontSize: 12, color: "#9a9a9a", marginTop: 12 }}>
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
        <div style={styles.overlay} onClick={closeReviewsModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <strong>
                {reviewsShowingAll ? "All reviews" : "Flagged reviews"} — {reviewsCompany.name}
              </strong>
              <button style={styles.buttonSecondary} onClick={closeReviewsModal}>
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
                    background: "#0f1115",
                    border: r.flagged_social_complaint ? "1px solid #7a3030" : "1px solid #333844",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#9a9a9a", marginBottom: 6 }}>
                    {r.rating !== null && <span>Rating: {r.rating}/5</span>}
                    {r.review_date && <span> · {r.review_date}</span>}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>{r.review_text}</div>
                  {r.flag_reason && (
                    <div style={{ fontSize: 11, color: "#ff8a8a" }}>Flagged: {r.flag_reason}</div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {bulkOpen && (
        <div style={styles.overlay} onClick={closeBulkModal}>
          <div style={{ ...styles.modal, maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <strong>Draft outreach emails — all leads in current view</strong>
              <button style={styles.buttonSecondary} onClick={closeBulkModal}>
                Close
              </button>
            </div>

            {bulkLoading && <div style={styles.status}>Generating drafts for every lead…</div>}
            {bulkError && <div style={styles.error}>{bulkError}</div>}

            {!bulkLoading &&
              bulkDrafts.map((d) => (
                <div
                  key={d.companyId}
                  style={{
                    background: "#0f1115",
                    border: "1px solid #333844",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{d.companyName}</div>

                  {d.error ? (
                    <div style={styles.error}>Couldn't generate a draft: {d.error}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: "#9a9a9a", marginBottom: 4 }}>
                        Subject: {d.subject}
                      </div>
                      <textarea
                        style={{ ...styles.textarea, minHeight: 140 }}
                        value={d.body}
                        readOnly
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          style={styles.buttonSecondary}
                          onClick={() => handleCopy(d.subject, `${d.companyName} subject`)}
                        >
                          Copy subject
                        </button>
                        <button
                          style={styles.buttonSecondary}
                          onClick={() => handleCopy(d.body, `${d.companyName} body`)}
                        >
                          Copy body
                        </button>
                        <button style={styles.button} onClick={() => openInEmailApp(d.subject, d.body)}>
                          Open in email app
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

            {copyStatus && <div style={styles.status}>{copyStatus}</div>}

            {!bulkLoading && bulkDrafts.length > 0 && (
              <p style={{ fontSize: 12, color: "#9a9a9a", marginTop: 4 }}>
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
