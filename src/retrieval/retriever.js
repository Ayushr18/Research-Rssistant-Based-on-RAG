import { embedText } from "../embeddings/embedder.js";
import { similaritySearch } from "../database/vectorStore.js";

export async function retrieveRelevantChunks(question, topK = 5) {
  console.log(`\n🔍 Finding relevant chunks for: "${question}"`);

  // Step 1: Convert the question into an embedding
  // Same process as we did for chunks - question becomes 384 numbers
  const questionEmbedding = await embedText(question);
  console.log(`   ✅ Question converted to vector`);

  // Step 2: Search the database for similar chunks
  // ChromaDB compares question vector against all stored vectors
  // Returns the most similar ones
  const results = await similaritySearch(questionEmbedding, topK);

  if (results.length === 0) {
    console.log(`   ⚠️  No relevant chunks found`);
    return [];
  }

  console.log(`   ✅ Found ${results.length} relevant chunks`);

  // Step 3: Format results nicely
  const formattedResults = results.map((result, index) => ({
    rank: index + 1,
    text: result.text,
    score: result.score.toFixed(4),
    source: {
      title: result.metadata.title,
      authors: result.metadata.authors,
      published: result.metadata.published,
      pdfUrl: result.metadata.pdfUrl,
      chunkIndex: result.metadata.chunkIndex,
    },
  }));

  return formattedResults;
}