import React, { useMemo, useState } from 'react';
import { Container, Button, Stack, Typography, Paper, } from '@mui/material';
import Grid from '@mui/material/Grid';
import { semanticSearch, reindex, chatWithHistory } from './services/api';
import { streamChat } from './services/stream';
import AskSearchPanel from './components/AskSearchPanel';
import AssistantPanel from './components/AssistantPanel';
import SearchResults from './components/SearchResults';
import DocumentsList from './components/DocumentsList';

function App() {
  const [query, setQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<string | undefined>(undefined);
  const [answer, setAnswer] = useState('');
  const [searchResults, setSearchResults] = useState<{ key: string; documentId: string; pageNumber: number; text: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([]);
  const [streaming, setStreaming] = useState(true);
  const canSend = useMemo(() => query.trim().length > 0, [query]);

  const handleSend = async () => {
    setIsChatting(true);
    try {
      const next = [...messages, { role: 'user' as const, content: query }];
      setMessages(next);
      setAnswer('');
      const windowed = next.slice(-6);
      if (streaming) {
        await streamChat(
          { messages: windowed, documentId: selectedDoc, maxResults: 6 },
          (t) => setAnswer((prev) => prev + t),
          (full) => setMessages((prev) => [...prev, { role: 'assistant' as const, content: full }])
        );
      } else {
        const ans = await chatWithHistory(windowed, selectedDoc, 6);
        setAnswer(ans);
        setMessages(prev => [...prev, { role: 'assistant' as const, content: ans }]);
      }
    } finally {
      setIsChatting(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await semanticSearch(query, selectedDoc);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleIngest = async () => {
    await reindex();
    alert('Re-index requested');
  };

  const handleClear = () => {
    setQuery('');
    setAnswer('');
    setSearchResults([]);
    setMessages([]);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>ChatApp RAG (React + Node)</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <DocumentsList selected={selectedDoc} onSelect={setSelectedDoc} />
            <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={handleIngest}>Re-index</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            <AskSearchPanel
              query={query}
              onChangeQuery={setQuery}
              onSearch={handleSearch}
              onChat={handleSend}
              streaming={streaming}
              onToggleStreaming={setStreaming}
              onClear={handleClear}
              isSearching={isSearching}
              isChatting={isChatting}
              disabled={!canSend}
            />

            <AssistantPanel answer={answer} />

            <SearchResults results={searchResults} selectedDoc={selectedDoc} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App;
