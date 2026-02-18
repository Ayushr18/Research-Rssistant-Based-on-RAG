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

// ─── HELPER: Pick the right fetcher based on source ───
async function fetchBySource(query, maxResults, source) {
  switch (source) {
    case "arxiv":
      return await fetchPapers(query, maxResults);
    case "semantic":
      return await fetchFromSemanticScholar(query, maxResults);
    case "pubmed":
      return await fetchFromPubMed(query, maxResults);
    case "chemrxiv":
      return await fetchFromChemRxiv(query, maxResults);
    default:
      return await fetchPapers(query, maxResults);
  }
}

// ─── HELPER: Process a single paper through the full pipeline ───
async function processPaper(paper, source) {
  const parsed = await downloadAndParsePDF(paper);
  const chunks = chunkPaper(parsed);

  if (chunks.length === 0) {
    throw new Error("No usable content extracted");
  }

  const embedded = await embedChunks(chunks);
  await storeChunks(embedded);

  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    published: paper.published,
    abstract: paper.abstract,
    pdfUrl: paper.pdfUrl,
    source: paper.source || source,
  };
}

// ─── ROUTE 1: Search and ingest papers ───
app.post("/api/ingest", async (req, res) => {
  try {
    const { query, maxResults = 5, source = "arxiv" } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log(`\n📥 Ingesting from ${source.toUpperCase()}: "${query}"`);

    // Step 1: Fetch paper metadata
    const papers = await fetchBySource(query, maxResults, source);

    if (papers.length === 0) {
      return res.status(404).json({ error: "No papers found. Try a different search term or source." });
    }

    // Step 2: Process all papers in PARALLEL for speed
    console.log(`\n⚡ Processing ${papers.length} papers in parallel...`);
    const startTime = Date.now();

    const results = await Promise.allSettled(
      papers.map(paper => processPaper(paper, source))
    );

    // Collect successful results, log failures
    const processedPapers = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        processedPapers.push(result.value);
      } else {
        console.log(`   ⚠️  Skipping "${papers[i].title.slice(0, 40)}..." — ${result.reason?.message}`);
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Processed ${processedPapers.length}/${papers.length} papers in ${elapsed}s`);

    if (processedPapers.length === 0) {
      return res.status(500).json({ error: "Could not process any papers. Please try again." });
    }

    const stats = await getCollectionStats();

    res.json({
      success: true,
      papers: processedPapers,
      stats,
      elapsed: `${elapsed}s`,
    });

  } catch (error) {
    console.error("Ingest error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── ROUTE 2: Ask a question ───
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

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

// ─── ROUTE 3: Get database stats ───
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Sources available: ArXiv, Semantic Scholar, PubMed, ChemRxiv`);
});