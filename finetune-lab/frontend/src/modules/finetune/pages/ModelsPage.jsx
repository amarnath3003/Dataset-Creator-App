import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, ArrowRight, Image as ImageIcon, Type } from "lucide-react";
import { models } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { METHOD_LABEL } from "../lib/format";

export default function ModelsPage() {
  const navigate = useNavigate();
  const { update, reset } = useWizard();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    models.list().then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }, []);

  const selectModel = (model) => {
    reset();
    update({ modelId: model.id, modelData: model, modelSource: "registry" });
    navigate("/finetune/new/dataset");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-light text-neu-text tracking-tight">Models</h1>
        <p className="text-neu-dim/60 font-mono text-[11px] uppercase tracking-[0.25em] mt-2">
          Supported model registry
        </p>
      </div>

      {loading ? (
        <p className="text-neu-dim text-sm py-10 text-center">Loading registry…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {list.map((model) => {
            const isVision = model.modality === "vision" || (model.supports || []).includes("vision");
            return (
              <div key={model.id} className="neu-plate p-6 rounded-2xl flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-neu-text">{model.name}</h3>
                      <span className="neu-badge neu-badge-accent flex items-center gap-1">
                        {isVision ? <ImageIcon size={11} /> : <Type size={11} />}
                        {isVision ? "Vision" : "Text"}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-neu-dim mt-1 break-all">{model.id}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-neu-dark px-2 py-1 rounded-md text-neu-accent shrink-0">
                    {model.parameters}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(model.supports || []).map((s) => (
                    <span key={s} className="text-[10px] font-mono uppercase tracking-widest text-neu-dim/70 bg-neu-dark/50 px-2 py-1 rounded-md border border-white/5">
                      {METHOD_LABEL[s] || s}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4 text-[10px] font-mono text-neu-dim uppercase tracking-widest">
                  <span>VRAM {model.min_vram}GB+</span>
                  <span>CTX {Math.round((model.context_length || 0) / 1024)}k</span>
                  <span>{model.license}</span>
                </div>

                <button
                  onClick={() => selectModel(model)}
                  className="neu-btn-primary flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest mt-1"
                >
                  Use in new run <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="md:col-span-2 neu-trough p-10 text-center text-neu-dim rounded-xl">
              <Boxes size={28} className="mx-auto mb-3 opacity-40" />
              Model registry is empty.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
