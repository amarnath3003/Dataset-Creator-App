import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Server, Check } from 'lucide-react';

export default function ModelSelectionPage() {
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState(null);

  const models = [
    { id: 'llama3-8b', name: 'Llama 3 8B', desc: "Meta's flagship 8B parameter model.", provider: 'Meta' },
    { id: 'gemma3-1b', name: 'Gemma 3 1B', desc: "Google's lightweight efficient model.", provider: 'Google' },
    { id: 'mistral-7b', name: 'Mistral 7B', desc: "High performance 7B model.", provider: 'Mistral AI' },
  ];

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
        <p className="text-neu-dim text-sm">Select a base open-source model to fine-tune.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map(model => (
            <div 
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`relative neu-plate p-6 flex flex-col gap-4 cursor-pointer transition-all duration-300 group ${selectedModel === model.id ? 'ring-1 ring-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.2)]' : 'hover:-translate-y-1'}`}
            >
                {selectedModel === model.id && (
                  <div className="absolute top-4 right-4 text-neu-accent">
                    <Check size={18} />
                  </div>
                )}
                <span className="neu-badge neu-badge-accent self-start">{model.provider}</span>
                <div>
                  <h3 className={`text-xl font-bold transition-colors ${selectedModel === model.id ? 'text-neu-accent' : 'group-hover:text-neu-text text-neu-dim'}`}>{model.name}</h3>
                  <p className="text-sm text-neu-dim/70 mt-2">{model.desc}</p>
                </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
          <Button 
            onClick={() => navigate('/finetune/datasets')} 
            variant="primary" 
            size="lg"
            disabled={!selectedModel}
            className={!selectedModel ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Next: Select Dataset
          </Button>
        </div>
      </div>
    </div>
  );
}
