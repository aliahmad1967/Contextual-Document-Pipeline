import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, Type, FileText, BookOpen } from 'lucide-react';
import { InputType } from '../types';

interface Props {
  onInput: (data: string | File, type: InputType) => void;
  disabled: boolean;
}

const InputSection: React.FC<Props> = ({ onInput, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onInput(event.target?.result as string, 'image');
      };
      reader.readAsDataURL(file);
    } else if (extension === 'pdf') {
      onInput(file, 'pdf');
    } else if (extension === 'epub') {
      onInput(file, 'epub');
    } else {
      // Default to text parsing
      const reader = new FileReader();
      reader.onload = (event) => {
        onInput(event.target?.result as string, 'text');
      };
      reader.readAsText(file);
    }
  };

  const handleTextSubmit = () => {
    if (textInputRef.current?.value) {
      onInput(textInputRef.current.value, 'text');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Text Input */}
      <div className="bg-brand-panel p-6 rounded-xl border border-slate-700 flex flex-col">
        <div className="flex items-center gap-2 mb-4 text-brand-blue">
            <Type size={20} />
            <h3 className="font-semibold text-white">Raw Text</h3>
        </div>
        <textarea 
            ref={textInputRef}
            disabled={disabled}
            dir="auto"
            placeholder="Paste your document text here..." 
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 resize-none focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue disabled:opacity-50 min-h-[160px]"
        />
        <button 
            onClick={handleTextSubmit}
            disabled={disabled}
            className="mt-4 bg-brand-blue hover:bg-blue-600 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            Process Text
        </button>
      </div>

      {/* File/Image Input */}
      <div className="bg-brand-panel p-6 rounded-xl border border-slate-700 flex flex-col">
         <div className="flex items-center gap-2 mb-4 text-purple-400">
            <ImageIcon size={20} />
            <h3 className="font-semibold text-white">Advanced Formats</h3>
        </div>
        <div 
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-400/5 transition-all group ${disabled ? 'opacity-50 cursor-not-allowed' : ''} min-h-[160px] p-4 text-center`}
        >
            <div className="flex gap-4 mb-3">
              <ImageIcon className="w-8 h-8 text-slate-600 group-hover:text-purple-400 transition-colors" />
              <FileText className="w-8 h-8 text-slate-600 group-hover:text-blue-400 transition-colors" />
              <BookOpen className="w-8 h-8 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </div>
            <p className="text-sm text-slate-400 group-hover:text-white transition-colors">Click to upload Document</p>
            <p className="text-xs text-slate-600 mt-2">Supports PDF, EPUB, Images (OCR), TXT, MD</p>
        </div>
        <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.txt,.md,.json,.pdf,.epub"
            disabled={disabled}
        />
      </div>
    </div>
  );
};

export default InputSection;