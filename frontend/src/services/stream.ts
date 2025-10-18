import api from './api';
export async function streamChat(
  body: any,
  onToken: (t: string) => void,
  onDone?: (full: string, extra?: any) => void,
  signal?: AbortSignal
) {
  const res = await fetch(`${api.defaults.baseURL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = JSON.parse(line.slice(5));
      if (payload.delta) {
        full += payload.delta;
        onToken(payload.delta);
      }
      if (payload.done) {
        onDone?.(full, { citations: payload.citations });
      }
      if (payload.error) {
        throw new Error(payload.error);
      }
    }
  }
  return full;
}


