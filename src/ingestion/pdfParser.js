import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_FOLDER = path.join(__dirname, "../../pdfs");

export async function downloadAndParsePDF(paper) {
  // If paper already has fullText (e.g. from PMC fetchers), skip download entirely
  if (paper.fullText && paper.fullText.length > 100) {
    console.log(`\n📄 Using pre-fetched text for: "${paper.title.slice(0, 50)}..."`);
    return {
      ...paper,
      textLength: paper.fullText.length,
    };
  }

  console.log(`\n📥 Downloading: "${paper.title.slice(0, 50)}..."`);

  try {
    if (!fs.existsSync(PDF_FOLDER)) {
      fs.mkdirSync(PDF_FOLDER, { recursive: true });
    }

    const filename = `${paper.id.replace(/\//g, "_")}.pdf`;
    const filepath = path.join(PDF_FOLDER, filename);

    if (fs.existsSync(filepath)) {
      console.log(`   ♻️  Already downloaded, using cached version`);
    } else {
      let response;
      try {
        response = await fetch(paper.pdfUrl, {
          headers: {
            "User-Agent": "ResearchAssistant/1.0 (research tool)",
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout — skip slow servers
        });
      } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          throw new Error(`Download timed out after 15s — server too slow`);
        }
        throw err;
      }

      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status}`);
      }

      // Cap download at 5MB — large PDFs slow everything down significantly
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      const chunks = [];
      let totalSize = 0;

      for await (const chunk of response.body) {
        chunks.push(chunk);
        totalSize += chunk.length;
        if (totalSize >= MAX_SIZE) {
          console.log(`   ⚠️  Large PDF — capping at 5MB for speed`);
          break;
        }
      }

      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(filepath, buffer);
      console.log(`   ✅ Downloaded successfully (${(totalSize / 1024).toFixed(0)}KB)`);
    }

    const text = await extractTextFromPDF(filepath);

    return {
      ...paper,
      fullText: text,
      textLength: text.length,
    };

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   ⚠️  Falling back to abstract only`);
    return {
      ...paper,
      fullText: paper.abstract || paper.title,
      textLength: (paper.abstract || paper.title).length,
      fallback: true,
    };
  }
}

async function extractTextFromPDF(filepath) {
  console.log(`   📖 Extracting text...`);

  const dataBuffer = fs.readFileSync(filepath);

  const pdfParseFunc = require("pdf-parse");
  const data = await pdfParseFunc(dataBuffer);

  const cleanText = data.text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();

  console.log(`   ✅ Extracted ${cleanText.length.toLocaleString()} characters`);
  return cleanText;
}