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

// ROUTE 6: ⚔️ Paper vs Paper Battle
app.post("/api/battle", async (req, res) => {
  try {
    const { paper1, paper2 } = req.body;
    if (!paper1 || !paper2) return res.status(400).json({ error: "Both paper1 and paper2 are required" });

    console.log(`\n⚔️  Battle: "${paper1.title?.slice(0,40)}" vs "${paper2.title?.slice(0,40)}"`);

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

    console.log(`   ✅ Battle complete! Winner: Paper ${battle.verdict?.winner}`);
    res.json({ success: true, battle });

  } catch (error) {
    console.error("Battle error:", error);
    res.status(500).json({ error: "Battle failed: " + error.message });
  }
});

// ─── ROUTE 7: 📚 Literature Review Generator ───
app.post("/api/literature-review", async (req, res) => {
  try {
    const { wordCount = 1000, style = "thesis", sections = [] } = req.body;

    // Pull all unique papers from the vector store
    const DB_PATH = new URL("./src/database/../../data/vectorStore.json", import.meta.url);
    const raw  = fs.readFileSync(DB_PATH, "utf-8");
    const db   = JSON.parse(raw);

    if (!db.chunks || db.chunks.length === 0) {
      return res.status(404).json({ error: "No papers indexed yet. Please ingest papers first." });
    }

    // Deduplicate papers by paperId
    const paperMap = new Map();
    db.chunks.forEach(chunk => {
      const id = chunk.metadata?.paperId;
      if (id && !paperMap.has(id)) {
        paperMap.set(id, {
          id,
          title:     chunk.metadata.title     || "Untitled",
          authors:   chunk.metadata.authors   || "Unknown",
          published: chunk.metadata.published || "Unknown",
          abstract:  chunk.metadata.abstract  || "",
          source:    chunk.metadata.source    || "unknown",
        });
      }
    });

    const papers = Array.from(paperMap.values());

    if (papers.length < 2) {
      return res.status(400).json({ error: "Please index at least 2 papers to generate a literature review." });
    }

    console.log(`\n📚 Generating literature review for ${papers.length} papers...`);
    console.log(`   Style: ${style} | Words: ${wordCount} | Sections: ${sections.length}`);

    const styleGuide = {
      thesis:  "formal academic thesis style, third person, passive voice where appropriate",
      journal: "concise journal article style, direct and precise",
      summary: "clear accessible summary style, readable by non-experts",
    }[style] || "formal academic style";

    const activeSections = sections.length > 0 ? sections : [
      "introduction",
      "theoretical_background",
      "methodology_comparison",
      "key_findings",
      "agreements",
      "contradictions",
      "research_gaps",
      "conclusion",
      "references",
    ];

    const sectionInstructions = {
      introduction:            "1. INTRODUCTION\nOverview of the research area, significance, and scope of this review.",
      theoretical_background:  "2. THEORETICAL BACKGROUND\nKey concepts, definitions, and foundational theories across the papers.",
      methodology_comparison:  "3. METHODOLOGY COMPARISON\nCompare research methods in a markdown table with columns: Paper | Approach | Data/Dataset | Key Technique | Results.",
      key_findings:            "4. KEY FINDINGS\nMost important findings and contributions from the papers collectively.",
      agreements:              "5. AGREEMENTS IN LITERATURE\nWhere the papers align and reinforce each other.",
      contradictions:          "6. CONTRADICTIONS & DEBATES\nWhere papers disagree, conflict, or offer competing views.",
      research_gaps:           "7. RESEARCH GAPS\nWhat remains unstudied or underexplored based on this body of work.",
      conclusion:              "8. CONCLUSION\nSynthesis of findings and future research directions.",
      references:              "9. REFERENCES\nAll papers in APA format.",
    };

    const papersContext = papers.map((p, i) =>
      `[${i+1}] Title: ${p.title}\n    Authors: ${Array.isArray(p.authors) ? p.authors.join(", ") : p.authors}\n    Year: ${p.published}\n    Abstract: ${p.abstract?.slice(0, 400) || "N/A"}`
    ).join("\n\n");

    const selectedSections = activeSections.map(s => sectionInstructions[s]).filter(Boolean).join("\n\n");

    const prompt = `You are an expert academic writer. Write a comprehensive literature review in ${styleGuide}.

Target length: approximately ${wordCount} words.

PAPERS TO REVIEW:
${papersContext}

Write the literature review with EXACTLY these sections:
${selectedSections}

Important rules:
- Cite papers inline as (Author, Year) format
- In the methodology table use markdown table syntax
- Be analytical, not just descriptive — compare, contrast, synthesize
- Identify patterns and themes across papers
- Write in continuous flowing prose (except the table)
- APA references at the end must include all ${papers.length} papers
- Do NOT include any preamble or explanation — start directly with the review`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const review = response.choices[0].message.content;
    console.log(`   ✅ Literature review generated! (~${review.split(" ").length} words)`);

    res.json({
      success: true,
      review,
      paperCount: papers.length,
      wordCount: review.split(" ").length,
      papers: papers.map(p => ({ title: p.title, authors: p.authors, published: p.published })),
    });

  } catch (error) {
    console.error("Literature review error:", error);
    res.status(500).json({ error: "Failed to generate literature review: " + error.message });
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
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="background:#f0a500;color:#0a0b0f;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;font-family:monospace;">#${i+1}</span>
        <span style="color:#6b7280;font-size:11px;font-family:monospace;">${p.source?.toUpperCase() || "ARXIV"} · ${p.published || ""}</span>
      </div>
      <h3 style="color:#f0f0f0;font-size:15px;margin:8px 0;line-height:1.5;">${p.title}</h3>
      <p style="color:#9ca3af;font-size:12px;margin-bottom:12px;font-family:monospace;">${Array.isArray(p.authors) ? p.authors.slice(0,3).join(", ") : p.authors}${p.authors?.length > 3 ? " et al." : ""}</p>
      <div style="background:#161b27;border-left:3px solid #f0a500;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;">
        <p style="color:#d1d5db;font-size:13px;line-height:1.7;margin:0;">${p.summary || p.abstract?.slice(0, 300) || "No summary available."}...</p>
      </div>
      ${p.pdfUrl && p.pdfUrl !== "no-pdf" ? `<a href="${p.pdfUrl}" style="display:inline-flex;align-items:center;gap:6px;color:#f0a500;font-size:12px;text-decoration:none;font-family:monospace;border:1px solid rgba(240,165,0,0.3);padding:6px 14px;border-radius:6px;">Read Paper →</a>` : ""}
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:10px;background:#111318;border:1px solid #1e2030;border-radius:12px;padding:12px 20px;">
        <span style="font-size:20px;">🧠</span>
        <span style="color:#f0a500;font-size:18px;font-weight:700;">ResearchMind</span>
        <span style="color:#6b7280;font-size:12px;font-family:monospace;">Weekly Digest</span>
      </div>
    </div>

    <!-- Hero -->
    <div style="background:linear-gradient(135deg,rgba(240,165,0,0.1),rgba(240,165,0,0.02));border:1px solid rgba(240,165,0,0.2);border-radius:16px;padding:28px;text-align:center;margin-bottom:32px;">
      <p style="color:#9ca3af;font-size:12px;font-family:monospace;letter-spacing:0.1em;margin-bottom:8px;">WEEKLY RESEARCH DIGEST</p>
      <h1 style="color:#f0f0f0;font-size:22px;margin:0 0 8px;line-height:1.4;">Hey ${name} 👋</h1>
      <p style="color:#9ca3af;font-size:14px;margin:0;">Here are the <strong style="color:#f0a500;">5 most important papers</strong> published this week on <strong style="color:#f0f0f0;">${topic}</strong></p>
    </div>

    <!-- Papers -->
    ${paperRows}

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://researchminds.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#f0a500,#d4920a);color:#0a0b0f;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;">Open ResearchMind →</a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e2030;padding-top:20px;text-align:center;">
      <p style="color:#4b5563;font-size:11px;font-family:monospace;margin:0 0 8px;">You're receiving this because you subscribed to ResearchMind Weekly Digest.</p>
      <p style="color:#4b5563;font-size:11px;font-family:monospace;margin:0;">researchminds.vercel.app</p>
    </div>
  </div>
</body>
</html>`;
}

async function generateDigestForSubscriber(subscriber) {
  try {
    const { fetchPapers } = await import("./src/ingestion/arxivFetcher.js");
    const papers = await fetchPapers(subscriber.topic, 5);
    if (!papers || papers.length === 0) return;

    // Generate AI summary for each paper
    const papersWithSummary = await Promise.all(papers.map(async (p) => {
      try {
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: `Summarize this research paper abstract in 2-3 sentences for a weekly digest email. Be concise and highlight the key contribution.\n\nTitle: ${p.title}\nAbstract: ${p.abstract}` }],
          max_tokens: 150,
          temperature: 0.3,
        });
        return { ...p, summary: response.choices[0].message.content };
      } catch { return { ...p, summary: p.abstract?.slice(0, 200) }; }
    }));

    const html = buildEmailHTML(subscriber.name, subscriber.topic, papersWithSummary);

    await resend.emails.send({
      from:    "ResearchMind Digest <onboarding@resend.dev>",
      to:      subscriber.email,
      subject: `📚 Your Weekly Digest — ${subscriber.topic}`,
      html,
    });

    console.log(`   ✅ Digest sent to ${subscriber.email}`);

    // Update lastSentAt
    const db = loadSubscribers();
    const idx = db.subscribers.findIndex(s => s.id === subscriber.id);
    if (idx >= 0) { db.subscribers[idx].lastSentAt = new Date().toISOString(); saveSubscribers(db); }

  } catch (err) {
    console.error(`   ❌ Failed to send to ${subscriber.email}:`, err.message);
  }
}

async function sendWeeklyDigests() {
  const db = loadSubscribers();
  const active = db.subscribers.filter(s => s.active);
  console.log(`\n📬 Sending weekly digest to ${active.length} subscribers...`);
  for (const sub of active) { await generateDigestForSubscriber(sub); }
  console.log("   ✅ Weekly digest complete!");
}

// ─── CRON: Every Monday at 8:00 AM ───
cron.schedule("0 8 * * 1", () => {
  console.log("\n⏰ Monday 8am — Running weekly digest cron...");
  sendWeeklyDigests();
});

// ─── ROUTE 8: Subscribe to digest ───
app.post("/api/digest/subscribe", async (req, res) => {
  try {
    const { name, email, topic } = req.body;
    if (!name || !email || !topic) return res.status(400).json({ error: "Name, email and topic are required." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address." });

    const db = loadSubscribers();
    const existing = db.subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      if (existing.active) return res.status(409).json({ error: "This email is already subscribed." });
      // Reactivate
      existing.active = true; existing.topic = topic; existing.name = name;
      saveSubscribers(db);
      return res.json({ success: true, message: "Subscription reactivated! You'll get your first digest next Monday." });
    }

    db.subscribers.push({
      id:          `sub_${Date.now()}`,
      name,
      email,
      topic,
      createdAt:   new Date().toISOString(),
      lastSentAt:  null,
      active:      true,
    });
    saveSubscribers(db);

    // Send welcome email
    await resend.emails.send({
      from:    "ResearchMind Digest <onboarding@resend.dev>",
      to:      email,
      subject: "📚 You're subscribed to ResearchMind Weekly Digest!",
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0b0f;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:520px;margin:0 auto;padding:40px 16px;text-align:center;">
          <div style="background:linear-gradient(135deg,rgba(240,165,0,0.1),rgba(240,165,0,0.02));border:1px solid rgba(240,165,0,0.2);border-radius:16px;padding:36px;">
            <div style="font-size:40px;margin-bottom:16px;">📬</div>
            <h1 style="color:#f0f0f0;font-size:22px;margin:0 0 12px;">You're in, ${name}!</h1>
            <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 8px;">Every Monday morning you'll receive the <strong style="color:#f0a500;">5 most important papers</strong> on:</p>
            <div style="background:#111318;border:1px solid rgba(240,165,0,0.3);border-radius:8px;padding:10px 20px;margin:16px 0;">
              <p style="color:#f0a500;font-size:15px;font-weight:700;margin:0;font-family:monospace;">${topic}</p>
            </div>
            <p style="color:#6b7280;font-size:12px;margin:0 0 24px;">Each paper summarized by AI. No noise, just signal.</p>
            <a href="https://researchminds.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#f0a500,#d4920a);color:#0a0b0f;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">Open ResearchMind →</a>
          </div>
          <p style="color:#374151;font-size:11px;margin-top:20px;font-family:monospace;">researchminds.vercel.app</p>
        </div>
      </body></html>`,
    });

    console.log(`   ✅ New subscriber: ${email} → "${topic}"`);
    res.json({ success: true, message: "Subscribed! Check your email for a confirmation. First digest arrives next Monday." });

  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: "Subscription failed: " + error.message });
  }
});

