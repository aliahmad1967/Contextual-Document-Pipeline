import { Chunk, KnowledgeGraph } from '../types';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// More robust JSON cleaning to handle model chatter
const cleanJson = (text: string): string => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
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
   let prompt = `Clean and normalize the following text. Return only the clean text.\n\nTEXT:\n${input}`;
   let images: string[] = [];
   if (type === 'image') {
      const base64Data = input.split(',')[1];
      images = [base64Data];
      prompt = "Extract all text from this image. Return ONLY the text.";
   }
   return callOllama(url, model, prompt, images);
};

export const ollamaEnrich = async (chunkText: string, fullDocSummary: string, url: string, model: string) => {
    const prompt = `Return valid JSON describing this chunk's context, keywords (3), sentiment, and entities (people, organizations, locations). Summary: ${fullDocSummary}. Chunk: "${chunkText}"`;
    const response = await callOllama(url, model, prompt, [], true);
    try {
        return JSON.parse(cleanJson(response));
    } catch(e) {
        console.error("JSON Parse Error (Enrich)", e, response);
        return { context: "Analysis failed", keywords: [], sentiment: "Neutral", entities: { people: [], organizations: [], locations: [] } };
    }
};

export const ollamaGenerateChunkSummary = async (chunkText: string, url: string, model: string, style: 'bullet' | 'executive' | 'technical' = 'bullet'): Promise<string> => {
    const stylePrompt = {
        bullet: "a single bullet point",
        executive: "a professional paragraph",
        technical: "a data-heavy TL;DR"
    };
    const prompt = `Summarize this text concisely as ${stylePrompt[style]}:\n\n"${chunkText}"`;
    return callOllama(url, model, prompt);
};

export const ollamaGenerateDocumentSummary = async (text: string, url: string, model: string): Promise<string> => {
    const truncated = text.slice(0, 4000); 
    const prompt = `Summarize in 2 sentences:\n\n${truncated}`;
    return callOllama(url, model, prompt);
};

export const ollamaGenerateKnowledgeGraph = async (chunks: Chunk[], url: string, model: string): Promise<KnowledgeGraph> => {
  const contextData = chunks.slice(0, 15).map(c => `Text: "${c.originalText.slice(0, 150)}..." Entities: ${JSON.stringify(c.entities)}`).join('\n---\n');
  const prompt = `Identify nodes (id, label, type) and edges (source, target, relation) from this data. 
  
  IMPORTANT: All node 'label' fields and edge 'relation' fields MUST remain in the same language as the source text. Do not translate them to English. 
  
  Return JSON only. \n\nDATA:\n${contextData}`;
  const response = await callOllama(url, model, prompt, [], true);
  try {
    return JSON.parse(cleanJson(response));
  } catch (e) {
    console.error("JSON Parse Error (Graph)", e, response);
    return { nodes: [], edges: [] };
  }
};