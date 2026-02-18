import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This is where we save our database
const DB_PATH = path.join(__dirname, "../../data/vectorStore.json");
const DATA_FOLDER = path.join(__dirname, "../../data");

// Load existing database from file
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { chunks: [] };
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

// Save database to file
function saveDB(db) {
  if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export async function storeChunks(embeddedChunks) {
  console.log(`\n💾 Storing ${embeddedChunks.length} chunks in local database...`);

  const db = loadDB();

  embeddedChunks.forEach((chunk) => {
    const id = `${chunk.metadata.paperId}_chunk_${chunk.metadata.chunkIndex}`;

    // Check if this chunk already exists (avoid duplicates)
    const existingIndex = db.chunks.findIndex((c) => c.id === id);

    const record = {
      id,
      text: chunk.text,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
    };

    if (existingIndex >= 0) {
      // Update existing
      db.chunks[existingIndex] = record;
    } else {
      // Add new
      db.chunks.push(record);
    }
  });

  saveDB(db);
  console.log(`   ✅ Stored ${embeddedChunks.length} chunks!`);
  console.log(`   📁 Database saved to: data/vectorStore.json`);
}

export async function similaritySearch(queryEmbedding, topK = 5) {
  const db = loadDB();

  if (db.chunks.length === 0) {
    console.log("   ⚠️  Database is empty!");
    return [];
  }

  // Calculate similarity between query and every stored chunk
  const scored = db.chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by score (highest first) and return top K
  const topResults = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return topResults;
}

// Cosine similarity measures how similar two vectors are
// Returns value between 0 and 1 (1 = identical, 0 = completely different)
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function getCollectionStats() {
  const db = loadDB();
  const papers = [...new Set(db.chunks.map((c) => c.metadata.paperId))];
  return {
    totalChunks: db.chunks.length,
    totalPapers: papers.length,
  };
}

export async function clearCollection() {
  saveDB({ chunks: [] });
  console.log(`   🗑️  Database cleared`);
}