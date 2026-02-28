import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { useUser, useClerk, SignInButton } from "@clerk/clerk-react";
import {
  Search, BookOpen, Brain, Loader2, AlertCircle,
  ChevronRight, FileText, Users, Calendar,
  ExternalLink, Database, Sparkles, Hash, Trash2,
  CheckCircle2, SkipForward, Download, Scissors, Cpu,
  Upload, X, File, Send, MessageSquare, Bot, User, Lock, Zap,
  Mic, MicOff, Volume2, VolumeX, Swords, Trophy, GitCompare, Minus,
  ScrollText, Settings2, Copy, Check, RefreshCw
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const FREE_LIMIT = 10;
const STORAGE_KEY_COUNT    = "rm_search_count";
const STORAGE_KEY_WELCOMED = "rm_welcomed";

const SOURCES = [
  { id: "arxiv",    label: "ArXiv",           color: "#f0a500", fields: "CS · AI · Physics · Math" },
  { id: "semantic", label: "Semantic Scholar", color: "#60a5fa", fields: "All Fields" },
  { id: "pubmed",   label: "PubMed",           color: "#4ade80", fields: "Medical · Biology" },
  { id: "chemrxiv", label: "ChemRxiv",         color: "#f472b6", fields: "Chemistry · Eng" },
];

function WelcomeModal({ onSkip, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
      animation: "fadeIn 0.3s ease both",
    }}>
      <div style={{
        background: "linear-gradient(145deg, #12141c, #0e1018)",
        border: "1px solid rgba(240,165,0,0.25)",
        borderRadius: "24px",
        padding: "40px",
        maxWidth: "440px",
        width: "100%",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
        animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
        position: "relative",
        textAlign: "center",
      }}>
        <div style={{
          width: "64px", height: "64px", margin: "0 auto 24px",
          background: "linear-gradient(135deg, rgba(240,165,0,0.2), rgba(240,165,0,0.05))",
          border: "1px solid rgba(240,165,0,0.3)",
          borderRadius: "18px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Brain size={28} color="var(--gold)" />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px", lineHeight: 1.2 }}>
          Welcome to <span style={{ color: "var(--gold)" }}>ResearchMind</span>
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.7, marginBottom: "32px", fontFamily: "'DM Sans'" }}>
          Your AI research assistant. Sign up free for unlimited access,
          or explore with <strong style={{ color: "var(--text-primary)" }}>10 free searches</strong> first.
        </p>
        <div style={{ background: "rgba(240,165,0,0.05)", border: "1px solid rgba(240,165,0,0.15)", borderRadius: "12px", padding: "16px", marginBottom: "28px", textAlign: "left", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { icon: Zap,      text: "Unlimited questions across all papers" },
            { icon: FileText, text: "Save & export your research sessions" },
            { icon: Database, text: "Access all 4 research databases" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "24px", height: "24px", flexShrink: 0, background: "rgba(240,165,0,0.1)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={12} color="var(--gold)" />
              </div>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px", fontFamily: "'DM Sans'" }}>{text}</span>
            </div>
          ))}
        </div>
        <SignInButton mode="modal" afterSignInUrl="/" afterSignUpUrl="/">
          <button onClick={onClose} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, var(--gold), #ffcc55)", border: "none", borderRadius: "12px", color: "#0a0b0f", fontWeight: 700, fontSize: "15px", cursor: "pointer", fontFamily: "'DM Sans'", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "12px", transition: "opacity 0.2s", boxShadow: "0 4px 20px rgba(240,165,0,0.3)" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </SignInButton>
        <button onClick={onSkip} style={{ width: "100%", padding: "12px", background: "transparent", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans'", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          Skip for now — use 10 free searches
        </button>
        <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "16px", fontFamily: "'JetBrains Mono'" }}>No credit card required · Free forever</p>
      </div>
    </div>
  );
}

function HardWallModal() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", animation: "fadeIn 0.3s ease both" }}>
      <div style={{ background: "linear-gradient(145deg, #12141c, #0e1018)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "24px", padding: "40px", maxWidth: "420px", width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", margin: "0 auto 24px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={28} color="#f87171" />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px" }}>
          You've used your {FREE_LIMIT} free searches
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.7, marginBottom: "28px", fontFamily: "'DM Sans'" }}>
          Sign up for free to keep going — unlimited questions, full chat history, and PDF exports.
        </p>
        <div style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px", fontFamily: "'JetBrains Mono'" }}>Free searches used</span>
            <span style={{ color: "#f87171", fontSize: "12px", fontFamily: "'JetBrains Mono'", fontWeight: 700 }}>{FREE_LIMIT} / {FREE_LIMIT}</span>
          </div>
          <div style={{ width: "100%", height: "6px", background: "var(--bg-hover)", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #f87171, #ef4444)", borderRadius: "999px" }} />
          </div>
        </div>
        <SignInButton mode="modal" afterSignInUrl="/" afterSignUpUrl="/">
          <button style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, var(--gold), #ffcc55)", border: "none", borderRadius: "12px", color: "#0a0b0f", fontWeight: 700, fontSize: "15px", cursor: "pointer", fontFamily: "'DM Sans'", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "12px", boxShadow: "0 4px 20px rgba(240,165,0,0.3)", transition: "opacity 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Create Free Account
          </button>
        </SignInButton>
        <p style={{ color: "var(--text-muted)", fontSize: "11px", fontFamily: "'JetBrains Mono'" }}>Free forever · No credit card needed</p>
      </div>
    </div>
  );
}

function Badge({ children, color = "default" }) {
  const colors = {
    default: { bg: "rgba(42,45,58,0.8)",   text: "#9096a8", border: "#2a2d3a" },
    gold:    { bg: "rgba(240,165,0,0.1)",   text: "#f0a500", border: "rgba(240,165,0,0.3)" },
    green:   { bg: "rgba(74,222,128,0.1)",  text: "#4ade80", border: "rgba(74,222,128,0.3)" },
    blue:    { bg: "rgba(96,165,250,0.1)",  text: "#60a5fa", border: "rgba(96,165,250,0.3)" },
    pink:    { bg: "rgba(244,114,182,0.1)", text: "#f472b6", border: "rgba(244,114,182,0.3)" },
    purple:  { bg: "rgba(167,139,250,0.1)", text: "#a78bfa", border: "rgba(167,139,250,0.3)" },
  };
  const c = colors[color] || colors.default;
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, letterSpacing: "0.03em" }}>
      {children}
    </span>
  );
}

function SourceBadge({ source }) {
  const map    = { arxiv: "gold", semantic: "blue", pubmed: "green", chemrxiv: "pink", upload: "purple" };
  const labels = { arxiv: "ArXiv", semantic: "Semantic Scholar", pubmed: "PubMed", chemrxiv: "ChemRxiv", upload: "Uploaded" };
  return <Badge color={map[source] || "default"}>{labels[source] || source}</Badge>;
}

function isRealPdf(url) { return url && url !== "no-pdf" && url.startsWith("http"); }

function ProgressBar({ progress, logs, isDone, isError }) {
  const logsEndRef = useRef(null);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);
  const barColor = isError ? "#f87171" : isDone ? "#4ade80" : "var(--gold)";
  function getLogIcon(type) {
    switch (type) {
      case "paper_done": return <CheckCircle2 size={12} color="#4ade80" />;
      case "paper_skip": return <SkipForward size={12} color="#f87171" />;
      case "done":       return <CheckCircle2 size={12} color="#4ade80" />;
      case "error":      return <AlertCircle size={12} color="#f87171" />;
      default:
        if (logs[logs.length-1]?.message?.includes("Downloading")) return <Download size={12} color="var(--gold)" />;
        if (logs[logs.length-1]?.message?.includes("Chunking"))    return <Scissors size={12} color="var(--gold)" />;
        if (logs[logs.length-1]?.message?.includes("Embedding"))   return <Cpu size={12} color="var(--gold)" />;
        return <Loader2 size={12} color="var(--gold)" style={{ animation: "spin 1s linear infinite" }} />;
    }
  }
  return (
    <div style={{ marginTop: "20px", background: "var(--bg-secondary)", border: `1px solid ${isError ? "rgba(248,113,113,0.3)" : isDone ? "rgba(74,222,128,0.3)" : "rgba(240,165,0,0.2)"}`, borderRadius: "12px", padding: "20px", animation: "fadeSlideIn 0.3s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", color: barColor }}>{isError ? "Error" : isDone ? "Complete" : "Processing..."}</span>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "13px", fontWeight: 700, color: barColor }}>{progress}%</span>
      </div>
      <div style={{ width: "100%", height: "6px", background: "var(--bg-hover)", borderRadius: "999px", overflow: "hidden", marginBottom: "16px" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: isError ? "#f87171" : isDone ? "linear-gradient(90deg, #4ade80, #22c55e)" : "linear-gradient(90deg, var(--gold), #ffcc55)", borderRadius: "999px", transition: "width 0.4s ease", boxShadow: isDone ? "0 0 8px rgba(74,222,128,0.4)" : "0 0 8px rgba(240,165,0,0.3)" }} />
      </div>
      <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
        {logs.map((log, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", opacity: i === logs.length - 1 ? 1 : 0.5, transition: "opacity 0.3s" }}>
            <span style={{ marginTop: "1px", flexShrink: 0 }}>{getLogIcon(log.type)}</span>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "11px", color: log.type === "paper_done" ? "#4ade80" : log.type === "paper_skip" ? "#f87171" : log.type === "error" ? "#f87171" : log.type === "done" ? "#4ade80" : "var(--text-secondary)", lineHeight: 1.5 }}>{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

function PaperCard({ paper, index }) {
  return (
    <div className="paper-card" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", transition: "all 0.2s ease", animation: `fadeSlideIn 0.4s ease ${index * 0.08}s both` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1 }}>
          <Badge color="gold"><Hash size={9} style={{ display: "inline", marginRight: "3px" }} />{paper.id?.slice(0, 15)}</Badge>
          {paper.source && <SourceBadge source={paper.source} />}
        </div>
        {isRealPdf(paper.pdfUrl) ? (
          <a href={paper.pdfUrl} target="_blank" rel="noreferrer" style={{ color: "var(--text-muted)", transition: "color 0.2s", flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.color = "var(--gold)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}><ExternalLink size={14} /></a>
        ) : (
          <span style={{ color: "var(--border)", cursor: "default", flexShrink: 0 }}><ExternalLink size={14} /></span>
        )}
      </div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: "10px" }}>{paper.title}</h3>
      <div style={{ display: "flex", gap: "16px", marginBottom: "10px", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)", fontSize: "12px" }}><Users size={11} />{paper.authors?.slice(0, 2).join(", ")}{paper.authors?.length > 2 && ` +${paper.authors.length - 2}`}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-secondary)", fontSize: "12px" }}><Calendar size={11} />{paper.published}</span>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{paper.abstract}</p>
    </div>
  );
}

function SummaryPopup({ abstract }) {
  if (!abstract || abstract === "Uploaded PDF document") return null;
  return (
    <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: 0, width: "340px", maxWidth: "90vw", background: "#16181f", border: "1px solid rgba(240,165,0,0.3)", borderRadius: "12px", padding: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 999, animation: "fadeSlideIn 0.2s ease both", pointerEvents: "none" }}>
      <p style={{ color: "var(--gold)", fontSize: "10px", fontFamily: "'JetBrains Mono'", letterSpacing: "0.08em", marginBottom: "8px" }}>ABSTRACT</p>
      <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontFamily: "'DM Sans'", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{abstract}</p>
      <div style={{ position: "absolute", bottom: "-6px", left: "24px", width: "10px", height: "10px", background: "#16181f", border: "1px solid rgba(240,165,0,0.3)", borderTop: "none", borderLeft: "none", transform: "rotate(45deg)" }} />
    </div>
  );
}

