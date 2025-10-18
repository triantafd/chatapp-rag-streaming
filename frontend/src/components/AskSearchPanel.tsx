import React from 'react';
import { Paper, Stack, TextField, Button, Typography, CircularProgress, Box, FormControlLabel, Switch } from '@mui/material';

export default function AskSearchPanel({
  query,
  onChangeQuery,
  onSearch,
  onChat,
  streaming,
  onToggleStreaming,
  onClear,
  isSearching,
  isChatting,
  disabled,
}: {
  query: string;
  onChangeQuery: (v: string) => void;
  onSearch: () => void;
  onChat: () => void;
  streaming: boolean;
  onToggleStreaming: (v: boolean) => void;
  onClear: () => void;
  isSearching: boolean;
  isChatting: boolean;
  disabled: boolean;
}) {
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" gutterBottom>Ask & Search</Typography>
        <FormControlLabel
          control={<Switch checked={streaming} onChange={(e) => onToggleStreaming(e.target.checked)} />}
          label="Streaming"
        />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }}>
        <TextField fullWidth label="Query" value={query} onChange={(e) => onChangeQuery(e.target.value)} />
        <Stack direction="row" spacing={0} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1, columnGap: 2 }}>
          <Button
            variant="outlined"
            onClick={onSearch}
            disabled={disabled || isSearching}
            sx={{ minWidth: { xs: 'auto', sm: 110, md: 130 } }}
          >
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              {isSearching && <CircularProgress size={16} color="inherit" />}
              {isSearching ? 'Searching…' : 'Search'}
            </Box>
          </Button>
          <Button
            variant="contained"
            onClick={onChat}
            disabled={disabled || isChatting}
            sx={{ minWidth: { xs: 'auto', sm: 110, md: 130 } }}
          >
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              {isChatting && <CircularProgress size={16} color="inherit" />}
              {isChatting ? 'Chatting…' : 'Chat'}
            </Box>
          </Button>
          <Button variant="text" color="warning" onClick={onClear}>Clear</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}


