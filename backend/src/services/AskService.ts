/** @format */

import { OpenAI } from "openai";
import { EmbeddingService } from "./EmbeddingService";
import { SemanticSearch } from "./SemanticSearch";

export class AskService {
  constructor(
    private embedder: EmbeddingService,
    private client: OpenAI,
    private chatModel: string = "gpt-4o-mini"
  ) {}

  private buildSystemPrompt(): string {
    return [
      "You are an assistant who answers questions about information you retrieve.",
      "Do not answer questions about anything else.",
      "Use only simple markdown to format your responses.",
      " Use the search tool to find relevant information. When you do this, end your",
      "reply with citations in the special XML format:",
      "<citation filename='string' page_number='number'>exact quote here</citation>",
      "Rules for citations:",
      "- Use the filename and page_number shown in the context header lines (doc: FILENAME p.PAGE). Do not guess.",
      "- The quote must be at most 5 words, copied verbatim from the cited context.",
      "- Emit the XML citations at the very end of your reply, with no surrounding text.",
      "- If the provided context is not relevant to the user's question or does not support your answer, do not emit citations.",
    ].join("\n");
  }

  async ask(
    question: string,
    documentId?: string,
    maxResults: number = 6,
    priorMessages?: { role: "user" | "assistant" | "system"; content: string }[]
  ) {
    const search = new SemanticSearch(this.embedder);
    const hits = await search.search(question, documentId, maxResults);
    const context = hits
      .map(
        (h: any, i: number) =>
          `[#${i + 1}] (doc: ${h.documentId} p.${h.pageNumber})\n${h.text}`
      )
      .join("\n\n");

    const systemPrompt = this.buildSystemPrompt();

    const windowed = priorMessages ? priorMessages.slice(-6) : [];
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...windowed,
      {
        role: "user" as const,
        content: `Question: ${question}\n\nContext:\n${context}`,
      },
    ];

    const res = await this.client.chat.completions.create({
      model: this.chatModel,
      messages,
      temperature: 0.2,
    });

    const answer = res.choices[0]?.message?.content?.trim() || "";
    return { answer, hits };
  }

  // Optional: tool-choice flow (mirrors .NET version using Search tool)
  async askWithToolChoice(
    question: string,
    documentId?: string,
    maxResults: number = 6,
    priorMessages: {
      role: "user" | "assistant" | "system";
      content: string;
    }[] = []
  ) {
    const systemPrompt = this.buildSystemPrompt();

    const windowed = priorMessages ? priorMessages.slice(-6) : [];

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "search",
          description:
            "Retrieve relevant document chunks for the user query. Use to ground answers with citations.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The user query to search for.",
              },
              documentId: { type: "string", nullable: true },
              maxResults: { type: "number", nullable: true },
            },
            required: ["query"],
            additionalProperties: false,
          },
        },
      },
    ];

    const first = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        { role: "system" as const, content: systemPrompt },
        ...windowed,
      ],
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    } as any);

    const choice = first.choices[0];
    const assistantToolMsg = (choice as any)?.message; // must include in follow-up
    const toolCalls: any[] = assistantToolMsg?.tool_calls || [];

    if (!toolCalls.length) {
      const content = assistantToolMsg?.content?.trim() || "";
      return { answer: content, hits: [] as any[] };
    }
    console.log(
      "[AskService] Function calling triggered:",
      toolCalls.map((tc: any) => tc?.function?.name || tc?.type)
    );
    // Execute tool calls (search) and continue
    const searchSvc = new SemanticSearch(this.embedder);
    const toolMessages: {
      role: "tool";
      name: string;
      tool_call_id: string;
      content: string;
    }[] = [];
    let lastHits: { documentId: string; pageNumber: number; text: string }[] =
      [];

    for (const tc of toolCalls) {
      if (tc.type === "function" && tc.function?.name === "search") {
        try {
          const args = JSON.parse(tc.function.arguments || "{}");
          const q = String(args.query || question || "").trim();
          const did = String(args.documentId || documentId || "") || undefined;
          const k = Number.isFinite(args.maxResults)
            ? Number(args.maxResults)
            : maxResults;
          const hits = q ? await searchSvc.search(q, did, k) : [];
          lastHits = hits.map((h: any) => ({
            documentId: h.documentId,
            pageNumber: h.pageNumber,
            text: h.text,
          }));
          const payload = {
            ok: true,
            results: lastHits,
          };
          toolMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: "search",
            content: JSON.stringify(payload),
          });
        } catch (e: any) {
          toolMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: "search",
            content: JSON.stringify({
              ok: false,
              error: String(e?.message || e),
            }),
          });
        }
      }
    }

    const second = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        { role: "system" as const, content: systemPrompt },
        ...windowed,
        assistantToolMsg as any,
        ...(toolMessages as any),
      ],
      temperature: 0.2,
    });
    const answer = second.choices[0]?.message?.content?.trim() || "";
    return { answer, hits: lastHits };
  }
}
