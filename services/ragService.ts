
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini for Embeddings
let aiInstance: GoogleGenAI | null = null;

const getGeminiApiKey = () => {
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
  const fallbackKey = import.meta.env.GEMINI_API_KEY;
  return viteKey || fallbackKey || '';
};

const getAI = () => {
  if (!aiInstance) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("Gemini API key is not configured. RAG features are disabled until a key is provided.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

interface VectorDocument {
  id: string;
  text: string;
  metadata: any;
  embedding: number[];
  timestamp: number;
}

class SimpleVectorStore {
  private documents: VectorDocument[] = [];
  
  // Cosine Similarity Algorithm
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async addDocument(text: string, metadata: any = {}) {
    try {
      const ai = getAI();
      // Generate Embedding using Gemini
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: { parts: [{ text }] }
      });

      const embedding = response.embeddings?.[0]?.values;
      
      if (embedding) {
          const doc: VectorDocument = {
              id: Date.now().toString() + Math.random().toString(),
              text,
              metadata,
              embedding,
              timestamp: Date.now()
          };
          this.documents.push(doc);
          console.log(`[RAG] Ingested document: "${text.substring(0, 50)}..."`);
      }
    } catch (e) {
      console.error("[RAG] Failed to generate embedding", e);
    }
  }

  async search(query: string, limit: number = 3): Promise<VectorDocument[]> {
    if (this.documents.length === 0) return [];

    try {
        const ai = getAI();
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: { parts: [{ text: query }] }
        });

        const queryEmbedding = response.embeddings?.[0]?.values;
        if (!queryEmbedding) return [];

        // Calculate scores
        const scoredDocs = this.documents.map(doc => ({
            ...doc,
            score: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        // Sort by score desc and take top K
        // Filter out low relevance (optional threshold 0.4)
        return scoredDocs
            .filter(d => d.score > 0.45) 
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

    } catch (e) {
        console.error("[RAG] Search failed", e);
        return [];
    }
  }

  getStats() {
      return { count: this.documents.length };
  }
}

export const vectorStore = new SimpleVectorStore();
