import { GoogleGenAI, Type } from "@google/genai";
import { Chunk, KnowledgeGraph } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 1. PARSE: Clean text or OCR image
export const parseDocument = async (input: string, type: 'text' | 'image'): Promise<string> => {
  const model = 'gemini-3-flash-preview'; // Flash is fast for OCR/Parsing
  
  let contents;
  
  if (type === 'image') {
    // Input is expected to be base64 data URL
    const base64Data = input.split(',')[1];
    const mimeType = input.split(';')[0].split(':')[1];
    
    contents = {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        {
          text: "Perform OCR on this image. Extract all readable text efficiently. Return ONLY the extracted text in its original language (e.g. if Arabic, return Arabic). No markdown formatting blocks."
        }
      ]
    };
  } else {
    // Text input
    contents = {
      parts: [{
        text: `Clean and normalize the following text. Remove excessive whitespace, fix broken lines (if any). Return the clean text in its original language (do not translate). \n\nTEXT:\n${input}`
      }]
    };
  }

  const response = await ai.models.generateContent({
    model,
    contents,
  });

  return response.text || "";
};

// 2. CHUNK: Logic is usually deterministic code, but we can ask Gemini to do semantic chunking if we wanted. 
// For this app, we will use a deterministic helper, but here is a Gemini helper for enrichment.

// 3. ENRICH: Add context to a chunk
export const enrichChunk = async (chunkText: string, fullDocSummary: string): Promise<{ context: string, keywords: string[], sentiment: string, entities: { people: string[], organizations: string[], locations: string[] } }> => {
  const model = 'gemini-3-pro-preview'; // Pro for reasoning and context

  const response = await ai.models.generateContent({
    model,
    contents: `
      You are a contextual enrichment engine. 
      
      DOCUMENT SUMMARY: ${fullDocSummary}
      
      CURRENT CHUNK: "${chunkText}"
      
      Analyze the specific chunk in relation to the document summary.
      1. Detect the language of the chunk.
      2. Provide a brief 1-sentence "context" explaining what this chunk is about (IN THE SAME LANGUAGE as the chunk).
      3. Extract up to 3 key keywords (IN THE SAME LANGUAGE as the chunk).
      4. Determine the sentiment (Return exactly one of: Neutral, Positive, Negative, Informational).
      5. Extract named entities (People, Organizations, Locations) mentioned in the text (IN THE SAME LANGUAGE as the chunk).
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
        required: ["context", "keywords", "sentiment", "entities"]
      }
    }
  });

  const jsonStr = response.text || "{}";
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON enrichment", e);
    return { 
      context: "Analysis failed", 
      keywords: [], 
      sentiment: "Neutral",
      entities: { people: [], organizations: [], locations: [] }
    };
  }
};

// 4. SUMMARIZE CHUNK: Generate a specific summary for a single chunk
export const generateChunkSummary = async (chunkText: string): Promise<string> => {
  const model = 'gemini-3-flash-preview'; // Flash is sufficient for simple summarization
  
  const response = await ai.models.generateContent({
    model,
    contents: `Summarize the following text segment concisely in one or two bullet points. Write the summary in the SAME language as the text (e.g. if Arabic, write in Arabic):\n\n"${chunkText}"`
  });

  return response.text || "Could not generate summary.";
};

// 5. KNOWLEDGE GRAPH: Generate graph from chunks
export const generateKnowledgeGraph = async (chunks: Chunk[]): Promise<KnowledgeGraph> => {
  const model = 'gemini-3-pro-preview';
  
  // Combine extracted entities and text for context
  const contextData = chunks.map(c => `
    Text: "${c.originalText.slice(0, 200)}..."
    Entities Found: ${JSON.stringify(c.entities)}
  `).join('\n---\n');

  const response = await ai.models.generateContent({
    model,
    contents: `
      You are a Knowledge Graph generator.
      Analyze the provided text chunks and their extracted entities.
      
      Task:
      1. Identify unique entities (nodes) representing People, Organizations, Locations, or Concepts. Merge duplicates.
      2. Identify relationships (edges) between these entities based on the text.
      
      IMPORTANT: The 'label' for nodes and the 'relation' description for edges MUST be in the SAME language as the input text (e.g. Arabic if input is Arabic).
      
      INPUT DATA:
      ${contextData}
    `,
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
                id: { type: Type.STRING, description: "Unique snake_case identifier" },
                label: { type: Type.STRING, description: "Human readable name in original language" },
                type: { type: Type.STRING, description: "Person, Organization, Location, etc." }
              },
              required: ["id", "label", "type"]
            }
          },
          edges: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING, description: "id of the source node" },
                target: { type: Type.STRING, description: "id of the target node" },
                relation: { type: Type.STRING, description: "verb or relationship description in original language" }
              },
              required: ["source", "target", "relation"]
            }
          }
        },
        required: ["nodes", "edges"]
      }
    }
  });

  const jsonStr = response.text || '{"nodes": [], "edges": []}';
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse KG", e);
    return { nodes: [], edges: [] };
  }
};

// Helper to generate a quick summary of the whole doc for context injection
export const generateDocumentSummary = async (text: string): Promise<string> => {
  const model = 'gemini-3-flash-preview';
  // Truncate if too long for summary generation to save tokens/time
  const truncated = text.slice(0, 10000); 
  
  const response = await ai.models.generateContent({
    model,
    contents: `Summarize the following document in 2 sentences to provide high-level context. Write the summary in the SAME language as the document:\n\n${truncated}`
  });
  
  return response.text || "No context available.";
}