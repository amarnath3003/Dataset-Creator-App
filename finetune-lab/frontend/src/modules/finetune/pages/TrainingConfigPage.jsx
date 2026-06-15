import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Settings, Sliders, Cpu, Zap } from "lucide-react";

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
    lora_dropout: 0.05
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
              { id: 'qlora', label: 'QLoRA', desc: 'Memory efficient 4-bit' },
              { id: 'lora', label: 'LoRA', desc: 'Standard adapter' },
              { id: 'sft', label: 'SFT', desc: 'Supervised Fine-Tuning' },
              { id: 'full', label: 'Full', desc: 'All parameters (High VRAM)' },
              { id: 'cpt', label: 'CPT', desc: 'Continued Pre-Training' },
              { id: 'vision', label: 'Vision', desc: 'Multimodal VLM' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => handleUpdate('training_type', mode.id)}
                className={`neu-plate p-4 rounded-xl text-left transition-all duration-300 border-2 ${config.training_type === mode.id ? 'border-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.1)]' : 'border-transparent hover:border-neu-dim/20'}`}
              >
                <div className="font-bold text-neu-text">{mode.label}</div>
                <div className="text-[10px] text-neu-dim mt-1">{mode.desc}</div>
              </button>
            ))}
          </div>
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
          </div>

          {/* LoRA Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
              <Sliders size={14} className="text-neu-accent" />
              Adapter Configuration
            </h3>
            <div className={`neu-plate p-6 rounded-2xl space-y-4 transition-opacity duration-300 ${['lora', 'qlora'].includes(config.training_type) ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              
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
