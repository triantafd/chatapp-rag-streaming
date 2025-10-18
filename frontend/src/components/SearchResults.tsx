import React from 'react';
import { Paper, Typography, Divider, Stack } from '@mui/material';

export default function SearchResults({
  results,
  selectedDoc,
}: {
  results: { key: string; documentId: string; pageNumber: number; text: string }[];
  selectedDoc?: string;
}) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Semantic Search Results{selectedDoc ? ` (filtered: ${selectedDoc})` : ''}
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Stack spacing={1}>
        {results.map((r) => (
          <Paper key={r.key} sx={{ p: 1 }}>
            <Typography variant="caption">doc: {r.documentId} page: {r.pageNumber}</Typography>
            <Typography variant="body2" whiteSpace="pre-wrap">{r.text.slice(0, 500)}</Typography>
          </Paper>
        ))}
        {results.length === 0 && (
          <Typography variant="body2" color="text.secondary">No results</Typography>
        )}
      </Stack>
    </Paper>
  );
}


