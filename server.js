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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
});