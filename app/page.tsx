"use client";

import { useState, useEffect, useCallback } from "react";

type Company = {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string;
  has_instagram: boolean | null;
  flagged_review_count: number;
  social_gap_score: number;
};

type Review = {
  id: number;
  review_text: string | null;
  rating: number | null;
  review_date: string | null;
  flag_reason: string | null;
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
  const [cityFilter, setCityFilter] = useState("");
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
        `Processed ${data.processed} of ${data.totalFound} companies found in ${data.city}.` +
          (data.note ? ` ${data.note}` : "")
      );
      setCityFilter(location);
      await loadCompanies(location);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const url = cityFilter ? `/api/export?city=${encodeURIComponent(cityFilter)}` : "/api/export";
    window.open(url, "_blank");
  }

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

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus("Couldn't copy — select and copy manually.");
    }
  }

  async function handleViewReviews(company: Company) {
    setReviewsCompany(company);
    setReviews([]);
    setReviewsError(null);
    setReviewsLoading(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/reviews`);
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
        </div>
        {status && <div style={styles.status}>{status}</div>}
        {error && <div style={styles.error}>{error}</div>}
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
            {companies.length === 0 && (
              <tr>
                <td style={styles.td} colSpan={7}>
                  No companies yet. Run a search above.
                </td>
              </tr>
            )}
            {companies.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}>
                  {c.has_instagram === false && <span style={styles.badgeGap}>No Instagram</span>}
                  {c.has_instagram === true && <span style={styles.badgeOk}>Has Instagram</span>}
                  {c.has_instagram === null && <span style={styles.badgeUnknown}>Unknown</span>}
                </td>
                <td style={styles.td}>
                  {c.flagged_review_count > 0 ? (
                    <button style={styles.linkButton} onClick={() => handleViewReviews(c)}>
                      {c.flagged_review_count} — view
                    </button>
                  ) : (
                    0
                  )}
                </td>
                <td style={styles.td}>{c.social_gap_score}</td>
                <td style={styles.td}>
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noreferrer" style={{ color: "#7aa2ff" }}>
                      site
                    </a>
                  ) : (
                    "—"
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
                <div style={{ marginTop: 8 }}>
                  <button style={styles.buttonSecondary} onClick={() => handleCopy(draftBody, "Body")}>
                    Copy body
                  </button>
                </div>

                {copyStatus && <div style={styles.status}>{copyStatus}</div>}
                <p style={{ fontSize: 12, color: "#9a9a9a", marginTop: 12 }}>
                  This is a starting point — personalize it before sending. Fill in your name and
                  contact info at the bottom.
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
              <strong>Flagged reviews — {reviewsCompany.name}</strong>
              <button style={styles.buttonSecondary} onClick={closeReviewsModal}>
                Close
              </button>
            </div>

            {reviewsLoading && <div style={styles.status}>Loading…</div>}
            {reviewsError && <div style={styles.error}>{reviewsError}</div>}

            {!reviewsLoading && !reviewsError && reviews.length === 0 && (
              <div style={styles.status}>No flagged reviews found.</div>
            )}

            {!reviewsLoading &&
              !reviewsError &&
              reviews.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: "#0f1115",
                    border: "1px solid #333844",
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
    </div>
  );
}
