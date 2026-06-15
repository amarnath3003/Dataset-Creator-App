import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Settings } from "lucide-react";

export default function TrainingConfigPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    batch_size: 2,
    learning_rate: 2e-4,
    epochs: 3
  });

  return (
    <div className="neu-section max-w-3xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Settings size={18} className="text-neu-dim" />
          Hyperparameters
        </h2>
        <div className="led led-on"></div>
      </div>
      
      <div className="neu-section-body space-y-8">
        <p className="text-neu-dim text-sm">Fine-tune the training configuration for your run.</p>

        <div className="flex flex-col space-y-6">
          <div className="flex flex-col space-y-2">
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Batch Size</label>
            <div className="neu-trough">
                <input
                  type="number"
                  value={config.batch_size}
                  onChange={(e) => setConfig({ ...config, batch_size: Number(e.target.value) })}
                  className="neu-input bg-transparent shadow-none"
                />
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Learning Rate</label>
            <div className="neu-trough">
                <input
                  type="number"
                  step="0.0001"
                  value={config.learning_rate}
                  onChange={(e) => setConfig({ ...config, learning_rate: Number(e.target.value) })}
                  className="neu-input bg-transparent shadow-none"
                />
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Epochs</label>
            <div className="neu-trough">
                <input
                  type="number"
                  value={config.epochs}
                  onChange={(e) => setConfig({ ...config, epochs: Number(e.target.value) })}
                  className="neu-input bg-transparent shadow-none"
                />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
          <Button onClick={() => navigate('/finetune/datasets')} variant="outline" size="lg">
            Back
          </Button>
          
          <Button 
            onClick={() => navigate('/finetune/hardware')}
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
