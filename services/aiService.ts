import { AIConfig, Chunk, KnowledgeGraph } from '../types';
import * as gemini from './geminiService';
import * as ollama from './ollamaService';

export const parseDocument = async (input: string, type: 'text' | 'image', config: AIConfig): Promise<string> => {
  if (config.provider === 'ollama') {
    return ollama.ollamaParse(input, type, config.ollamaUrl, config.ollamaModel);
  }
  return gemini.parseDocument(input, type);
};

export const enrichChunk = async (chunkText: string, fullDocSummary: string, config: AIConfig) => {
  if (config.provider === 'ollama') {
    return ollama.ollamaEnrich(chunkText, fullDocSummary, config.ollamaUrl, config.ollamaModel);
  }
  return gemini.enrichChunk(chunkText, fullDocSummary);
};

export const generateChunkSummary = async (chunkText: string, config: AIConfig): Promise<string> => {
  if (config.provider === 'ollama') {
    return ollama.ollamaGenerateChunkSummary(chunkText, config.ollamaUrl, config.ollamaModel);
  }
  return gemini.generateChunkSummary(chunkText);
};

export const generateDocumentSummary = async (text: string, config: AIConfig): Promise<string> => {
  if (config.provider === 'ollama') {
    return ollama.ollamaGenerateDocumentSummary(text, config.ollamaUrl, config.ollamaModel);
  }
  return gemini.generateDocumentSummary(text);
};

export const generateKnowledgeGraph = async (chunks: Chunk[], config: AIConfig): Promise<KnowledgeGraph> => {
  if (config.provider === 'ollama') {
    return ollama.ollamaGenerateKnowledgeGraph(chunks, config.ollamaUrl, config.ollamaModel);
  }
  return gemini.generateKnowledgeGraph(chunks);
};
