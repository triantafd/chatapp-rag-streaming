import React from 'react';
import { Chip, Stack } from '@mui/material';

// Extract <citation filename='...' page_number='...'>...</citation>
const CITATION_RE = /<citation\s+filename='([^']+)'\s+page_number='(\d+)'[^>]*>[^<]*<\/citation>/g;

export default function Citations({ answer }: { answer: string }) {
  const matches: { file: string; page: number }[] = [];
  // Avoid matchAll to support older TS targets; use exec loop instead
  const re = new RegExp(CITATION_RE.source, CITATION_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    const file = m[1];
    const page = Number(m[2]);
    if (file && !Number.isNaN(page)) matches.push({ file, page });
  }
  if (matches.length === 0) return null;
  // Build absolute PDF base from API base: replace trailing /api with /pdfs
  const apiBase = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:4000/api';
  const pdfBase = apiBase.replace(/\/?api\/?$/, '/pdfs');
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {matches.map((c, i) => (
        <Chip
          key={`${c.file}-${c.page}-${i}`}
          label={`${c.file} p.${c.page}`}
          component="a"
          clickable
          href={`${pdfBase}/${encodeURIComponent(c.file)}#page=${c.page}`}
          target="_blank"
          rel="noopener noreferrer"
        />
      ))}
    </Stack>
  );
}


