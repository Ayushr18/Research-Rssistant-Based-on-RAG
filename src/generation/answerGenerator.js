import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateAnswer(question, retrievedChunks) {
  console.log(`\n🤖 Generating answer with Groq (Llama AI)...`);

  if (retrievedChunks.length === 0) {
    return {
      answer: "I couldn't find relevant information in the stored papers.",
      citations: [],
    };
  }

  // Step 1: Build context from retrieved chunks
  // Each chunk becomes a labeled section with its source
  const context = retrievedChunks
    .map((chunk, index) => {
      return `
[Source ${index + 1}]
Paper: ${chunk.source.title}
Authors: ${chunk.source.authors}
Published: ${chunk.source.published}
Content: ${chunk.text}
      `.trim();
    })
    .join("\n\n");

  // Step 2: Build the prompt
  // This is the instruction we give to Llama AI
  const prompt = `You are an expert research assistant helping academics understand scientific papers.

Your job is to answer the question below using ONLY the provided context from research papers.

Rules:
- Answer based ONLY on the provided context
- Always cite which source you used like this: [Source 1], [Source 2]
- If the context doesn't contain enough info, say so clearly
- Be precise and academic in tone
- Do NOT make up information

CONTEXT FROM RESEARCH PAPERS:
${context}

QUESTION: ${question}

ANSWER (with citations):`;

  // Step 3: Call Groq API
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",  // Free model on Groq
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,   // Low = more focused and factual
    max_tokens: 1024,   // Max length of answer
  });

  // Step 4: Extract the answer
  const answer = response.choices[0].message.content;

  // Step 5: Build citations list
  const citations = retrievedChunks.map((chunk, index) => ({
    number: index + 1,
    title: chunk.source.title,
    authors: chunk.source.authors,
    published: chunk.source.published,
    pdfUrl: chunk.source.pdfUrl,
  }));

  console.log(`   ✅ Answer generated!`);

  return { answer, citations };
}