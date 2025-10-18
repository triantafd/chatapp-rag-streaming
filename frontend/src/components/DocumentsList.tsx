import React, { useEffect, useState } from 'react';
import { Box, Chip, Stack, Typography, Button } from '@mui/material';
import { listDocuments, reindex } from '../services/api';

export default function DocumentsList({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (doc?: string) => void;
}) {
  const [docs, setDocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await listDocuments();
      setDocs(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleReindex = async () => {
    setLoading(true);
    try {
      await reindex();
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h6">Documents</Typography>
        <Button size="small" variant="outlined" onClick={handleReindex} disabled={loading}>
          Re-index
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label="All" color={!selected ? 'primary' : 'default'} onClick={() => onSelect(undefined)} />
        {docs.map((d) => (
          <Chip
            key={d}
            label={d}
            color={selected === d ? 'primary' : 'default'}
            onClick={() => onSelect(d)}
          />
        ))}
        {docs.length === 0 && <Typography variant="body2" color="text.secondary">No PDFs found</Typography>}
      </Stack>
    </Box>
  );
}


