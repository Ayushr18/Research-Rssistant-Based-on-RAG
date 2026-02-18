import fetch from "node-fetch";
import xml2js from "xml2js";

export async function fetchPapers(query, maxResults = 10) {
  console.log(`🔍 Searching ArXiv for: "${query}"...`);

  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=relevance`;

  // Add retry logic — if ArXiv rate limits us, wait and try again
  let xmlData;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "ResearchAssistant/1.0" }
    });
    xmlData = await response.text();

    // Check if response is valid XML (starts with < not an error message)
    if (xmlData.trim().startsWith("<")) {
      break; // Valid XML, continue
    }

    console.log(`   ⚠️  ArXiv rate limited. Waiting 5 seconds... (attempt ${attempt}/3)`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Final check
  if (!xmlData || !xmlData.trim().startsWith("<")) {
    throw new Error("ArXiv is rate limiting us. Please wait 30 seconds and try again.");
  }

  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlData);

  const entries = result.feed.entry || [];

  if (entries.length === 0) {
    console.log("❌ No papers found");
    return [];
  }

  const papers = entries.map((entry) => {
    const arxivId = entry.id[0].split("/abs/")[1];
    return {
      id: arxivId,
      title: entry.title[0].replace(/\n/g, " ").trim(),
      authors: entry.author.map((a) => a.name[0]),
      abstract: entry.summary[0].replace(/\n/g, " ").trim(),
      published: entry.published[0].split("T")[0],
      pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
      arxivUrl: entry.id[0],
    };
  });

  console.log(`✅ Found ${papers.length} papers!`);
  return papers;
}