function CitationCard({ citation }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="citation-card" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderLeft: "3px solid var(--gold)", borderRadius: "8px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", position: "relative", transition: "border-color 0.2s" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {hovered && citation.abstract && <SummaryPopup abstract={citation.abstract} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
          <Badge color="gold">[{citation.number}]</Badge>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{citation.title}</span>
        </div>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}><Users size={10} style={{ display: "inline", marginRight: "4px" }} />{citation.authors?.slice(0, 50)}</span>
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}><Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />{citation.published}</span>
        </div>
      </div>
      {isRealPdf(citation.pdfUrl) ? (
        <a href={citation.pdfUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--gold)", fontSize: "11px", textDecoration: "none", fontFamily: "'JetBrains Mono', monospace", padding: "6px 12px", border: "1px solid rgba(240,165,0,0.3)", borderRadius: "6px", whiteSpace: "nowrap", transition: "all 0.2s", flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(240,165,0,0.1)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >PDF <ExternalLink size={10} /></a>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-muted)", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "6px", whiteSpace: "nowrap", cursor: "default", flexShrink: 0 }}>Abstract only</span>
      )}
    </div>
  );
}

function ChatCitationCard({ citation }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: "8px", border: `1px solid ${hovered ? "rgba(240,165,0,0.4)" : "var(--border)"}`, borderLeft: "2px solid var(--gold)", position: "relative", transition: "border-color 0.2s", cursor: "default" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {hovered && citation.abstract && (
        <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: "320px", maxWidth: "80vw", background: "#16181f", border: "1px solid rgba(240,165,0,0.35)", borderRadius: "10px", padding: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 999, animation: "fadeSlideIn 0.2s ease both", pointerEvents: "none" }}>
          <p style={{ color: "var(--gold)", fontSize: "10px", fontFamily: "'JetBrains Mono'", letterSpacing: "0.08em", marginBottom: "7px" }}>ABSTRACT</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontFamily: "'DM Sans'", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{citation.abstract}</p>
          <div style={{ position: "absolute", bottom: "-6px", left: "20px", width: "10px", height: "10px", background: "#16181f", border: "1px solid rgba(240,165,0,0.35)", borderTop: "none", borderLeft: "none", transform: "rotate(45deg)" }} />
        </div>
      )}
      <span style={{ color: "var(--gold)", fontSize: "11px", fontFamily: "'JetBrains Mono'", flexShrink: 0 }}>[{citation.number}]</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "var(--text-primary)", fontSize: "12px", fontFamily: "'DM Sans'", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{citation.title}</p>
        <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>
          {citation.published}
          {citation.abstract && <span style={{ color: "rgba(240,165,0,0.5)", marginLeft: "8px" }}>· hover to preview</span>}
        </p>
      </div>
      {isRealPdf(citation.pdfUrl) && (
        <a href={citation.pdfUrl} target="_blank" rel="noreferrer" style={{ color: "var(--text-muted)", flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.color = "var(--gold)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}><ExternalLink size={12} /></a>
      )}
    </div>
  );
}

