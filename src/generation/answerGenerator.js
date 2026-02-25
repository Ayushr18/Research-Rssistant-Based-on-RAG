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

  const prompt = `You are an expert research assistant helping academics understand scientific papers.

Your job is to answer the question below using ONLY the provided context from research papers.

CRITICAL LANGUAGE RULE:
- Detect the language of the QUESTION carefully.
- If the question is in Hindi (whether typed in Roman script like "LLM kya hai" OR in Devanagari script like "LLM क्या है"), you MUST respond ENTIRELY in proper Hindi using Devanagari script (देवनागरी लिपि). Do NOT use Roman/English letters for Hindi words.
- If the question is in Spanish, respond in Spanish.
- If the question is in French, respond in French.
- If the question is in English, respond in English.
- Always match the user's language. Never mix languages in your response.

Rules:
- Answer based ONLY on the provided context
- Always cite which source you used like this: [Source 1], [Source 2]
- If the context doesn't contain enough info, say so clearly in the same language as the question
- Be precise and academic in tone
- Do NOT make up information

CONTEXT FROM RESEARCH PAPERS:
${context}

QUESTION: ${question}

ANSWER (in the same language and script as the question):`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const answer = response.choices[0].message.content;

  const citations = retrievedChunks.map((chunk, index) => ({
    number: index + 1,
    title: chunk.source.title,
    authors: chunk.source.authors,
    published: chunk.source.published,
    pdfUrl: chunk.source.pdfUrl,
    abstract: chunk.source.abstract || null,
  }));

  const avgScore = retrievedChunks.reduce((sum, c) => sum + (c.score || 0), 0) / retrievedChunks.length;
  const confidence = Math.round(avgScore * 100);

  console.log(`   ✅ Answer generated! Confidence: ${confidence}%`);

  return { answer, citations, confidence };
}