export enum ProcessingStage {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  CHUNKING = 'CHUNKING',
  ENRICHING = 'ENRICHING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface Entities {
  people: string[];
  organizations: string[];
  locations: string[];
}

export interface Chunk {
  id: string;
  originalText: string;
  enrichedContext?: string;
  keywords?: string[];
  sentiment?: string;
  entities?: Entities;
  summary?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PipelineStats {
  originalLength: number;
  chunkCount: number;
  processingTimeMs: number;
}

export interface DocumentState {
  rawInput: string | null; // Text or base64 image
  inputType: 'text' | 'image';
  parsedText: string;
  chunks: Chunk[];
  stats: PipelineStats;
  knowledgeGraph?: KnowledgeGraph;
}

export type AIProvider = 'gemini' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  ollamaUrl: string;
  ollamaModel: string;
}