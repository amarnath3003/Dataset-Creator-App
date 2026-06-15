import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTrainingJob } from "../services/trainingApi";
import { Button } from "../../../components/Button";
import { Cpu, Play } from "lucide-react";

export default function HardwareSelectionPage() {
  const navigate = useNavigate();
  const [gpu, setGpu] = useState("RTX 3060");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const launchTraining = async () => {
    setIsSubmitting(true);
    try {
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
    } catch(err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="neu-section max-w-3xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Cpu size={18} className="text-neu-dim" />
          Hardware Compute
        </h2>
        <div className="led led-on"></div>
      </div>
      
      <div className="neu-section-body space-y-8">
        <p className="text-neu-dim text-sm">Choose the GPU configuration to execute the training run.</p>

        <div className="flex flex-col space-y-2">
          <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">GPU Provider</label>
          <div className="neu-trough">
            <select
                value={gpu}
                onChange={(e)=>setGpu(e.target.value)}
                className="neu-input bg-transparent shadow-none w-full"
            >
                <option>RTX 3060</option>
                <option>RTX 3070</option>
                <option>RTX 4090</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
          <Button onClick={() => window.history.back()} variant="outline" size="lg">
            Back
          </Button>
          
          <button 
            onClick={launchTraining} 
            disabled={isSubmitting}
            className={`neu-btn-primary px-8 py-3 flex items-center gap-2 font-bold uppercase tracking-widest text-sm rounded-[24px] ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Play size={16} fill="currentColor" />
            {isSubmitting ? 'Starting...' : 'Launch Training'}
          </button>
        </div>
      </div>
    </div>
  );
}
