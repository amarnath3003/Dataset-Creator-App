import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Server, Download, Upload, Search } from 'lucide-react';

export default function ModelSelectionPage() {
  const navigate = useNavigate();
  const [source, setSource] = useState('huggingface'); // 'huggingface' | 'local'
  const [hfModelId, setHfModelId] = useState('');
  const [localFile, setLocalFile] = useState(null);

  const isValid = source === 'huggingface' ? hfModelId.trim().length > 0 : localFile !== null;

  return (
    <div className="neu-section max-w-4xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Server size={18} className="text-neu-dim" />
          Foundation Model
        </h2>
        <div className="led led-on"></div>
      </div>
      
      <div className="neu-section-body flex flex-col gap-8">
        <p className="text-neu-dim text-sm">Select a base model from Hugging Face or upload a local GGUF/Safetensors file.</p>

        {/* Source Toggle */}
        <div className="flex bg-neu-dark p-1.5 rounded-[22px] shadow-[var(--sh-trough)] max-w-md w-full border border-black/50">
          <button
            onClick={() => setSource('huggingface')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase transition-all duration-300 ${source === 'huggingface' ? 'bg-neu-base text-neu-accent shadow-[var(--sh-flat)]' : 'text-neu-dim hover:text-neu-text'}`}
          >
            <Download size={16} />
            Hugging Face
          </button>
          <button
            onClick={() => setSource('local')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase transition-all duration-300 ${source === 'local' ? 'bg-neu-base text-neu-accent shadow-[var(--sh-flat)]' : 'text-neu-dim hover:text-neu-text'}`}
          >
            <Upload size={16} />
            Local File
          </button>
        </div>

        {/* Source Content */}
        <div className="neu-plate p-10 min-h-[300px] flex flex-col justify-center rounded-3xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 p-32 bg-neu-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>

          {source === 'huggingface' ? (
            <div className="flex flex-col gap-4 max-w-lg w-full mx-auto relative z-10 animate-in fade-in zoom-in-95 duration-300">
              <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Model ID</label>
              <div className="neu-trough relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-neu-dim">
                    <Search size={20} />
                  </div>
                  <input
                    type="text"
                    value={hfModelId}
                    onChange={(e) => setHfModelId(e.target.value)}
                    placeholder="meta-llama/Llama-3-8b"
                    className="neu-input bg-transparent shadow-none pl-14 h-16 text-lg placeholder:text-neu-dim/30 focus:text-neu-accent"
                  />
              </div>
              <p className="text-xs font-mono text-neu-dim/60">Enter the repository name as it appears on Hugging Face (e.g. 'mistralai/Mistral-7B-v0.1').</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-lg w-full mx-auto relative z-10 animate-in fade-in zoom-in-95 duration-300">
              <label className="w-full cursor-pointer">
                <div className={`neu-trough rounded-[28px] p-12 flex flex-col items-center gap-5 border-2 border-dashed transition-all duration-300 ${localFile
                    ? 'border-neu-accent/40 shadow-[inset_4px_4px_8px_#111315,inset_-4px_-4px_8px_#2c323a,0_0_20px_rgba(255,107,0,0.1)]'
                    : 'border-white/5 hover:border-neu-dim/20'
                    }`}>
                    <div className={`w-20 h-20 rounded-[20px] flex items-center justify-center transition-all duration-300 ${localFile ? 'bg-neu-accent/10 shadow-[0_0_20px_rgba(255,107,0,0.3)]' : 'neu-plate'}`}>
                        <Upload size={32} className={localFile ? 'text-neu-accent' : 'text-neu-dim'} strokeWidth={1.5} />
                    </div>

                    {localFile ? (
                        <div className="text-center">
                            <p className="font-bold text-neu-text tracking-tight truncate max-w-[250px]">{localFile.name}</p>
                            <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-2">
                                {(localFile.size / (1024 * 1024)).toFixed(2)} MB · Ready
                            </p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="font-semibold text-neu-text text-lg">Select Model File</p>
                            <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-2">GGUF, Safetensors, or Bin</p>
                        </div>
                    )}

                    <input
                        type="file" accept=".gguf,.safetensors,.bin"
                        onChange={(e) => setLocalFile(e.target.files[0])}
                        className="sr-only"
                    />
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
          <Button 
            onClick={() => navigate('/finetune/datasets')} 
            variant="primary" 
            size="lg"
            disabled={!isValid}
            className={!isValid ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Next: Select Dataset
          </Button>
        </div>
      </div>
    </div>
  );
}
