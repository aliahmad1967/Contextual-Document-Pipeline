import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, Type } from 'lucide-react';

interface Props {
  onInput: (data: string, type: 'text' | 'image') => void;
  disabled: boolean;
}

const InputSection: React.FC<Props> = ({ onInput, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Simple mime check
      if (file.type.startsWith('image/')) {
        onInput(result, 'image');
      } else {
        // Assume text
        // Note: For a real app we'd decode base64 for text, but FileReader.readAsText is better
        // Re-reading as text if it's not an image for simplicity
        const textReader = new FileReader();
        textReader.onload = (ev) => {
             onInput(ev.target?.result as string, 'text');
        }
        textReader.readAsText(file);
      }
    };

    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
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
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 resize-none focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue disabled:opacity-50"
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
            <h3 className="font-semibold text-white">Image / Document</h3>
        </div>
        <div 
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-400/5 transition-all group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <Upload className="w-10 h-10 text-slate-600 group-hover:text-purple-400 mb-3 transition-colors" />
            <p className="text-sm text-slate-400 group-hover:text-purple-300">Click to upload Image or Text File</p>
            <p className="text-xs text-slate-600 mt-2">Supports PNG, JPG, TXT, MD</p>
        </div>
        <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.txt,.md,.json"
            disabled={disabled}
        />
      </div>
    </div>
  );
};

export default InputSection;