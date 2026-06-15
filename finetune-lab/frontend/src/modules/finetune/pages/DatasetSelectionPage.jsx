import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Database, Upload, Check } from 'lucide-react';

export default function DatasetSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDataset, setSelectedDataset] = useState(null);

  // Mock datasets, in a real app these would be fetched from the backend/projects
  const datasets = [
    { id: 'ds-1', name: 'Alpaca Cleaned', rows: 52000, type: 'QA' },
    { id: 'ds-2', name: 'Internal Codebase Docs', rows: 1540, type: 'Instruction' },
  ];

  return (
    <div className="neu-section max-w-4xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Database size={18} className="text-neu-dim" />
          Training Dataset
        </h2>
        <div className="led led-on"></div>
      </div>
      
      <div className="neu-section-body flex flex-col gap-8">
        <p className="text-neu-dim text-sm">Select a dataset generated from Dataset Lab, or upload a new JSONL file.</p>

        {datasets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {datasets.map(ds => (
              <div 
                key={ds.id}
                onClick={() => setSelectedDataset(ds.id)}
                className={`relative neu-plate p-6 flex flex-col gap-4 cursor-pointer transition-all duration-300 group ${selectedDataset === ds.id ? 'ring-1 ring-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.2)]' : 'hover:-translate-y-1'}`}
              >
                  {selectedDataset === ds.id && (
                    <div className="absolute top-4 right-4 text-neu-accent">
                      <Check size={18} />
                    </div>
                  )}
                  <span className="neu-badge neu-badge-green self-start">{ds.type}</span>
                  <div>
                    <h3 className={`text-lg font-bold transition-colors ${selectedDataset === ds.id ? 'text-neu-accent' : 'group-hover:text-neu-text text-neu-dim'}`}>{ds.name}</h3>
                    <p className="text-sm text-neu-dim/70 mt-2">{ds.rows.toLocaleString()} rows</p>
                  </div>
              </div>
            ))}
            
            <div className="neu-trough p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/5 hover:border-neu-dim/20 cursor-pointer transition-colors text-center rounded-xl">
               <div className="w-12 h-12 rounded-full neu-inset flex items-center justify-center text-neu-dim">
                  <Upload size={20} />
               </div>
               <div>
                 <p className="font-semibold text-neu-text">Upload JSONL</p>
                 <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">Direct upload</p>
               </div>
            </div>
          </div>
        ) : (
          <div className="neu-trough p-12 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/5 text-center rounded-xl">
             <div className="w-16 h-16 rounded-full neu-inset flex items-center justify-center text-neu-dim">
                <Database size={24} />
             </div>
             <div>
               <p className="font-semibold text-neu-text">No Datasets Found</p>
               <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">Generate via Dataset Lab or Upload</p>
             </div>
             <Button variant="outline" className="mt-2">Import Dataset</Button>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-white/5 mt-4">
          <Button onClick={() => navigate('/finetune/models')} variant="outline" size="lg">
            Back
          </Button>
          <Button 
            onClick={() => navigate('/finetune/config', { state: { ...location.state, datasetId: selectedDataset } })} 
            variant="primary" 
            size="lg"
            disabled={!selectedDataset}
            className={!selectedDataset ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Next: Training Config
          </Button>
        </div>
      </div>
    </div>
  );
}
