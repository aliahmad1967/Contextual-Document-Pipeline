import React, { useState } from 'react';
import { Chunk } from '../types';
import { Hash, Tag, Info, Users, Building, MapPin, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  chunk: Chunk;
  index: number;
  onSummarize?: (id: string) => void;
}

const ChunkCard: React.FC<Props> = ({ chunk, index, onSummarize }) => {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const TRUNCATE_LIMIT = 200;

  const getSentimentColor = (s?: string) => {
    const sentiment = s?.toLowerCase() || 'neutral';
    if (sentiment.includes('positive')) return 'bg-green-500/20 text-green-400 border-green-500/50';
    if (sentiment.includes('negative')) return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (sentiment.includes('info')) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  };

  const handleSummarizeClick = async () => {
    if (!onSummarize) return;
    setLoadingSummary(true);
    await onSummarize(chunk.id);
    setLoadingSummary(false);
  };

  const shouldTruncate = chunk.originalText.length > TRUNCATE_LIMIT;
  const displayText = (!isExpanded && shouldTruncate) 
    ? chunk.originalText.slice(0, TRUNCATE_LIMIT).trim() + '...' 
    : chunk.originalText;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-brand-accent/30 transition-all group flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
                CHUNK_ID: {chunk.id.slice(0, 8)}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold tracking-wider ${getSentimentColor(chunk.sentiment)}`}>
                {chunk.sentiment || 'Analyzing...'}
            </span>
        </div>
        <div className="text-slate-600 text-xs">#{index + 1}</div>
      </div>

      {/* Content */}
      <div className="mb-4 border-l-2 border-slate-700 pl-3 grow flex flex-col items-start">
        <p dir="auto" className="text-slate-300 text-sm leading-relaxed italic">
            "{displayText}"
        </p>
        {shouldTruncate && (
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-xs flex items-center gap-1 text-brand-blue hover:text-blue-400 transition-colors focus:outline-none"
            >
                {isExpanded ? (
                    <><ChevronUp size={12} /> Show Less</>
                ) : (
                    <><ChevronDown size={12} /> Show More</>
                )}
            </button>
        )}
      </div>

      {/* Enrichment Data */}
      {chunk.enrichedContext ? (
          <div className="bg-brand-dark rounded p-3 space-y-3 animate-in fade-in duration-500 mt-auto">
            <div className="flex gap-2 items-start">
                <Info size={14} className="mt-0.5 text-brand-accent shrink-0" />
                <p dir="auto" className="text-xs text-brand-text/90"><span className="text-brand-accent font-semibold">Context:</span> {chunk.enrichedContext}</p>
            </div>
            
            {chunk.keywords && chunk.keywords.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Tag size={12} className="text-slate-500" />
                    {chunk.keywords.map((kw, i) => (
                        <span dir="auto" key={i} className="text-[10px] bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {kw}
                        </span>
                    ))}
                </div>
            )}

            {chunk.entities && (
                <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-800">
                    {(chunk.entities.people?.length > 0) && (
                        <div className="flex gap-2 text-[10px] items-start">
                            <Users size={12} className="text-slate-500 mt-0.5 shrink-0" />
                            <span dir="auto" className="text-slate-300 break-words">{chunk.entities.people.join(', ')}</span>
                        </div>
                    )}
                    {(chunk.entities.organizations?.length > 0) && (
                        <div className="flex gap-2 text-[10px] items-start">
                            <Building size={12} className="text-slate-500 mt-0.5 shrink-0" />
                            <span dir="auto" className="text-slate-300 break-words">{chunk.entities.organizations.join(', ')}</span>
                        </div>
                    )}
                    {(chunk.entities.locations?.length > 0) && (
                        <div className="flex gap-2 text-[10px] items-start">
                            <MapPin size={12} className="text-slate-500 mt-0.5 shrink-0" />
                            <span dir="auto" className="text-slate-300 break-words">{chunk.entities.locations.join(', ')}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Summary Section */}
            {chunk.summary ? (
                <div className="pt-2 border-t border-slate-800 animate-in fade-in">
                    <div className="flex items-start gap-2">
                        <FileText size={12} className="mt-0.5 text-blue-400 shrink-0" />
                        <div className="w-full">
                             <span className="text-[10px] text-blue-400 font-bold uppercase block mb-1">Generated Summary</span>
                             <p dir="auto" className="text-xs text-slate-300">{chunk.summary}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="pt-2 border-t border-slate-800">
                    <button 
                        onClick={handleSummarizeClick}
                        disabled={loadingSummary}
                        className="w-full text-xs flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-2 rounded text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-600 disabled:opacity-50"
                    >
                        {loadingSummary ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                        {loadingSummary ? "Summarizing..." : "Summarize Chunk"}
                    </button>
                </div>
            )}

          </div>
      ) : (
          <div className="h-20 flex items-center justify-center bg-slate-900/50 rounded border border-dashed border-slate-800 mt-auto">
             <span className="text-xs text-slate-600 flex items-center gap-2">
                 <SparklesIcon className="w-3 h-3 animate-spin" /> Waiting for enrichment...
             </span>
          </div>
      )}
    </div>
  );
};

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 5H5"/><path d="M3 7V3"/><path d="M7 5v4"/></svg>
)

export default ChunkCard;