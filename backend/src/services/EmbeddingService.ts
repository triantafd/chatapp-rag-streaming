import { OpenAI } from 'openai';

export class EmbeddingService {
  private client: OpenAI;
  private modelName: string;

  constructor(client: OpenAI, modelName: string = 'text-embedding-3-small') {
    this.client = client;
    this.modelName = modelName;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.modelName,
      input: texts,
    });
    return response.data.map((d) => d.embedding as number[]);
  }

  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    return vec;
  }
}








