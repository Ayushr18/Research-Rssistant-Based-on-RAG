import { HfInference } from "@huggingface/inference";
import dotenv from "dotenv";
dotenv.config();

const hf = new HfInference(process.env.HF_API_TOKEN);
const MODEL = "sentence-transformers/all-MiniLM-L6-v2";

export async function embedText(text) {
  const response = await hf.featureExtraction({
    model: MODEL,
    inputs: text,
  });
  return Array.from(response);
}

export async function embedChunks(chunks) {
  console.log(`\n🔢 Generating embeddings for ${chunks.length} chunks...`);
  console.log(`   Using HuggingFace — batching for speed!`);

  const BATCH_SIZE = 5; // Send 5 chunks at once
  const embeddedChunks = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    // Take a batch of 5 chunks
    const batch = chunks.slice(i, i + BATCH_SIZE);

    // Send all 5 at the same time instead of one by one
    const responses = await Promise.all(
      batch.map(chunk =>
        hf.featureExtraction({
          model: MODEL,
          inputs: chunk.text,
        })
      )
    );

    // Combine results
    batch.forEach((chunk, index) => {
      embeddedChunks.push({
        ...chunk,
        embedding: Array.from(responses[index]),
      });
    });

    console.log(`   Progress: ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks embedded`);

    // Small delay between batches only
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`   ✅ All chunks embedded!`);
  console.log(`   Vector size: ${embeddedChunks[0].embedding.length} numbers per chunk`);
  return embeddedChunks;
}
