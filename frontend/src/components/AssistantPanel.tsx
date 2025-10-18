import React from 'react';
import { Paper, Typography } from '@mui/material';
import Citations from './Citations';

function stripCitationXml(text: string): string {
  if (!text) return text;
  return text.replace(/<citation\b[^>]*>[^<]*<\/citation>/g, '').trim();
}

export default function AssistantPanel({ answer }: { answer: string }) {
  const display = stripCitationXml(answer);
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" gutterBottom>Assistant</Typography>
      <Typography whiteSpace="pre-wrap">{display || 'No answer yet'}</Typography>
      <Citations answer={answer} />
    </Paper>
  );
}


