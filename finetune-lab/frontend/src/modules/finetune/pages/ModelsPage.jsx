import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, ArrowRight, Image as ImageIcon, Type, Database } from "lucide-react";
import { models } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { METHOD_LABEL } from "../lib/format";
import { ConsoleSection, EmptyPanel, MetricCard, PageHero } from "../components/ConsolePage";

export default function ModelsPage() {
  const navigate = useNavigate();
  const { update, reset } = useWizard();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    models
      .list()
      .then(setList)
      .catch((e) => setError(e.message || "Failed to load model registry."))
      .finally(() => setLoading(false));
  }, []);

  const selectModel = (model) => {
    reset();
    update({ modelId: model.id, modelData: model, modelSource: "registry" });
    navigate("/finetune/new/dataset");
  };

  const textModels = list.filter((model) => !(model.modality === "vision" || (model.supports || []).includes("vision"))).length;
  const visionModels = list.length - textModels;

  return (
    <div className="space-y-8">
      <PageHero
        title="Models"
        description="Supported model registry"
        badge={
          <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
            {list.length} registered
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <MetricCard icon={Boxes} label="Registry Size" value={list.length} hint="Models exposed by the backend" />
        <MetricCard icon={Type} label="Text Models" value={textModels} hint="Instruction and completion stacks" />
        <MetricCard icon={ImageIcon} label="Vision Models" value={visionModels} hint="Multimodal backbones" accent={visionModels > 0} />
      </div>

      <ConsoleSection title="Registry Catalog" icon={Database} badge={loading ? "Refreshing catalog" : `${list.length} cards`}>
        {loading ? (
          <p className="text-neu-dim text-sm py-10 text-center">Loading registry...</p>
        ) : error ? (
          <div className="neu-trough p-10 text-center text-red-400 rounded-xl">
            <Boxes size={28} className="mx-auto mb-3 opacity-40" />
            {error}
          </div>
        ) : list.length === 0 ? (
          <EmptyPanel icon={Boxes} title="Model registry is empty" description="Expose models from the backend to seed new runs." />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {list.map((model) => {
              const isVision = model.modality === "vision" || (model.supports || []).includes("vision");
              return (
                <div key={model.id} className="neu-plate p-6 rounded-2xl flex flex-col gap-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-neu-text">{model.name}</h3>
                        <span className="neu-badge neu-badge-accent flex items-center gap-1">
                          {isVision ? <ImageIcon size={11} /> : <Type size={11} />}
                          {isVision ? "Vision" : "Text"}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-neu-dim mt-2 break-all">{model.id}</p>
                    </div>
                    <span className="neu-badge">{model.parameters}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(model.supports || []).map((s) => (
                      <span key={s} className="text-[10px] font-mono uppercase tracking-widest text-neu-dim/70 bg-neu-dark/50 px-2 py-1 rounded-md border border-white/5">
                        {METHOD_LABEL[s] || s}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-mono uppercase tracking-widest">
                    <div className="neu-trough rounded-xl px-3 py-2 text-neu-dim">VRAM {model.min_vram} GB+</div>
                    <div className="neu-trough rounded-xl px-3 py-2 text-neu-dim">CTX {Math.round((model.context_length || 0) / 1024)}k</div>
                    <div className="neu-trough rounded-xl px-3 py-2 text-neu-dim truncate">{model.license}</div>
                  </div>

                  <button
                    onClick={() => selectModel(model)}
                    className="group relative flex items-center justify-center gap-3 px-5 py-3 rounded-[18px] font-bold tracking-widest text-[12px] uppercase bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98] transition-all mt-2"
                  >
                    <span className="group-hover:text-neu-accent transition-colors">Use in New Run</span>
                    <ArrowRight size={14} className="text-neu-accent" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ConsoleSection>
    </div>
  );
}
