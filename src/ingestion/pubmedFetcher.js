import fetch from "node-fetch";

export async function fetchFromPubMed(query, maxResults = 10) {
  console.log(`\n🔍 Searching Europe PMC for: "${query}"...`);

  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${maxResults}&resultType=core`;

  const response = await fetch(url, {
    headers: { "User-Agent": "ResearchMind/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Europe PMC search failed: ${response.status}`);
  }

  const data = await response.json();
  const results = data.resultList?.result || [];

  if (results.length === 0) {
    console.log("❌ No papers found");
    return [];
  }

  const papers = results
    .filter(p => p.isOpenAccess === "Y" && p.fullTextUrlList)
    .map(paper => {
      const pdfUrl = paper.fullTextUrlList?.fullTextUrl
        ?.find(u => u.documentStyle === "pdf")?.url ||
        paper.fullTextUrlList?.fullTextUrl?.[0]?.url || "";

      return {
        id: `epmc_${paper.id}`,
        title: paper.title || "No title",
        authors: paper.authorList?.author?.map(a =>
          `${a.firstName || ""} ${a.lastName || ""}`.trim()
        ) || [],
        abstract: paper.abstractText || "No abstract available",
        published: paper.firstPublicationDate?.split("-")[0] || "Unknown",
        pdfUrl,
        source: "pubmed",
      };
    })
    .filter(p => p.pdfUrl);

  console.log(`✅ Found ${papers.length} open access papers!`);
  return papers;
}