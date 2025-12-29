import { GoogleGenAI, Type } from "@google/genai";
import { Chunk, KnowledgeGraph } from '../types';

// Maximum character limit for a single request to prevent token overflow
const MAX_TEXT_INPUT_CHARS = 800000;

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// 1. PARSE: Clean text or OCR image
export const parseDocument = async (input: string, type: string): Promise<string> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview'; 
  
  let contents;
  if (type === 'image') {
    const base64Data = input.split(',')[1];
    const mimeType = input.split(';')[0].split(':')[1];
    contents = {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64Data } },
        { text: "Perform high-accuracy OCR on this image. Extract all readable text. Maintain logical order. Return ONLY extracted text without any conversational preamble or markdown." }
      ]
    };
  } else {
    const truncatedInput = input.length > MAX_TEXT_INPUT_CHARS 
      ? input.slice(0, MAX_TEXT_INPUT_CHARS) + "\n[...Text truncated due to size limits...]"
      : input;

    contents = {
      parts: [{
        text: `Clean, normalize, and fix any encoding errors in the following text. Preserve the original language and structure. Remove excessive whitespace.\n\nTEXT:\n${truncatedInput}`
      }]
    };
  }

  const response = await ai.models.generateContent({ model, contents });
  return response.text || "";
};

// 3. ENRICH: Add context to a chunk
export const enrichChunk = async (chunkText: string, fullDocSummary: string): Promise<{ context: string, keywords: string[], sentiment: string, entities: { people: string[], organizations: string[], locations: string[] } }> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview'; 

  const response = await ai.models.generateContent({
    model,
    contents: `
      You are a contextual enrichment engine for RAG pipelines.
      DOCUMENT CONTEXT: ${fullDocSummary}
      CURRENT SEGMENT: "${chunkText}"
      
      Analyze this segment. Provide:
      1. A one-sentence 'context' explaining how this fits into the overall document.
      2. Key 'keywords' (max 5).
      3. Overall 'sentiment'.
      4. Extracted 'entities' (people, organizations, locations).
      
      Return ONLY valid JSON.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          context: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          sentiment: { type: Type.STRING },
          entities: {
            type: Type.OBJECT,
            properties: {
              people: { type: Type.ARRAY, items: { type: Type.STRING } },
              organizations: { type: Type.ARRAY, items: { type: Type.STRING } },
              locations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["people", "organizations", "locations"]
          }
        },
        required: ["context", "keywords", "sentiment", "entities"],
        propertyOrdering: ["context", "keywords", "sentiment", "entities"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse JSON enrichment", e);
    return { 
      context: "Enrichment failed", 
      keywords: [], 
      sentiment: "Neutral",
      entities: { people: [], organizations: [], locations: [] }
    };
  }
};

// 4. SUMMARIZE CHUNK: Generate a specific summary for a single chunk
export const generateChunkSummary = async (chunkText: string, style: 'bullet' | 'executive' | 'technical' = 'bullet'): Promise<string> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
  
  const styleInstructions = {
    bullet: "a single concise bullet point highlighting the main takeaway",
    executive: "a professional, high-level summary paragraph (max 2 sentences)",
    technical: "a data-driven TL;DR focusing on specific facts, figures, and names"
  };

  const response = await ai.models.generateContent({
    model,
    contents: `Summarize this text segment in the style of ${styleInstructions[style]}:\n\n"${chunkText}"`
  });
  return response.text || "Summary failed.";
};

// 5. KNOWLEDGE GRAPH: Generate graph from chunks
export const generateKnowledgeGraph = async (chunks: Chunk[]): Promise<KnowledgeGraph> => {
  const ai = getAI();
  const model = 'gemini-3-pro-preview';
  
  const sampleSize = 30;
  const contextData = chunks.slice(0, sampleSize).map(c => `
    Segment: "${c.originalText.slice(0, 150)}..."
    Entities: ${JSON.stringify(c.entities || {})}
  `).join('\n---\n');

  const response = await ai.models.generateContent({
    model,
    contents: `Identify unique entities and the relationships between them based on these document segments. 
    
    CRITICAL INSTRUCTION: All node 'labels' and edge 'relations' MUST be in the same language as the source text segments. Do not translate them to English.
    
    Nodes should have a label and type. Edges should describe the relation. Return valid JSON.\n\nINPUT DATA:\n${contextData}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                type: { type: Type.STRING }
              },
              required: ["id", "label", "type"]
            }
          },
          edges: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                relation: { type: Type.STRING }
              },
              required: ["source", "target", "relation"]
            }
          }
        },
        required: ["nodes", "edges"],
        propertyOrdering: ["nodes", "edges"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{"nodes": [], "edges": []}');
  } catch (e) {
    console.error("Failed to parse KG", e);
    return { nodes: [], edges: [] };
  }
};

export const generateDocumentSummary = async (text: string): Promise<string> => {
  const ai = getAI();
  const model = 'gemini-3-flash-preview';
  const truncated = text.slice(0, 20000); 
  const response = await ai.models.generateContent({
    model,
    contents: `Provide a high-level two-sentence summary of this document to serve as context for segment-level analysis:\n\n${truncated}`
  });
  return response.text || "No summary available.";
}