import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { fetchPapers } from "./src/ingestion/arxivFetcher.js";
import { fetchFromSemanticScholar } from "./src/ingestion/semanticScholarFetcher.js";
import { fetchFromPubMed } from "./src/ingestion/pubmedFetcher.js";
import { fetchFromChemRxiv } from "./src/ingestion/chemrxivFetcher.js";
import { downloadAndParsePDF } from "./src/ingestion/pdfParser.js";
import { chunkPaper } from "./src/ingestion/chunker.js";
import { embedChunks } from "./src/embeddings/embedder.js";
import { storeChunks, getCollectionStats, clearCollection } from "./src/database/vectorStore.js";
import { retrieveRelevantChunks } from "./src/retrieval/retriever.js";
import { generateAnswer } from "./src/generation/answerGenerator.js";
import Groq from "groq-sdk";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: [
   "http://localhost:5173",
    "http://localhost:3000",
    "https://researchminds.vercel.app",
  ],
  methods: ["GET", "POST", "DELETE"],
}));
app.use(express.json());

const uploadDir = path.join(__dirname, "pdfs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `upload_${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

async function fetchBySource(query, maxResults, source) {
  switch (source) {
    case "arxiv":    return await fetchPapers(query, maxResults);
    case "semantic": return await fetchFromSemanticScholar(query, maxResults);
    case "pubmed":   return await fetchFromPubMed(query, maxResults);
    case "chemrxiv": return await fetchFromChemRxiv(query, maxResults);
    default:         return await fetchPapers(query, maxResults);
  }
}

// Helper to load all indexed papers from vectorStore
function loadIndexedPapers() {
  try {
    const DB_PATH = new URL("./data/vectorStore.json", import.meta.url);
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const db  = JSON.parse(raw);
    const paperMap = new Map();
    (db.chunks || []).forEach(chunk => {
      const id = chunk.metadata?.paperId;
      if (id && !paperMap.has(id)) {
        paperMap.set(id, {
          id,
          title:     chunk.metadata.title     || "Untitled",
          authors:   chunk.metadata.authors   || [],
          published: chunk.metadata.published || "Unknown",
          abstract:  chunk.metadata.abstract  || "",
          source:    chunk.metadata.source    || "unknown",
          pdfUrl:    chunk.metadata.pdfUrl    || null,
        });
      }
    });
    return Array.from(paperMap.values());
  } catch { return []; }
}

// ROUTE 1: Ingest with SSE
app.get("/api/ingest-progress", async (req, res) => {
  const { query, maxResults = 5, source = "arxiv" } = req.query;
  if (!query) { res.status(400).json({ error: "Query is required" }); return; }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  function send(data) { res.write(`data: ${JSON.stringify(data)}\n\n`); }

  try {
    send({ type: "step", message: `Searching ${source} for "${query}"...`, progress: 5 });
    const papers = await fetchBySource(query, Number(maxResults), source);

    if (papers.length === 0) {
      send({ type: "error", message: "No papers found. Try a different search term." });
      res.end(); return;
    }

    send({ type: "step", message: `Found ${papers.length} papers. Starting ingestion...`, progress: 15 });

    const processedPapers = [];
    const progressPerPaper = 70 / papers.length;
    let currentProgress = 15;

    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      const shortTitle = paper.title?.length > 45 ? paper.title.slice(0, 45) + "..." : paper.title;
      try {
        send({ type: "paper", message: `📄 (${i+1}/${papers.length}) Downloading: ${shortTitle}`, progress: Math.round(currentProgress), stage: "download" });
        const parsed = await downloadAndParsePDF(paper);

        send({ type: "paper", message: `✂️  (${i+1}/${papers.length}) Chunking: ${shortTitle}`, progress: Math.round(currentProgress + progressPerPaper * 0.3), stage: "chunk" });
        const chunks = chunkPaper(parsed);
        if (chunks.length === 0) throw new Error("No usable content");

        send({ type: "paper", message: `🧠 (${i+1}/${papers.length}) Embedding: ${shortTitle}`, progress: Math.round(currentProgress + progressPerPaper * 0.6), stage: "embed" });
        const embedded = await embedChunks(chunks);
        await storeChunks(embedded);

        processedPapers.push({
          id: paper.id, title: paper.title, authors: paper.authors,
          published: paper.published, abstract: paper.abstract,
          pdfUrl: paper.pdfUrl, source: paper.source || source,
        });

        currentProgress += progressPerPaper;
        send({ type: "paper_done", message: `✅ (${i+1}/${papers.length}) Indexed: ${shortTitle}`, progress: Math.round(currentProgress) });
      } catch (err) {
        send({ type: "paper_skip", message: `⚠️  (${i+1}/${papers.length}) Skipped: ${shortTitle}`, progress: Math.round(currentProgress) });
        currentProgress += progressPerPaper;
      }
    }

    if (processedPapers.length === 0) {
      send({ type: "error", message: "Could not process any papers. Please try again." });
      res.end(); return;
    }

    const stats = await getCollectionStats();
    send({ type: "done", message: `🎉 Successfully indexed ${processedPapers.length} of ${papers.length} papers!`, progress: 100, papers: processedPapers, stats });
  } catch (error) {
    send({ type: "error", message: error.message });
  }
  res.end();
});