function ChatMessage({ message, msgIndex, onSpeak, isSpeakingThis }) {
  const isUser = message.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: "12px", alignItems: "flex-start", animation: "fadeSlideIn 0.3s ease both", marginBottom: "24px" }}>
      <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "10px", background: isUser ? "linear-gradient(135deg, var(--gold), var(--gold-dim))" : "rgba(96,165,250,0.15)", border: isUser ? "none" : "1px solid rgba(96,165,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isUser ? <User size={15} color="#0a0b0f" /> : <Brain size={15} color="#60a5fa" />}
      </div>
      <div style={{ maxWidth: "75%", minWidth: 0 }}>
        <div style={{ background: isUser ? "linear-gradient(135deg, rgba(240,165,0,0.12), rgba(240,165,0,0.06))" : "var(--bg-card)", border: isUser ? "1px solid rgba(240,165,0,0.25)" : "1px solid var(--border)", borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: "14px 18px" }}>
          {isUser ? (
            <p style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: 1.6, fontFamily: "'DM Sans'" }}>{message.question}</p>
          ) : (
            <div>
              {message.loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "13px" }}>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} color="var(--gold)" />
                  <span style={{ fontFamily: "'JetBrains Mono'" }}>Thinking...</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <Badge color="green">Grounded</Badge>
                    {message.confidence != null && (() => {
                      const c = message.confidence;
                      const isHigh = c >= 75, isMedium = c >= 50 && c < 75;
                      const color = isHigh ? "#4ade80" : isMedium ? "#f0a500" : "#f87171";
                      const label = isHigh ? "High Confidence" : isMedium ? "Medium Confidence" : "Low Confidence";
                      const dot   = isHigh ? "🟢" : isMedium ? "🟡" : "🔴";
                      return (
                        <span title={`Relevance score: ${c}%`} style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: `${color}18`, border: `1px solid ${color}40`, borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontFamily: "'JetBrains Mono'", color, cursor: "help" }}>
                          {dot} {label} · {c}%
                        </span>
                      );
                    })()}
                    <span style={{ color: "var(--text-muted)", fontSize: "11px", fontFamily: "'JetBrains Mono'" }}>{message.citations?.length || 0} sources</span>
                    {message.answer && (
                      <button
                        onClick={() => onSpeak(message.answer, msgIndex)}
                        title={isSpeakingThis ? "Stop speaking" : "Listen to answer"}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: isSpeakingThis ? "rgba(96,165,250,0.15)" : "transparent", border: `1px solid ${isSpeakingThis ? "rgba(96,165,250,0.4)" : "var(--border)"}`, borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontFamily: "'JetBrains Mono'", color: isSpeakingThis ? "#60a5fa" : "var(--text-muted)", cursor: "pointer", transition: "all 0.2s" }}
                      >
                        {isSpeakingThis ? <VolumeX size={11} /> : <Volume2 size={11} />}
                        {isSpeakingThis ? " Stop" : " Listen"}
                      </button>
                    )}
                  </div>
                  <div style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "'DM Sans'" }}>{message.answer}</div>
                  {message.citations?.length > 0 && (
                    <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: "11px", fontFamily: "'JetBrains Mono'", letterSpacing: "0.06em", marginBottom: "10px" }}>SOURCES</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {message.citations.map(citation => <ChatCitationCard key={citation.number} citation={citation} />)}
                      </div>
                    </div>
                  )}
                  {message.error && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontSize: "13px", marginTop: "8px" }}>
                      <AlertCircle size={13} /> {message.error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadTab({ onPaperIndexed, setStats }) {
  const [dragOver, setDragOver]     = useState(false);
  const [file, setFile]             = useState(null);
  const [title, setTitle]           = useState("");
  const [authors, setAuthors]       = useState("");
  const [uploading, setUploading]   = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [error, setError]           = useState("");
  const [progress, setProgress]     = useState(0);
  const [indexedPaper, setIndexedPaper] = useState(null);
  const fileInputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") pickFile(dropped);
    else setError("Please drop a PDF file.");
  }

  function pickFile(f) {
    setFile(f); setError(""); setUploadDone(false); setIndexedPaper(null); setProgress(0);
    if (!title) setTitle(f.name.replace(".pdf", "").replace(/[_-]/g, " "));
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(""); setProgress(10);
    const formData = new FormData();
    formData.append("pdf", file);
    if (title)   formData.append("title", title);
    if (authors) formData.append("authors", authors);
    try {
      setProgress(30);
      const res = await axios.post(`${API}/upload-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => { const pct = Math.round((e.loaded / e.total) * 40); setProgress(10 + pct); },
      });
      setProgress(80);
      await new Promise(r => setTimeout(r, 400));
      setProgress(100);
      setUploadDone(true); setIndexedPaper(res.data.paper);
      setStats(res.data.stats); onPaperIndexed(res.data.paper);
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed. Please try again.");
    } finally { setUploading(false); }
  }

  function reset() { setFile(null); setTitle(""); setAuthors(""); setUploadDone(false); setIndexedPaper(null); setError(""); setProgress(0); }

  return (
    <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
      <div className="panel-card">
        <h2 className="panel-title">Upload Your Own PDF</h2>
        <p className="panel-subtitle">Have a paper already? Upload it directly and start asking questions.</p>
        {!file && (
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? "var(--gold)" : "var(--border)"}`, borderRadius: "14px", padding: "48px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: dragOver ? "rgba(240,165,0,0.04)" : "var(--bg-secondary)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(240,165,0,0.5)"; e.currentTarget.style.background = "rgba(240,165,0,0.03)"; }}
            onMouseLeave={e => { if (!dragOver) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-secondary)"; }}}
          >
            <div style={{ width: "52px", height: "52px", margin: "0 auto 16px", background: "rgba(240,165,0,0.1)", border: "1px solid rgba(240,165,0,0.25)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Upload size={22} color="var(--gold)" />
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: 600, marginBottom: "6px", fontFamily: "'DM Sans'" }}>Drop your PDF here</p>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "14px" }}>or click to browse files</p>
            <span style={{ display: "inline-block", padding: "5px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "11px", fontFamily: "'JetBrains Mono'" }}>PDF up to 20MB</span>
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) pickFile(e.target.files[0]); }} />
          </div>
        )}
        {file && !uploadDone && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--bg-secondary)", border: "1px solid rgba(240,165,0,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", flexShrink: 0, background: "rgba(240,165,0,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}><File size={18} color="var(--gold)" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 600, fontFamily: "'DM Sans'", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                <p style={{ color: "var(--text-muted)", fontSize: "11px", fontFamily: "'JetBrains Mono'" }}>{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }} onMouseEnter={e => e.currentTarget.style.color = "#f87171"} onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", fontFamily: "'JetBrains Mono'", letterSpacing: "0.08em", marginBottom: "6px" }}>TITLE (optional)</label>
                <input className="search-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Paper title (auto-filled from filename)" style={{ width: "100%", paddingLeft: "16px" }} />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", fontFamily: "'JetBrains Mono'", letterSpacing: "0.08em", marginBottom: "6px" }}>AUTHORS (optional)</label>
                <input className="search-input" value={authors} onChange={e => setAuthors(e.target.value)} placeholder="e.g. John Smith, Jane Doe" style={{ width: "100%", paddingLeft: "16px" }} />
              </div>
            </div>
            <button className="action-btn" onClick={handleUpload} disabled={uploading} style={{ width: "100%", justifyContent: "center", background: uploading ? "var(--bg-hover)" : "linear-gradient(135deg, var(--gold), var(--gold-dim))", color: uploading ? "var(--text-muted)" : "#0a0b0f", cursor: uploading ? "not-allowed" : "pointer" }}>
              {uploading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Processing...</> : <><Upload size={15} /> Index This Paper</>}
            </button>
            {uploading && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", color: "var(--gold)" }}>{progress < 50 ? "Uploading..." : progress < 80 ? "Extracting text..." : "Embedding chunks..."}</span>
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", fontWeight: 700, color: "var(--gold)" }}>{progress}%</span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "var(--bg-hover)", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--gold), #ffcc55)", borderRadius: "999px", transition: "width 0.3s ease", boxShadow: "0 0 8px rgba(240,165,0,0.3)" }} />
                </div>
              </div>
            )}
            {error && <div className="error-row" style={{ marginTop: "12px" }}><AlertCircle size={14} />{error}</div>}
          </div>
        )}
        {uploadDone && indexedPaper && (
          <div style={{ animation: "fadeSlideIn 0.4s ease both" }}>
            <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: "12px", padding: "20px", marginBottom: "20px", display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div style={{ width: "36px", height: "36px", flexShrink: 0, background: "rgba(74,222,128,0.1)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={20} color="#4ade80" /></div>
              <div>
                <p style={{ color: "#4ade80", fontWeight: 700, fontSize: "14px", fontFamily: "'DM Sans'", marginBottom: "4px" }}>Successfully indexed!</p>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", fontFamily: "'DM Sans'" }}><strong style={{ color: "var(--text-primary)" }}>{indexedPaper.title}</strong> is ready for Q&A.</p>
              </div>
            </div>
            <button onClick={reset} style={{ width: "100%", padding: "11px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans'", fontWeight: 600 }}>Upload Another</button>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── BATTLE TAB ───



// ─── LITERATURE REVIEW TAB ───
function LitReviewTab({ stats }) {
  const [wordCount,  setWordCount]  = useState(1000);
  const [style,      setStyle]      = useState("thesis");
  const [sections,   setSections]   = useState({
    introduction:           true,
    theoretical_background: true,
    methodology_comparison: true,
    key_findings:           true,
    agreements:             true,
    contradictions:         true,
    research_gaps:          true,
    conclusion:             true,
    references:             true,
  });
  const [review,     setReview]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [meta,       setMeta]       = useState(null);
  const [copied,     setCopied]     = useState(false);

  const SECTION_LABELS = {
    introduction:           "Introduction",
    theoretical_background: "Theoretical Background",
    methodology_comparison: "Methodology Comparison Table",
    key_findings:           "Key Findings",
    agreements:             "Agreements in Literature",
    contradictions:         "Contradictions & Debates",
    research_gaps:          "Research Gaps",
    conclusion:             "Conclusion",
    references:             "References (APA)",
  };

  const STYLES = [
    { id: "thesis",  label: "Thesis",  desc: "Formal academic, third person" },
    { id: "journal", label: "Journal", desc: "Concise, direct, precise" },
    { id: "summary", label: "Summary", desc: "Accessible, readable" },
  ];

  function toggleSection(key) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGenerate() {
    const activeSections = Object.entries(sections).filter(([,v]) => v).map(([k]) => k);
    if (activeSections.length === 0) { setError("Select at least one section."); return; }
    setLoading(true); setError(""); setReview(""); setMeta(null);
    try {
      const res = await axios.post(`${API}/literature-review`, { wordCount, style, sections: activeSections });
      setReview(res.data.review);
      setMeta({ paperCount: res.data.paperCount, wordCount: res.data.wordCount, papers: res.data.papers });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate. Please try again.");
    } finally { setLoading(false); }
  }

  function handleCopy() {
    navigator.clipboard.writeText(review);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExportPDF() {
    const { jsPDF } = window.jspdf || {};
    // Use existing jsPDF from import
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 20, contentW = pageW - margin * 2;
      let y = margin;

      // Header
      doc.setFillColor(10, 11, 15); doc.rect(0, 0, pageW, 28, "F");
      doc.setFontSize(16); doc.setTextColor(240, 165, 0); doc.setFont("helvetica", "bold");
      doc.text("ResearchMind", margin, 17);
      doc.setFontSize(9); doc.setTextColor(144, 150, 168); doc.setFont("helvetica", "normal");
      doc.text("Literature Review", margin + 46, 17);
      doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), pageW - margin, 17, { align: "right" });
      y = 36;

      // Content
      const lines = review.split("\n");
      lines.forEach(line => {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        if (line.startsWith("# ") || line.match(/^\d+\. [A-Z]/)) {
          doc.setFontSize(13); doc.setTextColor(240, 165, 0); doc.setFont("helvetica", "bold");
          doc.text(line.replace(/^#+ /, ""), margin, y); y += 8;
        } else if (line.startsWith("## ")) {
          doc.setFontSize(11); doc.setTextColor(200, 200, 200); doc.setFont("helvetica", "bold");
          doc.text(line.replace("## ", ""), margin, y); y += 7;
        } else if (line.trim() === "") {
          y += 4;
        } else {
          doc.setFontSize(10); doc.setTextColor(180, 180, 180); doc.setFont("helvetica", "normal");
          const wrapped = doc.splitTextToSize(line, contentW);
          wrapped.forEach(l => { if (y > pageH - margin) { doc.addPage(); y = margin; } doc.text(l, margin, y); y += 5.5; });
        }
      });

      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p); doc.setFontSize(8); doc.setTextColor(60, 63, 80);
        doc.text("researchminds.vercel.app", margin, pageH - 8);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 8, { align: "right" });
      }
      doc.save(`LiteratureReview_${Date.now()}.pdf`);
    });
  }

  // Simple markdown renderer for the review output
  function renderMarkdown(text) {
    return text.split("\n").map((line, i) => {
      if (line.match(/^#{1,2} /)) {
        return <h3 key={i} style={{fontFamily:"'Playfair Display',serif",fontSize:"17px",color:"var(--gold)",marginTop:"24px",marginBottom:"8px",borderBottom:"1px solid rgba(240,165,0,0.2)",paddingBottom:"6px"}}>{line.replace(/^#{1,2} /, "")}</h3>;
      }
      if (line.match(/^\d+\. [A-Z]/)) {
        return <h3 key={i} style={{fontFamily:"'Playfair Display',serif",fontSize:"16px",color:"var(--gold)",marginTop:"24px",marginBottom:"8px",borderBottom:"1px solid rgba(240,165,0,0.2)",paddingBottom:"6px"}}>{line}</h3>;
      }
      if (line.startsWith("|")) {
        return <div key={i} style={{fontFamily:"'JetBrains Mono'",fontSize:"11px",color:"var(--text-secondary)",lineHeight:1.6,padding:"2px 0",borderBottom:"1px solid var(--border)"}}>{line}</div>;
      }
      if (line.trim() === "") return <div key={i} style={{height:"12px"}}/>;
      return <p key={i} style={{color:"var(--text-secondary)",fontSize:"14px",fontFamily:"'DM Sans'",lineHeight:1.8,marginBottom:"4px"}}>{line}</p>;
    });
  }

  return (
    <div style={{animation:"fadeSlideIn 0.3s ease both"}}>
      {/* Settings Panel */}
      <div className="panel-card" style={{marginBottom:"20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"24px"}}>
          <div style={{width:"40px",height:"40px",background:"linear-gradient(135deg,rgba(167,139,250,0.2),rgba(167,139,250,0.05))",border:"1px solid rgba(167,139,250,0.3)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <ScrollText size={20} color="#a78bfa"/>
          </div>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"20px",marginBottom:"2px"}}>Literature Review Generator</h2>
            <p style={{color:"var(--text-muted)",fontSize:"12px",fontFamily:"'JetBrains Mono'"}}>
              {stats.totalPapers} papers indexed · Generate a full academic literature review in seconds
            </p>
          </div>
        </div>

        {stats.totalPapers < 2 ? (
          <div style={{textAlign:"center",padding:"48px 24px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"12px"}}>
            <ScrollText size={36} color="var(--text-muted)" style={{margin:"0 auto 16px",display:"block",opacity:0.3}}/>
            <p style={{color:"var(--text-secondary)",fontSize:"14px",fontFamily:"'DM Sans'",fontWeight:600,marginBottom:"6px"}}>Need at least 2 indexed papers</p>
            <p style={{color:"var(--text-muted)",fontSize:"13px",fontFamily:"'DM Sans'"}}>Go to Search Papers and ingest at least 2 papers first.</p>
          </div>
        ) : (
          <>
            {/* Style Selector */}
            <div style={{marginBottom:"24px"}}>
              <label style={{display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"10px"}}>WRITING STYLE</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"}}>
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    style={{padding:"12px 16px",background:style===s.id?"rgba(167,139,250,0.1)":"var(--bg-secondary)",border:`1px solid ${style===s.id?"rgba(167,139,250,0.5)":"var(--border)"}`,borderRadius:"10px",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                    <p style={{color:style===s.id?"#a78bfa":"var(--text-primary)",fontSize:"13px",fontFamily:"'DM Sans'",fontWeight:600,marginBottom:"3px"}}>{s.label}</p>
                    <p style={{color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'"}}>{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Word Count Slider */}
            <div style={{marginBottom:"24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <label style={{color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em"}}>TARGET WORD COUNT</label>
                <span style={{color:"#a78bfa",fontSize:"13px",fontFamily:"'JetBrains Mono'",fontWeight:700}}>{wordCount.toLocaleString()} words</span>
              </div>
              <input type="range" min={500} max={3000} step={250} value={wordCount} onChange={e => setWordCount(Number(e.target.value))}
                style={{width:"100%",accentColor:"#a78bfa",height:"4px",cursor:"pointer"}}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"6px"}}>
                <span style={{color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'"}}>500</span>
                <span style={{color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'"}}>3,000</span>
              </div>
            </div>

            {/* Section Toggles */}
            <div style={{marginBottom:"24px"}}>
              <label style={{display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"10px"}}>INCLUDE SECTIONS</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px"}}>
                {Object.entries(SECTION_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => toggleSection(key)}
                    style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",background:sections[key]?"rgba(167,139,250,0.08)":"var(--bg-secondary)",border:`1px solid ${sections[key]?"rgba(167,139,250,0.35)":"var(--border)"}`,borderRadius:"8px",cursor:"pointer",transition:"all 0.2s",textAlign:"left"}}>
                    <div style={{width:"18px",height:"18px",flexShrink:0,borderRadius:"5px",background:sections[key]?"#a78bfa":"var(--bg-hover)",border:`1px solid ${sections[key]?"#a78bfa":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
                      {sections[key] && <Check size={11} color="#0a0b0f" strokeWidth={3}/>}
                    </div>
                    <span style={{color:sections[key]?"var(--text-primary)":"var(--text-muted)",fontSize:"12px",fontFamily:"'DM Sans'",fontWeight:sections[key]?600:400}}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="error-row" style={{marginBottom:"16px"}}><AlertCircle size={14}/>{error}</div>}

            <button onClick={handleGenerate} disabled={loading || stats.totalPapers < 2}
              style={{width:"100%",padding:"15px",background:loading?"var(--bg-hover)":"linear-gradient(135deg,#a78bfa,#7c3aed)",border:"none",borderRadius:"10px",color:loading?"var(--text-muted)":"#fff",fontWeight:700,fontSize:"15px",cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans'",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",transition:"all 0.2s",boxShadow:loading?"none":"0 4px 20px rgba(124,58,237,0.3)"}}>
              {loading
                ? <><Loader2 size={16} style={{animation:"spin 1s linear infinite"}}/> Generating your literature review — takes ~20 seconds...</>
                : <><ScrollText size={16}/> Generate Literature Review ({stats.totalPapers} papers)</>
              }
            </button>
          </>
        )}
      </div>

      {/* Review Output */}
      {review && (
        <div style={{animation:"fadeSlideIn 0.4s ease both"}}>
          {/* Meta bar */}
          {meta && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"12px",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
              <div style={{display:"flex",gap:"16px",flexWrap:"wrap"}}>
                <span style={{display:"flex",alignItems:"center",gap:"6px",color:"#a78bfa",fontSize:"12px",fontFamily:"'JetBrains Mono'"}}>
                  <FileText size={12}/> {meta.paperCount} papers
                </span>
                <span style={{display:"flex",alignItems:"center",gap:"6px",color:"var(--text-secondary)",fontSize:"12px",fontFamily:"'JetBrains Mono'"}}>
                  ~{meta.wordCount} words
                </span>
                <span style={{display:"flex",alignItems:"center",gap:"6px",color:"var(--text-secondary)",fontSize:"12px",fontFamily:"'JetBrains Mono'"}}>
                  {style} style
                </span>
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={handleGenerate}
                  style={{display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",background:"transparent",border:"1px solid var(--border)",borderRadius:"8px",color:"var(--text-muted)",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'",transition:"all 0.2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.4)";e.currentTarget.style.color="#a78bfa"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)"}}>
                  <RefreshCw size={11}/> Regenerate
                </button>
                <button onClick={handleCopy}
                  style={{display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",background:copied?"rgba(74,222,128,0.1)":"rgba(167,139,250,0.1)",border:`1px solid ${copied?"rgba(74,222,128,0.3)":"rgba(167,139,250,0.3)"}`,borderRadius:"8px",color:copied?"#4ade80":"#a78bfa",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'",transition:"all 0.2s"}}>
                  {copied ? <><Check size={11}/> Copied!</> : <><Copy size={11}/> Copy</>}
                </button>
                <button onClick={handleExportPDF}
                  style={{display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",background:"rgba(240,165,0,0.1)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"8px",color:"var(--gold)",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'",transition:"all 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(240,165,0,0.18)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(240,165,0,0.1)"}>
                  <Download size={11}/> Export PDF
                </button>
              </div>
            </div>
          )}

          {/* Review content */}
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"36px 40px",lineHeight:1.8}}>
            {renderMarkdown(review)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BATTLE TAB COMPONENT ───
function BattleTab({ indexedPapers }) {
  const [paper1, setPaper1]   = useState(null);
  const [paper2, setPaper2]   = useState(null);
  const [battle, setBattle]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const available = indexedPapers.filter(p => p.abstract && p.abstract !== "Uploaded PDF document");

  async function handleBattle() {
    if (!paper1 || !paper2) return;
    if (paper1.id === paper2.id) { setError("Please select two different papers."); return; }
    setLoading(true); setError(""); setBattle(null);
    try {
      const res = await axios.post(`${API}/battle`, { paper1, paper2 });
      setBattle(res.data.battle);
    } catch (err) {
      setError(err.response?.data?.error || "Battle failed. Please try again.");
    } finally { setLoading(false); }
  }

  function ScoreBadge({ winner, side }) {
    if (winner === "tie") return (
      <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:"rgba(240,165,0,0.12)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontFamily:"'JetBrains Mono'",color:"var(--gold)"}}>
        <Minus size={10}/> Tie
      </span>
    );
    return winner === side ? (
      <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontFamily:"'JetBrains Mono'",color:"#4ade80"}}>
        <Trophy size={10}/> Winner
      </span>
    ) : (
      <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontFamily:"'JetBrains Mono'",color:"#f87171"}}>
        Loses
      </span>
    );
  }

  function RoundRow({ label, data }) {
    if (!data) return null;
    return (
      <div style={{background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"12px",padding:"16px 20px",marginBottom:"12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
          <span style={{color:"var(--gold)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",fontWeight:700}}>{label}</span>
          <div style={{display:"flex",gap:"6px"}}>
            <ScoreBadge winner={data.winner} side="1"/>
            <ScoreBadge winner={data.winner} side="2"/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"10px"}}>
          <div style={{background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:"8px",padding:"10px 12px"}}>
            <p style={{color:"#60a5fa",fontSize:"10px",fontFamily:"'JetBrains Mono'",marginBottom:"5px"}}>🔵 PAPER 1</p>
            <p style={{color:"var(--text-secondary)",fontSize:"12px",fontFamily:"'DM Sans'",lineHeight:1.5}}>{data.paper1}</p>
          </div>
          <div style={{background:"rgba(244,114,182,0.06)",border:"1px solid rgba(244,114,182,0.2)",borderRadius:"8px",padding:"10px 12px"}}>
            <p style={{color:"#f472b6",fontSize:"10px",fontFamily:"'JetBrains Mono'",marginBottom:"5px"}}>🔴 PAPER 2</p>
            <p style={{color:"var(--text-secondary)",fontSize:"12px",fontFamily:"'DM Sans'",lineHeight:1.5}}>{data.paper2}</p>
          </div>
        </div>
        <p style={{color:"var(--text-muted)",fontSize:"12px",fontFamily:"'DM Sans'",fontStyle:"italic",borderTop:"1px solid var(--border)",paddingTop:"8px"}}>{data.reason}</p>
      </div>
    );
  }

  return (
    <div style={{animation:"fadeSlideIn 0.3s ease both"}}>
      <div className="panel-card">
        <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
          <div style={{width:"40px",height:"40px",background:"linear-gradient(135deg,rgba(240,165,0,0.2),rgba(240,165,0,0.05))",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Swords size={20} color="var(--gold)"/>
          </div>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"20px",marginBottom:"2px"}}>Paper vs Paper Battle</h2>
            <p style={{color:"var(--text-muted)",fontSize:"12px",fontFamily:"'JetBrains Mono'"}}>AI debates two papers head-to-head across methodology, novelty, and impact</p>
          </div>
        </div>

        {available.length < 2 ? (
          <div style={{textAlign:"center",padding:"48px 24px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"12px"}}>
            <GitCompare size={36} color="var(--text-muted)" style={{margin:"0 auto 16px",display:"block",opacity:0.3}}/>
            <p style={{color:"var(--text-secondary)",fontSize:"14px",fontFamily:"'DM Sans'",fontWeight:600,marginBottom:"6px"}}>Need at least 2 indexed papers</p>
            <p style={{color:"var(--text-muted)",fontSize:"13px",fontFamily:"'DM Sans'"}}>Go to Search Papers and ingest at least 2 papers first.</p>
          </div>
        ) : (
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 60px 1fr",gap:"16px",alignItems:"start",marginBottom:"20px",minWidth:0,overflow:"hidden"}}>
              <div style={{minWidth:0,overflow:"hidden"}}>
                <label style={{display:"block",color:"#60a5fa",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"8px"}}>🔵 PAPER 1</label>
                <select value={paper1?.id||""} onChange={e=>setPaper1(available.find(p=>p.id===e.target.value)||null)}
                  style={{width:"100%",padding:"12px 14px",background:"rgba(96,165,250,0.05)",border:`1px solid ${paper1?"rgba(96,165,250,0.5)":"var(--border)"}`,borderRadius:"10px",color:paper1?"var(--text-primary)":"var(--text-muted)",fontSize:"13px",fontFamily:"'DM Sans'",outline:"none",cursor:"pointer",transition:"border 0.2s",minWidth:0}}>
                  <option value="">Select a paper...</option>
                  {available.map(p=><option key={p.id} value={p.id} disabled={paper2?.id===p.id}>{p.title?.slice(0,52)}{p.title?.length>52?"...":""}</option>)}
                </select>
                {paper1 && <div style={{marginTop:"8px",padding:"10px 12px",background:"rgba(96,165,250,0.05)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:"8px",overflow:"hidden",minWidth:0}}>
                  <p style={{color:"#60a5fa",fontSize:"12px",fontFamily:"'DM Sans'",fontWeight:600,marginBottom:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{paper1.title}</p>
                  <p style={{color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'"}}>{paper1.published}</p>
                </div>}
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",paddingTop:"28px"}}>
                <div style={{width:"44px",height:"44px",background:"linear-gradient(135deg,rgba(240,165,0,0.15),rgba(240,165,0,0.05))",border:"1px solid rgba(240,165,0,0.35)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{color:"var(--gold)",fontSize:"13px",fontFamily:"'JetBrains Mono'",fontWeight:700}}>VS</span>
                </div>
              </div>
              <div style={{minWidth:0,overflow:"hidden"}}>
                <label style={{display:"block",color:"#f472b6",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"8px"}}>🔴 PAPER 2</label>
                <select value={paper2?.id||""} onChange={e=>setPaper2(available.find(p=>p.id===e.target.value)||null)}
                  style={{width:"100%",padding:"12px 14px",background:"rgba(244,114,182,0.05)",border:`1px solid ${paper2?"rgba(244,114,182,0.5)":"var(--border)"}`,borderRadius:"10px",color:paper2?"var(--text-primary)":"var(--text-muted)",fontSize:"13px",fontFamily:"'DM Sans'",outline:"none",cursor:"pointer",transition:"border 0.2s",minWidth:0}}>
                  <option value="">Select a paper...</option>
                  {available.map(p=><option key={p.id} value={p.id} disabled={paper1?.id===p.id}>{p.title?.slice(0,52)}{p.title?.length>52?"...":""}</option>)}
                </select>
                {paper2 && <div style={{marginTop:"8px",padding:"10px 12px",background:"rgba(244,114,182,0.05)",border:"1px solid rgba(244,114,182,0.15)",borderRadius:"8px",overflow:"hidden",minWidth:0}}>
                  <p style={{color:"#f472b6",fontSize:"12px",fontFamily:"'DM Sans'",fontWeight:600,marginBottom:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{paper2.title}</p>
                  <p style={{color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'"}}>{paper2.published}</p>
                </div>}
              </div>
            </div>

            {error && <div className="error-row" style={{marginBottom:"16px"}}><AlertCircle size={14}/>{error}</div>}

            <button onClick={handleBattle} disabled={!paper1||!paper2||loading||paper1?.id===paper2?.id}
              style={{width:"100%",padding:"14px",background:(!paper1||!paper2||loading)?"var(--bg-hover)":"linear-gradient(135deg,var(--gold),var(--gold-dim))",border:"none",borderRadius:"10px",color:(!paper1||!paper2||loading)?"var(--text-muted)":"#0a0b0f",fontWeight:700,fontSize:"15px",cursor:(!paper1||!paper2||loading)?"not-allowed":"pointer",fontFamily:"'DM Sans'",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",transition:"all 0.2s",boxShadow:(!paper1||!paper2||loading)?"none":"0 4px 20px rgba(240,165,0,0.25)"}}>
              {loading ? <><Loader2 size={16} style={{animation:"spin 1s linear infinite"}}/> Analyzing papers — this takes ~10 seconds...</> : <><Swords size={16}/> Start Battle</>}
            </button>
          </>
        )}
      </div>

      {battle && (
        <div style={{animation:"fadeSlideIn 0.4s ease both"}}>
          {/* Topic + Stances */}
          <div style={{background:"linear-gradient(135deg,rgba(240,165,0,0.07),rgba(240,165,0,0.02))",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"16px",padding:"24px 28px",marginBottom:"20px"}}>
            <div style={{textAlign:"center",marginBottom:"20px"}}>
              <p style={{color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"6px"}}>BATTLE TOPIC</p>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:"22px",color:"var(--text-primary)"}}>{battle.topic}</h3>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 40px 1fr",gap:"16px",alignItems:"center"}}>
              <div style={{background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:"10px",padding:"14px 16px"}}>
                <p style={{color:"#60a5fa",fontSize:"10px",fontFamily:"'JetBrains Mono'",marginBottom:"8px",letterSpacing:"0.06em"}}>🔵 {paper1?.title?.slice(0,35)}{paper1?.title?.length>35?"...":""}</p>
                <p style={{color:"var(--text-secondary)",fontSize:"12px",fontFamily:"'DM Sans'",lineHeight:1.6}}>{battle.paper1_stance}</p>
              </div>
              <div style={{textAlign:"center",fontSize:"20px"}}>⚔️</div>
              <div style={{background:"rgba(244,114,182,0.07)",border:"1px solid rgba(244,114,182,0.2)",borderRadius:"10px",padding:"14px 16px"}}>
                <p style={{color:"#f472b6",fontSize:"10px",fontFamily:"'JetBrains Mono'",marginBottom:"8px",letterSpacing:"0.06em"}}>🔴 {paper2?.title?.slice(0,35)}{paper2?.title?.length>35?"...":""}</p>
                <p style={{color:"var(--text-secondary)",fontSize:"12px",fontFamily:"'DM Sans'",lineHeight:1.6}}>{battle.paper2_stance}</p>
              </div>
            </div>
          </div>

          {/* Rounds */}
          <p style={{color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"12px"}}>BATTLE ROUNDS</p>
          <RoundRow label="📊 METHODOLOGY" data={battle.methodology}/>
          <RoundRow label="💡 NOVELTY" data={battle.novelty}/>
          <RoundRow label="🌍 IMPACT" data={battle.impact}/>

          {/* Agreements */}
          {battle.agreements?.length > 0 && (
            <div style={{background:"rgba(74,222,128,0.04)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:"12px",padding:"16px 20px",marginBottom:"12px"}}>
              <p style={{color:"#4ade80",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"10px"}}>🤝 COMMON GROUND</p>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {battle.agreements.map((a,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
                    <CheckCircle2 size={13} color="#4ade80" style={{flexShrink:0,marginTop:"2px"}}/>
                    <span style={{color:"var(--text-secondary)",fontSize:"13px",fontFamily:"'DM Sans'",lineHeight:1.5}}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Difference */}
          {battle.key_difference && (
            <div style={{background:"rgba(240,165,0,0.04)",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"12px",padding:"14px 20px",marginBottom:"16px",display:"flex",alignItems:"flex-start",gap:"12px"}}>
              <Swords size={15} color="var(--gold)" style={{flexShrink:0,marginTop:"2px"}}/>
              <div>
                <p style={{color:"var(--gold)",fontSize:"10px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"5px"}}>KEY DIFFERENCE</p>
                <p style={{color:"var(--text-secondary)",fontSize:"13px",fontFamily:"'DM Sans'",lineHeight:1.6}}>{battle.key_difference}</p>
              </div>
            </div>
          )}

          {/* Verdict */}
          {battle.verdict && (() => {
            const w = battle.verdict.winner;
            const color = w==="tie"?"var(--gold)":w==="1"?"#60a5fa":"#f472b6";
            const bg    = w==="tie"?"rgba(240,165,0,0.08)":w==="1"?"rgba(96,165,250,0.08)":"rgba(244,114,182,0.08)";
            const border= w==="tie"?"rgba(240,165,0,0.3)":w==="1"?"rgba(96,165,250,0.3)":"rgba(244,114,182,0.3)";
            const title = w==="tie"?"🤝 It's a Tie!":w==="1"?`🔵 ${paper1?.title?.slice(0,38)}... Wins`:`🔴 ${paper2?.title?.slice(0,38)}... Wins`;
            return (
              <div style={{background:`linear-gradient(135deg,${bg},transparent)`,border:`1px solid ${border}`,borderRadius:"14px",padding:"28px",textAlign:"center"}}>
                <Trophy size={30} color={color} style={{margin:"0 auto 12px",display:"block"}}/>
                <p style={{fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",color:"var(--text-muted)",marginBottom:"8px"}}>FINAL VERDICT</p>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:"22px",fontWeight:700,color:"var(--text-primary)",marginBottom:"12px"}}>{title}</p>
                <p style={{color:"var(--text-secondary)",fontSize:"14px",fontFamily:"'DM Sans'",lineHeight:1.8,maxWidth:"600px",margin:"0 auto"}}>{battle.verdict.summary}</p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { isSignedIn, user } = useUser();
  const { signOut }          = useClerk();

  const [tab, setTab]                       = useState("ingest");
  const [selectedSource, setSelectedSource] = useState("arxiv");
  const [ingestQuery, setIngestQuery]       = useState("");
  const [maxResults, setMaxResults]         = useState(3);
  const [question, setQuestion]             = useState("");
  const [papers, setPapers]                 = useState([]);
  const [stats, setStats]                   = useState({ totalPapers: 0, totalChunks: 0 });
  const [error, setError]                   = useState("");
  const [messages, setMessages]             = useState([]);
  const [isAsking, setIsAsking]             = useState(false);
  const [progress, setProgress]             = useState(0);
  const [progressLogs, setProgressLogs]     = useState([]);
  const [isIngesting, setIsIngesting]       = useState(false);
  const [ingestDone, setIngestDone]         = useState(false);
  const [ingestError, setIngestError]       = useState(false);
  const [serverStatus, setServerStatus]     = useState(null);
  const [showWelcome,  setShowWelcome]      = useState(false);
  const [showHardWall, setShowHardWall]     = useState(false);
  const [searchCount,  setSearchCount]      = useState(0);

  // ─── VOICE STATE ───
  const [isListening,    setIsListening]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(null);

  const eventSourceRef = useRef(null);
  const chatEndRef     = useRef(null);
  const inputRef       = useRef(null);
  const wakeTimerRef   = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    fetchStats();
    if (!isSignedIn) {
      const welcomed = localStorage.getItem(STORAGE_KEY_WELCOMED);
      if (!welcomed) setTimeout(() => setShowWelcome(true), 800);
      const count = parseInt(localStorage.getItem(STORAGE_KEY_COUNT) || "0", 10);
      setSearchCount(count);
      if (count >= FREE_LIMIT) setTimeout(() => setShowHardWall(true), 800);
    }
    return () => clearTimeout(wakeTimerRef.current);
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) { setShowWelcome(false); setShowHardWall(false); }
  }, [isSignedIn]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function fetchStats() {
    wakeTimerRef.current = setTimeout(() => setServerStatus("waking"), 2000);
    try {
      const res = await axios.get(`${API}/stats`);
      clearTimeout(wakeTimerRef.current);
      setServerStatus(null); setStats(res.data);
    } catch {
      clearTimeout(wakeTimerRef.current);
      setServerStatus("offline");
    }
  }

  // ─── VOICE INPUT ───
  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = false;
    recognition.lang            = ""; // auto-detect language
    recognition.onstart  = () => setIsListening(true);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => setIsListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setQuestion(transcript);
      setTimeout(() => { if (transcript.trim()) handleAskWithQuestion(transcript.trim()); }, 300);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() { recognitionRef.current?.stop(); setIsListening(false); }

  // ─── DETECT LANGUAGE FROM TEXT ───
  function detectLang(text) {
    // Check for Devanagari script (Hindi)
    if (/[\u0900-\u097F]/.test(text)) return "hi";
    // Check for Arabic script
    if (/[\u0600-\u06FF]/.test(text)) return "ar";
    // Check for Chinese characters
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
    // Check for Japanese
    if (/[\u3040-\u30FF]/.test(text)) return "ja";
    // Check for Korean
    if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
    // Check for Spanish indicators
    if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
    // Check for French indicators
    if (/[àâæçéèêëîïôœùûüÿ]/i.test(text)) return "fr";
    return "en";
  }

  // ─── VOICE OUTPUT — language-aware, waits for voices to load ───
  function speakAnswer(text, idx) {
    window.speechSynthesis.cancel();

    // Toggle off if already speaking this message
    if (speakingMsgIdx === idx && isSpeaking) {
      setIsSpeaking(false);
      setSpeakingMsgIdx(null);
      return;
    }

    function doSpeak() {
      const utterance  = new SpeechSynthesisUtterance(text);
      utterance.rate   = 0.88;
      utterance.pitch  = 1;
      utterance.volume = 1;

      const lang   = detectLang(text);
      const voices = window.speechSynthesis.getVoices();

      // Language → preferred voice lang code
      const langMap = { hi: "hi", ar: "ar", zh: "zh", ja: "ja", ko: "ko", es: "es", fr: "fr", en: "en" };
      const targetLang = langMap[lang] || "en";

      // Try to find a voice matching the detected language
      const voice = voices.find(v => v.lang.startsWith(targetLang) && v.localService)
                 || voices.find(v => v.lang.startsWith(targetLang))
                 || voices.find(v => v.lang.startsWith("en") && v.localService)
                 || voices.find(v => v.lang.startsWith("en"))
                 || voices[0];

      if (voice) {
        utterance.voice = voice;
        utterance.lang  = voice.lang;
      }

      console.log(`🔊 Speaking in ${lang} using voice: ${voice?.name || "default"}`);

      utterance.onstart = () => { setIsSpeaking(true);  setSpeakingMsgIdx(idx); };
      utterance.onend   = () => { setIsSpeaking(false); setSpeakingMsgIdx(null); };
      utterance.onerror = (e) => {
        console.warn("Speech error:", e.error);
        setIsSpeaking(false);
        setSpeakingMsgIdx(null);
      };
      window.speechSynthesis.speak(utterance);
    }

    // Voices may not be loaded on first call — wait for them
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
    }
  }

  function handleWelcomeSkip()  { localStorage.setItem(STORAGE_KEY_WELCOMED, "skipped");   setShowWelcome(false); }
  function handleWelcomeClose() { localStorage.setItem(STORAGE_KEY_WELCOMED, "signed_in"); setShowWelcome(false); }

  function incrementSearchCount() {
    if (isSignedIn) return true;
    const next = searchCount + 1;
    setSearchCount(next);
    localStorage.setItem(STORAGE_KEY_COUNT, String(next));
    if (next > FREE_LIMIT) { setShowHardWall(true); return false; }
    return true;
  }

  async function handleAskWithQuestion(q) {
    if (!q || isAsking) return;
    const allowed = incrementSearchCount();
    if (!allowed) return;
    const userMsg = { role: "user", question: q };
    const aiMsg   = { role: "ai", loading: true };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setQuestion("");
    setIsAsking(true);
    try {
      const res = await axios.post(`${API}/ask`, { question: q });
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { role: "ai", answer: res.data.answer, citations: res.data.citations, confidence: res.data.confidence }
          : m
      ));
    } catch (err) {
      const errMsg = err.response?.data?.error || "Something went wrong. Please try again.";
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { role: "ai", error: errMsg } : m));
    } finally {
      setIsAsking(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleAsk() {
    const q = question.trim();
    if (!q || isAsking) return;
    await handleAskWithQuestion(q);
  }

  function handleClearChat() {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMsgIdx(null);
    setMessages([]);
  }

  function exportToPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20, contentW = pageW - margin * 2;
    let y = margin;
    function checkNewPage(needed = 10) { if (y + needed > pageH - margin) { doc.addPage(); y = margin; } }
    function wrappedText(text, x, startY, maxWidth, lineHeight = 6) {
      doc.splitTextToSize(text, maxWidth).forEach(line => { checkNewPage(lineHeight); doc.text(line, x, y); y += lineHeight; });
    }
    doc.setFillColor(10, 11, 15); doc.rect(0, 0, pageW, 28, "F");
    doc.setFontSize(18); doc.setTextColor(240, 165, 0); doc.setFont("helvetica", "bold"); doc.text("ResearchMind", margin, 17);
    doc.setFontSize(9); doc.setTextColor(144, 150, 168); doc.setFont("helvetica", "normal");
    doc.text("AI Research Assistant — Exported Report", margin + 52, 17);
    doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), pageW - margin, 17, { align: "right" });
    y = 36;
    doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.text("Research Q&A Session", margin, y); y += 5;
    doc.setDrawColor(240, 165, 0); doc.setLineWidth(0.5); doc.line(margin, y, pageW - margin, y); y += 10;
    const qaPairs = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "user" && messages[i+1]?.role === "ai") qaPairs.push({ question: messages[i].question, ai: messages[i+1] });
    }
    qaPairs.forEach((pair, idx) => {
      checkNewPage(20);
      doc.setFontSize(9); doc.setTextColor(240, 165, 0); doc.setFont("helvetica", "bold"); doc.text(`Q${idx + 1}`, margin, y); y += 1;
      doc.setFontSize(11); doc.setTextColor(230, 230, 230); doc.setFont("helvetica", "bold"); wrappedText(pair.question, margin, y, contentW, 6); y += 4;
      if (pair.ai.answer) {
        doc.setFontSize(9); doc.setTextColor(144, 150, 168); doc.setFont("helvetica", "bold"); doc.text("AI ANSWER", margin, y); y += 5;
        doc.setFontSize(10); doc.setTextColor(200, 200, 200); doc.setFont("helvetica", "normal"); wrappedText(pair.ai.answer, margin, y, contentW, 5.5); y += 4;
        if (pair.ai.citations?.length > 0) {
          checkNewPage(10); doc.setFontSize(8); doc.setTextColor(240, 165, 0); doc.setFont("helvetica", "bold"); doc.text("SOURCES", margin, y); y += 5;
          pair.ai.citations.forEach(c => { checkNewPage(10); doc.setFontSize(8); doc.setTextColor(144, 150, 168); doc.setFont("helvetica", "normal"); wrappedText(`[${c.number}] ${c.title} — ${c.authors?.slice(0, 60) || ""}${c.authors?.length > 60 ? "..." : ""} (${c.published})`, margin + 3, y, contentW - 3, 5); });
          y += 3;
        }
      } else if (pair.ai.error) { doc.setFontSize(9); doc.setTextColor(248, 113, 113); doc.text(`Error: ${pair.ai.error}`, margin, y); y += 6; }
      if (idx < qaPairs.length - 1) { checkNewPage(8); y += 2; doc.setDrawColor(42, 45, 58); doc.setLineWidth(0.3); doc.line(margin, y, pageW - margin, y); y += 8; }
    });
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(60, 63, 80); doc.text(`researchminds.vercel.app`, margin, pageH - 8); doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 8, { align: "right" }); }
    doc.save(`ResearchMind_Report_${Date.now()}.pdf`);
  }

  async function handleClear() {
    if (!confirm("Clear all ingested papers from the database?")) return;
    try {
      await axios.delete(`${API}/clear`);
      setStats({ totalPapers: 0, totalChunks: 0 }); setPapers([]); setMessages([]);
      setProgress(0); setProgressLogs([]); setIngestDone(false);
    } catch {}
  }

  function handleIngest() {
    if (!ingestQuery.trim()) return;
    setPapers([]); setError(""); setProgress(0);
    setProgressLogs([]); setIsIngesting(true); setIngestDone(false); setIngestError(false);
    if (eventSourceRef.current) eventSourceRef.current.close();
    const url = `${API}/ingest-progress?query=${encodeURIComponent(ingestQuery)}&maxResults=${maxResults}&source=${selectedSource}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress !== undefined) setProgress(data.progress);
      setProgressLogs(prev => [...prev, { type: data.type, message: data.message }]);
      if (data.type === "done")  { setPapers(data.papers); setStats(data.stats); setIngestDone(true); setIsIngesting(false); es.close(); }
      if (data.type === "error") { setError(data.message); setIngestError(true); setIsIngesting(false); es.close(); }
    };
    es.onerror = () => { setError("Connection lost. Please try again."); setIngestError(true); setIsIngesting(false); es.close(); };
  }

  function handlePaperIndexed(paper) { setPapers(prev => [paper, ...prev]); }

  const activeSource      = SOURCES.find(s => s.id === selectedSource);
  const remainingSearches = isSignedIn ? "∞" : Math.max(0, FREE_LIMIT - searchCount);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn      { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp     { from { opacity: 0; transform: translateY(40px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pulse       { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin        { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes micPulse    { 0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.4); } 50% { box-shadow: 0 0 0 8px rgba(248,113,113,0); } }
        .app-header { border-bottom: 1px solid var(--border); background: rgba(10,11,15,0.9); backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 100; }
        .header-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 40px; }
        .header-logo { display: flex; align-items: center; gap: 12px; }
        .header-logo-icon { width: 32px; height: 32px; flex-shrink: 0; background: linear-gradient(135deg, var(--gold), var(--gold-dim)); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .header-logo-text { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
        .header-actions { display: flex; gap: 10px; align-items: center; }
        .stat-pill { display: flex; align-items: center; gap: 6px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 6px 14px; white-space: nowrap; }
        .stat-pill span { font-family: 'JetBrains Mono'; font-size: 12px; color: var(--text-secondary); }
        .clear-btn { display: flex; align-items: center; gap: 5px; padding: 6px 12px; background: transparent; border: 1px solid rgba(248,113,113,0.3); border-radius: 8px; color: #f87171; font-size: 12px; cursor: pointer; font-family: 'JetBrains Mono'; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
        .clear-btn:hover { background: rgba(248,113,113,0.08); }
        .main-content { max-width: 1100px; margin: 0 auto; padding: 48px 40px 60px; }
        .hero-section { text-align: center; margin-bottom: 56px; animation: fadeSlideIn 0.6s ease both; }
        .hero-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gold-glow); border: 1px solid rgba(240,165,0,0.25); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; }
        .hero-title { font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 58px); font-weight: 700; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 16px; }
        .hero-subtitle { color: var(--text-secondary); font-size: 16px; max-width: 520px; margin: 0 auto; line-height: 1.7; }
        .tab-bar { display: flex; gap: 4px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 4px; margin-bottom: 32px; animation: fadeSlideIn 0.6s ease 0.1s both; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
        .tab-label { display: inline; }
        .tab-bar::-webkit-scrollbar { display: none; }
        .tab-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; transition: all 0.2s ease; white-space: nowrap; }
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
        .search-input { width: 100%; padding: 13px 16px 13px 42px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; transition: border 0.2s; }
        .search-input:focus { border-color: rgba(240,165,0,0.5); }
        .count-select { padding: 13px 16px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; color: var(--text-secondary); font-size: 14px; font-family: 'JetBrains Mono', monospace; outline: none; cursor: pointer; }
        .action-btn { padding: 13px 28px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
        .papers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .error-row { display: flex; align-items: center; gap: 8px; color: var(--red); font-size: 13px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 8px; padding: 10px 14px; margin-top: 12px; }
        .chat-container { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; display: flex; flex-direction: column; height: 600px; overflow: hidden; }
        .chat-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 24px; scroll-behavior: smooth; }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        .chat-input-area { border-top: 1px solid var(--border); padding: 16px 20px; display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0; background: var(--bg-secondary); }
        .chat-input { flex: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; color: var(--text-primary); font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; resize: none; min-height: 44px; max-height: 120px; transition: border 0.2s; line-height: 1.5; }
        .chat-input:focus { border-color: rgba(240,165,0,0.5); }
        .chat-input::placeholder { color: var(--text-muted); }
        .send-btn { width: 44px; height: 44px; flex-shrink: 0; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .send-btn:disabled { cursor: not-allowed; opacity: 0.5; }
        .mic-active { animation: micPulse 1.2s ease infinite; }
        @media (max-width: 768px) {
          .header-inner { padding: 0 20px; height: 56px; } .chunks-pill { display: none; }
          .main-content { padding: 24px 16px 60px; } .panel-card { padding: 20px 16px; }
          .hero-section { margin-bottom: 28px; } .source-grid { grid-template-columns: repeat(2, 1fr); }
          .search-row { flex-wrap: wrap; } .search-input-wrap { flex: 1 1 100%; }
          .count-select { flex: 1; } .ingest-btn { flex: 1; justify-content: center; }
          .papers-grid { grid-template-columns: 1fr; }
          .tab-btn { font-size: 12px; padding: 10px 14px; }
          .chat-container { height: 500px; }
          .hero-title { font-size: clamp(26px, 6vw, 42px); }
        }
        @media (max-width: 600px) {
          .tab-label { display: none; }
          .tab-btn { flex: 1; padding: 12px 8px; gap: 0; min-width: 48px; }
          .tab-bar { gap: 2px; padding: 3px; }
        }
        @media (max-width: 480px) {
          .header-inner { padding: 0 14px; } .header-logo-text { font-size: 15px; } .stat-pill { display: none; }
          .main-content { padding: 16px 12px 60px; } .panel-card { padding: 16px 14px; border-radius: 12px; }
          .source-grid { gap: 8px; } .source-btn-sub { display: none; } .source-btn-label { font-size: 12px; }
          .hero-section { margin-bottom: 20px; } .hero-title { font-size: clamp(22px, 7vw, 32px); }
          .hero-subtitle { font-size: 13px; } .panel-title { font-size: 17px; }
          .chat-container { height: 420px; } .tab-bar { margin-bottom: 16px; border-radius: 10px; }
        }
      `}</style>

      {showWelcome && !isSignedIn && <WelcomeModal onSkip={handleWelcomeSkip} onClose={handleWelcomeClose} />}
      {showHardWall && !isSignedIn && <HardWallModal />}

      <div style={{ minHeight: "100vh" }}>
        <header className="app-header">
          <div className="header-inner">
            <div className="header-logo">
              <div className="header-logo-icon"><Brain size={16} color="#0a0b0f" /></div>
              <span className="header-logo-text">Research<span style={{ color: "var(--gold)" }}>Mind</span></span>
            </div>
            <div className="header-actions">
              {!isSignedIn && (
                <div className="stat-pill" style={{ borderColor: searchCount >= FREE_LIMIT ? "rgba(248,113,113,0.3)" : "var(--border)" }}>
                  <Zap size={12} color={searchCount >= FREE_LIMIT ? "#f87171" : "var(--gold)"} />
                  <span style={{ color: searchCount >= FREE_LIMIT ? "#f87171" : "var(--text-secondary)" }}>{remainingSearches} searches left</span>
                </div>
              )}
              {isSignedIn && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="stat-pill" style={{ borderColor: "rgba(74,222,128,0.3)" }}>
                    <CheckCircle2 size={12} color="#4ade80" />
                    <span style={{ color: "#4ade80" }}>{user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Signed in"}</span>
                  </div>
                  <button onClick={() => signOut()} style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer", fontFamily: "'JetBrains Mono'", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; e.currentTarget.style.color = "#f87171"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >Sign out</button>
                </div>
              )}
              {!isSignedIn && (
                <SignInButton mode="modal">
                  <button style={{ padding: "6px 14px", background: "linear-gradient(135deg, var(--gold), var(--gold-dim))", border: "none", borderRadius: "8px", color: "#0a0b0f", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'" }}>Sign In</button>
                </SignInButton>
              )}
              <div className="stat-pill"><Database size={12} color="var(--gold)" /><span>{stats.totalPapers} papers</span></div>
              <div className="stat-pill chunks-pill"><FileText size={12} color="var(--blue)" /><span>{stats.totalChunks} chunks</span></div>
              {stats.totalChunks > 0 && <button className="clear-btn" onClick={handleClear}><Trash2 size={11} /> Clear</button>}
            </div>
          </div>
        </header>

        {serverStatus === "waking" && (
          <div style={{ width: "100%", background: "linear-gradient(90deg, rgba(240,165,0,0.12), rgba(240,165,0,0.06))", borderBottom: "1px solid rgba(240,165,0,0.25)", padding: "10px 40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", animation: "fadeSlideIn 0.4s ease both" }}>
            <Loader2 size={13} color="var(--gold)" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", color: "var(--gold)" }}>Server is waking up — this may take up to 30 seconds on first visit...</span>
          </div>
        )}
        {serverStatus === "offline" && (
          <div style={{ width: "100%", background: "rgba(248,113,113,0.08)", borderBottom: "1px solid rgba(248,113,113,0.25)", padding: "10px 40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <AlertCircle size={13} color="#f87171" style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "12px", color: "#f87171" }}>Server appears to be offline. Please try refreshing the page.</span>
            <button onClick={fetchStats} style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "6px", color: "#f87171", fontSize: "11px", padding: "3px 10px", cursor: "pointer", fontFamily: "'JetBrains Mono'" }}>Retry</button>
          </div>
        )}

        <main className="main-content">
          <div className="hero-section">
            <div className="hero-badge">
              <Sparkles size={12} color="var(--gold)" />
              <span style={{ color: "var(--gold)", fontSize: "12px", fontFamily: "'JetBrains Mono'" }}>AI-Powered Research Assistant</span>
            </div>
            <h1 className="hero-title">
              Understand research papers<br />
              <span style={{ background: "linear-gradient(135deg, var(--gold), #ffcc55)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>in seconds, not hours</span>
            </h1>
            <p className="hero-subtitle">Search across ArXiv, PubMed, Semantic Scholar and ChemRxiv — or upload your own PDF. Ask questions in plain English and get cited answers.</p>
          </div>

          <div className="tab-bar">
            {[
              { id: "ingest",    label: "Search Papers", icon: BookOpen },
              { id: "upload",    label: "Upload PDF",    icon: Upload },
              { id: "ask",       label: "Ask",           icon: MessageSquare },
              { id: "battle",    label: "Battle",        icon: Swords },
              { id: "litreview", label: "Lit Review",    icon: ScrollText },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{ background: tab === id ? "linear-gradient(135deg, rgba(240,165,0,0.15), rgba(240,165,0,0.05))" : "transparent", color: tab === id ? "var(--gold)" : "var(--text-muted)", border: tab === id ? "1px solid rgba(240,165,0,0.25)" : "1px solid transparent" }}>
                <Icon size={15} />
                <span className="tab-label">{label}</span>
              </button>
            ))}
          </div>

          {tab === "ingest" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div className="panel-card">
                <h2 className="panel-title">Search & Ingest Papers</h2>
                <p className="panel-subtitle">Choose your source, search for papers, and index them for Q&A</p>
                <p style={{ color: "var(--text-secondary)", fontSize: "11px", marginBottom: "10px", fontFamily: "'JetBrains Mono'", letterSpacing: "0.08em" }}>SELECT SOURCE</p>
                <div className="source-grid">
                  {SOURCES.map(source => {
                    const isActive = selectedSource === source.id;
                    return (
                      <button key={source.id} className="source-btn" onClick={() => setSelectedSource(source.id)} style={{ background: isActive ? `${source.color}18` : "var(--bg-secondary)", border: isActive ? `1px solid ${source.color}` : "1px solid var(--border)" }}>
                        <div className="source-btn-label" style={{ color: isActive ? source.color : "var(--text-primary)" }}>{source.label}</div>
                        <div className="source-btn-sub">{source.fields}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="search-row">
                  <div className="search-input-wrap">
                    <span className="search-input-icon"><Search size={16} /></span>
                    <input className="search-input" value={ingestQuery} onChange={e => setIngestQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleIngest()} placeholder={`Search ${activeSource?.label}...`} disabled={isIngesting} />
                  </div>
                  <select className="count-select" value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} disabled={isIngesting}>
                    {[2, 3, 5, 8, 10].map(n => <option key={n} value={n}>{n} papers</option>)}
                  </select>
                  <button className="action-btn ingest-btn" onClick={handleIngest} disabled={isIngesting || !ingestQuery.trim()} style={{ background: isIngesting ? "var(--bg-hover)" : "linear-gradient(135deg, var(--gold), var(--gold-dim))", color: isIngesting ? "var(--text-muted)" : "#0a0b0f", cursor: isIngesting ? "not-allowed" : "pointer" }}>
                    {isIngesting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} />}
                    {isIngesting ? "Processing..." : "Ingest"}
                  </button>
                </div>
                {(isIngesting || ingestDone || ingestError) && progressLogs.length > 0 && <ProgressBar progress={progress} logs={progressLogs} isDone={ingestDone} isError={ingestError} />}
                {error && !ingestError && <div className="error-row"><AlertCircle size={14} />{error}</div>}
              </div>
              {papers.length > 0 && (
                <div style={{ animation: "fadeSlideIn 0.4s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px" }}>Ingested Papers</h3>
                    <Badge color="green">{papers.length} indexed</Badge>
                  </div>
                  <div className="papers-grid">{papers.map((paper, i) => <PaperCard key={paper.id} paper={paper} index={i} />)}</div>
                  <div style={{ marginTop: "28px", textAlign: "center", padding: "24px", background: "var(--gold-glow)", border: "1px solid rgba(240,165,0,0.2)", borderRadius: "12px" }}>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "12px", fontSize: "14px" }}>Papers indexed! Ready to answer questions.</p>
                    <button onClick={() => setTab("ask")} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px", background: "linear-gradient(135deg, var(--gold), var(--gold-dim))", border: "none", borderRadius: "8px", color: "#0a0b0f", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "'DM Sans'" }}>
                      Ask Questions <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "upload" && <UploadTab onPaperIndexed={handlePaperIndexed} setStats={setStats} />}

          {tab === "ask" && (
            <div style={{ animation: "fadeSlideIn 0.3s ease both" }}>
              <div className="chat-container">
                <div className="chat-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "28px", height: "28px", background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Brain size={14} color="#60a5fa" />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>ResearchMind AI</p>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'JetBrains Mono'" }}>
                        {stats.totalPapers} papers · {stats.totalChunks} chunks indexed
                        {!isSignedIn && <span style={{ marginLeft: "8px", color: searchCount >= FREE_LIMIT ? "#f87171" : "rgba(240,165,0,0.7)" }}>· {remainingSearches} searches left</span>}
                      </p>
                    </div>
                  </div>
                  {messages.length > 0 && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={exportToPDF} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.3)", borderRadius: "6px", color: "var(--gold)", fontSize: "11px", cursor: "pointer", fontFamily: "'JetBrains Mono'", transition: "all 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(240,165,0,0.15)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(240,165,0,0.08)"}
                      ><Download size={10} /> Export PDF</button>
                      <button onClick={handleClearChat} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-muted)", fontSize: "11px", cursor: "pointer", fontFamily: "'JetBrains Mono'", transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; e.currentTarget.style.color = "#f87171"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                      ><Trash2 size={10} /> Clear chat</button>
                    </div>
                  )}
                </div>

                <div className="chat-messages">
                  {messages.length === 0 && (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                      <div style={{ width: "48px", height: "48px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Brain size={22} color="#60a5fa" style={{ opacity: 0.6 }} />
                      </div>
                      <p style={{ color: "var(--text-muted)", fontSize: "14px", fontFamily: "'DM Sans'", textAlign: "center", maxWidth: "320px", lineHeight: 1.6 }}>
                        {stats.totalChunks === 0
                          ? "No papers indexed yet. Go to Search Papers or Upload PDF first."
                          : "Ask anything in any language 🌍 — type or use the mic 🎤 to speak"}
                      </p>
                      {stats.totalChunks > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "8px" }}>
                          {["What are the main findings?", "Compare the methodologies", "What are the limitations?"].map(q => (
                            <button key={q} onClick={() => { setQuestion(q); inputRef.current?.focus(); }} style={{ padding: "6px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "20px", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans'", transition: "all 0.2s" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(240,165,0,0.4)"; e.currentTarget.style.color = "var(--gold)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                            >{q}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <ChatMessage
                      key={i}
                      message={msg}
                      msgIndex={i}
                      onSpeak={speakAnswer}
                      isSpeakingThis={speakingMsgIdx === i && isSpeaking}
                    />
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="chat-input-area">
                  <textarea
                    ref={inputRef}
                    className="chat-input"
                    value={question}
                    onChange={e => {
                      setQuestion(e.target.value);
                      e.target.style.height = "44px";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                    placeholder={
                      isListening
                        ? "🎤 Listening... speak your question"
                        : (!isSignedIn && searchCount >= FREE_LIMIT
                            ? "Sign up to continue asking questions..."
                            : "Ask in any language... (Enter to send, Shift+Enter for new line)")
                    }
                    rows={1}
                    disabled={isAsking || (!isSignedIn && searchCount >= FREE_LIMIT)}
                    style={{ borderColor: isListening ? "rgba(240,165,0,0.6)" : undefined }}
                  />

                  {/* 🎤 MIC BUTTON */}
                  <button
                    className={`send-btn${isListening ? " mic-active" : ""}`}
                    onClick={isListening ? stopListening : startListening}
                    disabled={isAsking || (!isSignedIn && searchCount >= FREE_LIMIT)}
                    title={isListening ? "Stop listening" : "Speak your question (any language)"}
                    style={{
                      background: isListening ? "rgba(248,113,113,0.2)" : "var(--bg-hover)",
                      border: isListening ? "1px solid rgba(248,113,113,0.5)" : "1px solid var(--border)",
                    }}
                  >
                    {isListening
                      ? <MicOff size={16} color="#f87171" />
                      : <Mic size={16} color="var(--text-muted)" />
                    }
                  </button>

                  {/* ➤ SEND BUTTON */}
                  <button
                    className="send-btn"
                    onClick={handleAsk}
                    disabled={isAsking || !question.trim() || (!isSignedIn && searchCount >= FREE_LIMIT)}
                    style={{ background: isAsking || !question.trim() ? "var(--bg-hover)" : "linear-gradient(135deg, var(--gold), var(--gold-dim))" }}
                  >
                    {isAsking
                      ? <Loader2 size={16} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
                      : <Send size={16} color={question.trim() ? "#0a0b0f" : "var(--text-muted)"} />
                    }
                  </button>
                </div>
              </div>
            </div>
          )}
          {tab === "battle" && <BattleTab indexedPapers={papers} />}
          {tab === "litreview" && <LitReviewTab stats={stats} />}
        </main>
      </div>
    </>
  );
}