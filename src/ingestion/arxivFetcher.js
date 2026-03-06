import fetch from "node-fetch";
import xml2js from "xml2js";

export async function fetchPapers(query, maxResults = 10) {
  console.log(`🔍 Searching ArXiv for: "${query}"...`);

  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=relevance`;

  let xmlData;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "ResearchAssistant/1.0" },
        timeout: 15000,
      });

      xmlData = await response.text();

      // Must be an Atom feed — check for <feed and not an HTML error page
      const trimmed = xmlData.trim();
      const isAtomFeed = trimmed.startsWith("<?xml") || trimmed.includes("<feed");
      const isHtmlError = trimmed.toLowerCase().startsWith("<!doctype") || trimmed.toLowerCase().startsWith("<html");

      if (isAtomFeed && !isHtmlError) {
        break; // Valid Atom feed, proceed
      }

      // HTML error page or garbage — log and retry
      console.log(`   ⚠️  ArXiv returned non-XML response (attempt ${attempt}/3). Waiting 5s...`);
      console.log(`   Response preview: ${trimmed.slice(0, 120)}`);
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (fetchErr) {
      console.log(`   ⚠️  Network error on attempt ${attempt}/3: ${fetchErr.message}`);
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (!xmlData) {
    throw new Error("Could not reach ArXiv after 3 attempts. Check your internet connection.");
  }

  const trimmed = xmlData.trim();
  const isAtomFeed = trimmed.startsWith("<?xml") || trimmed.includes("<feed");
  if (!isAtomFeed) {
    throw new Error("ArXiv is temporarily unavailable or rate-limiting. Please wait 30 seconds and try again.");
  }

  // Strip any invalid characters that break xml2js
  const cleanedXml = xmlData
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, "&amp;") // fix bare ampersands
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");                  // strip control chars

  let result;
  try {
    const parser = new xml2js.Parser({ explicitArray: true, ignoreAttrs: false });
    result = await parser.parseStringPromise(cleanedXml);
  } catch (parseErr) {
    console.error("   ❌ XML parse error:", parseErr.message);
    console.error("   Raw XML preview:", xmlData.slice(0, 300));
    throw new Error(`ArXiv returned malformed data. Try a different search term or wait 30 seconds.`);
  }

  const entries = result?.feed?.entry || [];

  if (entries.length === 0) {
    console.log("❌ No papers found");
    return [];
  }

  const papers = entries.map((entry) => {
    try {
      const arxivId = entry.id[0].split("/abs/")[1] || entry.id[0];
      return {
        id:        arxivId,
        title:     entry.title?.[0]?.replace(/\n/g, " ").trim()    || "Untitled",
        authors:   (entry.author || []).map(a => a.name?.[0] || "Unknown"),
        abstract:  entry.summary?.[0]?.replace(/\n/g, " ").trim()  || "",
        published: entry.published?.[0]?.split("T")[0]              || "Unknown",
        pdfUrl:    `https://arxiv.org/pdf/${arxivId}.pdf`,
        arxivUrl:  entry.id?.[0]                                    || "",
        source:    "arxiv",
      };
    } catch (mapErr) {
      console.warn("   ⚠️  Skipping malformed entry:", mapErr.message);
      return null;
    }
  }).filter(Boolean);

  console.log(`✅ Found ${papers.length} papers!`);
  return papers;
}