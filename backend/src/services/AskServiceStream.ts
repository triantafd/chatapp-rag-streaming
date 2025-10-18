import { OpenAI } from 'openai';
import { EmbeddingService } from './EmbeddingService';
import { SemanticSearch } from './SemanticSearch';

export class AskServiceStream {
  constructor(private embedder: EmbeddingService, private client: OpenAI, private chatModel: string) {}

  async buildMessages(
    latestUserQuestion: string,
    documentId: string | undefined,
    maxResults: number,
    priorMessages?: { role: 'user' | 'assistant' | 'system'; content: string }[]
  ) {
    const search = new SemanticSearch(this.embedder);
    const hits = await search.search(latestUserQuestion, documentId, maxResults);
    const context = hits
      .map((h: any, i: number) => `[#${i + 1}] (doc: ${h.documentId} p.${h.pageNumber})\n${h.text}`)
      .join('\n\n');

    const systemPrompt = [
      'You are an assistant who answers questions about information you retrieve.',
      'Do not answer questions about anything else.',
      'Use only simple markdown to format your responses.',
      " Use the search tool to find relevant information. When you do this, end your",
      "reply with citations in the special XML format:",
      "<citation filename='string' page_number='number'>exact quote here</citation>",
      'Rules for citations:',
      '- Use the filename and page_number shown in the context header lines (doc: FILENAME p.PAGE). Do not guess.',
      '- The quote must be at most 5 words, copied verbatim from the cited context.',
      '- Emit the XML citations at the very end of your reply, with no surrounding text.',
      "- If the provided context is not relevant to the user's question or does not support your answer, do not emit citations.",
    ].join('\n');

    const windowed = priorMessages ? priorMessages.slice(-6) : [];
    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...windowed,
      { role: 'user' as const, content: `Question: ${latestUserQuestion}\n\nContext:\n${context}` },
    ];
    return { llmMessages, hits };
  }
}


