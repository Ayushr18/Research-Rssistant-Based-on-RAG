import fetch from "node-fetch";

export async function fetchFromSemanticScholar(query, maxResults = 10) {
  console.log(`🔍 Searching Semantic Scholar for: "${query}"...`);

  // Add delay before every request to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 2000));

  return await searchWithRetry(query, maxResults, 3);
}

async function searchWithRetry(query, maxResults, retries) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=title,authors,abstract,year,externalIds,openAccessPdf`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ResearchMind/1.0 (research tool)",
    },
    signal: AbortSignal.timeout(15000),
  });

  // Rate limited — wait and retry
  if (response.status === 429) {
    if (retries > 0) {
      console.log(`   ⏳ Rate limited. Waiting 10 seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return searchWithRetry(query, maxResults, retries - 1);
    }
    throw new Error("Semantic Scholar is rate limiting. Please wait 1 minute and try again.");
  }

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();
  const papers = data.data || [];

  if (papers.length === 0) {
    console.log("❌ No papers found");
    return [];
  }

  // Filter only papers that have open access PDFs
  const accessiblePapers = papers
    .filter(p => p.openAccessPdf?.url)
    .map(paper => ({
      id: paper.paperId,
      title: paper.title,
      authors: paper.authors.map(a => a.name),
      abstract: paper.abstract || "No abstract available",
      published: paper.year?.toString() || "Unknown",
      pdfUrl: paper.openAccessPdf.url,
      source: "Semantic Scholar",
    }));

  // If no open-access PDFs, fall back to abstracts only
  if (accessiblePapers.length === 0 && papers.length > 0) {
    console.log(`   ⚠️  No open-access PDFs found, using abstracts only...`);
    return papers.slice(0, maxResults).map(paper => ({
      id: paper.paperId,
      title: paper.title,
      authors: paper.authors.map(a => a.name),
      abstract: paper.abstract || "No abstract available",
      published: paper.year?.toString() || "Unknown",
      pdfUrl: "no-pdf",
      fullText: `${paper.title}\n\nAuthors: ${paper.authors.map(a => a.name).join(", ")}\n\nAbstract: ${paper.abstract || ""}`,
      source: "Semantic Scholar",
    }));
  }

  console.log(`✅ Found ${accessiblePapers.length} accessible papers!`);
  return accessiblePapers;
}