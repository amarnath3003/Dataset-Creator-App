import { useState } from "react";
import { Button } from "../../../components/Button";

export default function TrainingConfigPage() {

  const [config, setConfig] = useState({
    batch_size: 2,
    learning_rate: 2e-4,
    epochs: 3
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Step 3: Training Configuration</h1>
        <p className="text-neu-muted">Set up hyperparameters for your training run.</p>
      </div>
      
      <div className="flex flex-col space-y-4 max-w-md">
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium">Batch Size</label>
          <input
            type="number"
            value={config.batch_size}
            onChange={(e) => setConfig({ ...config, batch_size: Number(e.target.value) })}
            className="flex h-10 w-full rounded-md border border-neu-border bg-neu-base px-3 py-2 text-sm placeholder:text-neu-muted focus:outline-none focus:ring-2 focus:ring-neu-accent"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium">Learning Rate</label>
          <input
            type="number"
            step="0.0001"
            value={config.learning_rate}
            onChange={(e) => setConfig({ ...config, learning_rate: Number(e.target.value) })}
            className="flex h-10 w-full rounded-md border border-neu-border bg-neu-base px-3 py-2 text-sm placeholder:text-neu-muted focus:outline-none focus:ring-2 focus:ring-neu-accent"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium">Epochs</label>
          <input
            type="number"
            value={config.epochs}
            onChange={(e) => setConfig({ ...config, epochs: Number(e.target.value) })}
            className="flex h-10 w-full rounded-md border border-neu-border bg-neu-base px-3 py-2 text-sm placeholder:text-neu-muted focus:outline-none focus:ring-2 focus:ring-neu-accent"
          />
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button onClick={() => window.history.back()} variant="outline" size="lg">
          Back
        </Button>
        <Button variant="primary" size="lg">
          Launch Training
        </Button>
      </div>
    </div>
  );
}
