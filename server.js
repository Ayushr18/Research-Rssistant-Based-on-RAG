import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── HELPER: Pick the right fetcher ───
async function fetchBySource(query, maxResults, source) {
  switch (source) {
    case "arxiv":    return await fetchPapers(query, maxResults);
    case "semantic": return await fetchFromSemanticScholar(query, maxResults);
    case "pubmed":   return await fetchFromPubMed(query, maxResults);
    case "chemrxiv": return await fetchFromChemRxiv(query, maxResults);
    default:         return await fetchPapers(query, maxResults);
  }
}

// ─── ROUTE 1: Ingest with SSE progress streaming ───
app.get("/api/ingest-progress", async (req, res) => {
  const { query, maxResults = 5, source = "arxiv" } = req.query;

  if (!query) { res.status(400).json({ error: "Query is required" }); return; }

  // SSE headers
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  function send(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    console.log(`\n📥 Ingesting from ${source.toUpperCase()}: "${query}"`);

    // Step 1: Fetch
    send({ type: "step", message: `Searching ${source} for "${query}"...`, progress: 5 });
    const papers = await fetchBySource(query, Number(maxResults), source);

    if (papers.length === 0) {
      send({ type: "error", message: "No papers found. Try a different search term." });
      res.end(); return;
    }

    send({ type: "step", message: `Found ${papers.length} papers. Starting ingestion...`, progress: 15 });

    // Step 2: Process each paper sequentially for per-paper progress
    const processedPapers = [];
    const progressPerPaper = 70 / papers.length;
    let currentProgress = 15;

    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      const shortTitle = paper.title?.length > 45
        ? paper.title.slice(0, 45) + "..."
        : paper.title;

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
        console.log(`⚠️  Skipping — ${err.message}`);
        send({ type: "paper_skip", message: `⚠️  (${i+1}/${papers.length}) Skipped: ${shortTitle}`, progress: Math.round(currentProgress) });
        currentProgress += progressPerPaper;
      }
    }

    if (processedPapers.length === 0) {
      send({ type: "error", message: "Could not process any papers. Please try again." });
      res.end(); return;
    }

    send({ type: "step", message: "Finalizing database...", progress: 95 });
    const stats = await getCollectionStats();

    send({
      type: "done",
      message: `🎉 Successfully indexed ${processedPapers.length} of ${papers.length} papers!`,
      progress: 100,
      papers: processedPapers,
      stats,
    });

  } catch (error) {
    console.error("Ingest error:", error);
    send({ type: "error", message: error.message });
  }

  res.end();
});

// ─── ROUTE 2: Ask a question ───
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    console.log(`\n❓ Question: "${question}"`);
    const relevantChunks = await retrieveRelevantChunks(question, 5);

    if (relevantChunks.length === 0) {
      return res.status(404).json({ error: "No relevant papers found. Please ingest papers first." });
    }

    const { answer, citations } = await generateAnswer(question, relevantChunks);
    res.json({ success: true, answer, citations });

  } catch (error) {
    console.error("Ask error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE 3: Get stats ───
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await getCollectionStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE 4: Clear database ───
app.delete("/api/clear", async (req, res) => {
  try {
    await clearCollection();
    res.json({ success: true, message: "Database cleared" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Sources available: ArXiv, Semantic Scholar, PubMed, ChemRxiv`);
});