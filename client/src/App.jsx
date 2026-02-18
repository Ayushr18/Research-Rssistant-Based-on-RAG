import { useState, useEffect } from "react";
import axios from "axios";
import {
  Search, BookOpen, Brain, Loader2, AlertCircle,
  ChevronRight, FileText, Users, Calendar,
  ExternalLink, Database, Sparkles, Hash, Trash2
} from "lucide-react";

const API = "http://localhost:3001/api";

// ─── SOURCES CONFIG ───
const SOURCES = [
  {
    id: "arxiv",
    label: "ArXiv",
    color: "#f0a500",
    fields: "CS · AI · Physics · Math",
  },
  {
    id: "semantic",
    label: "Semantic Scholar",
    color: "#60a5fa",
    fields: "All Fields",
  },
  {
    id: "pubmed",
    label: "PubMed",
    color: "#4ade80",
    fields: "Medical · Biology · Chemistry",
  },
  {
    id: "chemrxiv",
    label: "ChemRxiv",
    color: "#f472b6",
    fields: "Chemistry · Chemical Engineering",
  },
];

// ─── SMALL COMPONENTS ───

function Badge({ children, color = "default" }) {
  const colors = {
    default: { bg: "rgba(42,45,58,0.8)", text: "#9096a8", border: "#2a2d3a" },
    gold: { bg: "rgba(240,165,0,0.1)", text: "#f0a500", border: "rgba(240,165,0,0.3)" },
    green: { bg: "rgba(74,222,128,0.1)", text: "#4ade80", border: "rgba(74,222,128,0.3)" },
    blue: { bg: "rgba(96,165,250,0.1)", text: "#60a5fa", border: "rgba(96,165,250,0.3)" },
    pink: { bg: "rgba(244,114,182,0.1)", text: "#f472b6", border: "rgba(244,114,182,0.3)" },
  };
  const c = colors[color];
  return (
    <span style={{
      background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      padding: "2px 10px", borderRadius: "20px",
      fontSize: "11px", fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 500, letterSpacing: "0.03em",
    }}>
      {children}
    </span>
  );
}

function SourceBadge({ source }) {
  const map = { arxiv: "gold", semantic: "blue", pubmed: "green", chemrxiv: "pink" };
  const labels = { arxiv: "ArXiv", semantic: "Semantic Scholar", pubmed: "PubMed", chemrxiv: "ChemRxiv" };
  return <Badge color={map[source] || "default"}>{labels[source] || source}</Badge>;
}

// ─── Check if a URL is a real downloadable PDF ───
function isRealPdf(url) {
  return url && url !== "no-pdf" && url.startsWith("http");
}

function PaperCard({ paper, index }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "20px 24px",
      transition: "all 0.2s ease",
      animation: `fadeSlideIn 0.4s ease ${index * 0.08}s both`,
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--border-light)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <Badge color="gold">
            <Hash size={9} style={{ display: "inline", marginRight: "3px" }} />
            {paper.id?.slice(0, 15)}
          </Badge>
          {paper.source && <SourceBadge source={paper.source} />}
        </div>

        {/* Only show PDF link if there's a real URL */}
        {isRealPdf(paper.pdfUrl) ? (
          <a href={paper.pdfUrl} target="_blank" rel="noreferrer"
            title="Open PDF"
            style={{ color: "var(--text-muted)", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--gold)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <ExternalLink size={14} />
          </a>
        ) : (
          <span title="No PDF available" style={{ color: "var(--border)", cursor: "default" }}>
            <ExternalLink size={14} />
          </span>
        )}
      </div>

      <h3 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: "15px", fontWeight: 600,
        color: "var(--text-primary)",
        lineHeight: 1.4, marginBottom: "10px",
      }}>
        {paper.title}
      </h3>

      <div style={{ display: "flex", gap: "16px", marginBottom: "10px", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)", fontSize: "12px" }}>
          <Users size={11} />
          {paper.authors?.slice(0, 2).join(", ")}
          {paper.authors?.length > 2 && ` +${paper.authors.length - 2}`}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)", fontSize: "12px" }}>
          <Calendar size={11} />
          {paper.published}
        </span>
      </div>

      <p style={{
        color: "var(--text-muted)", fontSize: "12px",
        lineHeight: 1.6,
        display: "-webkit-box", WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {paper.abstract}
      </p>
    </div>
  );
}

