import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';

export default function DatasetSelectionPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Step 2: Choose Dataset</h1>
        <p className="text-neu-muted">Select a dataset to use for fine-tuning your model.</p>
      </div>
      
      <div className="p-12 border-2 border-dashed border-neu-border rounded-xl text-center">
        <h3 className="text-lg font-medium">No datasets found</h3>
        <p className="text-sm text-neu-muted mt-1">Please import a dataset from Dataset Lab or upload a new one.</p>
        <Button variant="outline" className="mt-4">Import Dataset</Button>
      </div>

      <div className="flex justify-between mt-8">
        <Button onClick={() => navigate('/finetune/models')} variant="outline" size="lg">
          Back
        </Button>
        <Button onClick={() => navigate('/finetune/config')} variant="primary" size="lg">
          Next: Configure Training
        </Button>
      </div>
    </div>
  );
}