// ─── ROUTE 9: Unsubscribe ───
app.get("/api/digest/unsubscribe", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required." });

    const db = loadSubscribers();
    const sub = db.subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (!sub) return res.status(404).json({ error: "Email not found." });

    sub.active = false;
    saveSubscribers(db);

    res.send(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0b0f;font-family:sans-serif;">
      <div style="max-width:400px;margin:80px auto;text-align:center;padding:40px;background:#111318;border-radius:16px;border:1px solid #1e2030;">
        <div style="font-size:36px;margin-bottom:16px;">👋</div>
        <h2 style="color:#f0f0f0;margin:0 0 8px;">Unsubscribed</h2>
        <p style="color:#9ca3af;font-size:14px;">You've been removed from ResearchMind Weekly Digest.</p>
        <a href="https://researchminds.vercel.app" style="display:inline-block;margin-top:20px;color:#f0a500;font-size:13px;">← Back to ResearchMind</a>
      </div>
    </body></html>`);

  } catch (error) {
    res.status(500).send("Unsubscribe failed.");
  }
});

// ─── ROUTE 10: Send test digest ───
app.post("/api/digest/test", async (req, res) => {
  try {
    const { email, name, topic } = req.body;
    if (!email || !topic) return res.status(400).json({ error: "Email and topic required." });
    await generateDigestForSubscriber({ id: "test", email, name: name || "Researcher", topic, active: true });
    res.json({ success: true, message: `Test digest sent to ${email}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
});