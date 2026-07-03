import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Server, Download, Upload, Search, Database, Image as ImageIcon, Type, Loader2 } from "lucide-react";
import { models } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { useHfSearch } from "../hooks/useHfSearch";
import { METHOD_LABEL } from "../lib/format";

export default function ModelSelectionPage() {
  const navigate = useNavigate();
  const { draft, update } = useWizard();
  const [source, setSource] = useState(draft.modelSource || "registry");
  const [hfModelId, setHfModelId] = useState(draft.modelSource !== "registry" ? draft.modelId || "" : "");
  const [selectedRegistryId, setSelectedRegistryId] = useState(draft.modelSource === "registry" ? draft.modelId : null);
  const [registryModels, setRegistryModels] = useState([]);
  const [registryQuery, setRegistryQuery] = useState("");
  const [registryError, setRegistryError] = useState(null);
  const [registryLoading, setRegistryLoading] = useState(true);

  const [hfDropdownOpen, setHfDropdownOpen] = useState(false);
  const { suggestions: hfSuggestions, loading: hfSearching } = useHfSearch(
    source === "huggingface" ? hfModelId : "",
    models.searchHf
  );

  const localFileInputRef = useRef(null);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    models
      .list()
      .then(setRegistryModels)
      .catch((e) => setRegistryError(e.message || "Failed to load model registry."))
      .finally(() => setRegistryLoading(false));
  }, []);

  const filteredRegistryModels = registryModels.filter((m) => {
    const q = registryQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.family || "").toLowerCase().includes(q)
    );
  });

  const handleLocalUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingModel(true);
    setUploadError(null);
    try {
      const res = await models.uploadLocal(fileList);
      setHfModelId(res.path);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploadingModel(false);
    }
  };

  const chosenId = source === "registry" ? selectedRegistryId : hfModelId.trim();
  const isValid = Boolean(chosenId);

  const proceed = () => {
    if (source === "registry") {
      const model = registryModels.find((m) => m.id === selectedRegistryId) || null;
      update({ modelId: selectedRegistryId, modelData: model, modelSource: "registry" });
    } else {
      update({ modelId: hfModelId.trim(), modelData: null, modelSource: source });
    }
    navigate("/finetune/new/dataset");
  };

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
        <p className="text-neu-dim text-sm">Select a base model from the registry, Hugging Face, or upload a local file.</p>

        {/* Source Toggle */}
        <div className="flex bg-neu-dark p-1.5 rounded-[22px] shadow-[var(--sh-trough)] max-w-xl w-full border border-black/50">
          {[
            { id: "registry", label: "Registry", Icon: Database },
            { id: "huggingface", label: "Hugging Face", Icon: Download },
            { id: "local", label: "Local File", Icon: Upload },
          ].map((tab) => {
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSource(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase transition-all duration-300 ${source === tab.id ? "bg-neu-base text-neu-accent shadow-[var(--sh-flat)]" : "text-neu-dim hover:text-neu-text"}`}
              >
                <TabIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="neu-plate p-10 min-h-[300px] flex flex-col justify-center rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-neu-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>

          {source === "registry" ? (
            <div className="flex flex-col gap-4 relative z-10 animate-in fade-in zoom-in-95 duration-300">
              <div className="neu-trough relative max-w-md w-full">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neu-dim">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  value={registryQuery}
                  onChange={(e) => setRegistryQuery(e.target.value)}
                  placeholder="Search registry models…"
                  className="neu-input bg-transparent shadow-none pl-10"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRegistryModels.map((model) => {
                const isVision = model.modality === "vision" || (model.supports || []).includes("vision");
                return (
                  <div
                    key={model.id}
                    onClick={() => setSelectedRegistryId(model.id)}
                    className={`neu-plate p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${selectedRegistryId === model.id ? "border-neu-accent shadow-[0_0_20px_rgba(255,107,0,0.15)]" : "border-transparent hover:border-neu-dim/20"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-neu-text font-bold text-lg">{model.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-neu-dark px-2 py-1 rounded-md text-neu-accent">{model.parameters}</span>
                    </div>
                    <p className="text-neu-dim text-xs mb-3 font-mono break-all">{model.id}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(model.supports || []).slice(0, 5).map((s) => (
                        <span key={s} className="text-[9px] font-mono uppercase tracking-widest text-neu-dim/70 bg-neu-dark/60 px-1.5 py-0.5 rounded border border-white/5">
                          {METHOD_LABEL[s] || s}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="neu-badge neu-badge-accent flex items-center gap-1">
                        {isVision ? <ImageIcon size={10} /> : <Type size={10} />}
                        {isVision ? "Vision" : "Text"}
                      </span>
                      <span className="text-[10px] text-neu-dim/70 uppercase tracking-widest bg-neu-dark/50 px-2 py-1 rounded-md border border-white/5">VRAM {model.min_vram}GB+</span>
                      <span className="text-[10px] text-neu-dim/70 uppercase tracking-widest bg-neu-dark/50 px-2 py-1 rounded-md border border-white/5">CTX {Math.round(model.context_length / 1024)}k</span>
                    </div>
                  </div>
                );
              })}
              {registryError && (
                <div className="col-span-full text-center text-red-400 py-10">
                  <Database size={32} className="mx-auto mb-4 opacity-50" />
                  <p>{registryError}</p>
                </div>
              )}
              {!registryError && registryLoading && (
                <div className="col-span-full text-center text-neu-dim py-10">
                  <Database size={32} className="mx-auto mb-4 opacity-50" />
                  <p>Loading model registry…</p>
                </div>
              )}
              {!registryError && !registryLoading && registryModels.length === 0 && (
                <div className="col-span-full text-center text-neu-dim py-10">
                  <Database size={32} className="mx-auto mb-4 opacity-50" />
                  <p>Model registry is empty.</p>
                </div>
              )}
              {!registryError && registryModels.length > 0 && filteredRegistryModels.length === 0 && (
                <div className="col-span-full text-center text-neu-dim py-10">
                  <Search size={32} className="mx-auto mb-4 opacity-50" />
                  <p>No registry models match "{registryQuery}".</p>
                </div>
              )}
              </div>
            </div>
          ) : source === "huggingface" ? (
            <div className="flex flex-col gap-4 max-w-lg w-full mx-auto relative z-10 animate-in fade-in zoom-in-95 duration-300">
              <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Model ID</label>
              <div className="neu-trough relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-neu-dim">
                  <Search size={20} />
                </div>
                <input
                  type="text"
                  value={hfModelId}
                  onChange={(e) => setHfModelId(e.target.value)}
                  onFocus={() => hfSuggestions.length > 0 && setHfDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setHfDropdownOpen(false), 150)}
                  placeholder="unsloth/llama-3-8b-Instruct-bnb-4bit"
                  className="neu-input bg-transparent shadow-none pl-14 h-16 text-lg placeholder:text-neu-dim/30 focus:text-neu-accent outline-none"
                />
                {hfSearching && (
                  <Loader2 size={18} className="animate-spin absolute right-5 top-1/2 -translate-y-1/2 text-neu-dim" />
                )}
                {hfDropdownOpen && hfSuggestions.length > 0 && (
                  <div className="absolute z-20 top-full mt-2 w-full neu-plate rounded-xl overflow-hidden border border-white/5 max-h-72 overflow-y-auto shadow-lg">
                    {hfSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setHfModelId(s.id);
                          setHfDropdownOpen(false);
                        }}
                        className="w-full text-left px-5 py-3 text-sm font-mono text-neu-dim hover:bg-neu-dark hover:text-neu-accent transition-colors flex justify-between items-center gap-3"
                      >
                        <span className="truncate">{s.id}</span>
                        {s.downloads != null && (
                          <span className="text-[10px] text-neu-dim/50 shrink-0">{s.downloads.toLocaleString()} DL</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs font-mono text-neu-dim/60">Enter the repo name as it appears on Hugging Face. Unsloth 4-bit repos train fastest.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-lg w-full mx-auto relative z-10 animate-in fade-in zoom-in-95 duration-300">
              <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Local Model Path</label>
              <div className="neu-trough relative">
                <input
                  type="text"
                  value={hfModelId}
                  onChange={(e) => setHfModelId(e.target.value)}
                  placeholder="/path/to/local/model"
                  className="neu-input bg-transparent shadow-none"
                />
              </div>
              <input
                ref={localFileInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                className="sr-only"
                onChange={(e) => handleLocalUpload(e.target.files)}
              />
              <button
                type="button"
                onClick={() => !uploadingModel && localFileInputRef.current?.click()}
                className="neu-trough p-4 flex items-center justify-center gap-3 border-2 border-dashed border-white/5 hover:border-neu-dim/20 cursor-pointer transition-colors rounded-xl text-neu-dim hover:text-neu-text"
              >
                {uploadingModel ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span className="text-xs font-mono uppercase tracking-widest">
                  {uploadingModel ? "Uploading model…" : "Browse Local Model Folder"}
                </span>
              </button>
              {uploadError && <p className="text-xs text-red-400 font-mono">{uploadError}</p>}
              <p className="text-xs font-mono text-neu-dim/60">
                Browse to upload a local model folder and auto-fill its server path, or type a path that already exists on the training server (safetensors / GGUF).
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
          <Button
            onClick={proceed}
            variant="primary"
            size="lg"
            disabled={!isValid}
            className={!isValid ? "opacity-50 cursor-not-allowed" : ""}
          >
            Next: Select Dataset
          </Button>
        </div>
      </div>
    </div>
  );
}
