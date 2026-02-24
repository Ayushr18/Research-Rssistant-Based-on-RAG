import { similaritySearch } from "../database/vectorStore.js";
import { embedText } from "../embeddings/embedder.js";

export async function retrieveRelevantChunks(question, topK = 3) {
  console.log(`\n🔍 Retrieving relevant chunks for: "${question}"`);

  // Step 1: Embed the question
  const queryEmbedding = await embedText(question);

  // Step 2: Search vector store
  const results = await similaritySearch(queryEmbedding, topK);

  if (results.length === 0) {
    console.log("   ⚠️  No relevant chunks found");
    return [];
  }

  // Step 3: Format results — include abstract in source
  const chunks = results.map(result => ({
    text: result.text,
    score: result.score,
    source: {
      paperId:   result.metadata.paperId,
      title:     result.metadata.title,
      authors:   result.metadata.authors,
      published: result.metadata.published,
      pdfUrl:    result.metadata.pdfUrl,
      abstract:  result.metadata.abstract || null,  // ← passed through for hover popup
    },
  }));

  console.log(`   ✅ Found ${chunks.length} relevant chunks`);
  chunks.forEach((c, i) => {
    console.log(`   ${i + 1}. Score: ${c.score.toFixed(3)} — ${c.source.title?.slice(0, 50)}`);
  });

  return chunks; 
}