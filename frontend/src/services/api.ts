import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:4000/api',
});

export async function listDocuments(): Promise<string[]> {
  const { data } = await api.get('/documents');
  return (data?.documents ?? []) as string[];
}

export async function reindex(): Promise<void> {
  await api.post('/ingest/pdf-directory', {});
}

export const semanticSearch = async (q: string, documentId?: string, max: number = 5) => {
  const { data } = await api.get('/search', { params: { q, documentId, max } });
  return data.results as { key: string; documentId: string; pageNumber: number; text: string }[];
};

export const chatAsk = async (
  question: string,
  documentId?: string,
  maxResults: number = 6
) => {
  const { data } = await api.post('/chat', { question, documentId, maxResults });
  return data.answer as string;
};

export const chatWithHistory = async (
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  documentId?: string,
  maxResults: number = 6
) => {
  const { data } = await api.post('/chat', { messages, documentId, maxResults });
  return data.answer as string;
};

export default api;