// ROUTE 2: Upload PDF
app.post("/api/upload-pdf", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });
  const filepath = req.file.path;
  const originalName = req.file.originalname.replace(".pdf", "").replace(/_/g, " ");
  try {
    const paper = {
      id: `upload_${Date.now()}`, title: req.body.title || originalName || "Uploaded Paper",
      authors: req.body.authors ? [req.body.authors] : ["Unknown Author"],
      abstract: req.body.abstract || "Uploaded PDF document",
      published: new Date().getFullYear().toString(), pdfUrl: "no-pdf", source: "upload", filepath, fullText: null,
    };
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(fs.readFileSync(filepath));
    const cleanText = pdfData.text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();
    if (cleanText.length < 100) return res.status(422).json({ error: "Could not extract text from this PDF." });
    paper.fullText = cleanText;

    if (!req.body.abstract) {
      const first2000 = cleanText.slice(0, 2000);
      const abstractMatch = first2000.match(/abstract[:\s]+([^]+?)(?=introduction|keywords|1\s*\.|background|©|\n\n\n)/i);
      if (abstractMatch && abstractMatch[1]?.trim().length > 50) {
        paper.abstract = abstractMatch[1].replace(/\s+/g, " ").trim().slice(0, 600);
      } else {
        paper.abstract = cleanText.replace(/\s+/g, " ").trim().slice(150, 550);
      }
    }
    const chunks = chunkPaper(paper);
    if (chunks.length === 0) return res.status(422).json({ error: "PDF had no usable text content." });
    const embedded = await embedChunks(chunks);
    await storeChunks(embedded);
    const stats = await getCollectionStats();
    res.json({ success: true, paper: { id: paper.id, title: paper.title, authors: paper.authors, published: paper.published, abstract: paper.abstract, pdfUrl: "no-pdf", source: "upload" }, chunks: chunks.length, stats });
  } catch (error) {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    res.status(500).json({ error: error.message });
  }
});

// ROUTE 3: Ask
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });
    const relevantChunks = await retrieveRelevantChunks(question, 3);
    if (relevantChunks.length === 0) return res.status(404).json({ error: "No relevant papers found. Please ingest papers first." });
    const { answer, citations, confidence } = await generateAnswer(question, relevantChunks);
    res.json({ success: true, answer, citations, confidence });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ROUTE 4: Stats
