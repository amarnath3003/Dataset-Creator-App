import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTrainingJob } from "../services/trainingApi";
import { Button } from "../../../components/Button";

export default function HardwareSelectionPage() {

  const navigate = useNavigate();

  const [gpu, setGpu] = useState("RTX 3060");

  const launchTraining = async () => {

    const job = await createTrainingJob({
        model: "google/gemma-3-1b",
        dataset_path: "/datasets/test.jsonl",
        training_type: "sft",
        config: {
            batch_size: 2,
            learning_rate: 2e-4,
            epochs: 3
        }
    });
  
    navigate(`/finetune/runs/${job.job_id}`);
  };

  return (

    <div className="space-y-6">

      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Step 4: Select Hardware</h1>
        <p className="text-neu-muted">Choose the GPU configuration for the training run.</p>
      </div>

      <div className="flex flex-col space-y-1 max-w-md">
        <label className="text-sm font-medium">GPU Model</label>
        <select
            value={gpu}
            onChange={(e)=>setGpu(e.target.value)}
            className="flex h-10 w-full rounded-md border border-neu-border bg-neu-base px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neu-accent"
        >
            <option>RTX 3060</option>
            <option>RTX 3070</option>
            <option>RTX 4090</option>
        </select>
      </div>

      <div className="flex justify-between mt-8">
        <Button onClick={() => window.history.back()} variant="outline" size="lg">
          Back
        </Button>
        <Button onClick={launchTraining} variant="primary" size="lg">
          Launch Training
        </Button>
      </div>

    </div>
  );
}
