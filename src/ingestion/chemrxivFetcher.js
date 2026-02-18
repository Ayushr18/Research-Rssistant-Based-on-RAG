import fetch from "node-fetch";

export async function fetchFromChemRxiv(query, maxResults = 10) {
  console.log(`🔍 Searching Semantic Scholar (Chemistry) for: "${query.trim()}"...`);

  // Add delay to avoid rate limiting from previous requests
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("limit", maxResults);
  url.searchParams.set("fields", "title,authors,abstract,year,openAccessPdf,externalIds");
  url.searchParams.set("fieldsOfStudy", "Chemistry,Materials Science,Chemical Engineering");

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "ResearchMind/1.0 (academic research tool)",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(`Request failed: ${err.message}`);
  }

  // Handle rate limiting with one retry
  if (response.status === 429) {
    console.log(`   ⏳ Rate limited — waiting 10 seconds and retrying...`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    response = await fetch(url.toString(), {
      headers: { "User-Agent": "ResearchMind/1.0 (academic research tool)" },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429) {
      throw new Error("Still rate limited by Semantic Scholar. Please wait 1 minute and try again.");
    }
  }

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.data || [];

  console.log(`   📊 Got ${results.length} raw results`);

  // Filter to papers that have open access PDFs
  const papers = results
    .filter(p => p.openAccessPdf?.url)
    .map(paper => ({
      id: `ss_chem_${paper.paperId}`,
      title: paper.title || "No title",
      authors: paper.authors?.map(a => a.name) || [],
      abstract: paper.abstract || "No abstract available",
      published: paper.year?.toString() || "Unknown",
      pdfUrl: paper.openAccessPdf.url,
      source: "chemrxiv",
    }));

  // If no open-access PDFs found, use abstract-only fallback
  if (papers.length === 0 && results.length > 0) {
    console.log(`   ⚠️  No open-access PDFs found, using abstracts only...`);
    return results.slice(0, maxResults).map(paper => ({
      id: `ss_chem_${paper.paperId}`,
      title: paper.title || "No title",
      authors: paper.authors?.map(a => a.name) || [],
      abstract: paper.abstract || "No abstract available",
      published: paper.year?.toString() || "Unknown",
      pdfUrl: "no-pdf",
      // pdfParser will skip download and use this directly
      fullText: `${paper.title}\n\nAuthors: ${paper.authors?.map(a => a.name).join(", ")}\n\nAbstract: ${paper.abstract || ""}`,
      source: "chemrxiv",
    }));
  }

  console.log(`✅ Found ${papers.length} chemistry papers with PDFs!`);
  return papers;
}