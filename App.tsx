import React, { useState, useEffect } from 'react';
import { DocumentState, ProcessingStage, Chunk, AIConfig } from './types';
import { parseDocument, enrichChunk, generateDocumentSummary, generateKnowledgeGraph, generateChunkSummary } from './services/aiService';
import PipelineVisualizer from './components/PipelineVisualizer';
import InputSection from './components/InputSection';
import ChunkCard from './components/ChunkCard';
import KnowledgeGraphViewer from './components/KnowledgeGraphViewer';
import { Bot, Terminal, Activity, Layers, Download, Network, Share2, Loader2, Search, Eye, Settings, X, Server, Cloud } from 'lucide-react';

const App: React.FC = () => {
  const [stage, setStage] = useState<ProcessingStage>(ProcessingStage.IDLE);
  const [docState, setDocState] = useState<DocumentState>({
    rawInput: null,
    inputType: 'text',
    parsedText: '',
    chunks: [],
    stats: { originalLength: 0, chunkCount: 0, processingTimeMs: 0 },
    knowledgeGraph: undefined
  });
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGraph, setShowGraph] = useState(false);
  
  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3'
  });
  const [showSettings, setShowSettings] = useState(false);

  // Constants
  const CHUNK_SIZE = 300; 

  const handleInput = async (data: string, type: 'text' | 'image') => {
    setStage(ProcessingStage.PARSING);
    setError(null);
    setSearchQuery('');
    setDocState(prev => ({ 
        ...prev, 
        rawInput: data, 
        inputType: type, 
        chunks: [], 
        parsedText: '',
        knowledgeGraph: undefined 
    }));
    setShowGraph(false);

    const startTime = Date.now();

    try {
      // 1. Parse
      const parsedText = await parseDocument(data, type, aiConfig);
      setDocState(prev => ({ ...prev, parsedText }));
      
      // 2. Chunk
      setStage(ProcessingStage.CHUNKING);
      await new Promise(r => setTimeout(r, 800)); 
      
      const rawChunks = performChunking(parsedText, CHUNK_SIZE);
      const initialChunks: Chunk[] = rawChunks.map((text, idx) => ({
        id: `chk_${Date.now()}_${idx}`,
        originalText: text
      }));
      
      setDocState(prev => ({ 
        ...prev, 
        chunks: initialChunks,
        stats: { ...prev.stats, originalLength: parsedText.length, chunkCount: initialChunks.length }
      }));

      // 3. Enrich
      setStage(ProcessingStage.ENRICHING);
      
      // Context Summary
      const docSummary = await generateDocumentSummary(parsedText, aiConfig);
      
      const enrichedChunks = [...initialChunks];
      for (let i = 0; i < enrichedChunks.length; i++) {
        // Limit for demo unless local (local is free but slow, still limit to keep UI responsive)
        if (i >= 5) break; 

        const enrichment = await enrichChunk(enrichedChunks[i].originalText, docSummary, aiConfig);
        enrichedChunks[i] = {
            ...enrichedChunks[i],
            enrichedContext: enrichment.context,
            keywords: enrichment.keywords,
            sentiment: enrichment.sentiment,
            entities: enrichment.entities
        };
        
        setDocState(prev => ({ ...prev, chunks: [...enrichedChunks] }));
      }

      const totalTime = Date.now() - startTime;
      setDocState(prev => ({ 
          ...prev, 
          stats: { ...prev.stats, processingTimeMs: totalTime }
      }));
      setStage(ProcessingStage.COMPLETE);

    } catch (err: any) {
      console.error(err);
      let msg = "An error occurred during pipeline processing.";
      if (aiConfig.provider === 'ollama' && err.message.includes('Failed to fetch')) {
        msg = "Failed to connect to Ollama. Ensure Ollama is running and OLLAMA_ORIGINS=\"*\" is set.";
      }
      setError(msg);
      setStage(ProcessingStage.ERROR);
    }
  };

  const performChunking = (text: string, size: number): string[] => {
    const chunks = [];
    for (let i = 0; i < text.length; i += size) {
        chunks.push(text.slice(i, i + size));
    }
    return chunks;
  };

  const handleGenerateGraph = async () => {
    if (docState.chunks.length === 0) return;
    setIsGeneratingGraph(true);
    try {
        const graph = await generateKnowledgeGraph(docState.chunks, aiConfig);
        setDocState(prev => ({ ...prev, knowledgeGraph: graph }));
        setShowGraph(true); 
    } catch (e) {
        console.error(e);
        setError("Failed to generate Knowledge Graph.");
    } finally {
        setIsGeneratingGraph(false);
    }
  };

  const handleSummarizeChunk = async (chunkId: string) => {
    const chunkIndex = docState.chunks.findIndex(c => c.id === chunkId);
    if (chunkIndex === -1) return;

    try {
        const summary = await generateChunkSummary(docState.chunks[chunkIndex].originalText, aiConfig);
        setDocState(prev => {
            const newChunks = [...prev.chunks];
            newChunks[chunkIndex] = { ...newChunks[chunkIndex], summary };
            return { ...prev, chunks: newChunks };
        });
    } catch (e) {
        console.error("Summarization failed", e);
    }
  };

  const handleExport = () => {
    if (docState.chunks.length === 0) return;
    const exportData = {
        metadata: {
            timestamp: new Date().toISOString(),
            stats: docState.stats,
            sourceType: docState.inputType,
            provider: aiConfig.provider
        },
        chunks: docState.chunks,
        knowledgeGraph: docState.knowledgeGraph
    };
    downloadJson(exportData, `contextual-pipeline-${Date.now()}.json`);
  };

  const handleExportGraph = () => {
    if (!docState.knowledgeGraph) return;
    downloadJson(docState.knowledgeGraph, `knowledge-graph-${Date.now()}.json`);
  };

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredChunks = docState.chunks.filter(chunk => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
        chunk.originalText.toLowerCase().includes(q) ||
        (chunk.enrichedContext && chunk.enrichedContext.toLowerCase().includes(q)) ||
        (chunk.keywords && chunk.keywords.some(k => k.toLowerCase().includes(q))) ||
        (chunk.entities && (
            chunk.entities.people.some(e => e.toLowerCase().includes(q)) ||
            chunk.entities.organizations.some(e => e.toLowerCase().includes(q)) ||
            chunk.entities.locations.some(e => e.toLowerCase().includes(q))
        ))
    );
  });

  return (
    <div className="min-h-screen bg-brand-dark p-4 md:p-8 font-sans selection:bg-brand-accent/30 selection:text-brand-accent">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="flex items-center gap-4 mb-10 border-b border-slate-800 pb-6">
          <div className="bg-brand-accent/10 p-3 rounded-xl border border-brand-accent/20">
             <Bot className="w-8 h-8 text-brand-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Contextual Document Pipeline</h1>
            <p className="text-slate-400 text-sm">Parsing, chunking, and semantic enrichment.</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-4">
             <div className="flex gap-4 text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1"><Terminal size={14}/> v1.1.0</span>
                <span className="flex items-center gap-1 text-green-500"><Activity size={14}/> ONLINE</span>
             </div>
             <button 
                onClick={() => setShowSettings(true)}
                className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="AI Settings"
             >
                <Settings size={18} />
             </button>
          </div>
        </header>

        {/* Settings Modal */}
        {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-brand-panel border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <h3 className="font-semibold text-white flex items-center gap-2"><Settings size={18} /> AI Configuration</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">AI Provider</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setAiConfig(prev => ({...prev, provider: 'gemini'}))}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${aiConfig.provider === 'gemini' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <Cloud size={18} /> Google Gemini
                                </button>
                                <button 
                                    onClick={() => setAiConfig(prev => ({...prev, provider: 'ollama'}))}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${aiConfig.provider === 'ollama' ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <Server size={18} /> Local Ollama
                                </button>
                            </div>
                        </div>

                        {aiConfig.provider === 'ollama' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Ollama Endpoint</label>
                                    <input 
                                        type="text" 
                                        value={aiConfig.ollamaUrl}
                                        onChange={(e) => setAiConfig(prev => ({...prev, ollamaUrl: e.target.value}))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Model Name</label>
                                    <input 
                                        type="text" 
                                        value={aiConfig.ollamaModel}
                                        onChange={(e) => setAiConfig(prev => ({...prev, ollamaModel: e.target.value}))}
                                        placeholder="llama3, mistral, llava..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Note: For image OCR, ensure you use a vision model like <code>llava</code>. 
                                        Also ensure <code>OLLAMA_ORIGINS="*"</code> is set.
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <div className="pt-2 border-t border-slate-700 text-right">
                             <button onClick={() => setShowSettings(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                                 Save & Close
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <PipelineVisualizer stage={stage} />

        <InputSection 
            onInput={handleInput} 
            disabled={stage === ProcessingStage.PARSING || stage === ProcessingStage.CHUNKING || stage === ProcessingStage.ENRICHING || isGeneratingGraph} 
        />

        {(stage !== ProcessingStage.IDLE) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                 <div className="bg-brand-panel p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Parsed Length</div>
                    <div className="text-2xl font-mono text-white">{docState.stats.originalLength} <span className="text-sm text-slate-600">chars</span></div>
                 </div>
                 <div className="bg-brand-panel p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Total Chunks</div>
                    <div className="text-2xl font-mono text-brand-accent">{docState.stats.chunkCount}</div>
                 </div>
                 <div className="bg-brand-panel p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Status</div>
                    <div className="text-xl font-medium text-white flex items-center justify-between">
                        {stage === ProcessingStage.COMPLETE ? (
                            <span className="text-green-400">Done ({docState.stats.processingTimeMs}ms)</span>
                        ) : (
                            <span className="animate-pulse text-brand-blue">{stage}...</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${aiConfig.provider === 'ollama' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                            {aiConfig.provider}
                        </span>
                    </div>
                 </div>
            </div>
        )}

        {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-8 text-sm flex items-start gap-3">
                <div className="mt-0.5">⚠️</div>
                <div>{error}</div>
            </div>
        )}

        {stage === ProcessingStage.COMPLETE && (
            <div className="mb-8 p-4 bg-slate-900/50 border border-slate-800 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Network className="text-purple-400" size={24} />
                    <div>
                         <h3 className="font-semibold text-white">Knowledge Graph</h3>
                         <p className="text-sm text-slate-400">Convert processed chunks into a structured node-edge graph.</p>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    {!docState.knowledgeGraph ? (
                        <button 
                            onClick={handleGenerateGraph}
                            disabled={isGeneratingGraph}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {isGeneratingGraph ? <Loader2 size={16} className="animate-spin" /> : <Network size={16} />}
                            {isGeneratingGraph ? 'Analyzing Relations...' : 'Generate Graph'}
                        </button>
                    ) : (
                         <div className="flex items-center gap-4">
                             <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 hidden md:block">
                                <span className="text-purple-400 font-bold">{docState.knowledgeGraph.nodes.length}</span> Nodes • <span className="text-purple-400 font-bold">{docState.knowledgeGraph.edges.length}</span> Edges
                             </div>
                             
                             <button 
                                onClick={() => setShowGraph(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
                             >
                                <Eye size={16} />
                                Visualize
                             </button>

                             <button 
                                onClick={handleExportGraph}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-700 transition-colors"
                             >
                                <Share2 size={16} className="text-purple-400" />
                                <span className="hidden sm:inline">Export JSON</span>
                             </button>
                         </div>
                    )}
                </div>
            </div>
        )}

        {docState.chunks.length > 0 && (
            <div className="animate-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-2">
                        <Layers className="text-brand-accent" />
                        <h2 className="text-xl font-bold text-white">Contextual Chunks</h2>
                        {searchQuery && <span className="text-slate-500 text-sm">({filteredChunks.length} results)</span>}
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Filter chunks..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-300 pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-accent/50 transition-all placeholder:text-slate-600"
                            />
                        </div>
                        
                        <button 
                            onClick={handleExport}
                            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-brand-text px-4 py-2 rounded-lg border border-slate-700 hover:border-brand-accent/50 transition-all text-sm group whitespace-nowrap"
                        >
                            <Download size={16} className="text-slate-400 group-hover:text-brand-accent" />
                            <span className="hidden sm:inline">Export JSON</span>
                            <span className="sm:hidden">Export</span>
                        </button>
                    </div>
                </div>

                {filteredChunks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredChunks.map((chunk) => (
                            <ChunkCard 
                                key={chunk.id} 
                                chunk={chunk} 
                                index={docState.chunks.indexOf(chunk)}
                                onSummarize={handleSummarizeChunk} 
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">
                        <p className="text-slate-500">No chunks match your search.</p>
                    </div>
                )}
                
                {docState.chunks.length >= 5 && stage === ProcessingStage.COMPLETE && (
                    <div className="mt-8 text-center text-slate-500 text-sm">
                        * Demo limited to enriching first 5 chunks to conserve resources.
                    </div>
                )}
            </div>
        )}

        {showGraph && docState.knowledgeGraph && (
            <KnowledgeGraphViewer 
                data={docState.knowledgeGraph} 
                onClose={() => setShowGraph(false)} 
            />
        )}
      </div>
    </div>
  );
};

export default App;