export function chunkText(text, chunkSize = 600, overlap = 60) {
  const words = text.split(" ");
  const chunks = [];
  let startIndex = 0;

  const MAX_CHUNKS = 15; // Hard cap — keeps HuggingFace embedding fast

  while (startIndex < words.length) {
    const endIndex = startIndex + chunkSize;
    const chunkWords = words.slice(startIndex, endIndex);
    const chunkContent = chunkWords.join(" ").trim();

    if (chunkContent.length > 50) {
      chunks.push(chunkContent);
    }

    startIndex += (chunkSize - overlap);

    // Stop early once we hit the cap
    if (chunks.length >= MAX_CHUNKS) break;
  }

  return chunks;
}

export function chunkPaper(paper) {
  console.log(`\n📄 Processing: "${paper.title.slice(0, 50)}..."`);

  // Guard: if text is too short, return empty
  if (!paper.fullText || paper.fullText.length < 50) {
    console.log(`   ⚠️  Text too short to chunk, skipping`);
    return [];
  }

  console.log(`\n✂️  Chunking text...`);
  console.log(`   Total characters: ${paper.fullText.length.toLocaleString()}`);

  const chunks = chunkText(paper.fullText);

  // Attach paper metadata to each chunk
  const chunksWithMetadata = chunks.map((chunk, index) => ({
    text: chunk,
    metadata: {
      paperId: paper.id,
      title: paper.title,
      authors: paper.authors.join(", "),
      published: paper.published,
      pdfUrl: paper.pdfUrl,
      chunkIndex: index,
      totalChunks: chunks.length,
    }
  }));

  console.log(`   ✅ Created ${chunksWithMetadata.length} chunks`);
  console.log(`   Each chunk: ~${600} words with ${60} word overlap`);
  console.log(`   ✅ Paper split into ${chunksWithMetadata.length} chunks`);

  return chunksWithMetadata;
}