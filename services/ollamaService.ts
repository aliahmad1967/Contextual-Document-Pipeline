import { Chunk, KnowledgeGraph } from '../types';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// Helper to strip Markdown code blocks if the model includes them despite format: json
const cleanJson = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

async function callOllama(url: string, model: string, prompt: string, images: string[] = [], json = false) {
  try {
    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: json ? 'json' : undefined,
        images: images.length > 0 ? images : undefined,
      }),
    });

    if (!response.ok) {
       throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Ollama Call Failed", error);
    throw error;
  }
}

export const ollamaParse = async (input: string, type: 'text' | 'image', url: string, model: string): Promise<string> => {
   let prompt = `Clean and normalize the following text. Remove excessive whitespace. Return only the clean text. \n\nTEXT:\n${input}`;
   let images: string[] = [];

   if (type === 'image') {
      const base64Data = input.split(',')[1];
      images = [base64Data];
      prompt = "Extract all text from this image. Return ONLY the text. Do not describe the image, just output the text found inside it.";
   }

   return callOllama(url, model, prompt, images);
};

export const ollamaEnrich = async (chunkText: string, fullDocSummary: string, url: string, model: string) => {
    const prompt = `
      You are a contextual enrichment engine.
      DOCUMENT SUMMARY: ${fullDocSummary}
      CURRENT CHUNK: "${chunkText}"

      Analyze the chunk. Return a JSON object with these fields:
      - context: (string) Brief 1-sentence context.
      - keywords: (array of strings) Up to 3 keywords.
      - sentiment: (string) Neutral, Positive, Negative, or Informational.
      - entities: (object) with fields "people", "organizations", "locations" (all arrays of strings).

      Ensure valid JSON output.
    `;
    
    const response = await callOllama(url, model, prompt, [], true);
    try {
        return JSON.parse(cleanJson(response));
    } catch(e) {
        console.error("JSON Parse Error (Enrich)", e, response);
        return { 
            context: "Analysis failed", 
            keywords: [], 
            sentiment: "Neutral", 
            entities: { people: [], organizations: [], locations: [] } 
        };
    }
};

export const ollamaGenerateChunkSummary = async (chunkText: string, url: string, model: string): Promise<string> => {
    const prompt = `Summarize the following text segment concisely in one or two bullet points:\n\n"${chunkText}"`;
    return callOllama(url, model, prompt);
};

export const ollamaGenerateDocumentSummary = async (text: string, url: string, model: string): Promise<string> => {
    // Truncate to avoid context window issues with smaller local models
    const truncated = text.slice(0, 4000); 
    const prompt = `Summarize the following document in 2 sentences to provide high-level context:\n\n${truncated}`;
    return callOllama(url, model, prompt);
};

export const ollamaGenerateKnowledgeGraph = async (chunks: Chunk[], url: string, model: string): Promise<KnowledgeGraph> => {
  const contextData = chunks.slice(0, 15).map(c => `
    Text: "${c.originalText.slice(0, 150)}..."
    Entities Found: ${JSON.stringify(c.entities)}
  `).join('\n---\n');

  const prompt = `
    You are a Knowledge Graph generator.
    Analyze the provided text chunks and their extracted entities.
    
    Task:
    1. Identify unique entities (nodes) representing People, Organizations, Locations, or Concepts. Merge duplicates.
    2. Identify relationships (edges) between these entities.
    
    Return a JSON object with "nodes" (id, label, type) and "edges" (source, target, relation).
    Nodes 'id' should be snake_case.
    
    INPUT DATA:
    ${contextData}
  `;

  const response = await callOllama(url, model, prompt, [], true);
  
  try {
    const json = JSON.parse(cleanJson(response));
    // Basic validation
    if (!json.nodes || !json.edges) throw new Error("Invalid graph structure");
    return json;
  } catch (e) {
    console.error("JSON Parse Error (Graph)", e, response);
    return { nodes: [], edges: [] };
  }
};
