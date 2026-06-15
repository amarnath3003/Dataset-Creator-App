import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';

export default function ModelSelectionPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Step 1: Choose Model</h1>
        <p className="text-neu-muted">Select an open-source model to fine-tune.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Scaffolding Model Cards */}
        <div className="p-6 border border-neu-border bg-neu-surface rounded-xl hover:border-neu-accent transition-colors cursor-pointer group">
            <h3 className="text-xl font-bold group-hover:text-neu-accent transition-colors">Llama 3 8B</h3>
            <p className="text-sm text-neu-muted mt-2">Meta's flagship 8B parameter model.</p>
        </div>
        <div className="p-6 border border-neu-border bg-neu-surface rounded-xl hover:border-neu-accent transition-colors cursor-pointer group">
            <h3 className="text-xl font-bold group-hover:text-neu-accent transition-colors">Gemma 3 1B</h3>
            <p className="text-sm text-neu-muted mt-2">Google's lightweight efficient model.</p>
        </div>
        <div className="p-6 border border-neu-border bg-neu-surface rounded-xl hover:border-neu-accent transition-colors cursor-pointer group">
            <h3 className="text-xl font-bold group-hover:text-neu-accent transition-colors">Mistral 7B</h3>
            <p className="text-sm text-neu-muted mt-2">High performance 7B model.</p>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <Button onClick={() => navigate('/finetune/datasets')} variant="primary" size="lg">
          Next: Choose Dataset
        </Button>
      </div>
    </div>
  );
}
