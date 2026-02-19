import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Search, BookOpen, Brain, Loader2, AlertCircle,
  ChevronRight, FileText, Users, Calendar,
  ExternalLink, Database, Sparkles, Hash, Trash2,
  CheckCircle2, SkipForward, Download, Scissors, Cpu
} from "lucide-react";

const API = "https://research-rssistant-based-on-rag-production.up.railway.app/api"

const SOURCES = [
  { id: "arxiv",    label: "ArXiv",           color: "#f0a500", fields: "CS · AI · Physics · Math" },
  { id: "semantic", label: "Semantic Scholar", color: "#60a5fa", fields: "All Fields" },
  { id: "pubmed",   label: "PubMed",           color: "#4ade80", fields: "Medical · Biology" },
  { id: "chemrxiv", label: "ChemRxiv",         color: "#f472b6", fields: "Chemistry · Eng" },
];

function Badge({ children, color = "default" }) {
  const colors = {
    default: { bg: "rgba(42,45,58,0.8)",   text: "#9096a8", border: "#2a2d3a" },
    gold:    { bg: "rgba(240,165,0,0.1)",   text: "#f0a500", border: "rgba(240,165,0,0.3)" },
    green:   { bg: "rgba(74,222,128,0.1)",  text: "#4ade80", border: "rgba(74,222,128,0.3)" },
    blue:    { bg: "rgba(96,165,250,0.1)",  text: "#60a5fa", border: "rgba(96,165,250,0.3)" },
    pink:    { bg: "rgba(244,114,182,0.1)", text: "#f472b6", border: "rgba(244,114,182,0.3)" },
  };
  const c = colors[color];
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: "2px 10px", borderRadius: "20px",
      fontSize: "11px", fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 500, letterSpacing: "0.03em",
    }}>
      {children}
    </span>
  );
}

function SourceBadge({ source }) {
  const map    = { arxiv: "gold", semantic: "blue", pubmed: "green", chemrxiv: "pink" };
  const labels = { arxiv: "ArXiv", semantic: "Semantic Scholar", pubmed: "PubMed", chemrxiv: "ChemRxiv" };
  return <Badge color={map[source] || "default"}>{labels[source] || source}</Badge>;
}

function isRealPdf(url) {
  return url && url !== "no-pdf" && url.startsWith("http");
}

// ─── PROGRESS BAR COMPONENT ───
function ProgressBar({ progress, logs, isDone, isError }) {
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const barColor = isError ? "#f87171" : isDone ? "#4ade80" : "var(--gold)";

  function getLogIcon(type) {
    switch (type) {
      case "paper_done": return <CheckCircle2 size={12} color="#4ade80" />;
      case "paper_skip": return <SkipForward   size={12} color="#f87171" />;
      case "done":       return <CheckCircle2 size={12} color="#4ade80" />;
      case "error":      return <AlertCircle  size={12} color="#f87171" />;
      default:
        if (logs[logs.length - 1]?.message?.includes("Downloading")) return <Download size={12} color="var(--gold)" />;
        if (logs[logs.length - 1]?.message?.includes("Chunking"))    return <Scissors  size={12} color="var(--gold)" />;
        if (logs[logs.length - 1]?.message?.includes("Embedding"))   return <Cpu       size={12} color="var(--gold)" />;
        return <Loader2 size={12} color="var(--gold)" style={{ animation: "spin 1s linear infinite" }} />;
    }
  }

  return (
    <div style={{
      marginTop: "20px",
      background: "var(--bg-secondary)",
      border: `1px solid ${isError ? "rgba(248,113,113,0.3)" : isDone ? "rgba(74,222,128,0.3)" : "rgba(240,165,0,0.2)"}`,
      borderRadius: "12px", padding: "20px",
      animation: "fadeSlideIn 0.3s ease both",
    }}>
      {/* Progress percentage + label */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", color: barColor }}>
          {isError ? "Error" : isDone ? "Complete" : "Processing..."}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "13px", fontWeight: 700, color: barColor }}>
          {progress}%
        </span>
      </div>

      {/* Bar track */}
      <div style={{
        width: "100%", height: "6px",
        background: "var(--bg-hover)",
        borderRadius: "999px", overflow: "hidden",
        marginBottom: "16px",
      }}>
        <div style={{
          height: "100%",
          width: `${progress}%`,
          background: isError
            ? "#f87171"
            : isDone
            ? "linear-gradient(90deg, #4ade80, #22c55e)"
            : "linear-gradient(90deg, var(--gold), #ffcc55)",
          borderRadius: "999px",
          transition: "width 0.4s ease",
          boxShadow: isDone ? "0 0 8px rgba(74,222,128,0.4)" : "0 0 8px rgba(240,165,0,0.3)",
        }} />
      </div>

      {/* Log stream */}
      <div style={{
        maxHeight: "180px", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: "6px",
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: "8px",
            opacity: i === logs.length - 1 ? 1 : 0.5,
            transition: "opacity 0.3s",
          }}>
            <span style={{ marginTop: "1px", flexShrink: 0 }}>
              {getLogIcon(log.type)}
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono'", fontSize: "11px",
              color: log.type === "paper_done" ? "#4ade80"
                   : log.type === "paper_skip" ? "#f87171"
                   : log.type === "error"       ? "#f87171"
                   : log.type === "done"        ? "#4ade80"
                   : "var(--text-secondary)",
              lineHeight: 1.5,
            }}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