app.get("/api/stats", async (req, res) => {
  try { res.json(await getCollectionStats()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// ROUTE 5: Clear
app.delete("/api/clear", async (req, res) => {
  try { await clearCollection(); res.json({ success: true }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// ROUTE 6: Paper Battle
app.post("/api/battle", async (req, res) => {
  try {
    const { paper1, paper2 } = req.body;
    if (!paper1 || !paper2) return res.status(400).json({ error: "Both paper1 and paper2 are required" });

    const prompt = `You are an expert academic analyst. Compare these two research papers in a structured debate.

PAPER 1: ${paper1.title}
Authors: ${Array.isArray(paper1.authors) ? paper1.authors.join(", ") : paper1.authors}
Published: ${paper1.published}
Abstract: ${paper1.abstract}

PAPER 2: ${paper2.title}
Authors: ${Array.isArray(paper2.authors) ? paper2.authors.join(", ") : paper2.authors}
Published: ${paper2.published}
Abstract: ${paper2.abstract}

Respond ONLY with valid JSON, no extra text, no markdown fences:
{
  "topic": "The core topic both papers address in 5-8 words",
  "paper1_stance": "Paper 1 main argument or contribution (2-3 sentences)",
  "paper2_stance": "Paper 2 main argument or contribution (2-3 sentences)",
  "methodology": {
    "paper1": "Paper 1 methodology in 1-2 sentences",
    "paper2": "Paper 2 methodology in 1-2 sentences",
    "winner": "1 or 2 or tie",
    "reason": "Why one is stronger or why it's a tie (1 sentence)"
  },
  "novelty": {
    "paper1": "Paper 1 novel contribution in 1 sentence",
    "paper2": "Paper 2 novel contribution in 1 sentence",
    "winner": "1 or 2 or tie",
    "reason": "Which is more novel and why (1 sentence)"
  },
  "impact": {
    "paper1": "Paper 1 real-world impact in 1 sentence",
    "paper2": "Paper 2 real-world impact in 1 sentence",
    "winner": "1 or 2 or tie",
    "reason": "Which has broader impact and why (1 sentence)"
  },
  "agreements": ["Point both papers agree on #1", "Point both papers agree on #2"],
  "key_difference": "The single most important difference in one sentence",
  "verdict": {
    "winner": "1 or 2 or tie",
    "summary": "2-3 sentence final verdict explaining which paper wins overall and why, or why it's a tie"
  }
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const raw = response.choices[0].message.content;
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const battle = JSON.parse(clean);
    res.json({ success: true, battle });

  } catch (error) {
    res.status(500).json({ error: "Battle failed: " + error.message });
  }
});

// ROUTE 7: Literature Review
app.post("/api/literature-review", async (req, res) => {
  try {
    const { wordCount = 1000, style = "thesis", sections = [] } = req.body;
    const DB_PATH = new URL("./src/database/../../data/vectorStore.json", import.meta.url);
    const raw  = fs.readFileSync(DB_PATH, "utf-8");
    const db   = JSON.parse(raw);

    if (!db.chunks || db.chunks.length === 0) {
      return res.status(404).json({ error: "No papers indexed yet." });
    }

    const paperMap = new Map();
    db.chunks.forEach(chunk => {
      const id = chunk.metadata?.paperId;
      if (id && !paperMap.has(id)) {
        paperMap.set(id, {
          id, title: chunk.metadata.title || "Untitled",
          authors: chunk.metadata.authors || "Unknown",
          published: chunk.metadata.published || "Unknown",
          abstract: chunk.metadata.abstract || "",
        });
      }
    });

    const papers = Array.from(paperMap.values());
    if (papers.length < 2) return res.status(400).json({ error: "Please index at least 2 papers." });

    const styleGuide = { thesis: "formal academic thesis style, third person", journal: "concise journal article style", summary: "clear accessible summary style" }[style] || "formal academic style";

    const activeSections = sections.length > 0 ? sections : ["introduction","theoretical_background","methodology_comparison","key_findings","agreements","contradictions","research_gaps","conclusion","references"];
    const sectionInstructions = {
      introduction: "1. INTRODUCTION\nOverview of the research area.",
      theoretical_background: "2. THEORETICAL BACKGROUND\nKey concepts and foundational theories.",
      methodology_comparison: "3. METHODOLOGY COMPARISON\nMarkdown table: Paper | Approach | Key Technique | Results.",
      key_findings: "4. KEY FINDINGS\nMost important findings collectively.",
      agreements: "5. AGREEMENTS IN LITERATURE\nWhere papers align.",
      contradictions: "6. CONTRADICTIONS & DEBATES\nWhere papers disagree.",
      research_gaps: "7. RESEARCH GAPS\nWhat remains unstudied.",
      conclusion: "8. CONCLUSION\nSynthesis and future directions.",
      references: "9. REFERENCES\nAll papers in APA format.",
    };

    const papersContext = papers.map((p, i) => `[${i+1}] Title: ${p.title}\n    Authors: ${Array.isArray(p.authors) ? p.authors.join(", ") : p.authors}\n    Year: ${p.published}\n    Abstract: ${p.abstract?.slice(0, 400) || "N/A"}`).join("\n\n");
    const selectedSections = activeSections.map(s => sectionInstructions[s]).filter(Boolean).join("\n\n");

    const prompt = `You are an expert academic writer. Write a comprehensive literature review in ${styleGuide}. Target: ~${wordCount} words.\n\nPAPERS:\n${papersContext}\n\nSections:\n${selectedSections}\n\nRules: cite as (Author, Year), use markdown table for methodology, flowing prose. Start directly.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4, max_tokens: 4000,
    });

    const review = response.choices[0].message.content;
    res.json({ success: true, review, paperCount: papers.length, wordCount: review.split(" ").length, papers: papers.map(p => ({ title: p.title, authors: p.authors, published: p.published })) });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate: " + error.message });
  }
});

// ─── DIGEST HELPERS ───
import { Resend } from "resend";
import cron from "node-cron";

const resend = new Resend(process.env.RESEND_API_KEY);
const SUBSCRIBERS_PATH = new URL("./data/subscribers.json", import.meta.url);

function loadSubscribers() {
  try {
    if (!fs.existsSync(SUBSCRIBERS_PATH)) return { subscribers: [] };
    return JSON.parse(fs.readFileSync(SUBSCRIBERS_PATH, "utf-8"));
  } catch { return { subscribers: [] }; }
}

function saveSubscribers(data) {
  const dir = new URL("./data/", import.meta.url);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(data, null, 2));
}

function buildEmailHTML(name, topic, papers) {
  const paperRows = papers.map((p, i) => `
    <div style="margin-bottom:32px;padding:24px;background:#0f1117;border-radius:12px;border:1px solid #1e2030;">
      <div style="margin-bottom:4px;"><span style="background:#f0a500;color:#0a0b0f;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">#${i+1}</span><span style="color:#6b7280;font-size:11px;margin-left:8px;">${p.source?.toUpperCase() || "ARXIV"} · ${p.published || ""}</span></div>
      <h3 style="color:#f0f0f0;font-size:15px;margin:8px 0;">${p.title}</h3>
      <p style="color:#9ca3af;font-size:12px;margin-bottom:12px;">${Array.isArray(p.authors) ? p.authors.slice(0,3).join(", ") : p.authors}</p>
      <div style="background:#161b27;border-left:3px solid #f0a500;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;">
        <p style="color:#d1d5db;font-size:13px;line-height:1.7;margin:0;">${p.summary || p.abstract?.slice(0, 300) || ""}...</p>
      </div>
      ${p.pdfUrl && p.pdfUrl !== "no-pdf" ? `<a href="${p.pdfUrl}" style="color:#f0a500;font-size:12px;text-decoration:none;border:1px solid rgba(240,165,0,0.3);padding:6px 14px;border-radius:6px;">Read Paper →</a>` : ""}
    </div>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0b0f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:32px;"><div style="display:inline-block;background:#111318;border:1px solid #1e2030;border-radius:12px;padding:12px 20px;"><span style="color:#f0a500;font-size:18px;font-weight:700;">🧠 ResearchMind</span></div></div>
    <div style="background:linear-gradient(135deg,rgba(240,165,0,0.1),rgba(240,165,0,0.02));border:1px solid rgba(240,165,0,0.2);border-radius:16px;padding:28px;text-align:center;margin-bottom:32px;">
      <h1 style="color:#f0f0f0;font-size:22px;margin:0 0 8px;">Hey ${name} 👋</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0;">5 most important papers this week on <strong style="color:#f0f0f0;">${topic}</strong></p>
    </div>
    ${paperRows}
    <div style="text-align:center;margin:32px 0;"><a href="https://researchminds.vercel.app" style="background:linear-gradient(135deg,#f0a500,#d4920a);color:#0a0b0f;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;">Open ResearchMind →</a></div>
    <p style="color:#4b5563;font-size:11px;text-align:center;">researchminds.vercel.app</p>
  </div></body></html>`;
}

async function generateDigestForSubscriber(subscriber) {
  try {
    const papers = await fetchPapers(subscriber.topic, 5);
    if (!papers || papers.length === 0) return;
    const papersWithSummary = await Promise.all(papers.map(async (p) => {
      try {
        const response = await groq.chat.completions.create({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: `Summarize in 2-3 sentences:\nTitle: ${p.title}\nAbstract: ${p.abstract}` }], max_tokens: 150, temperature: 0.3 });
        return { ...p, summary: response.choices[0].message.content };
      } catch { return { ...p, summary: p.abstract?.slice(0, 200) }; }
    }));
    await resend.emails.send({ from: "ResearchMind Digest <onboarding@resend.dev>", to: subscriber.email, subject: `📚 Your Weekly Digest — ${subscriber.topic}`, html: buildEmailHTML(subscriber.name, subscriber.topic, papersWithSummary) });
    const db = loadSubscribers();
    const idx = db.subscribers.findIndex(s => s.id === subscriber.id);
    if (idx >= 0) { db.subscribers[idx].lastSentAt = new Date().toISOString(); saveSubscribers(db); }
  } catch (err) { console.error(`Failed to send to ${subscriber.email}:`, err.message); }
}

cron.schedule("0 8 * * 1", () => { generateDigestForSubscriber; });

// ─── ROUTE 11: Supervisor Analyze ───
app.post("/api/supervisor/analyze", async (req, res) => {
  try {
    const { mode, researchQuestion, hasDraft, draftName } = req.body;
    const papers = loadIndexedPapers().slice(0, 10);

    const modePersonas = {
      supportive: "You are a warm, encouraging academic supervisor. Give honest but kind feedback.",
      strict:     "You are a rigorous, demanding professor. Give direct, unfiltered criticism.",
      focused:    "You are a methodology specialist. Focus ONLY on research design and rigor.",
      interdisciplinary: "You are a broad-thinking academic connecting research across fields.",
    };

    const contextParts = [
      `The student has indexed ${papers.length} papers:`,
      papers.map((p, i) => `[${i+1}] "${p.title}" (${p.published}): ${p.abstract?.slice(0,200)}`).join("\n"),
      researchQuestion ? `\nStudent research question: "${researchQuestion}"` : "",
      hasDraft ? `\nStudent uploaded draft: "${draftName}"` : "",
    ].filter(Boolean).join("\n");

    const prompt = `${modePersonas[mode] || modePersonas.supportive}\n\nConduct an initial supervision session.\n${contextParts}\n\nCover:\n1. RESEARCH POSITION\n2. CRITICAL WEAKNESSES\n3. GENUINE STRENGTHS\n4. TOP 3 ACTIONS\n5. SUPERVISOR QUESTIONS\n\nBe specific. Under 500 words.`;

    const response = await groq.chat.completions.create({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.6, max_tokens: 1000 });
    res.json({ success: true, analysis: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "Failed to analyze: " + error.message });
  }
});

// ─── ROUTE 11b: Supervisor Chat ───
app.post("/api/supervisor/chat", async (req, res) => {
  try {
    const { message, mode, researchQuestion, history } = req.body;
    const modePersonas = { supportive: "warm, encouraging academic supervisor", strict: "rigorous, demanding professor", focused: "methodology specialist", interdisciplinary: "broad-thinking academic" };
    const systemPrompt = `You are a ${modePersonas[mode] || modePersonas.supportive}${researchQuestion ? ` supervising research on: "${researchQuestion}"` : ""}. Be specific and under 300 words.`;
    const messages = [{ role: "system", content: systemPrompt }, ...(history || []).map(m => ({ role: m.role === "supervisor" ? "assistant" : "user", content: m.content })), { role: "user", content: message }];
    const response = await groq.chat.completions.create({ model: "llama-3.3-70b-versatile", messages, temperature: 0.65, max_tokens: 600 });
    res.json({ success: true, reply: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "Failed to respond: " + error.message });
  }
});

// ─── ROUTE 12: Research Gap Finder ───
app.post("/api/research-gaps", async (req, res) => {
  try {
    const papers = loadIndexedPapers().slice(0, 8);
    if (papers.length < 2) return res.status(400).json({ error: "Please index at least 2 papers." });

    const papersContext = papers.map((p, i) => `[${i+1}] "${p.title}" (${p.published}) — ${p.abstract?.slice(0, 150) || "N/A"}`).join("\n");

    const prompt = `Analyze these ${papers.length} research papers and find gaps. Respond ONLY with valid compact JSON on one line:

PAPERS:
${papersContext}

JSON:
{"topic":"5 word topic","summary":"one sentence","critical_gaps":[{"title":"gap title","description":"what is missing","papers_that_hint":"[1],[2]"}],"partial_gaps":[{"title":"gap title","description":"understudied area","papers_that_hint":"[1]"}],"contradictions":[{"title":"contradiction topic","paper_a":"paper 1 claims X","paper_b":"paper 2 claims Y","implication":"why it matters"}],"future_directions":[{"title":"direction title","description":"what to explore","novelty":"high"}],"universal_agreements":["agreement 1","agreement 2"],"most_promising_gap":"2 sentence recommendation"}

Max 3 items per array, valid JSON only.`;

    const response = await groq.chat.completions.create({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 3000 });
    let clean = response.choices[0].message.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonStart = clean.indexOf("{"), jsonEnd = clean.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);

    let gaps;
    try { gaps = JSON.parse(clean); }
    catch {
      let repaired = clean;
      let openArrays = (repaired.match(/\[/g)||[]).length - (repaired.match(/\]/g)||[]).length;
      for (let i = 0; i < openArrays; i++) repaired += "]";
      let openObjects = (repaired.match(/\{/g)||[]).length - (repaired.match(/\}/g)||[]).length;
      for (let i = 0; i < openObjects; i++) repaired += "}";
      repaired = repaired.replace(/,\s*([}\]])/g, "$1");
      gaps = JSON.parse(repaired);
    }

    res.json({ success: true, gaps, paperCount: papers.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to find gaps: " + error.message });
  }
});

// ─── ROUTE 13: Digest Subscribe ───
app.post("/api/digest/subscribe", async (req, res) => {
  try {
    const { name, email, topic } = req.body;
    if (!name || !email || !topic) return res.status(400).json({ error: "Name, email and topic are required." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address." });
    const db = loadSubscribers();
    const existing = db.subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      if (existing.active) return res.status(409).json({ error: "This email is already subscribed." });
      existing.active = true; existing.topic = topic; existing.name = name;
      saveSubscribers(db);
      return res.json({ success: true, message: "Subscription reactivated! First digest arrives next Monday." });
    }
    db.subscribers.push({ id: `sub_${Date.now()}`, name, email, topic, createdAt: new Date().toISOString(), lastSentAt: null, active: true });
    saveSubscribers(db);
    await resend.emails.send({ from: "ResearchMind Digest <onboarding@resend.dev>", to: email, subject: "📚 You're subscribed to ResearchMind Weekly Digest!", html: `<div style="font-family:sans-serif;background:#0a0b0f;padding:40px;color:#f0f0f0;"><h1>You're in, ${name}! 📬</h1><p>Every Monday: 5 top papers on <strong style="color:#f0a500;">${topic}</strong></p><a href="https://researchminds.vercel.app" style="color:#f0a500;">Open ResearchMind →</a></div>` });
    res.json({ success: true, message: "Subscribed! Check your email for confirmation. First digest next Monday." });
  } catch (error) {
    res.status(500).json({ error: "Subscription failed: " + error.message });
  }
});

app.get("/api/digest/unsubscribe", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required." });
    const db = loadSubscribers();
    const sub = db.subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (!sub) return res.status(404).json({ error: "Email not found." });
    sub.active = false; saveSubscribers(db);
    res.send(`<div style="font-family:sans-serif;text-align:center;padding:80px;background:#0a0b0f;color:#f0f0f0;"><h2>Unsubscribed 👋</h2><p style="color:#9ca3af;">Removed from ResearchMind Weekly Digest.</p><a href="https://researchminds.vercel.app" style="color:#f0a500;">← Back</a></div>`);
  } catch { res.status(500).send("Unsubscribe failed."); }
});

app.post("/api/digest/test", async (req, res) => {
  try {
    const { email, name, topic } = req.body;
    if (!email || !topic) return res.status(400).json({ error: "Email and topic required." });
    await generateDigestForSubscriber({ id: "test", email, name: name || "Researcher", topic, active: true });
    res.json({ success: true, message: `Test digest sent to ${email}` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ═══════════════════════════════════════════════════════════
// ─── ROUTE 14: 🐇 Research Rabbit Hole — Build Graph ───
// ═══════════════════════════════════════════════════════════
app.post("/api/rabbit-hole", async (req, res) => {
  try {
    const { seedPaperId } = req.body;
    if (!seedPaperId) return res.status(400).json({ error: "seedPaperId is required" });

    const allPapers = loadIndexedPapers();
    if (allPapers.length === 0) return res.status(404).json({ error: "No papers indexed yet." });

    const seedPaper = allPapers.find(p => p.id === seedPaperId);
    if (!seedPaper) return res.status(404).json({ error: "Seed paper not found." });

    const otherPapers = allPapers.filter(p => p.id !== seedPaperId).slice(0, 12);

    console.log(`\n🐇 Building rabbit hole for: "${seedPaper.title?.slice(0,50)}..."`);
    console.log(`   Analyzing ${otherPapers.length} other papers...`);

    const othersContext = otherPapers.map((p, i) =>
      `[${i+1}] id:"${p.id}" title:"${p.title}" year:${p.published} abstract:"${p.abstract?.slice(0,200) || "N/A"}"`
    ).join("\n");

    const prompt = `You are a strict academic graph classifier. Your job is to map precise relationships between research papers.

SEED PAPER:
id: "${seedPaper.id}"
title: "${seedPaper.title}"
year: ${seedPaper.published}
abstract: "${seedPaper.abstract?.slice(0, 400) || "N/A"}"

OTHER PAPERS TO CLASSIFY:
${othersContext}

CLASSIFICATION RULES — read carefully before assigning:

"builds_on" → Use this when the paper DIRECTLY extends, improves, or is built upon the seed's specific technique, model, or finding. Must be a clear technical dependency or progression. Example: a paper that fine-tunes the same base model, or proposes an improvement to the exact method used.

"contradicts" → Use this when the paper reports OPPOSING results, challenges the seed's core claims, proposes a competing approach that invalidates the seed's approach, or finds the seed's method fails in certain conditions. Do NOT be shy — if there is any methodological disagreement, mark it contradicts.

"same_method" → Use this when the paper uses the EXACT same technique, benchmark, dataset, or experimental framework as the seed, even if applied to a different problem. Example: both use RLHF, both evaluate on MMLU, both use LoRA fine-tuning.

"related" → LAST RESORT ONLY. Use this only when none of the above apply but the papers share a broad research domain. If you can argue for any other type, use that instead.

IMPORTANT: You MUST use a diverse mix. If you have 10+ papers, you should have at least 2-3 contradicts, 2-3 same_method, 3-4 builds_on, and minimal related. Do NOT default everything to "related" — that is a lazy classification.

Respond ONLY with valid JSON, no markdown:
{
  "seed": {
    "id": "${seedPaper.id}",
    "title": "${seedPaper.title}",
    "year": "${seedPaper.published}",
    "abstract": "${seedPaper.abstract?.slice(0,200).replace(/"/g,"'") || ""}",
    "keyThemes": ["theme1", "theme2", "theme3"]
  },
  "connections": [
    {
      "id": "exact_paper_id_from_input",
      "title": "exact paper title from input",
      "year": "year",
      "abstract": "short abstract under 150 chars",
      "relationship": "builds_on|contradicts|same_method|related",
      "reason": "One specific sentence citing exactly what makes this relationship — name the technique, finding, or result",
      "strength": "strong|medium|weak"
    }
  ],
  "graphInsight": "One sentence describing the intellectual landscape around this seed paper"
}

Include ALL ${otherPapers.length} papers. Use the EXACT id values from the input. Every paper must have an entry.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 3000,
    });

    let raw = response.choices[0].message.content;
    let clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonStart = clean.indexOf("{"), jsonEnd = clean.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);

    let graph;
    try {
      graph = JSON.parse(clean);
    } catch {
      // Repair truncated JSON
      let repaired = clean;
      repaired = repaired.replace(/,\s*$/, "");
      // Close any open string
      const quoteCount = (repaired.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) repaired += '"';
      // Close arrays and objects
      let openArrays = (repaired.match(/\[/g)||[]).length - (repaired.match(/\]/g)||[]).length;
      for (let i = 0; i < openArrays; i++) repaired += "]";
      let openObjects = (repaired.match(/\{/g)||[]).length - (repaired.match(/\}/g)||[]).length;
      for (let i = 0; i < openObjects; i++) repaired += "}";
      repaired = repaired.replace(/,\s*([}\]])/g, "$1");
      graph = JSON.parse(repaired);
    }

    // Enrich connections — always use actual paper data for title/authors/pdfUrl
    // Never trust Groq for these fields (it hallucinates IDs and titles)
    if (graph.connections) {
      graph.connections = graph.connections
        .map(conn => {
          let actual = otherPapers.find(p => p.id === conn.id);
          if (!actual) {
            actual = otherPapers.find(p =>
              p.title?.toLowerCase().trim() === conn.title?.toLowerCase().trim()
            );
          }
          if (!actual) return null;
          return {
            ...conn,
            id: actual.id,
            title: actual.title || conn.title,
            authors: actual.authors || [],
            pdfUrl: actual.pdfUrl || null,
            published: actual.published || conn.year,
          };
        })
        .filter(Boolean);
    }

    console.log(`   ✅ Graph built: ${graph.connections?.length || 0} connections mapped`);
    res.json({ success: true, graph });

  } catch (error) {
    console.error("Rabbit hole error:", error);
    res.status(500).json({ error: "Failed to build graph: " + error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ─── ROUTE 15: 🐇 Rabbit Hole — Expand Node ───
// ═══════════════════════════════════════════════════════════
app.post("/api/rabbit-hole/expand", async (req, res) => {
  try {
    const { targetPaperId, seedPaperId, alreadyMapped } = req.body;
    if (!targetPaperId) return res.status(400).json({ error: "targetPaperId is required" });

    const allPapers = loadIndexedPapers();
    const targetPaper = allPapers.find(p => p.id === targetPaperId);
    if (!targetPaper) return res.status(404).json({ error: "Target paper not found." });

    // Papers not yet mapped — exclude seed, target, and already-mapped ones
    const excludeIds = new Set([seedPaperId, targetPaperId, ...(alreadyMapped || [])]);
    const candidates = allPapers.filter(p => !excludeIds.has(p.id)).slice(0, 8);

    if (candidates.length === 0) {
      return res.json({ success: true, newConnections: [], message: "No more papers to expand." });
    }

    console.log(`\n🐇 Expanding node: "${targetPaper.title?.slice(0,40)}..." → ${candidates.length} candidates`);

    const candidatesContext = candidates.map((p, i) =>
      `[${i+1}] id:"${p.id}" title:"${p.title}" year:${p.published} abstract:"${p.abstract?.slice(0,150) || "N/A"}"`
    ).join("\n");

    const prompt = `Map relationships from this FOCUS paper to the candidates.

FOCUS PAPER:
id: "${targetPaper.id}"
title: "${targetPaper.title}"
abstract: "${targetPaper.abstract?.slice(0,300) || "N/A"}"

CANDIDATES:
${candidatesContext}

Only return papers with "strong" or "medium" relationship. Skip weak ones.
Respond ONLY with valid JSON:
{
  "newConnections": [
    {
      "sourceId": "${targetPaper.id}",
      "id": "candidate_paper_id",
      "title": "paper title",
      "year": "year",
      "abstract": "under 120 chars",
      "relationship": "builds_on|contradicts|same_method|related",
      "reason": "One sentence why",
      "strength": "strong|medium"
    }
  ]
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    });

    let raw = response.choices[0].message.content;
    let clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonStart = clean.indexOf("{"), jsonEnd = clean.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);

    let result;
    try { result = JSON.parse(clean); }
    catch {
      let repaired = clean;
      let openArrays = (repaired.match(/\[/g)||[]).length - (repaired.match(/\]/g)||[]).length;
      for (let i = 0; i < openArrays; i++) repaired += "]";
      let openObjects = (repaired.match(/\{/g)||[]).length - (repaired.match(/\}/g)||[]).length;
      for (let i = 0; i < openObjects; i++) repaired += "}";
      repaired = repaired.replace(/,\s*([}\]])/g, "$1");
      result = JSON.parse(repaired);
    }

    // Enrich with real paper data — fix IDs and titles Groq may have corrupted
    if (result.newConnections) {
      result.newConnections = result.newConnections
        .map(conn => {
          let actual = candidates.find(p => p.id === conn.id);
          if (!actual) {
            actual = candidates.find(p =>
              p.title?.toLowerCase().trim() === conn.title?.toLowerCase().trim()
            );
          }
          if (!actual) return null;
          return {
            ...conn,
            id: actual.id,
            title: actual.title || conn.title,
            authors: actual.authors || [],
            pdfUrl: actual.pdfUrl || null,
            published: actual.published || conn.year,
          };
        })
        .filter(Boolean);
    }

    console.log(`   ✅ Expand complete: ${result.newConnections?.length || 0} new connections`);
    res.json({ success: true, newConnections: result.newConnections || [] });

  } catch (error) {
    console.error("Expand error:", error);
    res.status(500).json({ error: "Failed to expand: " + error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
});