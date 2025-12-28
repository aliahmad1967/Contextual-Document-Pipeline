import React from 'react';
import { ProcessingStage } from '../types';
import { FileText, Scissors, Sparkles, Database, ArrowRight } from 'lucide-react';

interface Props {
  stage: ProcessingStage;
}

const PipelineVisualizer: React.FC<Props> = ({ stage }) => {
  
  const getStageStatus = (targetStage: ProcessingStage) => {
    const stages = [ProcessingStage.IDLE, ProcessingStage.PARSING, ProcessingStage.CHUNKING, ProcessingStage.ENRICHING, ProcessingStage.COMPLETE];
    const currentIndex = stages.indexOf(stage);
    const targetIndex = stages.indexOf(targetStage);
    
    if (stage === ProcessingStage.ERROR) return 'text-red-500 border-red-500 opacity-50';
    if (targetIndex < currentIndex) return 'text-brand-accent border-brand-accent bg-brand-accent/10'; // Completed
    if (targetIndex === currentIndex) return 'text-brand-accent border-brand-accent animate-pulse bg-brand-accent/20'; // Active
    return 'text-slate-600 border-slate-700 bg-slate-900'; // Pending
  };

  return (
    <div className="w-full bg-brand-panel p-6 rounded-xl border border-slate-700 shadow-xl mb-8">
      <h3 className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-6">Document Processing Pipeline</h3>
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Step 1: Parse */}
        <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-500 ${getStageStatus(ProcessingStage.PARSING)} w-full md:w-1/4 h-32 justify-center relative group`}>
          <FileText className="w-8 h-8 mb-2" />
          <span className="font-bold text-sm">Parse</span>
          <span className="text-xs opacity-70 mt-1">OCR & Clean</span>
          <div className="absolute inset-0 bg-brand-accent/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
        </div>

        <ArrowRight className={`hidden md:block w-6 h-6 transition-colors duration-300 ${stage === ProcessingStage.IDLE ? 'text-slate-700' : 'text-brand-accent'}`} />

        {/* Step 2: Chunk */}
        <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-500 ${getStageStatus(ProcessingStage.CHUNKING)} w-full md:w-1/4 h-32 justify-center relative group`}>
          <Scissors className="w-8 h-8 mb-2 transform -rotate-90" />
          <span className="font-bold text-sm">Chunking</span>
          <span className="text-xs opacity-70 mt-1">Segment Text</span>
        </div>

        <ArrowRight className={`hidden md:block w-6 h-6 transition-colors duration-300 ${stage === ProcessingStage.PARSING || stage === ProcessingStage.IDLE ? 'text-slate-700' : 'text-brand-accent'}`} />

        {/* Step 3: Enrich */}
        <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-500 ${getStageStatus(ProcessingStage.ENRICHING)} w-full md:w-1/4 h-32 justify-center relative group`}>
          <Sparkles className="w-8 h-8 mb-2" />
          <span className="font-bold text-sm">Enrichment</span>
          <span className="text-xs opacity-70 mt-1">Gemini Context</span>
        </div>

        <ArrowRight className={`hidden md:block w-6 h-6 transition-colors duration-300 ${stage === ProcessingStage.COMPLETE ? 'text-brand-accent' : 'text-slate-700'}`} />

        {/* Step 4: Output */}
        <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-500 ${getStageStatus(ProcessingStage.COMPLETE)} w-full md:w-1/4 h-32 justify-center relative group`}>
          <Database className="w-8 h-8 mb-2" />
          <span className="font-bold text-sm">Contextual Chunks</span>
          <span className="text-xs opacity-70 mt-1">Structured Data</span>
        </div>

      </div>
    </div>
  );
};

export default PipelineVisualizer;