function CitationCard({ citation }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--gold)",
      borderRadius: "8px",
      padding: "14px 18px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <Badge color="gold">[{citation.number}]</Badge>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "13px", color: "var(--text-primary)", fontWeight: 600,
          }}>
            {citation.title}
          </span>
        </div>
        <div style={{ display: "flex", gap: "14px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
            <Users size={10} style={{ display: "inline", marginRight: "4px" }} />
            {citation.authors?.slice(0, 50)}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
            <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
            {citation.published}
          </span>
        </div>
      </div>

      {/* Only show PDF button if there's a real URL */}
      {isRealPdf(citation.pdfUrl) ? (
        <a href={citation.pdfUrl} target="_blank" rel="noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            color: "var(--gold)", fontSize: "11px", textDecoration: "none",
            fontFamily: "'JetBrains Mono', monospace",
            padding: "6px 12px",
            border: "1px solid rgba(240,165,0,0.3)",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(240,165,0,0.1)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          PDF <ExternalLink size={10} />
        </a>
      ) : (
        <span style={{
          display: "flex", alignItems: "center", gap: "5px",
          color: "var(--text-muted)", fontSize: "11px",
          fontFamily: "'JetBrains Mono', monospace",
          padding: "6px 12px",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          whiteSpace: "nowrap",
          cursor: "default",
        }}>
          Abstract only
        </span>
      )}
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const [tab, setTab] = useState("ingest");
  const [selectedSource, setSelectedSource] = useState("arxiv");
  const [ingestQuery, setIngestQuery] = useState("");
  const [maxResults, setMaxResults] = useState(3);
  const [question, setQuestion] = useState("");
  const [papers, setPapers] = useState([]);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState([]);
  const [stats, setStats] = useState({ totalPapers: 0, totalChunks: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch {}
  }

  async function handleIngest() {
    if (!ingestQuery.trim()) return;
    setLoading(true);
    setError("");
    setPapers([]);
    setStatus("Searching for papers...");
    try {
      setStatus("Downloading and processing PDFs...");
      const res = await axios.post(`${API}/ingest`, {
        query: ingestQuery,
        maxResults,
        source: selectedSource,
      });
      setPapers(res.data.papers);
      setStats(res.data.stats);
      setStatus("");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setAnswer("");
    setCitations([]);
    setStatus("Searching through papers...");
    try {
      setStatus("Generating answer with AI...");
      const res = await axios.post(`${API}/ask`, { question });
      setAnswer(res.data.answer);
      setCitations(res.data.citations);
      setStatus("");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (!confirm("Clear all ingested papers from the database?")) return;
    try {
      await axios.delete(`${API}/clear`);
      setStats({ totalPapers: 0, totalChunks: 0 });
      setPapers([]);
      setAnswer("");
      setCitations([]);
    } catch {}
  }

  const activeSource = SOURCES.find(s => s.id === selectedSource);

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", padding: "0 0 60px" }}>

        {/* ── HEADER ── */}
        <header style={{
          borderBottom: "1px solid var(--border)",
          background: "rgba(10,11,15,0.9)",
          backdropFilter: "blur(20px)",
          position: "sticky", top: 0, zIndex: 100,
          padding: "0 40px",
        }}>
          <div style={{
            maxWidth: "1100px", margin: "0 auto",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", height: "64px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "32px", height: "32px",
                background: "linear-gradient(135deg, var(--gold), var(--gold-dim))",
                borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Brain size={16} color="#0a0b0f" />
              </div>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "18px", fontWeight: 700,
                letterSpacing: "-0.02em",
              }}>
                Research<span style={{ color: "var(--gold)" }}>Mind</span>
              </span>
            </div>

            {/* Stats + Clear */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "8px", padding: "6px 14px",
              }}>
                <Database size={12} color="var(--gold)" />
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", color: "var(--text-secondary)" }}>
                  {stats.totalPapers} papers
                </span>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "8px", padding: "6px 14px",
              }}>
                <FileText size={12} color="var(--blue)" />
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", color: "var(--text-secondary)" }}>
                  {stats.totalChunks} chunks
                </span>
              </div>
              {stats.totalChunks > 0 && (
                <button onClick={handleClear}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "6px 12px",
                    background: "transparent",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: "8px", color: "#f87171",
                    fontSize: "12px", cursor: "pointer",
                    fontFamily: "'JetBrains Mono'", transition: "all 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 40px 0" }}>

          {/* ── HERO ── */}
          <div style={{
            textAlign: "center", marginBottom: "56px",
            animation: "fadeSlideIn 0.6s ease both",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              background: "var(--gold-glow)", border: "1px solid rgba(240,165,0,0.25)",
              borderRadius: "20px", padding: "5px 14px", marginBottom: "24px",
            }}>
              <Sparkles size={12} color="var(--gold)" />
              <span style={{ color: "var(--gold)", fontSize: "12px", fontFamily: "'JetBrains Mono'" }}>
                AI-Powered Research Assistant
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(36px, 5vw, 58px)",
              fontWeight: 700, lineHeight: 1.1,
              letterSpacing: "-0.03em", marginBottom: "16px",
            }}>
              Understand research papers
              <br />
              <span style={{
                background: "linear-gradient(135deg, var(--gold), #ffcc55)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                in seconds, not hours
              </span>
            </h1>

            <p style={{
              color: "var(--text-secondary)", fontSize: "16px",
              maxWidth: "520px", margin: "0 auto", lineHeight: 1.7,
            }}>
              Search across ArXiv, PubMed, Semantic Scholar and ChemRxiv.
              Ask questions in plain English and get cited answers.
            </p>
          </div>

          {/* ── TABS ── */}
          <div style={{
            display: "flex", gap: "4px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "12px", padding: "4px",
            marginBottom: "32px",
            animation: "fadeSlideIn 0.6s ease 0.1s both",
          }}>
            {[
              { id: "ingest", label: "Ingest Papers", icon: BookOpen },
              { id: "ask", label: "Ask Questions", icon: Brain },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{
                  flex: 1, display: "flex", alignItems: "center",
                  justifyContent: "center", gap: "8px",
                  padding: "10px 20px", borderRadius: "8px",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px", fontWeight: 500,
                  transition: "all 0.2s ease",
                  background: tab === id
                    ? "linear-gradient(135deg, rgba(240,165,0,0.15), rgba(240,165,0,0.05))"
                    : "transparent",
                  color: tab === id ? "var(--gold)" : "var(--text-muted)",
                  border: tab === id
                    ? "1px solid rgba(240,165,0,0.25)"
                    : "1px solid transparent",
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* ── INGEST TAB ── */}
          {tab === "ingest" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "16px", padding: "32px",
                marginBottom: "28px",
              }}>
                <h2 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "20px", marginBottom: "6px",
                }}>
                  Search & Ingest Papers
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                  Choose your source, search for papers, and index them for Q&A
                </p>

                {/* ── SOURCE SELECTOR ── */}
                <div style={{ marginBottom: "20px" }}>
                  <p style={{
                    color: "var(--text-secondary)", fontSize: "11px",
                    marginBottom: "10px", fontFamily: "'JetBrains Mono'",
                    letterSpacing: "0.08em",
                  }}>
                    SELECT SOURCE
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                    {SOURCES.map(source => {
                      const isActive = selectedSource === source.id;
                      return (
                        <button key={source.id}
                          onClick={() => setSelectedSource(source.id)}
                          style={{
                            padding: "12px 16px",
                            background: isActive
                              ? `${source.color}18`
                              : "var(--bg-secondary)",
                            border: isActive
                              ? `1px solid ${source.color}`
                              : "1px solid var(--border)",
                            borderRadius: "10px",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.2s",
                          }}
                        >
                          <div style={{
                            fontSize: "13px", fontWeight: 600,
                            color: isActive ? source.color : "var(--text-primary)",
                            fontFamily: "'DM Sans', sans-serif",
                            marginBottom: "3px",
                          }}>
                            {source.label}
                          </div>
                          <div style={{
                            fontSize: "11px", color: "var(--text-muted)",
                            fontFamily: "'JetBrains Mono'",
                          }}>
                            {source.fields}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── SEARCH BAR ── */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <Search size={16} style={{
                      position: "absolute", left: "14px",
                      top: "50%", transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }} />
                    <input
                      value={ingestQuery}
                      onChange={e => setIngestQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleIngest()}
                      placeholder={`Search ${activeSource?.label}...`}
                      style={{
                        width: "100%", padding: "13px 16px 13px 42px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px", color: "var(--text-primary)",
                        fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
                        outline: "none", transition: "border 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "rgba(240,165,0,0.5)"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                  <select
                    value={maxResults}
                    onChange={e => setMaxResults(Number(e.target.value))}
                    style={{
                      padding: "13px 16px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px", color: "var(--text-secondary)",
                      fontSize: "14px", fontFamily: "'JetBrains Mono', monospace",
                      outline: "none", cursor: "pointer",
                    }}
                  >
                    {[2, 3, 5, 8, 10].map(n => (
                      <option key={n} value={n}>{n} papers</option>
                    ))}
                  </select>

                  <button onClick={handleIngest} disabled={loading || !ingestQuery.trim()}
                    style={{
                      padding: "13px 28px",
                      background: loading ? "var(--bg-hover)" : "linear-gradient(135deg, var(--gold), var(--gold-dim))",
                      border: "none", borderRadius: "10px",
                      color: loading ? "var(--text-muted)" : "#0a0b0f",
                      fontSize: "14px", fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: "8px",
                      whiteSpace: "nowrap", transition: "all 0.2s",
                    }}
                  >
                    {loading
                      ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                      : <Search size={15} />
                    }
                    {loading ? "Processing..." : "Ingest"}
                  </button>
                </div>

                {status && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    color: "var(--gold)", fontSize: "13px",
                    fontFamily: "'JetBrains Mono'",
                    animation: "pulse 1.5s ease infinite",
                  }}>
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                    {status}
                  </div>
                )}

                {error && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    color: "var(--red)", fontSize: "13px",
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    borderRadius: "8px", padding: "10px 14px", marginTop: "12px",
                  }}>
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
              </div>

              {papers.length > 0 && (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    marginBottom: "20px",
                  }}>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px" }}>
                      Ingested Papers
                    </h3>
                    <Badge color="green">{papers.length} indexed</Badge>
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: "16px",
                  }}>
                    {papers.map((paper, i) => (
                      <PaperCard key={paper.id} paper={paper} index={i} />
                    ))}
                  </div>

                  <div style={{
                    marginTop: "28px", textAlign: "center",
                    padding: "24px",
                    background: "var(--gold-glow)",
                    border: "1px solid rgba(240,165,0,0.2)",
                    borderRadius: "12px",
                  }}>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "12px", fontSize: "14px" }}>
                      Papers indexed successfully! Ready to answer questions.
                    </p>
                    <button onClick={() => setTab("ask")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "8px",
                        padding: "10px 24px",
                        background: "linear-gradient(135deg, var(--gold), var(--gold-dim))",
                        border: "none", borderRadius: "8px",
                        color: "#0a0b0f", fontWeight: 600, fontSize: "14px",
                        cursor: "pointer", fontFamily: "'DM Sans'",
                      }}
                    >
                      Ask Questions <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ASK TAB ── */}
          {tab === "ask" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "16px", padding: "32px",
                marginBottom: "28px",
              }}>
                <h2 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "20px", marginBottom: "6px",
                }}>
                  Ask a Research Question
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
                  Ask anything about the papers you've ingested. Get cited answers.
                </p>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <Brain size={16} style={{
                      position: "absolute", left: "14px",
                      top: "50%", transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }} />
                    <input
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAsk()}
                      placeholder='e.g. "What are the main findings of these papers?"'
                      style={{
                        width: "100%", padding: "13px 16px 13px 42px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px", color: "var(--text-primary)",
                        fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
                        outline: "none", transition: "border 0.2s",
                      }}
                      onFocus={e => e.target.style.borderColor = "rgba(240,165,0,0.5)"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  </div>

                  <button onClick={handleAsk} disabled={loading || !question.trim()}
                    style={{
                      padding: "13px 28px",
                      background: loading ? "var(--bg-hover)" : "linear-gradient(135deg, var(--gold), var(--gold-dim))",
                      border: "none", borderRadius: "10px",
                      color: loading ? "var(--text-muted)" : "#0a0b0f",
                      fontSize: "14px", fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: "8px",
                      transition: "all 0.2s",
                    }}
                  >
                    {loading
                      ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                      : <Sparkles size={15} />
                    }
                    {loading ? "Thinking..." : "Ask AI"}
                  </button>
                </div>

                {status && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    color: "var(--gold)", fontSize: "13px",
                    fontFamily: "'JetBrains Mono'", marginTop: "12px",
                    animation: "pulse 1.5s ease infinite",
                  }}>
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                    {status}
                  </div>
                )}

                {error && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    color: "var(--red)", fontSize: "13px",
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    borderRadius: "8px", padding: "10px 14px", marginTop: "12px",
                  }}>
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
              </div>

              {answer && (
                <div style={{ animation: "fadeSlideIn 0.4s ease both" }}>
                  <div style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderTop: "3px solid var(--gold)",
                    borderRadius: "16px", padding: "32px",
                    marginBottom: "20px",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      marginBottom: "20px",
                    }}>
                      <div style={{
                        width: "28px", height: "28px",
                        background: "var(--gold-glow)",
                        border: "1px solid rgba(240,165,0,0.3)",
                        borderRadius: "8px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Brain size={14} color="var(--gold)" />
                      </div>
                      <span style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "16px", fontWeight: 600,
                      }}>
                        AI Answer
                      </span>
                      <Badge color="green">Grounded</Badge>
                    </div>
                    <div style={{
                      color: "var(--text-primary)",
                      fontSize: "15px", lineHeight: 1.8,
                      whiteSpace: "pre-wrap",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {answer}
                    </div>
                  </div>

                  {citations.length > 0 && (
                    <div>
                      <h3 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "16px", marginBottom: "14px",
                        display: "flex", alignItems: "center", gap: "8px",
                      }}>
                        <FileText size={15} color="var(--gold)" />
                        Sources & Citations
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {citations.map(citation => (
                          <CitationCard key={citation.number} citation={citation} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!answer && !loading && (
                <div style={{
                  textAlign: "center", padding: "60px 20px",
                  color: "var(--text-muted)",
                }}>
                  <Brain size={40} style={{ marginBottom: "16px", opacity: 0.3 }} />
                  <p style={{ fontSize: "14px" }}>
                    {stats.totalChunks === 0
                      ? "No papers ingested yet. Go to Ingest Papers first."
                      : "Ask a question about your research papers above."}
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}