function PaperCard({ paper, index }) {
  return (
    <div className="paper-card" style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "20px 24px",
      transition: "all 0.2s ease",
      animation: `fadeSlideIn 0.4s ease ${index * 0.08}s both`,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)";       e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1 }}>
          <Badge color="gold">
            <Hash size={9} style={{ display: "inline", marginRight: "3px" }} />
            {paper.id?.slice(0, 15)}
          </Badge>
          {paper.source && <SourceBadge source={paper.source} />}
        </div>
        {isRealPdf(paper.pdfUrl) ? (
          <a href={paper.pdfUrl} target="_blank" rel="noreferrer" title="Open PDF"
            style={{ color: "var(--text-muted)", transition: "color 0.2s", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--gold)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          ><ExternalLink size={14} /></a>
        ) : (
          <span title="No PDF available" style={{ color: "var(--border)", cursor: "default", flexShrink: 0 }}>
            <ExternalLink size={14} />
          </span>
        )}
      </div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: "10px" }}>
        {paper.title}
      </h3>
      <div style={{ display: "flex", gap: "16px", marginBottom: "10px", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)", fontSize: "12px" }}>
          <Users size={11} />
          {paper.authors?.slice(0, 2).join(", ")}
          {paper.authors?.length > 2 && ` +${paper.authors.length - 2}`}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)", fontSize: "12px" }}>
          <Calendar size={11} />{paper.published}
        </span>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {paper.abstract}
      </p>
    </div>
  );
}

