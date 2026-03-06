import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { useUser, useClerk, SignInButton } from "@clerk/clerk-react";
import * as d3 from "d3";
import {
  Search, BookOpen, Brain, Loader2, AlertCircle,
  ChevronRight, FileText, Users, Calendar,
  ExternalLink, Database, Sparkles, Hash, Trash2,
  CheckCircle2, SkipForward, Download, Scissors, Cpu,
  Upload, X, File, Send, MessageSquare, Bot, User, Lock, Zap,
  Mic, MicOff, Volume2, VolumeX, Swords, Trophy, GitCompare, Minus,
  ScrollText, Settings2, Copy, Check, RefreshCw, Mail, Bell,
  Search as SearchIcon, GraduationCap, Network, ZoomIn, ZoomOut, Maximize2
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

// ─── NODE COLORS ───
const NODE_CONFIG = {
  seed:        { color: "#f0a500", glow: "rgba(240,165,0,0.4)",   label: "Seed Paper",    emoji: "⭐" },
  builds_on:   { color: "#a78bfa", glow: "rgba(167,139,250,0.4)", label: "Builds On",     emoji: "🔼" },
  contradicts: { color: "#f87171", glow: "rgba(248,113,113,0.4)", label: "Contradicts",   emoji: "⚡" },
  same_method: { color: "#60a5fa", glow: "rgba(96,165,250,0.4)",  label: "Same Method",   emoji: "🔬" },
  related:     { color: "#4ade80", glow: "rgba(74,222,128,0.4)",  label: "Related",       emoji: "🔗" },
};

function isRealPdf(url) { return url && url !== "no-pdf" && url.startsWith("http"); }

function WelcomeModal({ onSkip, onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",animation:"fadeIn 0.3s ease both" }}>
      <div style={{ background:"linear-gradient(145deg,#12141c,#0e1018)",border:"1px solid rgba(240,165,0,0.25)",borderRadius:"24px",padding:"40px",maxWidth:"440px",width:"100%",boxShadow:"0 32px 80px rgba(0,0,0,0.6)",animation:"slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both",textAlign:"center" }}>
        <div style={{ width:"64px",height:"64px",margin:"0 auto 24px",background:"linear-gradient(135deg,rgba(240,165,0,0.2),rgba(240,165,0,0.05))",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"18px",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <Brain size={28} color="var(--gold)" />
        </div>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"26px",fontWeight:700,color:"var(--text-primary)",marginBottom:"10px" }}>
          Welcome to <span style={{ color:"var(--gold)" }}>ResearchMind</span>
        </h2>
        <p style={{ color:"var(--text-secondary)",fontSize:"14px",lineHeight:1.7,marginBottom:"32px",fontFamily:"'DM Sans'" }}>
          Your AI research assistant. Sign up free for unlimited access, or explore with <strong style={{ color:"var(--text-primary)" }}>10 free searches</strong> first.
        </p>
        <SignInButton mode="modal" afterSignInUrl="/" afterSignUpUrl="/">
          <button onClick={onClose} style={{ width:"100%",padding:"14px",background:"linear-gradient(135deg,var(--gold),#ffcc55)",border:"none",borderRadius:"12px",color:"#0a0b0f",fontWeight:700,fontSize:"15px",cursor:"pointer",fontFamily:"'DM Sans'",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",marginBottom:"12px",boxShadow:"0 4px 20px rgba(240,165,0,0.3)" }}>
            Continue with Google
          </button>
        </SignInButton>
        <button onClick={onSkip} style={{ width:"100%",padding:"12px",background:"transparent",border:"1px solid var(--border)",borderRadius:"12px",color:"var(--text-muted)",fontSize:"13px",cursor:"pointer",fontFamily:"'DM Sans'" }}>
          Skip for now — use 10 free searches
        </button>
        <p style={{ color:"var(--text-muted)",fontSize:"11px",marginTop:"16px",fontFamily:"'JetBrains Mono'" }}>No credit card required · Free forever</p>
      </div>
    </div>
  );
}

function HardWallModal() {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <div style={{ background:"linear-gradient(145deg,#12141c,#0e1018)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:"24px",padding:"40px",maxWidth:"420px",width:"100%",textAlign:"center" }}>
        <div style={{ width:"64px",height:"64px",margin:"0 auto 24px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:"18px",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <Lock size={28} color="#f87171" />
        </div>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"24px",fontWeight:700,color:"var(--text-primary)",marginBottom:"10px" }}>You've used your {FREE_LIMIT} free searches</h2>
        <p style={{ color:"var(--text-secondary)",fontSize:"14px",lineHeight:1.7,marginBottom:"28px",fontFamily:"'DM Sans'" }}>Sign up for free to keep going — unlimited questions, full chat history, and PDF exports.</p>
        <SignInButton mode="modal" afterSignInUrl="/" afterSignUpUrl="/">
          <button style={{ width:"100%",padding:"14px",background:"linear-gradient(135deg,var(--gold),#ffcc55)",border:"none",borderRadius:"12px",color:"#0a0b0f",fontWeight:700,fontSize:"15px",cursor:"pointer",fontFamily:"'DM Sans'",marginBottom:"12px",boxShadow:"0 4px 20px rgba(240,165,0,0.3)" }}>
            Create Free Account
          </button>
        </SignInButton>
        <p style={{ color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>Free forever · No credit card needed</p>
      </div>
    </div>
  );
}

function Badge({ children, color = "default" }) {
  const colors = {
    default: { bg:"rgba(42,45,58,0.8)",   text:"#9096a8", border:"#2a2d3a" },
    gold:    { bg:"rgba(240,165,0,0.1)",   text:"#f0a500", border:"rgba(240,165,0,0.3)" },
    green:   { bg:"rgba(74,222,128,0.1)",  text:"#4ade80", border:"rgba(74,222,128,0.3)" },
    blue:    { bg:"rgba(96,165,250,0.1)",  text:"#60a5fa", border:"rgba(96,165,250,0.3)" },
    pink:    { bg:"rgba(244,114,182,0.1)", text:"#f472b6", border:"rgba(244,114,182,0.3)" },
    purple:  { bg:"rgba(167,139,250,0.1)", text:"#a78bfa", border:"rgba(167,139,250,0.3)" },
  };
  const c = colors[color] || colors.default;
  return <span style={{ background:c.bg,color:c.text,border:`1px solid ${c.border}`,padding:"2px 10px",borderRadius:"20px",fontSize:"11px",fontFamily:"'JetBrains Mono',monospace",fontWeight:500 }}>{children}</span>;
}

function SourceBadge({ source }) {
  const map    = { arxiv:"gold", semantic:"blue", pubmed:"green", chemrxiv:"pink", upload:"purple" };
  const labels = { arxiv:"ArXiv", semantic:"Semantic Scholar", pubmed:"PubMed", chemrxiv:"ChemRxiv", upload:"Uploaded" };
  return <Badge color={map[source]||"default"}>{labels[source]||source}</Badge>;
}

function ProgressBar({ progress, logs, isDone, isError }) {
  const logsEndRef = useRef(null);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [logs]);
  const barColor = isError ? "#f87171" : isDone ? "#4ade80" : "var(--gold)";
  return (
    <div style={{ marginTop:"20px",background:"var(--bg-secondary)",border:`1px solid ${isError?"rgba(248,113,113,0.3)":isDone?"rgba(74,222,128,0.3)":"rgba(240,165,0,0.2)"}`,borderRadius:"12px",padding:"20px",animation:"fadeSlideIn 0.3s ease both" }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"10px" }}>
        <span style={{ fontFamily:"'JetBrains Mono'",fontSize:"12px",color:barColor }}>{isError?"Error":isDone?"Complete":"Processing..."}</span>
        <span style={{ fontFamily:"'JetBrains Mono'",fontSize:"13px",fontWeight:700,color:barColor }}>{progress}%</span>
      </div>
      <div style={{ width:"100%",height:"6px",background:"var(--bg-hover)",borderRadius:"999px",overflow:"hidden",marginBottom:"16px" }}>
        <div style={{ height:"100%",width:`${progress}%`,background:isError?"#f87171":isDone?"linear-gradient(90deg,#4ade80,#22c55e)":"linear-gradient(90deg,var(--gold),#ffcc55)",borderRadius:"999px",transition:"width 0.4s ease" }} />
      </div>
      <div style={{ maxHeight:"180px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"6px" }}>
        {logs.map((log,i) => (
          <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:"8px",opacity:i===logs.length-1?1:0.5 }}>
            <span style={{ fontFamily:"'JetBrains Mono'",fontSize:"11px",color:log.type==="paper_done"?"#4ade80":log.type==="paper_skip"?"#f87171":log.type==="error"?"#f87171":log.type==="done"?"#4ade80":"var(--text-secondary)",lineHeight:1.5 }}>{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

function PaperCard({ paper, index }) {
  return (
    <div className="paper-card" style={{ background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"12px",padding:"20px 24px",transition:"all 0.2s ease",animation:`fadeSlideIn 0.4s ease ${index*0.08}s both` }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--border-light)"; e.currentTarget.style.transform="translateY(-2px)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.transform="translateY(0)"; }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px",gap:"8px" }}>
        <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",flex:1 }}>
          <Badge color="gold"><Hash size={9} style={{ display:"inline",marginRight:"3px" }}/>{paper.id?.slice(0,15)}</Badge>
          {paper.source && <SourceBadge source={paper.source}/>}
        </div>
        {isRealPdf(paper.pdfUrl) ? (
          <a href={paper.pdfUrl} target="_blank" rel="noreferrer" style={{ color:"var(--text-muted)",transition:"color 0.2s",flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.color="var(--gold)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text-muted)"}><ExternalLink size={14}/></a>
        ) : <span style={{ color:"var(--border)",flexShrink:0 }}><ExternalLink size={14}/></span>}
      </div>
      <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:"15px",fontWeight:600,color:"var(--text-primary)",lineHeight:1.4,marginBottom:"10px" }}>{paper.title}</h3>
      <div style={{ display:"flex",gap:"16px",marginBottom:"10px",flexWrap:"wrap" }}>
        <span style={{ display:"flex",alignItems:"center",gap:"5px",color:"var(--text-secondary)",fontSize:"12px" }}><Users size={11}/>{paper.authors?.slice(0,2).join(", ")}{paper.authors?.length>2&&` +${paper.authors.length-2}`}</span>
        <span style={{ display:"flex",alignItems:"center",gap:"5px",color:"var(--text-secondary)",fontSize:"12px" }}><Calendar size={11}/>{paper.published}</span>
      </div>
      <p style={{ color:"var(--text-muted)",fontSize:"12px",lineHeight:1.6,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden" }}>{paper.abstract}</p>
    </div>
  );
}

function CitationCard({ citation }) {
  const [hovered,setHovered] = useState(false);
  return (
    <div style={{ background:"var(--bg-secondary)",border:"1px solid var(--border)",borderLeft:"3px solid var(--gold)",borderRadius:"8px",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",position:"relative",transition:"border-color 0.2s" }}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px",flexWrap:"wrap" }}>
          <Badge color="gold">[{citation.number}]</Badge>
          <span style={{ fontFamily:"'Playfair Display',serif",fontSize:"13px",color:"var(--text-primary)",fontWeight:600 }}>{citation.title}</span>
        </div>
        <div style={{ display:"flex",gap:"14px",flexWrap:"wrap" }}>
          <span style={{ color:"var(--text-muted)",fontSize:"11px" }}>{citation.published}</span>
        </div>
      </div>
      {isRealPdf(citation.pdfUrl) && (
        <a href={citation.pdfUrl} target="_blank" rel="noreferrer" style={{ display:"flex",alignItems:"center",gap:"5px",color:"var(--gold)",fontSize:"11px",textDecoration:"none",padding:"6px 12px",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"6px",whiteSpace:"nowrap",flexShrink:0 }}>PDF <ExternalLink size={10}/></a>
      )}
    </div>
  );
}

function ChatMessage({ message, msgIndex, onSpeak, isSpeakingThis }) {
  const isUser = message.role === "user";
  return (
    <div style={{ display:"flex",flexDirection:isUser?"row-reverse":"row",gap:"12px",alignItems:"flex-start",animation:"fadeSlideIn 0.3s ease both",marginBottom:"24px" }}>
      <div style={{ width:"32px",height:"32px",flexShrink:0,borderRadius:"10px",background:isUser?"linear-gradient(135deg,var(--gold),var(--gold-dim))":"rgba(96,165,250,0.15)",border:isUser?"none":"1px solid rgba(96,165,250,0.3)",display:"flex",alignItems:"center",justifyContent:"center" }}>
        {isUser ? <User size={15} color="#0a0b0f"/> : <Brain size={15} color="#60a5fa"/>}
      </div>
      <div style={{ maxWidth:"75%",minWidth:0 }}>
        <div style={{ background:isUser?"linear-gradient(135deg,rgba(240,165,0,0.12),rgba(240,165,0,0.06))":"var(--bg-card)",border:`1px solid ${isUser?"rgba(240,165,0,0.25)":"var(--border)"}`,borderRadius:isUser?"16px 4px 16px 16px":"4px 16px 16px 16px",padding:"14px 18px" }}>
          {isUser ? (
            <p style={{ color:"var(--text-primary)",fontSize:"14px",lineHeight:1.6,fontFamily:"'DM Sans'" }}>{message.question}</p>
          ) : (
            <div>
              {message.loading ? (
                <div style={{ display:"flex",alignItems:"center",gap:"8px",color:"var(--text-muted)",fontSize:"13px" }}>
                  <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} color="var(--gold)"/>
                  <span style={{ fontFamily:"'JetBrains Mono'" }}>Thinking...</span>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex",alignItems:"center",gap:"6px",marginBottom:"10px",flexWrap:"wrap" }}>
                    <Badge color="green">Grounded</Badge>
                    {message.confidence!=null && (() => {
                      const c=message.confidence, isHigh=c>=75, isMedium=c>=50&&c<75;
                      const color=isHigh?"#4ade80":isMedium?"#f0a500":"#f87171";
                      return <span style={{ display:"inline-flex",alignItems:"center",gap:"4px",background:`${color}18`,border:`1px solid ${color}40`,borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontFamily:"'JetBrains Mono'",color }}>{isHigh?"🟢":isMedium?"🟡":"🔴"} {isHigh?"High":isMedium?"Medium":"Low"} · {c}%</span>;
                    })()}
                    {message.answer && (
                      <button onClick={()=>onSpeak(message.answer,msgIndex)} style={{ display:"inline-flex",alignItems:"center",gap:"4px",background:isSpeakingThis?"rgba(96,165,250,0.15)":"transparent",border:`1px solid ${isSpeakingThis?"rgba(96,165,250,0.4)":"var(--border)"}`,borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontFamily:"'JetBrains Mono'",color:isSpeakingThis?"#60a5fa":"var(--text-muted)",cursor:"pointer" }}>
                        {isSpeakingThis?<VolumeX size={11}/>:<Volume2 size={11}/>}{isSpeakingThis?" Stop":" Listen"}
                      </button>
                    )}
                  </div>
                  <div style={{ color:"var(--text-primary)",fontSize:"14px",lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"'DM Sans'" }}>{message.answer}</div>
                  {message.citations?.length>0 && (
                    <div style={{ marginTop:"16px",borderTop:"1px solid var(--border)",paddingTop:"14px" }}>
                      <p style={{ color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.06em",marginBottom:"10px" }}>SOURCES</p>
                      <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
                        {message.citations.map(c=><CitationCard key={c.number} citation={c}/>)}
                      </div>
                    </div>
                  )}
                  {message.error && <div style={{ display:"flex",alignItems:"center",gap:"6px",color:"#f87171",fontSize:"13px",marginTop:"8px" }}><AlertCircle size={13}/>{message.error}</div>}
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
  const [dragOver,setDragOver]   = useState(false);
  const [file,setFile]           = useState(null);
  const [title,setTitle]         = useState("");
  const [authors,setAuthors]     = useState("");
  const [uploading,setUploading] = useState(false);
  const [uploadDone,setUploadDone] = useState(false);
  const [error,setError]         = useState("");
  const [progress,setProgress]   = useState(0);
  const [indexedPaper,setIndexedPaper] = useState(null);
  const fileInputRef = useRef(null);

  function pickFile(f) { setFile(f); setError(""); setUploadDone(false); setIndexedPaper(null); setProgress(0); if(!title) setTitle(f.name.replace(".pdf","").replace(/[_-]/g," ")); }

  async function handleUpload() {
    if(!file) return;
    setUploading(true); setError(""); setProgress(10);
    const formData = new FormData();
    formData.append("pdf",file);
    if(title) formData.append("title",title);
    if(authors) formData.append("authors",authors);
    try {
      setProgress(30);
      const res = await axios.post(`${API}/upload-pdf`,formData,{ headers:{"Content-Type":"multipart/form-data"}, onUploadProgress:(e)=>{ setProgress(10+Math.round((e.loaded/e.total)*40)); } });
      setProgress(100); setUploadDone(true); setIndexedPaper(res.data.paper);
      setStats(res.data.stats); onPaperIndexed(res.data.paper);
    } catch(err) { setError(err.response?.data?.error||"Upload failed."); }
    finally { setUploading(false); }
  }

  function reset() { setFile(null); setTitle(""); setAuthors(""); setUploadDone(false); setIndexedPaper(null); setError(""); setProgress(0); }

  return (
    <div style={{ animation:"fadeSlideIn 0.3s ease both" }}>
      <div className="panel-card">
        <h2 className="panel-title">Upload Your Own PDF</h2>
        <p className="panel-subtitle">Upload a paper directly and start asking questions.</p>
        {!file && (
          <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);const d=e.dataTransfer.files[0];if(d?.type==="application/pdf")pickFile(d);else setError("Please drop a PDF.");}}
            onClick={()=>fileInputRef.current?.click()}
            style={{ border:`2px dashed ${dragOver?"var(--gold)":"var(--border)"}`,borderRadius:"14px",padding:"48px 24px",textAlign:"center",cursor:"pointer",transition:"all 0.2s",background:dragOver?"rgba(240,165,0,0.04)":"var(--bg-secondary)" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(240,165,0,0.5)";}} onMouseLeave={e=>{if(!dragOver)e.currentTarget.style.borderColor="var(--border)";}}>
            <Upload size={22} color="var(--gold)" style={{ margin:"0 auto 16px",display:"block" }}/>
            <p style={{ color:"var(--text-primary)",fontSize:"15px",fontWeight:600,marginBottom:"6px",fontFamily:"'DM Sans'" }}>Drop your PDF here</p>
            <p style={{ color:"var(--text-muted)",fontSize:"13px" }}>or click to browse files</p>
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>{if(e.target.files[0])pickFile(e.target.files[0]);}}/>
          </div>
        )}
        {file && !uploadDone && (
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:"12px",background:"var(--bg-secondary)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"10px",padding:"12px 16px",marginBottom:"20px" }}>
              <File size={18} color="var(--gold)"/>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ color:"var(--text-primary)",fontSize:"13px",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{file.name}</p>
                <p style={{ color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>{(file.size/1024).toFixed(0)} KB</p>
              </div>
              <button onClick={reset} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)" }}><X size={16}/></button>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"12px",marginBottom:"20px" }}>
              <div><label style={{ display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"6px" }}>TITLE (optional)</label>
                <input className="search-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Paper title" style={{ width:"100%",paddingLeft:"16px" }}/></div>
              <div><label style={{ display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"6px" }}>AUTHORS (optional)</label>
                <input className="search-input" value={authors} onChange={e=>setAuthors(e.target.value)} placeholder="e.g. John Smith, Jane Doe" style={{ width:"100%",paddingLeft:"16px" }}/></div>
            </div>
            <button className="action-btn" onClick={handleUpload} disabled={uploading} style={{ width:"100%",justifyContent:"center",background:uploading?"var(--bg-hover)":"linear-gradient(135deg,var(--gold),var(--gold-dim))",color:uploading?"var(--text-muted)":"#0a0b0f",cursor:uploading?"not-allowed":"pointer" }}>
              {uploading?<><Loader2 size={15} style={{ animation:"spin 1s linear infinite" }}/>Processing...</>:<><Upload size={15}/>Index This Paper</>}
            </button>
            {uploading && <div style={{ marginTop:"16px" }}><div style={{ width:"100%",height:"6px",background:"var(--bg-hover)",borderRadius:"999px",overflow:"hidden" }}><div style={{ height:"100%",width:`${progress}%`,background:"linear-gradient(90deg,var(--gold),#ffcc55)",borderRadius:"999px",transition:"width 0.3s ease" }}/></div></div>}
            {error && <div className="error-row" style={{ marginTop:"12px" }}><AlertCircle size={14}/>{error}</div>}
          </div>
        )}
        {uploadDone && indexedPaper && (
          <div style={{ animation:"fadeSlideIn 0.4s ease both" }}>
            <div style={{ background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:"12px",padding:"20px",marginBottom:"20px",display:"flex",alignItems:"flex-start",gap:"14px" }}>
              <CheckCircle2 size={20} color="#4ade80"/>
              <div><p style={{ color:"#4ade80",fontWeight:700,fontSize:"14px" }}>Successfully indexed!</p><p style={{ color:"var(--text-secondary)",fontSize:"13px" }}><strong>{indexedPaper.title}</strong> is ready for Q&A.</p></div>
            </div>
            <button onClick={reset} style={{ width:"100%",padding:"11px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"10px",color:"var(--text-secondary)",fontSize:"13px",cursor:"pointer" }}>Upload Another</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResearchGapsTab({ stats }) {
  const [gaps,setGaps]     = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError]   = useState("");
  const [copied,setCopied] = useState(false);

  async function handleFind() {
    setLoading(true); setError(""); setGaps(null);
    try { const res = await axios.post(`${API}/research-gaps`); setGaps(res.data.gaps); }
    catch(err) { setError(err.response?.data?.error||"Failed to find gaps."); }
    finally { setLoading(false); }
  }

  function GapCard({ item, color, index }) {
    return (
      <div style={{ background:"var(--bg-secondary)",border:`1px solid ${color}30`,borderRadius:"12px",padding:"16px 18px",marginBottom:"10px",borderLeft:`3px solid ${color}` }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"8px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
            <span style={{ background:`${color}18`,color:color,fontSize:"11px",fontFamily:"'JetBrains Mono'",fontWeight:700,padding:"2px 8px",borderRadius:"20px" }}>#{index+1}</span>
            <h4 style={{ color:"var(--text-primary)",fontSize:"13px",fontFamily:"'DM Sans'",fontWeight:700 }}>{item.title}</h4>
          </div>
          {item.novelty && <span style={{ background:item.novelty==="high"?"rgba(74,222,128,0.1)":"rgba(240,165,0,0.1)",color:item.novelty==="high"?"#4ade80":"var(--gold)",fontSize:"10px",fontFamily:"'JetBrains Mono'",padding:"2px 8px",borderRadius:"20px" }}>{item.novelty} novelty</span>}
        </div>
        <p style={{ color:"var(--text-secondary)",fontSize:"13px",lineHeight:1.7,margin:"0 0 8px" }}>{item.description}</p>
        {item.papers_that_hint && <p style={{ color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>Referenced in: {item.papers_that_hint}</p>}
      </div>
    );
  }

  return (
    <div style={{ animation:"fadeSlideIn 0.3s ease both" }}>
      <div className="panel-card" style={{ marginBottom:"20px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px" }}>
          <div style={{ width:"40px",height:"40px",background:"linear-gradient(135deg,rgba(251,146,60,0.2),rgba(251,146,60,0.05))",border:"1px solid rgba(251,146,60,0.3)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Search size={20} color="#fb923c"/></div>
          <div><h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"20px",marginBottom:"2px" }}>Research Gap Finder</h2><p style={{ color:"var(--text-muted)",fontSize:"12px",fontFamily:"'JetBrains Mono'" }}>{stats.totalPapers} papers indexed</p></div>
        </div>
        {stats.totalPapers < 2 ? (
          <div style={{ textAlign:"center",padding:"48px 24px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"12px" }}>
            <p style={{ color:"var(--text-secondary)",fontSize:"14px",fontWeight:600,marginBottom:"6px" }}>Need at least 2 indexed papers</p>
          </div>
        ) : (
          <>
            {error && <div className="error-row" style={{ marginBottom:"16px" }}><AlertCircle size={14}/>{error}</div>}
            <button onClick={handleFind} disabled={loading} style={{ width:"100%",padding:"15px",background:loading?"var(--bg-hover)":"linear-gradient(135deg,#fb923c,#ea580c)",border:"none",borderRadius:"10px",color:loading?"var(--text-muted)":"#fff",fontWeight:700,fontSize:"15px",cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans'",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px" }}>
              {loading?<><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/>Analyzing...</>:<><Search size={16}/>Find Research Gaps</>}
            </button>
          </>
        )}
      </div>
      {gaps && (
        <div style={{ animation:"fadeSlideIn 0.4s ease both" }}>
          <div style={{ background:"linear-gradient(135deg,rgba(251,146,60,0.08),rgba(251,146,60,0.02))",border:"1px solid rgba(251,146,60,0.2)",borderRadius:"14px",padding:"20px 24px",marginBottom:"20px" }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:"20px",marginBottom:"8px" }}>{gaps.topic}</h3>
            <p style={{ color:"var(--text-secondary)",fontSize:"13px",lineHeight:1.6 }}>{gaps.summary}</p>
          </div>
          {gaps.critical_gaps?.length>0 && <div style={{ marginBottom:"20px" }}><p style={{ color:"#f87171",fontSize:"11px",fontFamily:"'JetBrains Mono'",marginBottom:"10px" }}>🚨 CRITICAL GAPS</p>{gaps.critical_gaps.map((g,i)=><GapCard key={i} item={g} color="#f87171" index={i}/>)}</div>}
          {gaps.partial_gaps?.length>0 && <div style={{ marginBottom:"20px" }}><p style={{ color:"#fb923c",fontSize:"11px",fontFamily:"'JetBrains Mono'",marginBottom:"10px" }}>⚠️ PARTIAL GAPS</p>{gaps.partial_gaps.map((g,i)=><GapCard key={i} item={g} color="#fb923c" index={i}/>)}</div>}
          {gaps.future_directions?.length>0 && <div style={{ marginBottom:"20px" }}><p style={{ color:"#4ade80",fontSize:"11px",fontFamily:"'JetBrains Mono'",marginBottom:"10px" }}>💡 FUTURE DIRECTIONS</p>{gaps.future_directions.map((g,i)=><GapCard key={i} item={g} color="#4ade80" index={i}/>)}</div>}
          {gaps.most_promising_gap && <div style={{ background:"linear-gradient(135deg,rgba(240,165,0,0.08),rgba(240,165,0,0.02))",border:"1px solid rgba(240,165,0,0.25)",borderRadius:"14px",padding:"24px",textAlign:"center" }}><p style={{ color:"var(--gold)",fontSize:"11px",fontFamily:"'JetBrains Mono'",marginBottom:"10px" }}>⭐ MOST PROMISING GAP</p><p style={{ color:"var(--text-secondary)",fontSize:"14px",lineHeight:1.8 }}>{gaps.most_promising_gap}</p></div>}
        </div>
      )}
    </div>
  );
}

function DigestTab() {
  const [name,setName]     = useState("");
  const [email,setEmail]   = useState("");
  const [topic,setTopic]   = useState("");
  const [loading,setLoading] = useState(false);
  const [success,setSuccess] = useState("");
  const [error,setError]   = useState("");
  const SUGGESTED = ["Large Language Models","RAG Systems","Computer Vision","Reinforcement Learning","Diffusion Models","Transformers","Neural Networks","NLP","Robotics","Quantum Computing"];

  async function handleSubscribe() {
    if(!name.trim()||!email.trim()||!topic.trim()){setError("Please fill in all fields.");return;}
    setLoading(true); setError(""); setSuccess("");
    try { const res=await axios.post(`${API}/digest/subscribe`,{name:name.trim(),email:email.trim(),topic:topic.trim()}); setSuccess(res.data.message); }
    catch(err) { setError(err.response?.data?.error||"Subscription failed."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ animation:"fadeSlideIn 0.3s ease both",maxWidth:"640px",margin:"0 auto" }}>
      <div style={{ textAlign:"center",marginBottom:"32px" }}>
        <div style={{ width:"56px",height:"56px",background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.05))",border:"1px solid rgba(99,102,241,0.3)",borderRadius:"16px",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}><Mail size={26} color="#6366f1"/></div>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"24px",marginBottom:"8px" }}>Weekly Research Digest</h2>
        <p style={{ color:"var(--text-muted)",fontSize:"14px",lineHeight:1.6,maxWidth:"420px",margin:"0 auto" }}>Get the <strong style={{ color:"var(--text-secondary)" }}>5 most important papers</strong> on your topic every Monday.</p>
      </div>
      <div className="panel-card">
        {success ? (
          <div style={{ textAlign:"center",padding:"32px 20px" }}>
            <CheckCircle2 size={40} color="#4ade80" style={{ margin:"0 auto 16px",display:"block" }}/>
            <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:"20px",marginBottom:"8px" }}>You're subscribed! 🎉</h3>
            <p style={{ color:"var(--text-secondary)",fontSize:"14px",lineHeight:1.7,marginBottom:"20px" }}>{success}</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:"16px" }}><label style={{ display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"8px" }}>YOUR NAME</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ayush" style={{ width:"100%",padding:"12px 14px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"10px",color:"var(--text-primary)",fontSize:"14px",outline:"none",boxSizing:"border-box" }}/></div>
            <div style={{ marginBottom:"16px" }}><label style={{ display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"8px" }}>EMAIL ADDRESS</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" type="email" style={{ width:"100%",padding:"12px 14px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"10px",color:"var(--text-primary)",fontSize:"14px",outline:"none",boxSizing:"border-box" }}/></div>
            <div style={{ marginBottom:"12px" }}><label style={{ display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"8px" }}>RESEARCH TOPIC</label>
              <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Large Language Models..." style={{ width:"100%",padding:"12px 14px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"10px",color:"var(--text-primary)",fontSize:"14px",outline:"none",boxSizing:"border-box" }}/></div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"20px" }}>
              {SUGGESTED.map(t=><button key={t} onClick={()=>setTopic(t)} style={{ padding:"4px 10px",background:topic===t?"rgba(99,102,241,0.15)":"var(--bg-hover)",border:`1px solid ${topic===t?"rgba(99,102,241,0.4)":"var(--border)"}`,borderRadius:"20px",color:topic===t?"#6366f1":"var(--text-muted)",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'" }}>{t}</button>)}
            </div>
            {error && <div className="error-row" style={{ marginBottom:"16px" }}><AlertCircle size={14}/>{error}</div>}
            <button onClick={handleSubscribe} disabled={loading} style={{ width:"100%",padding:"14px",background:loading?"var(--bg-hover)":"linear-gradient(135deg,#6366f1,#4f46e5)",border:"none",borderRadius:"10px",color:loading?"var(--text-muted)":"#fff",fontWeight:700,fontSize:"15px",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px" }}>
              {loading?<><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/>Subscribing...</>:<><Mail size={16}/>Subscribe Free — Every Monday</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LitReviewTab({ stats }) {
  const [wordCount,setWordCount] = useState(1000);
  const [style,setStyle]         = useState("thesis");
  const [sections,setSections]   = useState({ introduction:true,theoretical_background:true,methodology_comparison:true,key_findings:true,agreements:true,contradictions:true,research_gaps:true,conclusion:true,references:true });
  const [review,setReview]       = useState("");
  const [loading,setLoading]     = useState(false);
  const [error,setError]         = useState("");
  const [meta,setMeta]           = useState(null);
  const [copied,setCopied]       = useState(false);

  const SECTION_LABELS = { introduction:"Introduction",theoretical_background:"Theoretical Background",methodology_comparison:"Methodology Comparison",key_findings:"Key Findings",agreements:"Agreements",contradictions:"Contradictions",research_gaps:"Research Gaps",conclusion:"Conclusion",references:"References" };
  const STYLES = [{ id:"thesis",label:"Thesis",desc:"Formal academic" },{ id:"journal",label:"Journal",desc:"Concise & direct" },{ id:"summary",label:"Summary",desc:"Accessible" }];

  async function handleGenerate() {
    const activeSections=Object.entries(sections).filter(([,v])=>v).map(([k])=>k);
    if(activeSections.length===0){setError("Select at least one section.");return;}
    setLoading(true); setError(""); setReview(""); setMeta(null);
    try { const res=await axios.post(`${API}/literature-review`,{wordCount,style,sections:activeSections}); setReview(res.data.review); setMeta({paperCount:res.data.paperCount,wordCount:res.data.wordCount}); }
    catch(err){ setError(err.response?.data?.error||"Failed to generate."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ animation:"fadeSlideIn 0.3s ease both" }}>
      <div className="panel-card" style={{ marginBottom:"20px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"24px" }}>
          <div style={{ width:"40px",height:"40px",background:"linear-gradient(135deg,rgba(167,139,250,0.2),rgba(167,139,250,0.05))",border:"1px solid rgba(167,139,250,0.3)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><ScrollText size={20} color="#a78bfa"/></div>
          <div><h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"20px",marginBottom:"2px" }}>Literature Review Generator</h2><p style={{ color:"var(--text-muted)",fontSize:"12px",fontFamily:"'JetBrains Mono'" }}>{stats.totalPapers} papers indexed</p></div>
        </div>
        {stats.totalPapers < 2 ? <div style={{ textAlign:"center",padding:"48px 24px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"12px" }}><p style={{ color:"var(--text-secondary)",fontWeight:600 }}>Need at least 2 indexed papers</p></div> : (
          <>
            <div style={{ marginBottom:"24px" }}>
              <label style={{ display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"10px" }}>WRITING STYLE</label>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px" }}>
                {STYLES.map(s=><button key={s.id} onClick={()=>setStyle(s.id)} style={{ padding:"12px 16px",background:style===s.id?"rgba(167,139,250,0.1)":"var(--bg-secondary)",border:`1px solid ${style===s.id?"rgba(167,139,250,0.5)":"var(--border)"}`,borderRadius:"10px",cursor:"pointer",textAlign:"left" }}>
                  <p style={{ color:style===s.id?"#a78bfa":"var(--text-primary)",fontSize:"13px",fontWeight:600,marginBottom:"3px" }}>{s.label}</p>
                  <p style={{ color:"var(--text-muted)",fontSize:"11px" }}>{s.desc}</p>
                </button>)}
              </div>
            </div>
            <div style={{ marginBottom:"24px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"10px" }}>
                <label style={{ color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em" }}>WORD COUNT</label>
                <span style={{ color:"#a78bfa",fontSize:"13px",fontFamily:"'JetBrains Mono'",fontWeight:700 }}>{wordCount.toLocaleString()}</span>
              </div>
              <input type="range" min={500} max={3000} step={250} value={wordCount} onChange={e=>setWordCount(Number(e.target.value))} style={{ width:"100%",accentColor:"#a78bfa" }}/>
            </div>
            <div style={{ marginBottom:"24px" }}>
              <label style={{ display:"block",color:"var(--text-secondary)",fontSize:"11px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em",marginBottom:"10px" }}>INCLUDE SECTIONS</label>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px" }}>
                {Object.entries(SECTION_LABELS).map(([key,label])=>(
                  <button key={key} onClick={()=>setSections(p=>({...p,[key]:!p[key]}))} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",background:sections[key]?"rgba(167,139,250,0.08)":"var(--bg-secondary)",border:`1px solid ${sections[key]?"rgba(167,139,250,0.35)":"var(--border)"}`,borderRadius:"8px",cursor:"pointer" }}>
                    <div style={{ width:"18px",height:"18px",flexShrink:0,borderRadius:"5px",background:sections[key]?"#a78bfa":"var(--bg-hover)",border:`1px solid ${sections[key]?"#a78bfa":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center" }}>{sections[key]&&<Check size={11} color="#0a0b0f" strokeWidth={3}/>}</div>
                    <span style={{ color:sections[key]?"var(--text-primary)":"var(--text-muted)",fontSize:"12px",fontWeight:sections[key]?600:400 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <div className="error-row" style={{ marginBottom:"16px" }}><AlertCircle size={14}/>{error}</div>}
            <button onClick={handleGenerate} disabled={loading} style={{ width:"100%",padding:"15px",background:loading?"var(--bg-hover)":"linear-gradient(135deg,#a78bfa,#7c3aed)",border:"none",borderRadius:"10px",color:loading?"var(--text-muted)":"#fff",fontWeight:700,fontSize:"15px",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px" }}>
              {loading?<><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/>Generating...</>:<><ScrollText size={16}/>Generate Literature Review</>}
            </button>
          </>
        )}
      </div>
      {review && (
        <div style={{ animation:"fadeSlideIn 0.4s ease both" }}>
          {meta && <div style={{ display:"flex",justifyContent:"space-between",padding:"14px 20px",background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"12px",marginBottom:"16px",flexWrap:"wrap",gap:"10px" }}>
            <span style={{ color:"#a78bfa",fontSize:"12px",fontFamily:"'JetBrains Mono'" }}>{meta.paperCount} papers · ~{meta.wordCount} words</span>
            <div style={{ display:"flex",gap:"8px" }}>
              <button onClick={()=>{navigator.clipboard.writeText(review);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{ display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",background:copied?"rgba(74,222,128,0.1)":"rgba(167,139,250,0.1)",border:`1px solid ${copied?"rgba(74,222,128,0.3)":"rgba(167,139,250,0.3)"}`,borderRadius:"8px",color:copied?"#4ade80":"#a78bfa",fontSize:"11px",cursor:"pointer" }}>{copied?<><Check size={11}/>Copied!</>:<><Copy size={11}/>Copy</>}</button>
            </div>
          </div>}
          <div style={{ background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"36px 40px",lineHeight:1.8 }}>
            {review.split("\n").map((line,i)=>{
              if(line.match(/^#{1,2} /)||line.match(/^\d+\. [A-Z]/)) return <h3 key={i} style={{ fontFamily:"'Playfair Display',serif",fontSize:"17px",color:"var(--gold)",marginTop:"24px",marginBottom:"8px",borderBottom:"1px solid rgba(240,165,0,0.2)",paddingBottom:"6px" }}>{line.replace(/^#{1,2} /,"")}</h3>;
              if(line.trim()==="") return <div key={i} style={{ height:"12px" }}/>;
              return <p key={i} style={{ color:"var(--text-secondary)",fontSize:"14px",lineHeight:1.8,marginBottom:"4px" }}>{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BattleTab({ indexedPapers }) {
  const [paper1,setPaper1] = useState(null);
  const [paper2,setPaper2] = useState(null);
  const [battle,setBattle] = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError]   = useState("");
  const available = indexedPapers.filter(p=>p.abstract&&p.abstract!=="Uploaded PDF document");

  async function handleBattle() {
    if(!paper1||!paper2) return;
    if(paper1.id===paper2.id){setError("Select two different papers.");return;}
    setLoading(true); setError(""); setBattle(null);
    try { const res=await axios.post(`${API}/battle`,{paper1,paper2}); setBattle(res.data.battle); }
    catch(err){ setError(err.response?.data?.error||"Battle failed."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ animation:"fadeSlideIn 0.3s ease both" }}>
      <div className="panel-card">
        <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px" }}>
          <div style={{ width:"40px",height:"40px",background:"linear-gradient(135deg,rgba(240,165,0,0.2),rgba(240,165,0,0.05))",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Swords size={20} color="var(--gold)"/></div>
          <div><h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:"20px",marginBottom:"2px" }}>Paper vs Paper Battle</h2><p style={{ color:"var(--text-muted)",fontSize:"12px",fontFamily:"'JetBrains Mono'" }}>AI debates two papers head-to-head</p></div>
        </div>
        {available.length < 2 ? <div style={{ textAlign:"center",padding:"48px 24px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"12px" }}><p style={{ color:"var(--text-secondary)",fontWeight:600 }}>Need at least 2 indexed papers</p></div> : (
          <>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 60px 1fr",gap:"16px",alignItems:"start",marginBottom:"20px",overflow:"hidden" }}>
              <div style={{ minWidth:0 }}>
                <label style={{ display:"block",color:"#60a5fa",fontSize:"11px",fontFamily:"'JetBrains Mono'",marginBottom:"8px" }}>🔵 PAPER 1</label>
                <select value={paper1?.id||""} onChange={e=>setPaper1(available.find(p=>p.id===e.target.value)||null)} style={{ width:"100%",padding:"12px 14px",background:"rgba(96,165,250,0.05)",border:`1px solid ${paper1?"rgba(96,165,250,0.5)":"var(--border)"}`,borderRadius:"10px",color:paper1?"var(--text-primary)":"var(--text-muted)",fontSize:"13px",outline:"none",cursor:"pointer",minWidth:0 }}>
                  <option value="">Select a paper...</option>
                  {available.map(p=><option key={p.id} value={p.id} disabled={paper2?.id===p.id}>{p.title?.slice(0,50)}{p.title?.length>50?"...":""}</option>)}
                </select>
              </div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",paddingTop:"28px" }}>
                <div style={{ width:"44px",height:"44px",background:"linear-gradient(135deg,rgba(240,165,0,0.15),rgba(240,165,0,0.05))",border:"1px solid rgba(240,165,0,0.35)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <span style={{ color:"var(--gold)",fontSize:"13px",fontFamily:"'JetBrains Mono'",fontWeight:700 }}>VS</span>
                </div>
              </div>
              <div style={{ minWidth:0 }}>
                <label style={{ display:"block",color:"#f472b6",fontSize:"11px",fontFamily:"'JetBrains Mono'",marginBottom:"8px" }}>🔴 PAPER 2</label>
                <select value={paper2?.id||""} onChange={e=>setPaper2(available.find(p=>p.id===e.target.value)||null)} style={{ width:"100%",padding:"12px 14px",background:"rgba(244,114,182,0.05)",border:`1px solid ${paper2?"rgba(244,114,182,0.5)":"var(--border)"}`,borderRadius:"10px",color:paper2?"var(--text-primary)":"var(--text-muted)",fontSize:"13px",outline:"none",cursor:"pointer",minWidth:0 }}>
                  <option value="">Select a paper...</option>
                  {available.map(p=><option key={p.id} value={p.id} disabled={paper1?.id===p.id}>{p.title?.slice(0,50)}{p.title?.length>50?"...":""}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="error-row" style={{ marginBottom:"16px" }}><AlertCircle size={14}/>{error}</div>}
            <button onClick={handleBattle} disabled={!paper1||!paper2||loading} style={{ width:"100%",padding:"14px",background:(!paper1||!paper2||loading)?"var(--bg-hover)":"linear-gradient(135deg,var(--gold),var(--gold-dim))",border:"none",borderRadius:"10px",color:(!paper1||!paper2||loading)?"var(--text-muted)":"#0a0b0f",fontWeight:700,fontSize:"15px",cursor:(!paper1||!paper2||loading)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px" }}>
              {loading?<><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/>Analyzing...</>:<><Swords size={16}/>Start Battle</>}
            </button>
          </>
        )}
      </div>
      {battle && (
        <div style={{ animation:"fadeSlideIn 0.4s ease both",marginTop:"20px" }}>
          <div style={{ background:"linear-gradient(135deg,rgba(240,165,0,0.07),rgba(240,165,0,0.02))",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"16px",padding:"24px",marginBottom:"16px",textAlign:"center" }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:"22px",marginBottom:"8px" }}>{battle.topic}</h3>
            <p style={{ color:"var(--text-muted)",fontSize:"13px" }}>{battle.key_difference}</p>
          </div>
          {battle.verdict && (() => {
            const w=battle.verdict.winner, color=w==="tie"?"var(--gold)":w==="1"?"#60a5fa":"#f472b6";
            return <div style={{ background:"rgba(240,165,0,0.04)",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"14px",padding:"28px",textAlign:"center" }}>
              <Trophy size={30} color={color} style={{ margin:"0 auto 12px",display:"block" }}/>
              <p style={{ fontFamily:"'Playfair Display',serif",fontSize:"20px",fontWeight:700,color:"var(--text-primary)",marginBottom:"12px" }}>{w==="tie"?"🤝 It's a Tie!":w==="1"?`🔵 Paper 1 Wins`:`🔴 Paper 2 Wins`}</p>
              <p style={{ color:"var(--text-secondary)",fontSize:"14px",lineHeight:1.8 }}>{battle.verdict.summary}</p>
            </div>;
          })()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── RESEARCH RABBIT HOLE PAGE ───
// ═══════════════════════════════════════════════════════════
function RabbitHolePage({ stats, indexedPapers, onClose }) {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);

  const [phase, setPhase]             = useState("select"); // select | loading | graph
  const [seedPaper, setSeedPaper]     = useState(null);
  const [graphData, setGraphData]     = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandingId, setExpandingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [error, setError]             = useState("");
  const [zoomLevel, setZoomLevel]     = useState(1);
  const zoomRef = useRef(null);

  const available = indexedPapers.length > 0 ? indexedPapers : [];

  // ── Build graph ──
  async function handleBuild() {
    if (!seedPaper) return;
    setPhase("loading"); setError("");
    try {
      const res = await axios.post(`${API}/rabbit-hole`, { seedPaperId: seedPaper.id });
      setGraphData(res.data.graph);
      setPhase("graph");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to build graph.");
      setPhase("select");
    }
  }

  // ── Expand node ──
  async function handleExpand(node) {
    if (expandingId || expandedIds.has(node.id) || node.type === "seed") return;
    setExpandingId(node.id);
    try {
      const alreadyMapped = graphData.connections.map(c => c.id);
      const res = await axios.post(`${API}/rabbit-hole/expand`, {
        targetPaperId: node.id,
        seedPaperId: graphData.seed.id,
        alreadyMapped,
      });
      if (res.data.newConnections?.length > 0) {
        setGraphData(prev => ({
          ...prev,
          connections: [...prev.connections, ...res.data.newConnections],
        }));
      }
      setExpandedIds(prev => new Set([...prev, node.id]));
    } catch { /* silent */ }
    finally { setExpandingId(null); }
  }

  // ── D3 Graph rendering ──
  useEffect(() => {
    if (phase !== "graph" || !graphData || !svgRef.current) return;

    const container = svgRef.current.parentElement;
    const W = container.clientWidth  || 900;
    const H = container.clientHeight || 600;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    // Build nodes + links
    const seedNode = {
      id: graphData.seed.id,
      title: graphData.seed.title,
      year: graphData.seed.year,
      abstract: graphData.seed.abstract || "",
      type: "seed",
      pdfUrl: graphData.seed.pdfUrl || null,
      authors: graphData.seed.authors || [],
      reason: "This is your seed paper — the center of the graph.",
      strength: "strong",
      keyThemes: graphData.seed.keyThemes || [],
    };

    const connNodes = (graphData.connections || []).map(c => ({
      id: c.id,
      title: c.title,
      year: c.year,
      abstract: c.abstract || "",
      type: c.relationship || "related",
      pdfUrl: c.pdfUrl || null,
      authors: c.authors || [],
      reason: c.reason || "",
      strength: c.strength || "medium",
      sourceId: c.sourceId || null,
    }));

    const nodeMap = new Map();
    [seedNode, ...connNodes].forEach(n => nodeMap.set(n.id, n));
    const nodes = Array.from(nodeMap.values());

    const links = (graphData.connections || []).map(c => ({
      source: c.sourceId || graphData.seed.id,
      target: c.id,
      type: c.relationship || "related",
      strength: c.strength || "medium",
    })).filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));

    const svg = d3.select(svgRef.current)
      .attr("width", W).attr("height", H);

    // Defs for glow filters
    const defs = svg.append("defs");
    Object.entries(NODE_CONFIG).forEach(([key, cfg]) => {
      const filter = defs.append("filter").attr("id", `glow-${key}`).attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
      filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
      const merge = filter.append("feMerge");
      merge.append("feMergeNode").attr("in", "coloredBlur");
      merge.append("feMergeNode").attr("in", "SourceGraphic");
    });

    // Arrow markers for each relationship type
    Object.entries(NODE_CONFIG).forEach(([key, cfg]) => {
      defs.append("marker")
        .attr("id", `arrow-${key}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 28).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", cfg.color)
        .attr("opacity", 0.7);
    });

    // Zoom behaviour
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(Math.round(event.transform.k * 100) / 100);
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    const g = svg.append("g");

    // Background grid
    const gridSize = 40;
    const gridGroup = g.append("g").attr("class", "grid").attr("opacity", 0.06);
    for (let x = -W; x < W*2; x += gridSize) {
      gridGroup.append("line").attr("x1", x).attr("y1", -H).attr("x2", x).attr("y2", H*2).attr("stroke", "#fff").attr("stroke-width", 0.5);
    }
    for (let y = -H; y < H*2; y += gridSize) {
      gridGroup.append("line").attr("x1", -W).attr("y1", y).attr("x2", W*2).attr("y2", y).attr("stroke", "#fff").attr("stroke-width", 0.5);
    }

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.strength==="strong"?160:d.strength==="medium"?220:280).strength(d => d.strength==="strong"?0.8:0.5))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(W/2, H/2))
      .force("collision", d3.forceCollide(50));

    simulationRef.current = simulation;

    // Links
    const link = g.append("g").selectAll("line")
      .data(links).join("line")
      .attr("stroke", d => NODE_CONFIG[d.type]?.color || "#4ade80")
      .attr("stroke-opacity", d => d.strength==="strong"?0.7:d.strength==="medium"?0.45:0.25)
      .attr("stroke-width", d => d.strength==="strong"?2:d.strength==="medium"?1.5:1)
      .attr("stroke-dasharray", d => d.type==="contradicts"?"6,3":null)
      .attr("marker-end", d => `url(#arrow-${d.type})`);

    // Node groups
    const node = g.append("g").selectAll("g")
      .data(nodes).join("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on("drag",  (event, d) => { d.fx=event.x; d.fy=event.y; })
        .on("end",   (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx=null; d.fy=null; })
      )
      .on("click", (event, d) => { event.stopPropagation(); setSelectedNode(d); });

    // Outer glow ring
    node.append("circle")
      .attr("r", d => d.type==="seed"?32:22)
      .attr("fill", "none")
      .attr("stroke", d => NODE_CONFIG[d.type]?.color || "#4ade80")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)
      .attr("filter", d => `url(#glow-${d.type})`);

    // Main circle
    node.append("circle")
      .attr("r", d => d.type==="seed"?24:16)
      .attr("fill", d => {
        const cfg = NODE_CONFIG[d.type];
        return cfg ? cfg.color + "22" : "#4ade8022";
      })
      .attr("stroke", d => NODE_CONFIG[d.type]?.color || "#4ade80")
      .attr("stroke-width", d => d.type==="seed"?2.5:1.5);

    // Emoji / icon in center
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", d => d.type==="seed"?"14":"10")
      .text(d => NODE_CONFIG[d.type]?.emoji || "🔗");

    // Title label below node
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", d => d.type==="seed"?38:28)
      .attr("fill", d => NODE_CONFIG[d.type]?.color || "#4ade80")
      .attr("font-size", d => d.type==="seed"?11:9)
      .attr("font-family", "'DM Sans', sans-serif")
      .attr("font-weight", d => d.type==="seed"?700:500)
      .style("pointer-events", "none")
      .text(d => d.title?.length>30 ? d.title.slice(0,28)+"…" : d.title);

    // Year label
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", d => d.type==="seed"?52:40)
      .attr("fill", "rgba(255,255,255,0.3)")
      .attr("font-size", 8)
      .attr("font-family", "'JetBrains Mono', monospace")
      .style("pointer-events", "none")
      .text(d => d.year || "");

    // Expand indicator for non-seed, non-expanded nodes
    node.filter(d => d.type !== "seed")
      .append("circle")
      .attr("cx", d => 16)
      .attr("cy", d => -16)
      .attr("r", 7)
      .attr("fill", "#07080d")
      .attr("stroke", "rgba(255,255,255,0.15)")
      .attr("stroke-width", 1)
      .attr("class", "expand-btn");

    node.filter(d => d.type !== "seed")
      .append("text")
      .attr("x", 16).attr("y", -16)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 8)
      .attr("fill", "rgba(255,255,255,0.5)")
      .style("pointer-events", "none")
      .text("+");

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Click on background to deselect
    svg.on("click", () => setSelectedNode(null));

    return () => { simulation.stop(); };
  }, [graphData, phase]);

  // ── Update graph when connections change (expand) ──
  useEffect(() => {
    if (phase !== "graph" || !graphData) return;
    // Re-trigger full render
  }, [graphData?.connections?.length]);

  function handleZoomIn()  { if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.3); }
  function handleZoomOut() { if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.77); }
  function handleZoomReset() { if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().call(zoomRef.current.transform, d3.zoomIdentity); }

  function handleExportPNG() {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rabbit-hole-${Date.now()}.svg`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── LEGEND ──
  const Legend = () => (
    <div style={{ display:"flex",flexWrap:"wrap",gap:"8px" }}>
      {Object.entries(NODE_CONFIG).map(([key,cfg]) => (
        <div key={key} style={{ display:"flex",alignItems:"center",gap:"5px" }}>
          <div style={{ width:"10px",height:"10px",borderRadius:"50%",background:cfg.color,boxShadow:`0 0 6px ${cfg.glow}` }}/>
          <span style={{ color:"rgba(255,255,255,0.45)",fontSize:"10px",fontFamily:"'JetBrains Mono'" }}>{cfg.label}</span>
        </div>
      ))}
    </div>
  );

  // ─── SELECT SCREEN ───
  if (phase === "select") {
    return (
      <div style={{ position:"fixed",inset:0,zIndex:500,background:"#07080d",overflow:"auto",animation:"fadeSlideIn 0.4s ease both" }}>
        {/* Header */}
        <div style={{ position:"sticky",top:0,zIndex:10,background:"rgba(7,8,13,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"0 40px",height:"56px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
            <button onClick={onClose} style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"rgba(255,255,255,0.5)",fontSize:"12px",cursor:"pointer",fontFamily:"'JetBrains Mono'" }}>
              <ChevronRight size={12} style={{ transform:"rotate(180deg)" }}/> Back
            </button>
            <div style={{ width:"1px",height:"20px",background:"rgba(255,255,255,0.08)" }}/>
            <span style={{ fontFamily:"'Playfair Display',serif",fontSize:"16px",color:"rgba(255,255,255,0.9)" }}>Research Rabbit Hole</span>
          </div>
          <div style={{ padding:"4px 10px",background:"rgba(240,165,0,0.1)",border:"1px solid rgba(240,165,0,0.25)",borderRadius:"6px" }}>
            <span style={{ color:"var(--gold)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>{stats.totalPapers} papers indexed</span>
          </div>
        </div>

        <div style={{ maxWidth:"680px",margin:"0 auto",padding:"60px 40px" }}>
          {/* Hero */}
          <div style={{ textAlign:"center",marginBottom:"56px" }}>
            <div style={{ width:"80px",height:"80px",margin:"0 auto 20px",background:"linear-gradient(135deg,rgba(167,139,250,0.15),rgba(96,165,250,0.05))",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"24px",display:"flex",alignItems:"center",justifyContent:"center",position:"relative" }}>
              <Network size={36} color="#a78bfa"/>
              <div style={{ position:"absolute",top:"-4px",right:"-4px",width:"18px",height:"18px",background:"linear-gradient(135deg,#f0a500,#ffcc55)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px" }}>🐇</div>
            </div>
            <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:"36px",fontWeight:700,color:"#fff",marginBottom:"10px",lineHeight:1.2 }}>Research Rabbit Hole</h1>
            <p style={{ color:"rgba(255,255,255,0.45)",fontSize:"15px",fontFamily:"'DM Sans'",lineHeight:1.7,maxWidth:"480px",margin:"0 auto" }}>
              Pick any paper. Watch AI map its entire intellectual universe — what it builds on, what contradicts it, and where it sits in the literature.
            </p>
          </div>

          {/* Legend preview */}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px",marginBottom:"40px" }}>
            {Object.entries(NODE_CONFIG).map(([key,cfg]) => (
              <div key={key} style={{ display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"10px" }}>
                <div style={{ width:"28px",height:"28px",flexShrink:0,background:cfg.color+"18",border:`1px solid ${cfg.color}40`,borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px" }}>{cfg.emoji}</div>
                <div>
                  <p style={{ color:cfg.color,fontSize:"12px",fontFamily:"'DM Sans'",fontWeight:600,marginBottom:"1px" }}>{cfg.label}</p>
                  <p style={{ color:"rgba(255,255,255,0.3)",fontSize:"10px",fontFamily:"'JetBrains Mono'" }}>{key==="seed"?"Center of the graph":key==="builds_on"?"Builds on / extends":key==="contradicts"?"Opposing findings":key==="same_method"?"Similar methodology":"Same research domain"}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Paper selection */}
          <div style={{ marginBottom:"32px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px" }}>
              <span style={{ width:"24px",height:"24px",background:"rgba(240,165,0,0.15)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:"var(--gold)",fontFamily:"'JetBrains Mono'",fontWeight:700,flexShrink:0 }}>1</span>
              <h3 style={{ color:"rgba(255,255,255,0.9)",fontSize:"14px",fontFamily:"'DM Sans'",fontWeight:600 }}>Choose your seed paper</h3>
            </div>

            {available.length === 0 ? (
              <div style={{ textAlign:"center",padding:"32px",background:"rgba(255,255,255,0.03)",border:"1px dashed rgba(255,255,255,0.1)",borderRadius:"12px" }}>
                <p style={{ color:"rgba(255,255,255,0.4)",fontSize:"13px",fontFamily:"'DM Sans'" }}>No papers indexed yet. Go to Search Papers first.</p>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:"8px",maxHeight:"340px",overflowY:"auto",paddingRight:"4px" }}>
                {available.map(p => {
                  const isSelected = seedPaper?.id === p.id;
                  return (
                    <button key={p.id} onClick={() => setSeedPaper(p)}
                      style={{ display:"flex",alignItems:"flex-start",gap:"12px",padding:"14px 16px",background:isSelected?"rgba(167,139,250,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${isSelected?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.07)"}`,borderRadius:"10px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",position:"relative" }}>
                      <div style={{ width:"36px",height:"36px",flexShrink:0,background:isSelected?"rgba(167,139,250,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${isSelected?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        {isSelected ? <span style={{ fontSize:"14px" }}>⭐</span> : <FileText size={14} color="rgba(255,255,255,0.3)"/>}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ color:isSelected?"#a78bfa":"rgba(255,255,255,0.8)",fontSize:"13px",fontFamily:"'DM Sans'",fontWeight:600,lineHeight:1.4,marginBottom:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.title}</p>
                        <p style={{ color:"rgba(255,255,255,0.3)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>
                          {Array.isArray(p.authors)?p.authors.slice(0,2).join(", "):p.authors} · {p.published}
                        </p>
                      </div>
                      {isSelected && <div style={{ position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",width:"8px",height:"8px",borderRadius:"50%",background:"#a78bfa" }}/>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <div className="error-row" style={{ marginBottom:"16px" }}><AlertCircle size={14}/>{error}</div>}

          <button onClick={handleBuild} disabled={!seedPaper || available.length === 0}
            style={{ width:"100%",padding:"16px",background:!seedPaper?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#a78bfa,#7c3aed)",border:"none",borderRadius:"14px",color:!seedPaper?"rgba(255,255,255,0.2)":"#fff",fontWeight:700,fontSize:"15px",cursor:!seedPaper?"not-allowed":"pointer",fontFamily:"'DM Sans'",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",transition:"all 0.3s",boxShadow:seedPaper?"0 4px 32px rgba(124,58,237,0.3)":"none" }}>
            <Network size={18}/> Build Rabbit Hole Graph
          </button>
          {seedPaper && <p style={{ textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:"11px",fontFamily:"'JetBrains Mono'",marginTop:"10px" }}>Will analyze {stats.totalPapers-1} other papers · Takes ~10 seconds</p>}
        </div>
      </div>
    );
  }

  // ─── LOADING SCREEN ───
  if (phase === "loading") {
    return (
      <div style={{ position:"fixed",inset:0,zIndex:500,background:"#07080d",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"24px" }}>
        <div style={{ position:"relative",width:"80px",height:"80px" }}>
          <div style={{ position:"absolute",inset:0,border:"2px solid rgba(167,139,250,0.15)",borderRadius:"50%" }}/>
          <div style={{ position:"absolute",inset:0,border:"2px solid transparent",borderTopColor:"#a78bfa",borderRadius:"50%",animation:"spin 1s linear infinite" }}/>
          <div style={{ position:"absolute",inset:"12px",border:"2px solid transparent",borderTopColor:"rgba(167,139,250,0.4)",borderRadius:"50%",animation:"spin 0.7s linear infinite reverse" }}/>
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px" }}>🐇</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <p style={{ color:"rgba(255,255,255,0.9)",fontSize:"16px",fontFamily:"'Playfair Display',serif",marginBottom:"6px" }}>Mapping the rabbit hole...</p>
          <p style={{ color:"rgba(255,255,255,0.35)",fontSize:"12px",fontFamily:"'JetBrains Mono'" }}>Analyzing relationships across {stats.totalPapers} papers</p>
        </div>
        <div style={{ display:"flex",gap:"6px" }}>
          {["builds_on","contradicts","same_method","related"].map((t,i) => (
            <div key={t} style={{ width:"8px",height:"8px",borderRadius:"50%",background:NODE_CONFIG[t].color,animation:`pulse 1.4s ease ${i*0.2}s infinite`,opacity:0.7 }}/>
          ))}
        </div>
      </div>
    );
  }

  // ─── GRAPH SCREEN ───
  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"#05060b",display:"flex",flexDirection:"column",animation:"fadeSlideIn 0.3s ease both" }}>

      {/* Header */}
      <div style={{ flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(5,6,11,0.95)",backdropFilter:"blur(20px)",padding:"0 24px",height:"52px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"10px",minWidth:0,flex:1 }}>
          <button onClick={onClose} style={{ display:"flex",alignItems:"center",gap:"4px",padding:"5px 10px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"7px",color:"rgba(255,255,255,0.4)",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'",flexShrink:0 }}>
            <ChevronRight size={11} style={{ transform:"rotate(180deg)" }}/> Exit
          </button>
          <div style={{ display:"flex",alignItems:"center",gap:"7px",minWidth:0 }}>
            <span style={{ fontSize:"16px",flexShrink:0 }}>🐇</span>
            <div style={{ minWidth:0 }}>
              <p style={{ color:"rgba(255,255,255,0.85)",fontSize:"12px",fontFamily:"'DM Sans'",fontWeight:600,lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>Research Rabbit Hole</p>
              <p style={{ color:"#a78bfa",fontSize:"10px",fontFamily:"'JetBrains Mono'",marginTop:"2px",whiteSpace:"nowrap" }}>Seed: {graphData?.seed?.title?.slice(0,45)}{graphData?.seed?.title?.length>45?"…":""}</p>
            </div>
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"6px",flexShrink:0 }}>
          <div style={{ padding:"4px 10px",background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:"6px" }}>
            <span style={{ color:"#a78bfa",fontSize:"10px",fontFamily:"'JetBrains Mono'" }}>{(graphData?.connections?.length||0)+1} nodes · {graphData?.connections?.length||0} links</span>
          </div>
          <button onClick={() => { setPhase("select"); setGraphData(null); setSelectedNode(null); setExpandedIds(new Set()); }}
            style={{ padding:"5px 10px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"7px",color:"rgba(255,255,255,0.35)",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'",whiteSpace:"nowrap" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(240,165,0,0.3)";e.currentTarget.style.color="var(--gold)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.35)";}}>
            New Graph
          </button>
          <button onClick={handleExportPNG}
            style={{ display:"flex",alignItems:"center",gap:"4px",padding:"5px 10px",background:"rgba(240,165,0,0.08)",border:"1px solid rgba(240,165,0,0.25)",borderRadius:"7px",color:"var(--gold)",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(240,165,0,0.15)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(240,165,0,0.08)"}>
            <Download size={11}/> Export
          </button>
        </div>
      </div>

      {/* Main content: graph + sidebar */}
      <div style={{ flex:1,display:"flex",overflow:"hidden" }}>

        {/* SVG graph */}
        <div ref={containerRef} style={{ flex:1,position:"relative",overflow:"hidden",background:"radial-gradient(ellipse at center,#0d0e1a 0%,#05060b 70%)" }}>
          <svg ref={svgRef} style={{ width:"100%",height:"100%",display:"block" }}/>

          {/* Zoom controls */}
          <div style={{ position:"absolute",bottom:"20px",left:"20px",display:"flex",flexDirection:"column",gap:"4px" }}>
            {[
              { icon:<ZoomIn size={14}/>,  action:handleZoomIn,  title:"Zoom in" },
              { icon:<ZoomOut size={14}/>, action:handleZoomOut, title:"Zoom out" },
              { icon:<Maximize2 size={13}/>, action:handleZoomReset, title:"Reset zoom" },
            ].map((btn,i) => (
              <button key={i} onClick={btn.action} title={btn.title}
                style={{ width:"32px",height:"32px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.5)",transition:"all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.color="#fff"}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.5)"}}>
                {btn.icon}
              </button>
            ))}
            <div style={{ padding:"4px 8px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"6px",textAlign:"center" }}>
              <span style={{ color:"rgba(255,255,255,0.3)",fontSize:"9px",fontFamily:"'JetBrains Mono'" }}>{Math.round(zoomLevel*100)}%</span>
            </div>
          </div>

          {/* Legend bottom right */}
          <div style={{ position:"absolute",bottom:"20px",right: selectedNode ? "360px" : "20px",background:"rgba(5,6,11,0.85)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"10px 14px",transition:"right 0.3s ease" }}>
            <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"9px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"8px" }}>LEGEND</p>
            <Legend/>
          </div>

          {/* Graph insight */}
          {graphData?.graphInsight && (
            <div style={{ position:"absolute",top:"16px",left:"50%",transform:"translateX(-50%)",background:"rgba(5,6,11,0.85)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"8px",padding:"8px 14px",maxWidth:"500px",textAlign:"center",pointerEvents:"none" }}>
              <p style={{ color:"rgba(167,139,250,0.8)",fontSize:"11px",fontFamily:"'DM Sans'" }}>{graphData.graphInsight}</p>
            </div>
          )}

          {/* Hint */}
          <div style={{ position:"absolute",top:"16px",left:"16px",background:"rgba(5,6,11,0.7)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"8px",padding:"7px 12px" }}>
            <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"10px",fontFamily:"'JetBrains Mono'" }}>Click node to inspect · Drag to move · Scroll to zoom · Click + to expand</p>
          </div>
        </div>

        {/* Right sidebar: selected node details */}
        {selectedNode && (
          <div style={{ width:"340px",flexShrink:0,borderLeft:"1px solid rgba(255,255,255,0.06)",background:"rgba(7,8,13,0.98)",overflowY:"auto",animation:"fadeSlideIn 0.25s ease both" }}>
            <div style={{ padding:"20px" }}>
              {/* Node type badge */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                  <span style={{ fontSize:"16px" }}>{NODE_CONFIG[selectedNode.type]?.emoji}</span>
                  <span style={{ background:`${NODE_CONFIG[selectedNode.type]?.color}18`,color:NODE_CONFIG[selectedNode.type]?.color,border:`1px solid ${NODE_CONFIG[selectedNode.type]?.color}35`,fontSize:"10px",fontFamily:"'JetBrains Mono'",padding:"3px 9px",borderRadius:"20px" }}>{NODE_CONFIG[selectedNode.type]?.label}</span>
                </div>
                <button onClick={()=>setSelectedNode(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",padding:"4px" }} onMouseEnter={e=>e.currentTarget.style.color="#fff"} onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}><X size={14}/></button>
              </div>

              {/* Title */}
              <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:"15px",color:"#fff",lineHeight:1.4,marginBottom:"8px" }}>{selectedNode.title}</h3>

              {/* Meta */}
              <div style={{ display:"flex",gap:"12px",marginBottom:"14px",flexWrap:"wrap" }}>
                {selectedNode.year && <span style={{ color:"rgba(255,255,255,0.35)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>{selectedNode.year}</span>}
                {selectedNode.authors?.length>0 && <span style={{ color:"rgba(255,255,255,0.35)",fontSize:"11px",fontFamily:"'DM Sans'" }}>{(Array.isArray(selectedNode.authors)?selectedNode.authors:["Unknown"]).slice(0,2).join(", ")}</span>}
              </div>

              {/* Connection reason */}
              {selectedNode.reason && selectedNode.type !== "seed" && (
                <div style={{ background:`${NODE_CONFIG[selectedNode.type]?.color}08`,border:`1px solid ${NODE_CONFIG[selectedNode.type]?.color}20`,borderRadius:"8px",padding:"12px 14px",marginBottom:"14px" }}>
                  <p style={{ color:NODE_CONFIG[selectedNode.type]?.color,fontSize:"9px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"5px" }}>WHY CONNECTED</p>
                  <p style={{ color:"rgba(255,255,255,0.6)",fontSize:"12px",fontFamily:"'DM Sans'",lineHeight:1.6 }}>{selectedNode.reason}</p>
                </div>
              )}

              {/* Key themes (seed only) */}
              {selectedNode.type==="seed" && selectedNode.keyThemes?.length>0 && (
                <div style={{ marginBottom:"14px" }}>
                  <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"9px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"7px" }}>KEY THEMES</p>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:"5px" }}>
                    {selectedNode.keyThemes.map(t=><span key={t} style={{ padding:"3px 9px",background:"rgba(240,165,0,0.08)",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"20px",color:"var(--gold)",fontSize:"10px",fontFamily:"'JetBrains Mono'" }}>{t}</span>)}
                  </div>
                </div>
              )}

              {/* Abstract */}
              {selectedNode.abstract && (
                <div style={{ marginBottom:"16px" }}>
                  <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"9px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"7px" }}>ABSTRACT</p>
                  <p style={{ color:"rgba(255,255,255,0.45)",fontSize:"12px",fontFamily:"'DM Sans'",lineHeight:1.7 }}>{selectedNode.abstract.slice(0,280)}{selectedNode.abstract.length>280?"…":""}</p>
                </div>
              )}

              {/* Strength */}
              {selectedNode.strength && selectedNode.type!=="seed" && (
                <div style={{ display:"flex",alignItems:"center",gap:"6px",marginBottom:"16px" }}>
                  <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"9px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em" }}>CONNECTION STRENGTH</p>
                  <span style={{ padding:"2px 8px",background:selectedNode.strength==="strong"?"rgba(74,222,128,0.1)":selectedNode.strength==="medium"?"rgba(240,165,0,0.1)":"rgba(156,163,175,0.1)",color:selectedNode.strength==="strong"?"#4ade80":selectedNode.strength==="medium"?"var(--gold)":"#9ca3af",fontSize:"10px",fontFamily:"'JetBrains Mono'",borderRadius:"20px",border:`1px solid ${selectedNode.strength==="strong"?"rgba(74,222,128,0.3)":selectedNode.strength==="medium"?"rgba(240,165,0,0.3)":"rgba(156,163,175,0.2)"}` }}>{selectedNode.strength}</span>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
                {isRealPdf(selectedNode.pdfUrl) && (
                  <a href={selectedNode.pdfUrl} target="_blank" rel="noreferrer"
                    style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",padding:"10px",background:"rgba(240,165,0,0.08)",border:"1px solid rgba(240,165,0,0.25)",borderRadius:"9px",color:"var(--gold)",fontSize:"12px",fontFamily:"'DM Sans'",textDecoration:"none",fontWeight:600,transition:"all 0.2s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(240,165,0,0.16)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(240,165,0,0.08)"}>
                    <ExternalLink size={13}/> Read Full Paper
                  </a>
                )}
                {selectedNode.type !== "seed" && (
                  <button onClick={()=>handleExpand(selectedNode)} disabled={!!expandingId || expandedIds.has(selectedNode.id)}
                    style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",padding:"10px",background:expandedIds.has(selectedNode.id)?"rgba(74,222,128,0.08)":expandingId===selectedNode.id?"rgba(255,255,255,0.04)":"rgba(167,139,250,0.08)",border:`1px solid ${expandedIds.has(selectedNode.id)?"rgba(74,222,128,0.25)":expandingId===selectedNode.id?"rgba(255,255,255,0.08)":"rgba(167,139,250,0.25)"}`,borderRadius:"9px",color:expandedIds.has(selectedNode.id)?"#4ade80":expandingId===selectedNode.id?"rgba(255,255,255,0.3)":"#a78bfa",fontSize:"12px",fontFamily:"'DM Sans'",cursor:expandedIds.has(selectedNode.id)||!!expandingId?"not-allowed":"pointer",fontWeight:600 }}>
                    {expandingId===selectedNode.id ? <><Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/>Expanding...</> : expandedIds.has(selectedNode.id) ? <><CheckCircle2 size={13}/>Already Expanded</> : <><Network size={13}/>Expand This Node</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
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
  const [showSupervisor, setShowSupervisor] = useState(false);
  const [showRabbitHole, setShowRabbitHole] = useState(false);

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

  useEffect(() => { if (isSignedIn) { setShowWelcome(false); setShowHardWall(false); } }, [isSignedIn]);
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

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input not supported. Use Chrome."); return; }
    const recognition = new SR();
    recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart  = () => setIsListening(true);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => setIsListening(false);
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setQuestion(t);
      setTimeout(() => { if (t.trim()) handleAskWithQuestion(t.trim()); }, 300);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() { recognitionRef.current?.stop(); setIsListening(false); }

  function speakAnswer(text, idx) {
    window.speechSynthesis.cancel();
    if (speakingMsgIdx === idx && isSpeaking) { setIsSpeaking(false); setSpeakingMsgIdx(null); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith("en") && v.localService) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { setIsSpeaking(true); setSpeakingMsgIdx(idx); };
    utterance.onend   = () => { setIsSpeaking(false); setSpeakingMsgIdx(null); };
    utterance.onerror = () => { setIsSpeaking(false); setSpeakingMsgIdx(null); };
    window.speechSynthesis.speak(utterance);
  }

  function handleWelcomeSkip()  { localStorage.setItem(STORAGE_KEY_WELCOMED, "skipped"); setShowWelcome(false); }
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
    if (!incrementSearchCount()) return;
    const userMsg = { role:"user", question:q };
    const aiMsg   = { role:"ai", loading:true };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setQuestion(""); setIsAsking(true);
    try {
      const res = await axios.post(`${API}/ask`, { question:q });
      setMessages(prev => prev.map((m,i) => i===prev.length-1 ? { role:"ai", answer:res.data.answer, citations:res.data.citations, confidence:res.data.confidence } : m));
    } catch(err) {
      const errMsg = err.response?.data?.error || "Something went wrong.";
      setMessages(prev => prev.map((m,i) => i===prev.length-1 ? { role:"ai", error:errMsg } : m));
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

  function handleClearChat() { window.speechSynthesis.cancel(); setIsSpeaking(false); setSpeakingMsgIdx(null); setMessages([]); }

  function exportToPDF() {
    const doc = new jsPDF({ unit:"mm", format:"a4" });
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
    const margin = 20, contentW = pageW - margin*2;
    let y = margin;
    doc.setFillColor(10,11,15); doc.rect(0,0,pageW,28,"F");
    doc.setFontSize(18); doc.setTextColor(240,165,0); doc.setFont("helvetica","bold"); doc.text("ResearchMind",margin,17);
    doc.setFontSize(9); doc.setTextColor(144,150,168); doc.setFont("helvetica","normal");
    doc.text("AI Research Assistant",margin+52,17);
    doc.text(new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),pageW-margin,17,{align:"right"});
    y = 36;
    const qaPairs = [];
    for (let i=0;i<messages.length;i++) { if(messages[i].role==="user"&&messages[i+1]?.role==="ai") qaPairs.push({question:messages[i].question,ai:messages[i+1]}); }
    qaPairs.forEach((pair,idx) => {
      if(y>pageH-margin){doc.addPage();y=margin;}
      doc.setFontSize(9);doc.setTextColor(240,165,0);doc.setFont("helvetica","bold");doc.text(`Q${idx+1}`,margin,y);y+=1;
      doc.setFontSize(11);doc.setTextColor(230,230,230);doc.setFont("helvetica","bold");
      doc.splitTextToSize(pair.question,contentW).forEach(l=>{if(y>pageH-margin){doc.addPage();y=margin;}doc.text(l,margin,y);y+=6;});y+=4;
      if(pair.ai.answer){
        doc.setFontSize(10);doc.setTextColor(200,200,200);doc.setFont("helvetica","normal");
        doc.splitTextToSize(pair.ai.answer,contentW).forEach(l=>{if(y>pageH-margin){doc.addPage();y=margin;}doc.text(l,margin,y);y+=5.5;});
      }
    });
    const totalPages=doc.internal.getNumberOfPages();
    for(let p=1;p<=totalPages;p++){doc.setPage(p);doc.setFontSize(8);doc.setTextColor(60,63,80);doc.text("researchminds.vercel.app",margin,pageH-8);doc.text(`Page ${p} of ${totalPages}`,pageW-margin,pageH-8,{align:"right"});}
    doc.save(`ResearchMind_Report_${Date.now()}.pdf`);
  }

  async function handleClear() {
    if (!confirm("Clear all indexed papers?")) return;
    try { await axios.delete(`${API}/clear`); setStats({totalPapers:0,totalChunks:0}); setPapers([]); setMessages([]); setProgress(0); setProgressLogs([]); setIngestDone(false); }
    catch {}
  }

  function handleIngest() {
    if (!ingestQuery.trim()) return;
    setPapers([]); setError(""); setProgress(0); setProgressLogs([]); setIsIngesting(true); setIngestDone(false); setIngestError(false);
    if (eventSourceRef.current) eventSourceRef.current.close();
    const url = `${API}/ingest-progress?query=${encodeURIComponent(ingestQuery)}&maxResults=${maxResults}&source=${selectedSource}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress !== undefined) setProgress(data.progress);
      setProgressLogs(prev => [...prev, { type:data.type, message:data.message }]);
      if (data.type==="done")  { setPapers(data.papers); setStats(data.stats); setIngestDone(true); setIsIngesting(false); es.close(); }
      if (data.type==="error") { setError(data.message); setIngestError(true); setIsIngesting(false); es.close(); }
    };
    es.onerror = () => { setError("Connection lost."); setIngestError(true); setIsIngesting(false); es.close(); };
  }

  function handlePaperIndexed(paper) { setPapers(prev => [paper, ...prev]); }

  const activeSource = SOURCES.find(s => s.id === selectedSource);
  const remainingSearches = isSignedIn ? "∞" : Math.max(0, FREE_LIMIT - searchCount);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn      { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp     { from { opacity: 0; transform: translateY(40px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pulse       { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
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
        .clear-btn { display: flex; align-items: center; gap: 5px; padding: 6px 12px; background: transparent; border: 1px solid rgba(248,113,113,0.3); border-radius: 8px; color: #f87171; font-size: 12px; cursor: pointer; font-family: 'JetBrains Mono'; transition: all 0.2s; }
        .clear-btn:hover { background: rgba(248,113,113,0.08); }
        .main-content { max-width: 1100px; margin: 0 auto; padding: 48px 40px 60px; }
        .hero-section { text-align: center; margin-bottom: 56px; animation: fadeSlideIn 0.6s ease both; }
        .hero-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gold-glow); border: 1px solid rgba(240,165,0,0.25); border-radius: 20px; padding: 5px 14px; margin-bottom: 24px; }
        .hero-title { font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 58px); font-weight: 700; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 16px; }
        .hero-subtitle { color: var(--text-secondary); font-size: 16px; max-width: 520px; margin: 0 auto; line-height: 1.7; }
        .tab-bar { display: flex; gap: 4px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 4px; margin-bottom: 32px; animation: fadeSlideIn 0.6s ease 0.1s both; overflow-x: auto; scrollbar-width: none; }
        .tab-bar::-webkit-scrollbar { display: none; }
        .tab-label { display: inline; }
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
        .chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        .chat-input-area { border-top: 1px solid var(--border); padding: 16px 20px; display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0; background: var(--bg-secondary); }
        .chat-input { flex: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; color: var(--text-primary); font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; resize: none; min-height: 44px; max-height: 120px; transition: border 0.2s; line-height: 1.5; }
        .chat-input:focus { border-color: rgba(240,165,0,0.5); }
        .send-btn { width: 44px; height: 44px; flex-shrink: 0; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .mic-active { animation: micPulse 1.2s ease infinite; }
        @media (max-width: 768px) {
          .header-inner { padding: 0 20px; height: 56px; } .chunks-pill { display: none; }
          .main-content { padding: 24px 16px 60px; } .panel-card { padding: 20px 16px; }
          .source-grid { grid-template-columns: repeat(2, 1fr); } .search-row { flex-wrap: wrap; }
          .papers-grid { grid-template-columns: 1fr; } .tab-btn { font-size: 12px; padding: 10px 12px; }
        }
        @media (max-width: 600px) { .tab-label { display: none; } .tab-btn { flex: 1; padding: 12px 8px; min-width: 44px; } }
        @media (max-width: 480px) {
          .header-inner { padding: 0 14px; } .stat-pill { display: none; }
          .main-content { padding: 16px 12px 60px; } .panel-card { padding: 16px 14px; }
          .source-grid { gap: 8px; } .source-btn-sub { display: none; }
        }
      `}</style>

      {showWelcome && !isSignedIn && <WelcomeModal onSkip={handleWelcomeSkip} onClose={handleWelcomeClose}/>}
      {showHardWall && !isSignedIn && <HardWallModal/>}

      <div style={{ minHeight:"100vh" }}>
        <header className="app-header">
          <div className="header-inner">
            <div className="header-logo">
              <div className="header-logo-icon"><Brain size={16} color="#0a0b0f"/></div>
              <span className="header-logo-text">Research<span style={{ color:"var(--gold)" }}>Mind</span></span>
            </div>
            <div className="header-actions">
              {!isSignedIn && (
                <div className="stat-pill" style={{ borderColor:searchCount>=FREE_LIMIT?"rgba(248,113,113,0.3)":"var(--border)" }}>
                  <Zap size={12} color={searchCount>=FREE_LIMIT?"#f87171":"var(--gold)"}/>
                  <span style={{ color:searchCount>=FREE_LIMIT?"#f87171":"var(--text-secondary)" }}>{remainingSearches} searches left</span>
                </div>
              )}
              {isSignedIn && (
                <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                  <div className="stat-pill" style={{ borderColor:"rgba(74,222,128,0.3)" }}>
                    <CheckCircle2 size={12} color="#4ade80"/>
                    <span style={{ color:"#4ade80" }}>{user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Signed in"}</span>
                  </div>
                  <button onClick={()=>signOut()} style={{ padding:"6px 12px",background:"transparent",border:"1px solid var(--border)",borderRadius:"8px",color:"var(--text-muted)",fontSize:"12px",cursor:"pointer",fontFamily:"'JetBrains Mono'" }}>Sign out</button>
                </div>
              )}
              {!isSignedIn && (
                <SignInButton mode="modal">
                  <button style={{ padding:"6px 14px",background:"linear-gradient(135deg,var(--gold),var(--gold-dim))",border:"none",borderRadius:"8px",color:"#0a0b0f",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans'" }}>Sign In</button>
                </SignInButton>
              )}
              <div className="stat-pill"><Database size={12} color="var(--gold)"/><span>{stats.totalPapers} papers</span></div>
              <div className="stat-pill chunks-pill"><FileText size={12} color="var(--blue)"/><span>{stats.totalChunks} chunks</span></div>
              {stats.totalChunks > 0 && <button className="clear-btn" onClick={handleClear}><Trash2 size={11}/> Clear</button>}
            </div>
          </div>
        </header>

        {serverStatus === "waking" && (
          <div style={{ width:"100%",background:"linear-gradient(90deg,rgba(240,165,0,0.12),rgba(240,165,0,0.06))",borderBottom:"1px solid rgba(240,165,0,0.25)",padding:"10px 40px",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px" }}>
            <Loader2 size={13} color="var(--gold)" style={{ animation:"spin 1s linear infinite",flexShrink:0 }}/>
            <span style={{ fontFamily:"'JetBrains Mono'",fontSize:"12px",color:"var(--gold)" }}>Server is waking up — may take up to 30 seconds on first visit...</span>
          </div>
        )}
        {serverStatus === "offline" && (
          <div style={{ width:"100%",background:"rgba(248,113,113,0.08)",borderBottom:"1px solid rgba(248,113,113,0.25)",padding:"10px 40px",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px" }}>
            <AlertCircle size={13} color="#f87171" style={{ flexShrink:0 }}/>
            <span style={{ fontFamily:"'JetBrains Mono'",fontSize:"12px",color:"#f87171" }}>Server appears offline. Try refreshing.</span>
            <button onClick={fetchStats} style={{ background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:"6px",color:"#f87171",fontSize:"11px",padding:"3px 10px",cursor:"pointer" }}>Retry</button>
          </div>
        )}

        <main className="main-content">
          <div className="hero-section">
            <div className="hero-badge">
              <Sparkles size={12} color="var(--gold)"/>
              <span style={{ color:"var(--gold)",fontSize:"12px",fontFamily:"'JetBrains Mono'" }}>AI-Powered Research Assistant</span>
            </div>
            <h1 className="hero-title">
              Understand research papers<br/>
              <span style={{ background:"linear-gradient(135deg,var(--gold),#ffcc55)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>in seconds, not hours</span>
            </h1>
            <p className="hero-subtitle">Search across ArXiv, PubMed, Semantic Scholar and ChemRxiv — or upload your own PDF.</p>
          </div>

          <div className="tab-bar">
            {[
              { id:"ingest",    label:"Search Papers", icon:BookOpen },
              { id:"upload",    label:"Upload PDF",    icon:Upload },
              { id:"ask",       label:"Ask",           icon:MessageSquare },
              { id:"battle",    label:"Battle",        icon:Swords },
              { id:"litreview", label:"Lit Review",    icon:ScrollText },
              { id:"gaps",      label:"Gaps",          icon:SearchIcon },
              { id:"digest",    label:"Digest",        icon:Mail },
            ].map(({ id, label, icon:Icon }) => (
              <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{ background:tab===id?"linear-gradient(135deg,rgba(240,165,0,0.15),rgba(240,165,0,0.05))":"transparent",color:tab===id?"var(--gold)":"var(--text-muted)",border:tab===id?"1px solid rgba(240,165,0,0.25)":"1px solid transparent" }}>
                <Icon size={15}/><span className="tab-label">{label}</span>
              </button>
            ))}
          </div>

          {/* Feature entry cards */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"32px",animation:"fadeSlideIn 0.6s ease 0.15s both" }}>
            {/* AI Supervisor */}
            <button onClick={() => setShowSupervisor(true)}
              style={{ padding:"16px 20px",background:"linear-gradient(135deg,rgba(240,165,0,0.08),rgba(240,165,0,0.02))",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.2s",gap:"12px",textAlign:"left" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(240,165,0,0.4)";e.currentTarget.style.background="linear-gradient(135deg,rgba(240,165,0,0.12),rgba(240,165,0,0.04))";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(240,165,0,0.2)";e.currentTarget.style.background="linear-gradient(135deg,rgba(240,165,0,0.08),rgba(240,165,0,0.02))";}}>
              <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                <div style={{ width:"38px",height:"38px",background:"linear-gradient(135deg,rgba(240,165,0,0.2),rgba(240,165,0,0.05))",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"18px" }}>👨‍🏫</div>
                <div>
                  <p style={{ color:"var(--gold)",fontSize:"13px",fontWeight:700,marginBottom:"2px" }}>AI Research Supervisor</p>
                  <p style={{ color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>Expert feedback on your research</p>
                </div>
              </div>
              <ChevronRight size={14} color="var(--gold)" style={{ flexShrink:0 }}/>
            </button>

            {/* Research Rabbit Hole */}
            <button onClick={() => setShowRabbitHole(true)}
              style={{ padding:"16px 20px",background:"linear-gradient(135deg,rgba(167,139,250,0.08),rgba(96,165,250,0.02))",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.2s",gap:"12px",textAlign:"left" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.45)";e.currentTarget.style.background="linear-gradient(135deg,rgba(167,139,250,0.13),rgba(96,165,250,0.04))";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.2)";e.currentTarget.style.background="linear-gradient(135deg,rgba(167,139,250,0.08),rgba(96,165,250,0.02))";}}>
              <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                <div style={{ width:"38px",height:"38px",background:"linear-gradient(135deg,rgba(167,139,250,0.2),rgba(96,165,250,0.05))",border:"1px solid rgba(167,139,250,0.3)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative" }}>
                  <Network size={18} color="#a78bfa"/>
                  <div style={{ position:"absolute",top:"-4px",right:"-4px",width:"14px",height:"14px",background:"linear-gradient(135deg,#f0a500,#ffcc55)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"7px" }}>🐇</div>
                </div>
                <div>
                  <p style={{ color:"#a78bfa",fontSize:"13px",fontWeight:700,marginBottom:"2px" }}>Research Rabbit Hole</p>
                  <p style={{ color:"var(--text-muted)",fontSize:"11px",fontFamily:"'JetBrains Mono'" }}>Interactive knowledge graph</p>
                </div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:"6px",flexShrink:0 }}>
                <span style={{ padding:"2px 7px",background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:"20px",color:"#a78bfa",fontSize:"9px",fontFamily:"'JetBrains Mono'" }}>NEW</span>
                <ChevronRight size={14} color="#a78bfa"/>
              </div>
            </button>
          </div>

          {/* Tab content */}
          {tab === "ingest" && (
            <div style={{ animation:"fadeSlideIn 0.3s ease both" }}>
              <div className="panel-card">
                <h2 className="panel-title">Search & Ingest Papers</h2>
                <p className="panel-subtitle">Choose your source, search for papers, and index them for Q&A</p>
                <p style={{ color:"var(--text-secondary)",fontSize:"11px",marginBottom:"10px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.08em" }}>SELECT SOURCE</p>
                <div className="source-grid">
                  {SOURCES.map(source => {
                    const isActive = selectedSource === source.id;
                    return (
                      <button key={source.id} className="source-btn" onClick={() => setSelectedSource(source.id)} style={{ background:isActive?`${source.color}18`:"var(--bg-secondary)",border:isActive?`1px solid ${source.color}`:"1px solid var(--border)" }}>
                        <div className="source-btn-label" style={{ color:isActive?source.color:"var(--text-primary)" }}>{source.label}</div>
                        <div className="source-btn-sub">{source.fields}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="search-row">
                  <div className="search-input-wrap">
                    <span className="search-input-icon"><Search size={16}/></span>
                    <input className="search-input" value={ingestQuery} onChange={e=>setIngestQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleIngest()} placeholder={`Search ${activeSource?.label}...`} disabled={isIngesting}/>
                  </div>
                  <select className="count-select" value={maxResults} onChange={e=>setMaxResults(Number(e.target.value))} disabled={isIngesting}>
                    {[2,3,5,8,10].map(n=><option key={n} value={n}>{n} papers</option>)}
                  </select>
                  <button className="action-btn" onClick={handleIngest} disabled={isIngesting||!ingestQuery.trim()} style={{ background:isIngesting?"var(--bg-hover)":"linear-gradient(135deg,var(--gold),var(--gold-dim))",color:isIngesting?"var(--text-muted)":"#0a0b0f",cursor:isIngesting?"not-allowed":"pointer" }}>
                    {isIngesting?<Loader2 size={15} style={{ animation:"spin 1s linear infinite" }}/>:<Search size={15}/>}
                    {isIngesting?"Processing...":"Ingest"}
                  </button>
                </div>
                {(isIngesting||ingestDone||ingestError)&&progressLogs.length>0&&<ProgressBar progress={progress} logs={progressLogs} isDone={ingestDone} isError={ingestError}/>}
                {error&&!ingestError&&<div className="error-row"><AlertCircle size={14}/>{error}</div>}
              </div>
              {papers.length > 0 && (
                <div style={{ animation:"fadeSlideIn 0.4s ease both" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"20px" }}>
                    <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:"17px" }}>Ingested Papers</h3>
                    <Badge color="green">{papers.length} indexed</Badge>
                  </div>
                  <div className="papers-grid">{papers.map((p,i)=><PaperCard key={p.id} paper={p} index={i}/>)}</div>
                  <div style={{ marginTop:"28px",textAlign:"center",padding:"24px",background:"var(--gold-glow)",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"12px" }}>
                    <p style={{ color:"var(--text-secondary)",marginBottom:"12px",fontSize:"14px" }}>Papers indexed! Ready to answer questions.</p>
                    <button onClick={()=>setTab("ask")} style={{ display:"inline-flex",alignItems:"center",gap:"8px",padding:"10px 24px",background:"linear-gradient(135deg,var(--gold),var(--gold-dim))",border:"none",borderRadius:"8px",color:"#0a0b0f",fontWeight:600,fontSize:"14px",cursor:"pointer" }}>
                      Ask Questions <ChevronRight size={14}/>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "upload"    && <UploadTab onPaperIndexed={handlePaperIndexed} setStats={setStats}/>}
          {tab === "battle"    && <BattleTab indexedPapers={papers}/>}
          {tab === "litreview" && <LitReviewTab stats={stats}/>}
          {tab === "gaps"      && <ResearchGapsTab stats={stats}/>}
          {tab === "digest"    && <DigestTab/>}

          {tab === "ask" && (
            <div style={{ animation:"fadeSlideIn 0.3s ease both" }}>
              <div className="chat-container">
                <div className="chat-header">
                  <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                    <div style={{ width:"28px",height:"28px",background:"rgba(96,165,250,0.15)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center" }}><Brain size={14} color="#60a5fa"/></div>
                    <div>
                      <p style={{ fontFamily:"'Playfair Display',serif",fontSize:"15px",fontWeight:600,color:"var(--text-primary)" }}>ResearchMind AI</p>
                      <p style={{ fontSize:"11px",color:"var(--text-muted)",fontFamily:"'JetBrains Mono'" }}>{stats.totalPapers} papers · {stats.totalChunks} chunks{!isSignedIn&&<span style={{ marginLeft:"8px",color:searchCount>=FREE_LIMIT?"#f87171":"rgba(240,165,0,0.7)" }}>· {remainingSearches} searches left</span>}</p>
                    </div>
                  </div>
                  {messages.length > 0 && (
                    <div style={{ display:"flex",gap:"8px" }}>
                      <button onClick={exportToPDF} style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",background:"rgba(240,165,0,0.08)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"6px",color:"var(--gold)",fontSize:"11px",cursor:"pointer" }}><Download size={10}/> Export PDF</button>
                      <button onClick={handleClearChat} style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",background:"transparent",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text-muted)",fontSize:"11px",cursor:"pointer" }}><Trash2 size={10}/> Clear</button>
                    </div>
                  )}
                </div>
                <div className="chat-messages">
                  {messages.length === 0 && (
                    <div style={{ height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"12px" }}>
                      <Brain size={22} color="#60a5fa" style={{ opacity:0.4 }}/>
                      <p style={{ color:"var(--text-muted)",fontSize:"14px",textAlign:"center",maxWidth:"320px",lineHeight:1.6 }}>
                        {stats.totalChunks===0?"No papers indexed yet. Go to Search Papers first.":"Ask anything about your indexed papers"}
                      </p>
                      {stats.totalChunks>0 && (
                        <div style={{ display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"center" }}>
                          {["What are the main findings?","Compare the methodologies","What are the limitations?"].map(q=>(
                            <button key={q} onClick={()=>{setQuestion(q);inputRef.current?.focus();}} style={{ padding:"6px 12px",background:"var(--bg-secondary)",border:"1px solid var(--border)",borderRadius:"20px",color:"var(--text-secondary)",fontSize:"12px",cursor:"pointer",transition:"all 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(240,165,0,0.4)";e.currentTarget.style.color="var(--gold)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}>
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {messages.map((msg,i)=><ChatMessage key={i} message={msg} msgIndex={i} onSpeak={speakAnswer} isSpeakingThis={speakingMsgIdx===i&&isSpeaking}/>)}
                  <div ref={chatEndRef}/>
                </div>
                <div className="chat-input-area">
                  <textarea ref={inputRef} className="chat-input" value={question}
                    onChange={e=>{setQuestion(e.target.value);e.target.style.height="44px";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleAsk();}}}
                    placeholder={isListening?"🎤 Listening...":(!isSignedIn&&searchCount>=FREE_LIMIT?"Sign up to continue...":"Ask in any language... (Enter to send)")}
                    rows={1} disabled={isAsking||(!isSignedIn&&searchCount>=FREE_LIMIT)}/>
                  <button className={`send-btn${isListening?" mic-active":""}`} onClick={isListening?stopListening:startListening} disabled={isAsking||(!isSignedIn&&searchCount>=FREE_LIMIT)} style={{ background:isListening?"rgba(248,113,113,0.2)":"var(--bg-hover)",border:`1px solid ${isListening?"rgba(248,113,113,0.5)":"var(--border)"}` }}>
                    {isListening?<MicOff size={16} color="#f87171"/>:<Mic size={16} color="var(--text-muted)"/>}
                  </button>
                  <button className="send-btn" onClick={handleAsk} disabled={isAsking||!question.trim()||(!isSignedIn&&searchCount>=FREE_LIMIT)} style={{ background:isAsking||!question.trim()?"var(--bg-hover)":"linear-gradient(135deg,var(--gold),var(--gold-dim))" }}>
                    {isAsking?<Loader2 size={16} color="var(--text-muted)" style={{ animation:"spin 1s linear infinite" }}/>:<Send size={16} color={question.trim()?"#0a0b0f":"var(--text-muted)"}/>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showSupervisor && <SupervisorPage stats={stats} onClose={()=>setShowSupervisor(false)}/>}
      {showRabbitHole && <RabbitHolePage stats={stats} indexedPapers={papers} onClose={()=>setShowRabbitHole(false)}/>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── AI SUPERVISOR PAGE ───
// ═══════════════════════════════════════════════════════════
function SupervisorPage({ stats, onClose }) {
  const MODES = [
    { id:"supportive", label:"Supportive", emoji:"🤝", color:"#4ade80", desc:"Encouraging, gentle, builds confidence", persona:"I'm here to help you grow. I'll be honest but kind." },
    { id:"strict",     label:"Strict",     emoji:"⚡", color:"#f87171", desc:"Harsh but fair, like a top professor",  persona:"I have high standards. Expect direct, unfiltered feedback." },
    { id:"focused",    label:"Focused",    emoji:"🎯", color:"#60a5fa", desc:"Methodology only, precise and technical", persona:"We'll focus exclusively on your methodology." },
    { id:"interdisciplinary", label:"Interdisciplinary", emoji:"🌍", color:"#a78bfa", desc:"Connects your work across fields", persona:"The most interesting research lives at intersections." },
  ];

  const [phase, setPhase]             = useState("setup");
  const [selectedMode, setSelectedMode] = useState(null);
  const [researchQuestion, setResearchQuestion] = useState("");
  const [draftFile, setDraftFile]     = useState(null);
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [isThinking, setIsThinking]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [mobilePanel, setMobilePanel] = useState("chat");
  const [isMobile, setIsMobile]       = useState(false);

  const chatEndRef   = useRef(null);
  const inputRef     = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 700); }
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const mode = MODES.find(m => m.id === selectedMode);

  async function handleDraftUpload(file) {
    if (!file || file.type !== "application/pdf") return;
    setDraftFile(file); setUploadingDraft(true);
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("title", file.name.replace(".pdf", ""));
    try { await axios.post(`${API}/upload-pdf`, formData, { headers:{"Content-Type":"multipart/form-data"} }); }
    catch { /* silent */ }
    finally { setUploadingDraft(false); }
  }

  async function startSession() {
    if (!selectedMode) return;
    setPhase("session"); setMobilePanel("chat");
    setMessages([{ role:"supervisor", content:"", loading:true }]); setIsThinking(true);
    try {
      const res = await axios.post(`${API}/supervisor/analyze`, { mode:selectedMode, researchQuestion:researchQuestion.trim(), hasDraft:!!draftFile, draftName:draftFile?.name||null });
      setMessages([{ role:"supervisor", content:res.data.analysis }]);
    } catch { setMessages([{ role:"supervisor", content:"I encountered an issue analyzing your papers. Please ensure you have papers indexed and try again." }]); }
    finally { setIsThinking(false); setTimeout(()=>inputRef.current?.focus(),200); }
  }

  async function handleSend() {
    const q = input.trim();
    if (!q || isThinking) return;
    setInput(""); setMobilePanel("chat");
    setMessages(prev=>[...prev,{ role:"student",content:q },{ role:"supervisor",content:"",loading:true }]);
    setIsThinking(true);
    try {
      const history = messages.map(m=>({ role:m.role==="supervisor"?"assistant":"user",content:m.content }));
      const res = await axios.post(`${API}/supervisor/chat`, { message:q,mode:selectedMode,researchQuestion:researchQuestion.trim(),history:history.slice(-10) });
      setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{ role:"supervisor",content:res.data.reply }:m));
    } catch { setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{ role:"supervisor",content:"Something went wrong." }:m)); }
    finally { setIsThinking(false); setTimeout(()=>inputRef.current?.focus(),100); }
  }

  const modeColor = mode?.color || "var(--gold)";

  function ContextPanel() {
    return (
      <div style={{ display:"flex",flexDirection:"column",gap:"20px",padding:isMobile?"20px 16px":"24px 20px",overflowY:"auto",height:"100%" }}>
        <div>
          <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"10px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"10px" }}>SESSION CONTEXT</p>
          <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"8px",padding:"10px 12px",marginBottom:"8px" }}>
            <p style={{ color:"rgba(255,255,255,0.35)",fontSize:"10px",fontFamily:"'JetBrains Mono'",marginBottom:"4px" }}>PAPERS ANALYZED</p>
            <p style={{ color:"rgba(255,255,255,0.8)",fontSize:"18px",fontFamily:"'JetBrains Mono'",fontWeight:700 }}>{stats.totalPapers}</p>
          </div>
        </div>
        <div>
          <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"10px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"10px" }}>SWITCH MODE</p>
          <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
            {MODES.map(m=>(
              <button key={m.id} onClick={()=>{setSelectedMode(m.id);if(isMobile)setMobilePanel("chat");}}
                style={{ display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",background:selectedMode===m.id?`${m.color}10`:"transparent",border:`1px solid ${selectedMode===m.id?m.color+"40":"rgba(255,255,255,0.06)"}`,borderRadius:"8px",cursor:"pointer",textAlign:"left" }}>
                <span style={{ fontSize:"14px" }}>{m.emoji}</span>
                <span style={{ color:selectedMode===m.id?m.color:"rgba(255,255,255,0.45)",fontSize:"12px",fontFamily:"'DM Sans'",fontWeight:selectedMode===m.id?600:400 }}>{m.label}</span>
                {selectedMode===m.id&&<div style={{ marginLeft:"auto",width:"6px",height:"6px",borderRadius:"50%",background:m.color }}/>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ color:"rgba(255,255,255,0.25)",fontSize:"10px",fontFamily:"'JetBrains Mono'",letterSpacing:"0.1em",marginBottom:"10px" }}>QUICK QUESTIONS</p>
          <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
            {["What is the biggest weakness?","How can I narrow my hypothesis?","What should I do next?","What do papers disagree on?","Am I ready to write?"].map(q=>(
              <button key={q} onClick={()=>{setInput(q);setMobilePanel("chat");setTimeout(()=>inputRef.current?.focus(),100);}}
                style={{ padding:"8px 10px",background:"transparent",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"7px",color:"rgba(255,255,255,0.35)",fontSize:"11px",cursor:"pointer",textAlign:"left",lineHeight:1.4,transition:"all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=modeColor+"40";e.currentTarget.style.color="rgba(255,255,255,0.7)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.35)";}}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div style={{ position:"fixed",inset:0,zIndex:500,background:"#07080d",overflow:"auto",animation:"fadeSlideIn 0.4s ease both" }}>
        <div style={{ position:"sticky",top:0,zIndex:10,background:"rgba(7,8,13,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:isMobile?"0 16px":"0 40px",height:"56px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
            <button onClick={onClose} style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",color:"rgba(255,255,255,0.5)",fontSize:"12px",cursor:"pointer",fontFamily:"'JetBrains Mono'" }}>
              <ChevronRight size={12} style={{ transform:"rotate(180deg)" }}/> Back
            </button>
            {!isMobile&&<span style={{ fontFamily:"'Playfair Display',serif",fontSize:"16px",color:"rgba(255,255,255,0.9)",marginLeft:"10px" }}>AI Research Supervisor</span>}
          </div>
          <span style={{ color:"var(--gold)",fontSize:"11px",fontFamily:"'JetBrains Mono'",padding:"4px 10px",background:"rgba(240,165,0,0.1)",border:"1px solid rgba(240,165,0,0.25)",borderRadius:"6px" }}>{stats.totalPapers} papers</span>
        </div>
        <div style={{ maxWidth:"720px",margin:"0 auto",padding:isMobile?"32px 16px 40px":"60px 40px" }}>
          <div style={{ textAlign:"center",marginBottom:isMobile?"36px":"56px" }}>
            <div style={{ width:"72px",height:"72px",margin:"0 auto 20px",background:"linear-gradient(135deg,rgba(240,165,0,0.15),rgba(240,165,0,0.03))",border:"1px solid rgba(240,165,0,0.2)",borderRadius:"20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"32px" }}>👨‍🏫</div>
            <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:isMobile?"28px":"36px",fontWeight:700,color:"#fff",marginBottom:"10px" }}>Meet Your AI Supervisor</h1>
            <p style={{ color:"rgba(255,255,255,0.45)",fontSize:"14px",lineHeight:1.7,maxWidth:"420px",margin:"0 auto" }}>Get the honest, specific feedback that takes PhD students months to find.</p>
          </div>
          <div style={{ marginBottom:"36px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px" }}>
              <span style={{ width:"24px",height:"24px",background:"rgba(240,165,0,0.15)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:"var(--gold)",fontWeight:700,flexShrink:0 }}>1</span>
              <h3 style={{ color:"rgba(255,255,255,0.9)",fontSize:"14px",fontWeight:600 }}>Choose your supervisor's style</h3>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" }}>
              {MODES.map(m=>(
                <button key={m.id} onClick={()=>setSelectedMode(m.id)}
                  style={{ padding:isMobile?"14px 12px":"20px",background:selectedMode===m.id?`${m.color}10`:"rgba(255,255,255,0.03)",border:`1px solid ${selectedMode===m.id?m.color+"50":"rgba(255,255,255,0.08)"}`,borderRadius:"14px",cursor:"pointer",textAlign:"left",transition:"all 0.2s" }}>
                  <div style={{ fontSize:isMobile?"20px":"24px",marginBottom:"8px" }}>{m.emoji}</div>
                  <p style={{ color:selectedMode===m.id?m.color:"rgba(255,255,255,0.85)",fontSize:"14px",fontWeight:700,marginBottom:"3px" }}>{m.label}</p>
                  <p style={{ color:"rgba(255,255,255,0.4)",fontSize:"11px",fontFamily:"'JetBrains Mono'",lineHeight:1.4 }}>{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:"28px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px" }}>
              <span style={{ width:"24px",height:"24px",background:"rgba(240,165,0,0.15)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:"var(--gold)",fontWeight:700,flexShrink:0 }}>2</span>
              <h3 style={{ color:"rgba(255,255,255,0.9)",fontSize:"14px",fontWeight:600 }}>Your research question <span style={{ color:"rgba(255,255,255,0.3)",fontWeight:400 }}>(optional)</span></h3>
            </div>
            <textarea value={researchQuestion} onChange={e=>setResearchQuestion(e.target.value)} placeholder="e.g. How does RAG improve factual accuracy in LLMs?" style={{ width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",color:"rgba(255,255,255,0.85)",fontSize:"14px",outline:"none",resize:"none",lineHeight:1.7,minHeight:"88px",boxSizing:"border-box",transition:"border 0.2s" }} onFocus={e=>e.target.style.borderColor="rgba(240,165,0,0.4)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}/>
          </div>
          <div style={{ marginBottom:"36px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px" }}>
              <span style={{ width:"24px",height:"24px",background:"rgba(240,165,0,0.15)",border:"1px solid rgba(240,165,0,0.3)",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:"var(--gold)",fontWeight:700,flexShrink:0 }}>3</span>
              <h3 style={{ color:"rgba(255,255,255,0.9)",fontSize:"14px",fontWeight:600 }}>Upload your draft <span style={{ color:"rgba(255,255,255,0.3)",fontWeight:400 }}>(optional)</span></h3>
            </div>
            {!draftFile ? (
              <div onClick={()=>fileInputRef.current?.click()} style={{ border:"2px dashed rgba(255,255,255,0.1)",borderRadius:"12px",padding:isMobile?"24px 16px":"32px",textAlign:"center",cursor:"pointer",transition:"all 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(240,165,0,0.35)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";}}>
                <Upload size={22} color="rgba(255,255,255,0.25)" style={{ margin:"0 auto 8px",display:"block" }}/>
                <p style={{ color:"rgba(255,255,255,0.5)",fontSize:"13px" }}>Drop thesis draft or paper PDF here</p>
                <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>{if(e.target.files[0])handleDraftUpload(e.target.files[0]);}}/>
              </div>
            ) : (
              <div style={{ display:"flex",alignItems:"center",gap:"12px",padding:"14px 16px",background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:"12px" }}>
                {uploadingDraft?<Loader2 size={18} color="#4ade80" style={{ animation:"spin 1s linear infinite" }}/>:<CheckCircle2 size={18} color="#4ade80"/>}
                <div style={{ flex:1,minWidth:0 }}>
                  <p style={{ color:"#4ade80",fontSize:"13px",fontWeight:600 }}>{uploadingDraft?"Indexing...":"Draft ready"}</p>
                  <p style={{ color:"rgba(255,255,255,0.4)",fontSize:"11px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{draftFile.name}</p>
                </div>
                <button onClick={()=>setDraftFile(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)" }}><X size={14}/></button>
              </div>
            )}
          </div>
          <button onClick={startSession} disabled={!selectedMode||uploadingDraft} style={{ width:"100%",padding:"16px",background:!selectedMode?"rgba(255,255,255,0.05)":"linear-gradient(135deg,var(--gold),#ffcc55)",border:"none",borderRadius:"14px",color:!selectedMode?"rgba(255,255,255,0.2)":"#0a0b0f",fontWeight:700,fontSize:"15px",cursor:!selectedMode?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",transition:"all 0.3s" }}>
            {selectedMode?<><span style={{ fontSize:"18px" }}>{mode?.emoji}</span>Start Session with {mode?.label} Supervisor</>:"Select a supervisor style to begin"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"#07080d",display:"flex",flexDirection:"column",animation:"fadeSlideIn 0.3s ease both" }}>
      <div style={{ flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(7,8,13,0.95)",backdropFilter:"blur(20px)",padding:isMobile?"0 12px":"0 32px",height:isMobile?"52px":"60px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px",minWidth:0,flex:1 }}>
          <button onClick={onClose} style={{ display:"flex",alignItems:"center",gap:"4px",padding:"5px 8px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"7px",color:"rgba(255,255,255,0.4)",fontSize:"11px",cursor:"pointer",fontFamily:"'JetBrains Mono'",flexShrink:0 }}>
            <ChevronRight size={11} style={{ transform:"rotate(180deg)" }}/>{isMobile?"":"Exit"}
          </button>
          <div style={{ display:"flex",alignItems:"center",gap:"7px",minWidth:0,overflow:"hidden" }}>
            <span style={{ fontSize:isMobile?"16px":"18px",flexShrink:0 }}>{mode?.emoji}</span>
            <div style={{ minWidth:0,overflow:"hidden" }}>
              <p style={{ color:"rgba(255,255,255,0.85)",fontSize:isMobile?"12px":"13px",fontWeight:600,lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>AI Research Supervisor</p>
              <p style={{ color:modeColor,fontSize:"10px",fontFamily:"'JetBrains Mono'",opacity:0.8,marginTop:"2px" }}>{mode?.label} Mode</p>
            </div>
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"6px",flexShrink:0 }}>
          <button onClick={()=>{const text=messages.map(m=>`${m.role==="supervisor"?"SUPERVISOR":"YOU"}:\n${m.content}`).join("\n\n---\n\n");navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
            style={{ display:"flex",alignItems:"center",gap:"4px",padding:"5px 8px",background:copied?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.04)",border:`1px solid ${copied?"rgba(74,222,128,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:"7px",color:copied?"#4ade80":"rgba(255,255,255,0.4)",fontSize:"11px",cursor:"pointer" }}>
            {copied?<Check size={10}/>:<Copy size={10}/>}{!isMobile&&(copied?" Copied":" Copy")}
          </button>
          <button onClick={()=>{setPhase("setup");setMessages([]);}} style={{ padding:"5px 8px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"7px",color:"rgba(255,255,255,0.35)",fontSize:"11px",cursor:"pointer",whiteSpace:"nowrap" }}>
            {isMobile?"New":"New Session"}
          </button>
        </div>
      </div>
      {isMobile && (
        <div style={{ flexShrink:0,display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(7,8,13,0.9)" }}>
          {["chat","context"].map(panel=>(
            <button key={panel} onClick={()=>setMobilePanel(panel)} style={{ flex:1,padding:"12px",background:"transparent",border:"none",borderBottom:`2px solid ${mobilePanel===panel?modeColor:"transparent"}`,color:mobilePanel===panel?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.3)",fontSize:"13px",fontWeight:mobilePanel===panel?600:400,cursor:"pointer" }}>
              {panel==="chat"?"💬 Chat":"⚙️ Context"}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex:1,display:"flex",overflow:"hidden" }}>
        {(!isMobile||mobilePanel==="context") && (
          <div style={{ width:isMobile?"100%":"260px",flexShrink:0,borderRight:isMobile?"none":"1px solid rgba(255,255,255,0.05)",overflowY:"auto" }}>
            <ContextPanel/>
          </div>
        )}
        {(!isMobile||mobilePanel==="chat") && (
          <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 }}>
            <div style={{ flex:1,overflowY:"auto",padding:isMobile?"20px 14px":"32px 40px" }}>
              {messages.map((msg,i)=>{
                const isSuper=msg.role==="supervisor";
                return (
                  <div key={i} style={{ display:"flex",gap:isMobile?"10px":"14px",alignItems:"flex-start",marginBottom:isMobile?"20px":"28px",animation:"fadeSlideIn 0.3s ease both" }}>
                    {isSuper&&<div style={{ width:isMobile?"30px":"36px",height:isMobile?"30px":"36px",flexShrink:0,background:`${modeColor}15`,border:`1px solid ${modeColor}30`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?"14px":"18px" }}>{mode?.emoji}</div>}
                    <div style={{ flex:1,minWidth:0,maxWidth:isSuper?"100%":isMobile?"85%":"75%",marginLeft:isSuper?0:"auto" }}>
                      {isSuper&&<p style={{ color:modeColor,fontSize:"10px",fontFamily:"'JetBrains Mono'",marginBottom:"6px",opacity:0.8 }}>{mode?.label} Supervisor</p>}
                      <div style={{ background:isSuper?"rgba(255,255,255,0.03)":`${modeColor}12`,border:`1px solid ${isSuper?"rgba(255,255,255,0.07)":modeColor+"30"}`,borderRadius:isSuper?"4px 14px 14px 14px":"14px 4px 14px 14px",padding:isMobile?"12px 14px":"18px 22px" }}>
                        {msg.loading ? (
                          <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                            <Loader2 size={13} color={modeColor} style={{ animation:"spin 1s linear infinite",flexShrink:0 }}/>
                            <span style={{ color:"rgba(255,255,255,0.4)",fontSize:"13px",fontFamily:"'JetBrains Mono'" }}>Analyzing your research...</span>
                          </div>
                        ) : (
                          <p style={{ color:isSuper?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.9)",fontSize:isMobile?"13px":"14px",lineHeight:isMobile?"1.7":"1.9",whiteSpace:"pre-wrap",wordBreak:"break-word",overflowWrap:"break-word" }}>{msg.content}</p>
                        )}
                      </div>
                      {!isSuper&&<p style={{ color:"rgba(255,255,255,0.2)",fontSize:"10px",textAlign:"right",marginTop:"4px",fontFamily:"'JetBrains Mono'" }}>You</p>}
                    </div>
                    {!isSuper&&<div style={{ width:isMobile?"28px":"36px",height:isMobile?"28px":"36px",flexShrink:0,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center" }}><User size={isMobile?13:16} color="rgba(255,255,255,0.5)"/></div>}
                  </div>
                );
              })}
              <div ref={chatEndRef}/>
            </div>
            <div style={{ flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.06)",padding:isMobile?"12px 12px 16px":"20px 40px",background:"rgba(7,8,13,0.8)" }}>
              <div style={{ display:"flex",gap:"8px",alignItems:"flex-end" }}>
                <textarea ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height=isMobile?"42px":"48px";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}} placeholder={isThinking?"Supervisor is thinking...":"Ask your supervisor..."} disabled={isThinking} rows={1}
                  style={{ flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${isThinking?"rgba(255,255,255,0.05)":modeColor+"30"}`,borderRadius:"12px",padding:isMobile?"11px 14px":"14px 18px",color:"rgba(255,255,255,0.85)",fontSize:"14px",outline:"none",resize:"none",minHeight:isMobile?"42px":"48px",maxHeight:"120px",lineHeight:1.6,wordBreak:"break-word" }}
                  onFocus={e=>e.target.style.borderColor=modeColor+"60"} onBlur={e=>e.target.style.borderColor=modeColor+"30"}/>
                <button onClick={handleSend} disabled={!input.trim()||isThinking} style={{ width:isMobile?"42px":"48px",height:isMobile?"42px":"48px",flexShrink:0,background:(!input.trim()||isThinking)?"rgba(255,255,255,0.04)":`linear-gradient(135deg,${modeColor},${modeColor}cc)`,border:"none",borderRadius:"12px",cursor:(!input.trim()||isThinking)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s" }}>
                  {isThinking?<Loader2 size={15} color="rgba(255,255,255,0.3)" style={{ animation:"spin 1s linear infinite" }}/>:<Send size={15} color={!input.trim()?"rgba(255,255,255,0.2)":"#0a0b0f"}/>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}