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
  // A single SSE event can span several network reads, so buffer until the
  // blank line ("\n\n") that terminates each event before parsing it.
  let buffer = '';

  const handleEvent = (event: string) => {
    const data = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5))
      .join('\n');
    if (!data.trim()) return;
    const payload = JSON.parse(data);
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
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      handleEvent(event);
    }
  }
  buffer += dec.decode();
  if (buffer.trim()) handleEvent(buffer);
  return full;
}