function CitationCard({ citation }) {
  return (
    <div className="citation-card" style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderLeft: "3px solid var(--gold)", borderRadius: "8px", padding: "14px 18px",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
          <Badge color="gold">[{citation.number}]</Badge>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>
            {citation.title}
          </span>
        </div>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
            <Users size={10} style={{ display: "inline", marginRight: "4px" }} />{citation.authors?.slice(0, 50)}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
            <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />{citation.published}
          </span>
        </div>
      </div>
      {isRealPdf(citation.pdfUrl) ? (
        <a href={citation.pdfUrl} target="_blank" rel="noreferrer" style={{
          display: "flex", alignItems: "center", gap: "5px",
          color: "var(--gold)", fontSize: "11px", textDecoration: "none",
          fontFamily: "'JetBrains Mono', monospace", padding: "6px 12px",
          border: "1px solid rgba(240,165,0,0.3)", borderRadius: "6px",
          whiteSpace: "nowrap", transition: "all 0.2s", flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(240,165,0,0.1)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >PDF <ExternalLink size={10} /></a>
      ) : (
        <span style={{
          display: "flex", alignItems: "center", gap: "5px",
          color: "var(--text-muted)", fontSize: "11px",
          fontFamily: "'JetBrains Mono', monospace", padding: "6px 12px",
          border: "1px solid var(--border)", borderRadius: "6px",
          whiteSpace: "nowrap", cursor: "default", flexShrink: 0,
        }}>Abstract only</span>
      )}
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const [tab, setTab]                       = useState("ingest");
  const [selectedSource, setSelectedSource] = useState("arxiv");
  const [ingestQuery, setIngestQuery]       = useState("");
  const [maxResults, setMaxResults]         = useState(3);
  const [question, setQuestion]             = useState("");
  const [papers, setPapers]                 = useState([]);
  const [answer, setAnswer]                 = useState("");
  const [citations, setCitations]           = useState([]);
  const [stats, setStats]                   = useState({ totalPapers: 0, totalChunks: 0 });
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [status, setStatus]                 = useState("");

  // ─── Progress state ───
  const [progress, setProgress]     = useState(0);
  const [progressLogs, setProgressLogs] = useState([]);
  const [isIngesting, setIsIngesting]   = useState(false);
  const [ingestDone, setIngestDone]     = useState(false);
  const [ingestError, setIngestError]   = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    try { const res = await axios.get(`${API}/stats`); setStats(res.data); } catch {}
  }

  // ─── INGEST with SSE progress ───
  function handleIngest() {
    if (!ingestQuery.trim()) return;

    // Reset state
    setPapers([]);
    setError("");
    setProgress(0);
    setProgressLogs([]);
    setIsIngesting(true);
    setIngestDone(false);
    setIngestError(false);

    // Close any existing SSE connection
    if (eventSourceRef.current) eventSourceRef.current.close();

    const url = `${API}/ingest-progress?query=${encodeURIComponent(ingestQuery)}&maxResults=${maxResults}&source=${selectedSource}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Update progress bar
      if (data.progress !== undefined) setProgress(data.progress);

      // Add to log
      setProgressLogs(prev => [...prev, { type: data.type, message: data.message }]);

      if (data.type === "done") {
        setPapers(data.papers);
        setStats(data.stats);
        setIngestDone(true);
        setIsIngesting(false);
        es.close();
      }

      if (data.type === "error") {
        setError(data.message);
        setIngestError(true);
        setIsIngesting(false);
        es.close();
      }
    };

    es.onerror = () => {
      setError("Connection lost. Please try again.");
      setIngestError(true);
      setIsIngesting(false);
      es.close();
    };
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setLoading(true); setError(""); setAnswer(""); setCitations([]);
    setStatus("Searching through papers...");
    try {
      setStatus("Generating answer with AI...");
      const res = await axios.post(`${API}/ask`, { question });
      setAnswer(res.data.answer); setCitations(res.data.citations); setStatus("");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong"); setStatus("");
    } finally { setLoading(false); }
  }

  async function handleClear() {
    if (!confirm("Clear all ingested papers from the database?")) return;
    try {
      await axios.delete(`${API}/clear`);
      setStats({ totalPapers: 0, totalChunks: 0 });
      setPapers([]); setAnswer(""); setCitations([]);
      setProgress(0); setProgressLogs([]); setIngestDone(false);
    } catch {}
  }

  const activeSource = SOURCES.find(s => s.id === selectedSource);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse       { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin        { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer     {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .app-header {
          border-bottom: 1px solid var(--border);
          background: rgba(10,11,15,0.9);
          backdrop-filter: blur(20px);
          position: sticky; top: 0; z-index: 100;
        }
        .header-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center;
          justify-content: space-between;
          height: 64px; padding: 0 40px;
        }
        .header-logo { display: flex; align-items: center; gap: 12px; }
        .header-logo-icon {
          width: 32px; height: 32px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--gold), var(--gold-dim));
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .header-logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 700;
          letter-spacing: -0.02em; white-space: nowrap;
        }
        .header-actions { display: flex; gap: 10px; align-items: center; }
        .stat-pill {
          display: flex; align-items: center; gap: 6px;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 8px; padding: 6px 14px; white-space: nowrap;
        }
        .stat-pill span { font-family: 'JetBrains Mono'; font-size: 12px; color: var(--text-secondary); }
        .clear-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; background: transparent;
          border: 1px solid rgba(248,113,113,0.3);
          border-radius: 8px; color: #f87171;
          font-size: 12px; cursor: pointer;
          font-family: 'JetBrains Mono'; transition: all 0.2s;
          white-space: nowrap; flex-shrink: 0;
        }
        .clear-btn:hover { background: rgba(248,113,113,0.08); }

        .main-content { max-width: 1100px; margin: 0 auto; padding: 48px 40px 60px; }

        .hero-section { text-align: center; margin-bottom: 56px; animation: fadeSlideIn 0.6s ease both; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--gold-glow); border: 1px solid rgba(240,165,0,0.25);
          border-radius: 20px; padding: 5px 14px; margin-bottom: 24px;
        }
        .hero-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(28px, 5vw, 58px);
          font-weight: 700; line-height: 1.1;
          letter-spacing: -0.03em; margin-bottom: 16px;
        }
        .hero-subtitle { color: var(--text-secondary); font-size: 16px; max-width: 520px; margin: 0 auto; line-height: 1.7; }

        .tab-bar {
          display: flex; gap: 4px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 12px; padding: 4px; margin-bottom: 32px;
          animation: fadeSlideIn 0.6s ease 0.1s both;
        }
        .tab-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px 20px; border-radius: 8px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
          transition: all 0.2s ease;
        }

        .panel-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 32px; margin-bottom: 28px; }
        .panel-title { font-family: 'Playfair Display', serif; font-size: 20px; margin-bottom: 6px; }
        .panel-subtitle { color: var(--text-muted); font-size: 13px; margin-bottom: 24px; }

        .source-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .source-btn { padding: 12px 16px; border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.2s; }
        .source-btn-label { font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; margin-bottom: 3px; }
        .source-btn-sub { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono'; }

        .search-row { display: flex; gap: 12px; margin-bottom: 16px; align-items: stretch; }
        .search-input-wrap { flex: 1; position: relative; min-width: 0; }
        .search-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .search-input {
          width: 100%; padding: 13px 16px 13px 42px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 10px; color: var(--text-primary);
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; transition: border 0.2s;
        }
        .search-input:focus { border-color: rgba(240,165,0,0.5); }
        .count-select {
          padding: 13px 16px; background: var(--bg-secondary);
          border: 1px solid var(--border); border-radius: 10px;
          color: var(--text-secondary); font-size: 14px;
          font-family: 'JetBrains Mono', monospace; outline: none; cursor: pointer;
        }
        .action-btn {
          padding: 13px 28px; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          cursor: pointer; display: flex; align-items: center; gap: 8px;
          transition: all 0.2s; white-space: nowrap; flex-shrink: 0;
        }

        .papers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

        .status-row { display: flex; align-items: center; gap: 8px; color: var(--gold); font-size: 13px; font-family: 'JetBrains Mono'; margin-top: 12px; animation: pulse 1.5s ease infinite; }
        .error-row { display: flex; align-items: center; gap: 8px; color: var(--red); font-size: 13px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 8px; padding: 10px 14px; margin-top: 12px; }

        /* Scrollbar for logs */
        .progress-logs::-webkit-scrollbar { width: 4px; }
        .progress-logs::-webkit-scrollbar-track { background: transparent; }
        .progress-logs::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }

        /* ═══ TABLET ≤ 768px ═══ */
        @media (max-width: 768px) {
          .header-inner  { padding: 0 20px; height: 56px; }
          .chunks-pill   { display: none; }
          .main-content  { padding: 32px 20px 60px; }
          .panel-card    { padding: 24px 20px; }
          .hero-section  { margin-bottom: 40px; }
          .source-grid   { grid-template-columns: repeat(2, 1fr); }
          .search-row    { flex-wrap: wrap; }
          .search-input-wrap { flex: 1 1 100%; }
          .count-select  { flex: 1; }
          .ingest-btn    { flex: 1; justify-content: center; }
          .ask-row       { flex-wrap: wrap; }
          .ask-input-wrap { flex: 1 1 100%; }
          .ask-btn       { width: 100%; justify-content: center; }
          .papers-grid   { grid-template-columns: 1fr; }
          .tab-btn       { font-size: 13px; padding: 9px 12px; }
        }

        /* ═══ MOBILE ≤ 480px ═══ */
        @media (max-width: 480px) {
          .header-inner  { padding: 0 14px; }
          .header-logo-text { font-size: 16px; }
          .stat-pill     { display: none; }
          .main-content  { padding: 24px 14px 60px; }
          .panel-card    { padding: 18px 14px; border-radius: 12px; }
          .source-grid   { gap: 8px; }
          .source-btn-sub { display: none; }
          .source-btn-label { font-size: 12px; }
          .hero-section  { margin-bottom: 28px; }
          .hero-title    { font-size: clamp(24px, 7vw, 36px); }
          .hero-subtitle { font-size: 14px; }
          .tab-btn       { font-size: 12px; padding: 8px 8px; gap: 5px; }
          .citation-card { flex-direction: column !important; align-items: flex-start !important; }
          .panel-title   { font-size: 17px; }
        }
      `}</style>

      <div style={{ minHeight: "100vh" }}>

        {/* ── HEADER ── */}
        <header className="app-header">
          <div className="header-inner">
            <div className="header-logo">
              <div className="header-logo-icon"><Brain size={16} color="#0a0b0f" /></div>
              <span className="header-logo-text">
                Research<span style={{ color: "var(--gold)" }}>Mind</span>
              </span>
            </div>
            <div className="header-actions">
              <div className="stat-pill">
                <Database size={12} color="var(--gold)" />
                <span>{stats.totalPapers} papers</span>
              </div>
              <div className="stat-pill chunks-pill">
                <FileText size={12} color="var(--blue)" />
                <span>{stats.totalChunks} chunks</span>
              </div>
              {stats.totalChunks > 0 && (
                <button className="clear-btn" onClick={handleClear}>
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">

          {/* ── HERO ── */}
          <div className="hero-section">
            <div className="hero-badge">
              <Sparkles size={12} color="var(--gold)" />
              <span style={{ color: "var(--gold)", fontSize: "12px", fontFamily: "'JetBrains Mono'" }}>
                AI-Powered Research Assistant
              </span>
            </div>
            <h1 className="hero-title">
              Understand research papers
              <br />
              <span style={{ background: "linear-gradient(135deg, var(--gold), #ffcc55)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                in seconds, not hours
              </span>
            </h1>
            <p className="hero-subtitle">
              Search across ArXiv, PubMed, Semantic Scholar and ChemRxiv.
              Ask questions in plain English and get cited answers.
            </p>
          </div>

          {/* ── TABS ── */}
          <div className="tab-bar">
            {[
              { id: "ingest", label: "Ingest Papers",  icon: BookOpen },
              { id: "ask",    label: "Ask Questions",  icon: Brain },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{
                background: tab === id ? "linear-gradient(135deg, rgba(240,165,0,0.15), rgba(240,165,0,0.05))" : "transparent",
                color:  tab === id ? "var(--gold)" : "var(--text-muted)",
                border: tab === id ? "1px solid rgba(240,165,0,0.25)" : "1px solid transparent",
              }}>
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          {/* ── INGEST TAB ── */}
          {tab === "ingest" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div className="panel-card">
                <h2 className="panel-title">Search & Ingest Papers</h2>
                <p className="panel-subtitle">Choose your source, search for papers, and index them for Q&A</p>

                {/* SOURCE SELECTOR */}
                <p style={{ color: "var(--text-secondary)", fontSize: "11px", marginBottom: "10px", fontFamily: "'JetBrains Mono'", letterSpacing: "0.08em" }}>
                  SELECT SOURCE
                </p>
                <div className="source-grid">
                  {SOURCES.map(source => {
                    const isActive = selectedSource === source.id;
                    return (
                      <button key={source.id} className="source-btn"
                        onClick={() => setSelectedSource(source.id)}
                        style={{
                          background: isActive ? `${source.color}18` : "var(--bg-secondary)",
                          border: isActive ? `1px solid ${source.color}` : "1px solid var(--border)",
                        }}
                      >
                        <div className="source-btn-label" style={{ color: isActive ? source.color : "var(--text-primary)" }}>
                          {source.label}
                        </div>
                        <div className="source-btn-sub">{source.fields}</div>
                      </button>
                    );
                  })}
                </div>

                {/* SEARCH ROW */}
                <div className="search-row">
                  <div className="search-input-wrap">
                    <span className="search-input-icon"><Search size={16} /></span>
                    <input
                      className="search-input"
                      value={ingestQuery}
                      onChange={e => setIngestQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleIngest()}
                      placeholder={`Search ${activeSource?.label}...`}
                      disabled={isIngesting}
                    />
                  </div>
                  <select className="count-select" value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} disabled={isIngesting}>
                    {[2, 3, 5, 8, 10].map(n => <option key={n} value={n}>{n} papers</option>)}
                  </select>
                  <button className="action-btn ingest-btn"
                    onClick={handleIngest}
                    disabled={isIngesting || !ingestQuery.trim()}
                    style={{
                      background: isIngesting ? "var(--bg-hover)" : "linear-gradient(135deg, var(--gold), var(--gold-dim))",
                      color: isIngesting ? "var(--text-muted)" : "#0a0b0f",
                      cursor: isIngesting ? "not-allowed" : "pointer",
                    }}
                  >
                    {isIngesting
                      ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                      : <Search size={15} />
                    }
                    {isIngesting ? "Processing..." : "Ingest"}
                  </button>
                </div>

                {/* ── PROGRESS BAR ── */}
                {(isIngesting || ingestDone || ingestError) && progressLogs.length > 0 && (
                  <ProgressBar
                    progress={progress}
                    logs={progressLogs}
                    isDone={ingestDone}
                    isError={ingestError}
                  />
                )}

                {error && !ingestError && (
                  <div className="error-row"><AlertCircle size={14} />{error}</div>
                )}
              </div>

              {/* PAPERS RESULTS */}
              {papers.length > 0 && (
                <div style={{ animation: "fadeSlideIn 0.4s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px" }}>Ingested Papers</h3>
                    <Badge color="green">{papers.length} indexed</Badge>
                  </div>
                  <div className="papers-grid">
                    {papers.map((paper, i) => <PaperCard key={paper.id} paper={paper} index={i} />)}
                  </div>
                  <div style={{ marginTop: "28px", textAlign: "center", padding: "24px", background: "var(--gold-glow)", border: "1px solid rgba(240,165,0,0.2)", borderRadius: "12px" }}>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "12px", fontSize: "14px" }}>
                      Papers indexed successfully! Ready to answer questions.
                    </p>
                    <button onClick={() => setTab("ask")} style={{
                      display: "inline-flex", alignItems: "center", gap: "8px",
                      padding: "10px 24px",
                      background: "linear-gradient(135deg, var(--gold), var(--gold-dim))",
                      border: "none", borderRadius: "8px",
                      color: "#0a0b0f", fontWeight: 600, fontSize: "14px",
                      cursor: "pointer", fontFamily: "'DM Sans'",
                    }}>
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
              <div className="panel-card">
                <h2 className="panel-title">Ask a Research Question</h2>
                <p className="panel-subtitle">Ask anything about the papers you've ingested. Get cited answers.</p>

                <div className="search-row ask-row">
                  <div className="search-input-wrap ask-input-wrap">
                    <span className="search-input-icon"><Brain size={16} /></span>
                    <input
                      className="search-input"
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAsk()}
                      placeholder='e.g. "What are the main findings of these papers?"'
                    />
                  </div>
                  <button className="action-btn ask-btn"
                    onClick={handleAsk} disabled={loading || !question.trim()}
                    style={{
                      background: loading ? "var(--bg-hover)" : "linear-gradient(135deg, var(--gold), var(--gold-dim))",
                      color: loading ? "var(--text-muted)" : "#0a0b0f",
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={15} />}
                    {loading ? "Thinking..." : "Ask AI"}
                  </button>
                </div>

                {status && (
                  <div className="status-row">
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />{status}
                  </div>
                )}
                {error && (
                  <div className="error-row"><AlertCircle size={14} />{error}</div>
                )}
              </div>

              {answer && (
                <div style={{ animation: "fadeSlideIn 0.4s ease both" }}>
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderTop: "3px solid var(--gold)", borderRadius: "16px", padding: "32px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                      <div style={{ width: "28px", height: "28px", flexShrink: 0, background: "var(--gold-glow)", border: "1px solid rgba(240,165,0,0.3)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Brain size={14} color="var(--gold)" />
                      </div>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 600 }}>AI Answer</span>
                      <Badge color="green">Grounded</Badge>
                    </div>
                    <div style={{ color: "var(--text-primary)", fontSize: "15px", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif" }}>
                      {answer}
                    </div>
                  </div>

                  {citations.length > 0 && (
                    <div>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <FileText size={15} color="var(--gold)" />Sources & Citations
                      </h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {citations.map(citation => <CitationCard key={citation.number} citation={citation} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!answer && !loading && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
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