import React, { useState } from 'react';
import { Chunk } from '../types';
import { Hash, Tag, Info, Users, Building, MapPin, FileText, Loader2, ChevronDown, ChevronUp, Sparkles, MoreVertical } from 'lucide-react';

interface Props {
  chunk: Chunk;
  index: number;
  onSummarize?: (id: string, style?: 'bullet' | 'executive' | 'technical') => void;
}

const ChunkCard: React.FC<Props> = ({ chunk, index, onSummarize }) => {
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  const TRUNCATE_LIMIT = 200;

  const getSentimentColor = (s?: string) => {
    const sentiment = s?.toLowerCase() || 'neutral';
    if (sentiment.includes('positive')) return 'bg-green-500/20 text-green-400 border-green-500/50';
    if (sentiment.includes('negative')) return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (sentiment.includes('info')) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  };

  const handleSummarizeClick = async (style: 'bullet' | 'executive' | 'technical' = 'bullet') => {
    if (!onSummarize) return;
    setLoadingSummary(true);
    setShowOptions(false);
    await onSummarize(chunk.id, style);
    setLoadingSummary(false);
  };

  const shouldTruncate = chunk.originalText.length > TRUNCATE_LIMIT;
  const displayText = (!isExpanded && shouldTruncate) 
    ? chunk.originalText.slice(0, TRUNCATE_LIMIT).trim() + '...' 
    : chunk.originalText;

  const hasEnrichment = chunk.enrichedContext !== undefined;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-brand-accent/30 transition-all group flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
                CHUNK_ID: {chunk.id.slice(0, 8)}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold tracking-wider ${getSentimentColor(chunk.sentiment)}`}>
                {chunk.sentiment || (hasEnrichment ? 'Neutral' : 'Analyzing...')}
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
      {hasEnrichment ? (
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
                <div className="pt-2 border-t border-slate-800 animate-in slide-in-from-top-2">
                    <div className="bg-blue-600/10 p-2 rounded border border-blue-500/20">
                        <div className="flex items-center justify-between mb-1">
                             <span className="text-[10px] text-blue-400 font-bold uppercase flex items-center gap-1">
                                <Sparkles size={10} /> AI Summary
                             </span>
                             <button onClick={() => handleSummarizeClick()} className="text-[10px] text-slate-500 hover:text-white">Regenerate</button>
                        </div>
                        <p dir="auto" className="text-xs text-slate-300 leading-relaxed">{chunk.summary}</p>
                    </div>
                </div>
            ) : (
                <div className="pt-2 border-t border-slate-800 relative">
                    <div className="flex gap-1">
                        <button 
                            onClick={() => handleSummarizeClick('bullet')}
                            disabled={loadingSummary}
                            className="flex-1 text-[10px] flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 py-2 rounded text-slate-300 transition-colors border border-transparent disabled:opacity-50"
                        >
                            {loadingSummary ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
                            Summarize
                        </button>
                        <button 
                            onClick={() => setShowOptions(!showOptions)}
                            className="bg-slate-800 hover:bg-slate-700 px-2 rounded text-slate-400 transition-colors border border-transparent"
                        >
                            <ChevronDown size={14} />
                        </button>
                    </div>

                    {showOptions && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-1">
                                <button onClick={() => handleSummarizeClick('bullet')} className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:bg-slate-700 rounded transition-colors">Bullet Points</button>
                                <button onClick={() => handleSummarizeClick('executive')} className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:bg-slate-700 rounded transition-colors">Executive Paragraph</button>
                                <button onClick={() => handleSummarizeClick('technical')} className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:bg-slate-700 rounded transition-colors">Technical TL;DR</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

          </div>
      ) : (
          <div className="h-20 flex items-center justify-center bg-slate-900/50 rounded border border-dashed border-slate-800 mt-auto">
             <span className="text-xs text-slate-600 flex items-center gap-2">
                 <Loader2 className="w-3 h-3 animate-spin" /> Waiting for enrichment...
             </span>
          </div>
      )}
    </div>
  );
};

export default ChunkCard;