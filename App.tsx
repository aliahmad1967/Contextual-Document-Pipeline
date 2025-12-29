import React, { useState, useRef, useMemo } from 'react';
import { DocumentState, ProcessingStage, Chunk, AIConfig, InputType } from './types';
import { parseDocument, enrichChunk, generateDocumentSummary, generateKnowledgeGraph, generateChunkSummary } from './services/aiService';
import { extractTextFromPdf, extractTextFromEpub } from './services/fileProcessingService';
import PipelineVisualizer from './components/PipelineVisualizer';
import InputSection from './components/InputSection';
import ChunkCard from './components/ChunkCard';
import KnowledgeGraphViewer from './components/KnowledgeGraphViewer';
import { Bot, Terminal, Activity, Layers, Download, Network, Share2, Loader2, Search, Eye, Settings, X, Server, Cloud, AlertCircle, StopCircle, RefreshCw, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [stage, setStage] = useState<ProcessingStage>(ProcessingStage.IDLE);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });
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
  const [isSummarizingAll, setIsSummarizingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGraph, setShowGraph] = useState(false);
  
  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3'
  });
  const [showSettings, setShowSettings] = useState(false);

  // Cancellation Support
  const cancellationRef = useRef<boolean>(false);

  // Constants
  const CHUNK_SIZE = 500; 
  const MAX_CHAR_LIMIT = 1000000; 

  const handleCancel = () => {
    cancellationRef.current = true;
    setError("Processing interrupted by user.");
    setStage(ProcessingStage.ERROR);
    setIsSummarizingAll(false);
  };

  const resetPipeline = () => {
    setStage(ProcessingStage.IDLE);
    setDocState({
        rawInput: null,
        inputType: 'text',
        parsedText: '',
        chunks: [],
        stats: { originalLength: 0, chunkCount: 0, processingTimeMs: 0 },
        knowledgeGraph: undefined
    });
    setError(null);
  };

  const handleInput = async (data: string | File, type: InputType) => {
    if (type === 'text' && typeof data === 'string' && data.length > MAX_CHAR_LIMIT) {
        setError(`Document exceeds safety limits (${Math.round(data.length / 1024)}KB). Please use a smaller segment.`);
        return;
    }

    setStage(ProcessingStage.PARSING);
    setError(null);
    setSearchQuery('');
    setEnrichmentProgress({ current: 0, total: 0 });
    cancellationRef.current = false; 
    
    setDocState(prev => ({ 
        ...prev, 
        rawInput: typeof data === 'string' ? 'Manual Text Input' : data.name, 
        inputType: type, 
        chunks: [], 
        parsedText: '',
        knowledgeGraph: undefined 
    }));
    setShowGraph(false);

    const startTime = Date.now();

    try {
      let textToProcess = '';

      // Step 0: Extraction
      if (type === 'pdf' && data instanceof File) {
        textToProcess = await extractTextFromPdf(data);
      } else if (type === 'epub' && data instanceof File) {
        textToProcess = await extractTextFromEpub(data);
      } else if (typeof data === 'string') {
        textToProcess = data;
      }

      if (cancellationRef.current) return;

      // Step 1: Normalize & OCR
      const effectiveType = (type === 'pdf' || type === 'epub') ? 'text' : type;
      const parsedText = await parseDocument(textToProcess, effectiveType, aiConfig);
      
      if (cancellationRef.current) return;
      if (!parsedText) throw new Error("Parsed document is empty or unreadable.");
      
      setDocState(prev => ({ ...prev, parsedText }));
      
      // Step 2: Semantic Chunking
      setStage(ProcessingStage.CHUNKING);
      await new Promise(r => setTimeout(r, 600)); 
      
      if (cancellationRef.current) return;

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

      // Step 3: Contextual Enrichment
      setStage(ProcessingStage.ENRICHING);
      setEnrichmentProgress({ current: 0, total: initialChunks.length });
      
      const docSummary = await generateDocumentSummary(parsedText, aiConfig);
      
      const currentChunks = [...initialChunks];
      for (let i = 0; i < currentChunks.length; i++) {
        if (cancellationRef.current) return;

        setEnrichmentProgress(prev => ({ ...prev, current: i + 1 }));

        try {
            const enrichment = await enrichChunk(currentChunks[i].originalText, docSummary, aiConfig);
            if (cancellationRef.current) return;

            currentChunks[i] = {
                ...currentChunks[i],
                enrichedContext: enrichment.context || "No context provided",
                keywords: enrichment.keywords || [],
                sentiment: enrichment.sentiment || "Neutral",
                entities: enrichment.entities || { people: [], organizations: [], locations: [] }
            };
            setDocState(prev => ({ ...prev, chunks: [...currentChunks] }));
        } catch (enrichErr: any) {
            console.warn(`Failed to enrich chunk ${i}`, enrichErr);
            currentChunks[i] = { ...currentChunks[i], enrichedContext: "Enrichment failed" };
            setDocState(prev => ({ ...prev, chunks: [...currentChunks] }));
        }
      }

      const totalTime = Date.now() - startTime;
      setDocState(prev => ({ 
          ...prev, 
          stats: { ...prev.stats, processingTimeMs: totalTime }
      }));
      setStage(ProcessingStage.COMPLETE);

    } catch (err: any) {
      if (cancellationRef.current) return;
      
      console.error(err);
      let msg = err.message || "Pipeline failure.";
      if (msg.includes('token count exceeds')) {
          msg = "Document is too large for the model's context window. Try a smaller file.";
      }
      setError(msg);
      setStage(ProcessingStage.ERROR);
    }
  };

  const performChunking = (text: string, size: number): string[] => {
    // Better chunking that respects paragraph boundaries
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of paragraphs) {
      if ((currentChunk + p).length > size && currentChunk !== "") {
        chunks.push(currentChunk.trim());
        currentChunk = p;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + p;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.length > 0 ? chunks : [text];
  };

  const handleGenerateGraph = async () => {
    if (docState.chunks.length === 0) return;
    setIsGeneratingGraph(true);
    setError(null);
    try {
        const graph = await generateKnowledgeGraph(docState.chunks, aiConfig);
        setDocState(prev => ({ ...prev, knowledgeGraph: graph }));
        setShowGraph(true); 
    } catch (e: any) {
        setError("Knowledge Graph generation failed.");
    } finally {
        setIsGeneratingGraph(false);
    }
  };

  const handleSummarizeChunk = async (chunkId: string, style: 'bullet' | 'executive' | 'technical' = 'bullet') => {
    const chunkIndex = docState.chunks.findIndex(c => c.id === chunkId);
    if (chunkIndex === -1) return;
    try {
        const summary = await generateChunkSummary(docState.chunks[chunkIndex].originalText, aiConfig, style);
        setDocState(prev => {
            const newChunks = [...prev.chunks];
            newChunks[chunkIndex] = { ...newChunks[chunkIndex], summary };
            return { ...prev, chunks: newChunks };
        });
    } catch (e) {
        console.error("Summary failed", e);
    }
  };

  const handleSummarizeAll = async () => {
    if (docState.chunks.length === 0 || isSummarizingAll) return;
    setIsSummarizingAll(true);
    cancellationRef.current = false;
    
    const chunksToSummarize = docState.chunks.filter(c => !c.summary);
    
    for (const chunk of chunksToSummarize) {
        if (cancellationRef.current) break;
        await handleSummarizeChunk(chunk.id, 'bullet');
    }
    
    setIsSummarizingAll(false);
  };

  const handleExport = () => {
    if (docState.chunks.length === 0) return;
    const blob = new Blob([JSON.stringify({
        metadata: { timestamp: new Date().toISOString(), stats: docState.stats, provider: aiConfig.provider },
        chunks: docState.chunks,
        knowledgeGraph: docState.knowledgeGraph
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-data-${Date.now()}.json`;
    a.click();
  };

  const filteredChunks = docState.chunks.filter(chunk => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return chunk.originalText.toLowerCase().includes(q) || 
           (chunk.keywords && chunk.keywords.some(k => k.toLowerCase().includes(q))) ||
           (chunk.enrichedContext && chunk.enrichedContext.toLowerCase().includes(q));
  });

  const isProcessing = (stage !== ProcessingStage.IDLE && stage !== ProcessingStage.COMPLETE && stage !== ProcessingStage.ERROR) || isSummarizingAll;

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
                <span className="flex items-center gap-1"><Terminal size={14}/> v1.3.1</span>
                <span className="flex items-center gap-1 text-green-500"><Activity size={14}/> ONLINE</span>
             </div>
             <button 
                onClick={() => setShowSettings(true)}
                className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
             >
                <Settings size={18} />
             </button>
          </div>
        </header>

        {/* Settings */}
        {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-brand-panel border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <h3 className="font-semibold text-white flex items-center gap-2"><Settings size={18} /> Configuration</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-3">AI Provider</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setAiConfig(prev => ({...prev, provider: 'gemini'}))}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${aiConfig.provider === 'gemini' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <Cloud size={18} /> Gemini
                                </button>
                                <button 
                                    onClick={() => setAiConfig(prev => ({...prev, provider: 'ollama'}))}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${aiConfig.provider === 'ollama' ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <Server size={18} /> Ollama
                                </button>
                            </div>
                        </div>
                        {aiConfig.provider === 'ollama' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <input 
                                    type="text" 
                                    value={aiConfig.ollamaUrl}
                                    onChange={(e) => setAiConfig(prev => ({...prev, ollamaUrl: e.target.value}))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    placeholder="Endpoint URL"
                                />
                                <input 
                                    type="text" 
                                    value={aiConfig.ollamaModel}
                                    onChange={(e) => setAiConfig(prev => ({...prev, ollamaModel: e.target.value}))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    placeholder="Model Name"
                                />
                            </div>
                        )}
                        <button onClick={() => setShowSettings(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm transition-colors">
                            Close Settings
                        </button>
                    </div>
                </div>
            </div>
        )}

        <PipelineVisualizer stage={stage} />

        <InputSection 
            onInput={handleInput} 
            disabled={isProcessing || isGeneratingGraph} 
        />

        {/* Status Dashboard */}
        {(stage !== ProcessingStage.IDLE) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                 <div className="bg-brand-panel p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Source Info</div>
                    <div className="text-sm font-medium text-white truncate">{docState.rawInput || 'No Source'}</div>
                 </div>
                 <div className="bg-brand-panel p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Progress</div>
                    <div className="text-xl font-mono text-brand-accent flex items-center gap-2">
                        {isSummarizingAll ? (
                             <><Sparkles size={16} className="animate-pulse text-blue-400" /> Summarizing...</>
                        ) : stage === ProcessingStage.ENRICHING ? (
                            <><Loader2 size={16} className="animate-spin" /> {enrichmentProgress.current} / {enrichmentProgress.total}</>
                        ) : (
                            <>{docState.stats.chunkCount} Chunks</>
                        )}
                    </div>
                 </div>
                 <div className="bg-brand-panel p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Action</div>
                    <div className="flex items-center justify-between">
                        {isProcessing ? (
                             <button 
                                onClick={handleCancel}
                                className="flex items-center gap-2 text-red-500 hover:text-red-400 font-bold text-sm bg-red-500/10 px-3 py-1 rounded transition-colors"
                             >
                                <StopCircle size={14} /> Cancel Process
                             </button>
                        ) : (
                             <button 
                                onClick={resetPipeline}
                                className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-sm bg-slate-800 px-3 py-1 rounded transition-colors"
                             >
                                <RefreshCw size={14} /> Reset
                             </button>
                        )}
                    </div>
                 </div>
            </div>
        )}

        {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-8 text-sm flex items-start gap-3 animate-in shake">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="font-bold">Error Occurred</p>
                    <p className="opacity-90">{error}</p>
                </div>
            </div>
        )}

        {/* Knowledge Graph Card */}
        {stage === ProcessingStage.COMPLETE && (
            <div className="mb-8 p-4 bg-purple-900/10 border border-purple-500/20 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Network className="text-purple-400" size={24} />
                    <div>
                         <h3 className="font-semibold text-white">Relationship Mapping</h3>
                         <p className="text-xs text-slate-400">Extract an interactive knowledge graph from processed data.</p>
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
                            {isGeneratingGraph ? 'Analyzing...' : 'Extract Graph'}
                        </button>
                    ) : (
                         <button 
                            onClick={() => setShowGraph(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-transform hover:scale-105"
                         >
                            <Eye size={16} /> Visualize Graph
                         </button>
                    )}
                </div>
            </div>
        )}

        {/* Results */}
        {docState.chunks.length > 0 && (
            <div className="animate-in slide-in-from-bottom-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-2">
                        <Layers className="text-brand-accent" />
                        <h2 className="text-xl font-bold text-white">Contextual Chunks</h2>
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input 
                                type="text" 
                                placeholder="Filter content..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-slate-300 pl-9 pr-4 py-1.5 rounded-lg text-sm focus:outline-none focus:border-brand-accent w-48 md:w-64"
                            />
                        </div>
                        
                        <button 
                            onClick={handleSummarizeAll} 
                            disabled={isProcessing}
                            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors text-sm disabled:opacity-50"
                        >
                            <Sparkles size={14} /> Summarize All
                        </button>

                        <button onClick={handleExport} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors text-sm">
                            <Download size={14} /> Export
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredChunks.map((chunk, idx) => (
                        <ChunkCard 
                            key={chunk.id} 
                            chunk={chunk} 
                            index={docState.chunks.indexOf(chunk)}
                            onSummarize={handleSummarizeChunk} 
                        />
                    ))}
                </div>
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