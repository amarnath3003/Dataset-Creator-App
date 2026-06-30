import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Settings, Sliders, Cpu, Zap, Box } from "lucide-react";

export default function TrainingConfigPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState({
    training_type: 'qlora',
    batch_size: 2,
    gradient_accumulation: 4,
    learning_rate: 2e-4,
    epochs: 3,
    max_seq_length: 2048,
    save_steps: 200,
    lora_rank: 16,
    lora_alpha: 16,
    lora_dropout: 0.05,
    use_rslora: false,
    use_loftq: false,
    packing: false,
    // CPT (continued pre-training)
    train_embeddings: true,
    embedding_learning_rate: 0.000005,
    // Vision (VLM)
    finetune_vision_layers: true,
    finetune_language_layers: true,
    finetune_attention_modules: true,
    finetune_mlp_modules: true,
    vision_instruction: 'Describe this image in detail.',
  });

  const handleUpdate = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="neu-section max-w-4xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Settings size={18} className="text-neu-dim" />
          Hyperparameters & Mode
        </h2>
        <div className="led led-on"></div>
      </div>
      
      <div className="neu-section-body space-y-8">
        
        {/* Training Mode Selection */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Cpu size={14} className="text-neu-accent" />
            Training Engine Mode
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: 'qlora', label: 'QLoRA', desc: '4-bit base + LoRA · lowest VRAM' },
              { id: 'lora', label: 'LoRA', desc: '16-bit base + LoRA · higher quality' },
              { id: 'sft', label: 'SFT', desc: 'Supervised tuning (4-bit LoRA)' },
              { id: 'full', label: 'Full', desc: 'All parameters (high VRAM)' },
              { id: 'cpt', label: 'CPT', desc: 'Continued pre-training' },
              { id: 'vision', label: 'Vision', desc: 'Multimodal VLM' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => {
                  handleUpdate('training_type', mode.id);
                  // CPT highly recommends packing
                  if (mode.id === 'cpt') handleUpdate('packing', true);
                }}
                className={`neu-plate p-4 rounded-xl text-left transition-all duration-300 border-2 ${config.training_type === mode.id ? 'border-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.1)]' : 'border-transparent hover:border-neu-dim/20'}`}
              >
                <div className="font-bold text-neu-text">{mode.label}</div>
                <div className="text-[10px] text-neu-dim mt-1">{mode.desc}</div>
              </button>
            ))}
          </div>

          {['sft', 'lora', 'qlora'].includes(config.training_type) && (
            <p className="text-[11px] font-mono text-neu-dim">
              Base precision:{' '}
              <span className="text-neu-accent">
                {config.training_type === 'lora' ? '16-bit' : '4-bit'}
              </span>
              {config.training_type === 'lora'
                ? ' — loads the full-precision checkpoint (more VRAM, higher fidelity).'
                : ' — quantized base (lowest VRAM).'}
            </p>
          )}

          {config.training_type === 'full' && (
            <p className="text-[11px] font-mono text-neu-dim">
              Base precision: <span className="text-neu-accent">16-bit</span> — full-parameter fine-tuning (no LoRA adapters). Highest quality and highest VRAM; use a small model or multiple GPUs.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Basic Hyperparameters */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
              <Zap size={14} className="text-neu-accent" />
              Core Hyperparameters
            </h3>
            <div className="neu-plate p-6 rounded-2xl space-y-4">
              
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Epochs</label>
                <div className="neu-trough">
                    <input
                      type="number" value={config.epochs}
                      onChange={(e) => handleUpdate('epochs', Number(e.target.value))}
                      className="neu-input bg-transparent shadow-none"
                    />
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Learning Rate</label>
                <div className="neu-trough">
                    <input
                      type="number" step="0.00001" value={config.learning_rate}
                      onChange={(e) => handleUpdate('learning_rate', Number(e.target.value))}
                      className="neu-input bg-transparent shadow-none"
                    />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Batch Size</label>
                  <div className="neu-trough">
                      <input
                        type="number" value={config.batch_size}
                        onChange={(e) => handleUpdate('batch_size', Number(e.target.value))}
                        className="neu-input bg-transparent shadow-none"
                      />
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Grad Accum</label>
                  <div className="neu-trough">
                      <input
                        type="number" value={config.gradient_accumulation}
                        onChange={(e) => handleUpdate('gradient_accumulation', Number(e.target.value))}
                        className="neu-input bg-transparent shadow-none"
                      />
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Max Seq Length</label>
                <div className="neu-trough">
                    <input
                      type="number" step="512" value={config.max_seq_length}
                      onChange={(e) => handleUpdate('max_seq_length', Number(e.target.value))}
                      className="neu-input bg-transparent shadow-none"
                    />
                </div>
              </div>

            </div>

            {/* SFT / CPT Specific Settings */}
            <div className={`space-y-4 transition-opacity duration-300 ${['sft', 'cpt'].includes(config.training_type) ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2 mt-6">
                <Box size={14} className="text-neu-accent" />
                Dataset Config
              </h3>
              <div className="neu-plate p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-neu-text">Sequence Packing</label>
                    <p className="text-[10px] text-neu-dim mt-1">Accelerates training for short sequences (5x speedup)</p>
                  </div>
                  <button
                    onClick={() => handleUpdate('packing', !config.packing)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${config.packing ? 'bg-neu-accent' : 'bg-neu-dark'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full transition-transform ${config.packing ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>

                {config.training_type === 'cpt' && (
                  <>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div>
                        <label className="text-sm font-bold text-neu-text">Train Embeddings</label>
                        <p className="text-[10px] text-neu-dim mt-1">Also tune embed_tokens + lm_head for new domain vocabulary</p>
                      </div>
                      <button
                        onClick={() => handleUpdate('train_embeddings', !config.train_embeddings)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${config.train_embeddings ? 'bg-neu-accent' : 'bg-neu-dark'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full transition-transform ${config.train_embeddings ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                    </div>

                    <div className={`flex flex-col space-y-2 transition-opacity ${config.train_embeddings ? '' : 'opacity-40 pointer-events-none'}`}>
                      <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Embedding Learning Rate</label>
                      <div className="neu-trough">
                        <input
                          type="number" step="0.000001" min="0" value={config.embedding_learning_rate}
                          onChange={(e) => handleUpdate('embedding_learning_rate', Number(e.target.value))}
                          className="neu-input bg-transparent shadow-none"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-neu-dim">
                      CPT trains on a raw-text corpus (a <span className="font-mono text-neu-dim">text</span> column). Use domain documents, not Q&amp;A pairs.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Vision (VLM) Settings */}
            {config.training_type === 'vision' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2 mt-6">
                  <Box size={14} className="text-neu-accent" />
                  Vision Config
                </h3>
                <div className="neu-plate p-6 rounded-2xl space-y-4">
                  {[
                    { key: 'finetune_vision_layers', label: 'Vision Layers', desc: 'Tune the image encoder' },
                    { key: 'finetune_language_layers', label: 'Language Layers', desc: 'Tune the text decoder' },
                    { key: 'finetune_attention_modules', label: 'Attention Modules', desc: 'Tune attention projections' },
                    { key: 'finetune_mlp_modules', label: 'MLP Modules', desc: 'Tune feed-forward layers' },
                  ].map(opt => (
                    <div key={opt.key} className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-bold text-neu-text">{opt.label}</label>
                        <p className="text-[10px] text-neu-dim mt-1">{opt.desc}</p>
                      </div>
                      <button
                        onClick={() => handleUpdate(opt.key, !config[opt.key])}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${config[opt.key] ? 'bg-neu-accent' : 'bg-neu-dark'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full transition-transform ${config[opt.key] ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                  ))}

                  <div className="flex flex-col space-y-2 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Instruction Prompt</label>
                    <div className="neu-trough">
                      <textarea
                        rows={2} value={config.vision_instruction}
                        onChange={(e) => handleUpdate('vision_instruction', e.target.value)}
                        className="neu-textarea bg-transparent shadow-none"
                      />
                    </div>
                    <p className="text-[10px] text-neu-dim">Used as the user turn for each image when the dataset has image + text columns.</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* LoRA Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
              <Sliders size={14} className="text-neu-accent" />
              Adapter Configuration
            </h3>
            <div className={`neu-plate p-6 rounded-2xl space-y-6 transition-opacity duration-300 ${['sft', 'lora', 'qlora', 'cpt', 'vision'].includes(config.training_type) ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest flex justify-between">
                  <span>LoRA Rank (r)</span>
                  <span className="text-neu-accent">{config.lora_rank}</span>
                </label>
                <div className="neu-trough p-3">
                    <input
                      type="range" min="8" max="128" step="8" value={config.lora_rank}
                      onChange={(e) => handleUpdate('lora_rank', Number(e.target.value))}
                      className="w-full accent-neu-accent"
                    />
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest flex justify-between">
                  <span>LoRA Alpha</span>
                  <span className="text-neu-accent">{config.lora_alpha}</span>
                </label>
                <div className="neu-trough p-3">
                    <input
                      type="range" min="8" max="256" step="8" value={config.lora_alpha}
                      onChange={(e) => handleUpdate('lora_alpha', Number(e.target.value))}
                      className="w-full accent-neu-accent"
                    />
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">LoRA Dropout</label>
                <div className="neu-trough">
                    <input
                      type="number" step="0.01" min="0" max="1" value={config.lora_dropout}
                      onChange={(e) => handleUpdate('lora_dropout', Number(e.target.value))}
                      className="neu-input bg-transparent shadow-none"
                    />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-neu-text">RSLoRA</label>
                    <p className="text-[10px] text-neu-dim mt-1">Rank-Stabilized LoRA (Unsloth optimized)</p>
                  </div>
                  <button 
                    onClick={() => handleUpdate('use_rslora', !config.use_rslora)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${config.use_rslora ? 'bg-neu-accent' : 'bg-neu-dark'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full transition-transform ${config.use_rslora ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>

                <div className={`flex items-center justify-between transition-opacity ${['qlora', 'sft'].includes(config.training_type) ? '' : 'opacity-40 pointer-events-none'}`}>
                  <div>
                    <label className="text-sm font-bold text-neu-text">LoftQ Initialization</label>
                    <p className="text-[10px] text-neu-dim mt-1">Improves QLoRA accuracy (4-bit only)</p>
                  </div>
                  <button
                    onClick={() => handleUpdate('use_loftq', !config.use_loftq)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${config.use_loftq ? 'bg-neu-accent' : 'bg-neu-dark'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full transition-transform ${config.use_loftq ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
          <Button onClick={() => navigate('/finetune/datasets')} variant="outline" size="lg">
            Back
          </Button>
          
          <Button 
            onClick={() => navigate('/finetune/hardware', { state: { ...location.state, trainingConfig: config } })}
            variant="primary"
            size="lg"
          >
            Next: Hardware
          </Button>
        </div>
      </div>
    </div>
  );
}
