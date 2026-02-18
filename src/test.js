import { fetchPapers } from "./ingestion/arxivFetcher.js";
import { downloadAndParsePDF } from "./ingestion/pdfParser.js";
import { chunkPaper } from "./ingestion/chunker.js";
import { embedChunks } from "./embeddings/embedder.js";
import { storeChunks, clearCollection } from "./database/vectorStore.js";
import { retrieveRelevantChunks } from "./retrieval/retriever.js";
import { generateAnswer } from "./generation/answerGenerator.js";

console.log("🚀 Testing Full RAG Pipeline...\n");

// ─── INGESTION ───
await clearCollection();
const papers = await fetchPapers("vision transformer image classification", 2);
const parsedPaper = await downloadAndParsePDF(papers[0]);
const chunks = chunkPaper(parsedPaper);
const embeddedChunks = await embedChunks(chunks);
await storeChunks(embeddedChunks);

// ─── QUESTION & ANSWER ───
console.log("\n" + "=".repeat(50));
console.log("FULL RAG PIPELINE TEST");
console.log("=".repeat(50));

const question = "What problem does the Vision Transformer solve and what is its main approach?";

// Retrieve relevant chunks
const relevantChunks = await retrieveRelevantChunks(question, 3);

// Generate answer
const { answer, citations } = await generateAnswer(question, relevantChunks);

// Display results
console.log(`\n❓ Question:\n   ${question}`);
console.log(`\n💡 Answer:\n`);
console.log(answer);
console.log(`\n📚 Citations:`);
citations.forEach((citation) => {
  console.log(`\n   [${citation.number}] ${citation.title}`);
  console.log(`        Authors  : ${citation.authors.slice(0, 60)}`);
  console.log(`        Published: ${citation.published}`);
  console.log(`        PDF      : ${citation.pdfUrl}`);
});

console.log("\n" + "=".repeat(50));
console.log("✅ FULL RAG PIPELINE COMPLETE!");
console.log("=".repeat(50));