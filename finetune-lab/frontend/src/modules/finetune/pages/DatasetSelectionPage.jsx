import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Database, Upload, Check, Loader2, AlertTriangle, FileJson, Download } from 'lucide-react';
import { datasetApi } from '../services/datasetApi';
import { useWizard } from '../context/WizardContext';

// Schemas the SFT engine can train on directly. PREFERENCE is DPO-only.
const SFT_OK = new Set(['instruction', 'chatml', 'sharegpt', 'completion']);

const FORMAT_LABEL = {
  instruction: 'Instruction',
  chatml: 'ChatML',
  sharegpt: 'ShareGPT',
  completion: 'Completion',
  preference: 'Preference (DPO)',
  unknown: 'Unknown',
};

export default function DatasetSelectionPage() {
  const navigate = useNavigate();
  const { update } = useWizard();
  const fileInputRef = useRef(null);

  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [source, setSource] = useState('uploaded'); // 'uploaded' | 'hf'
  const [hfDatasetId, setHfDatasetId] = useState('');

  const selected = datasets.find((d) => d.id === selectedId) || null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await datasetApi.list();
      setDatasets(list);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const ds = await datasetApi.upload(file);
      await refresh();
      setSelectedId(ds.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const formatBadge = (fmt) => {
    const ok = SFT_OK.has(fmt);
    const cls = ok ? 'neu-badge-green' : 'neu-badge-accent';
    return <span className={`neu-badge ${cls} self-start`}>{FORMAT_LABEL[fmt] || fmt}</span>;
  };

  const selectedUnsupported = selected && !SFT_OK.has(selected.format);
  const canProceed = source === 'hf' ? hfDatasetId.trim().length > 0 : (selected && !selectedUnsupported);

  const proceed = () => {
    const patch =
      source === 'hf'
        ? {
            datasetPath: hfDatasetId.trim(),
            datasetName: hfDatasetId.trim(),
            datasetFormat: 'huggingface',
            datasetRows: null,
          }
        : {
            datasetPath: selected.path,
            datasetName: selected.name,
            datasetFormat: selected.format,
            datasetRows: selected.rows,
          };
    update(patch);
    navigate('/finetune/new/config');
  };

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
        <p className="text-neu-dim text-sm">
          Select a dataset generated from Dataset Lab, or upload a new JSONL / JSON / CSV file.
        </p>

        {error && (
          <div className="neu-alert-warn">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Source toggle */}
        <div className="flex bg-neu-dark p-1.5 rounded-[22px] shadow-[var(--sh-trough)] max-w-md w-full border border-black/50">
          <button
            onClick={() => setSource('uploaded')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold tracking-widest uppercase transition-all duration-300 ${source === 'uploaded' ? 'bg-neu-base text-neu-accent shadow-[var(--sh-flat)]' : 'text-neu-dim hover:text-neu-text'}`}
          >
            <Upload size={15} /> Uploaded / Local
          </button>
          <button
            onClick={() => setSource('hf')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold tracking-widest uppercase transition-all duration-300 ${source === 'hf' ? 'bg-neu-base text-neu-accent shadow-[var(--sh-flat)]' : 'text-neu-dim hover:text-neu-text'}`}
          >
            <Download size={15} /> Hugging Face
          </button>
        </div>

        {source === 'hf' && (
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Dataset ID</label>
            <div className="neu-trough">
              <input
                type="text"
                value={hfDatasetId}
                onChange={(e) => setHfDatasetId(e.target.value)}
                placeholder="unsloth/LaTeX_OCR"
                className="neu-input bg-transparent shadow-none"
              />
            </div>
            <p className="text-[11px] text-neu-dim">
              Load a dataset directly from the Hugging Face Hub. Required for image datasets used in{' '}
              <span className="font-mono text-neu-dim">Vision</span> fine-tuning (e.g.{' '}
              <span className="font-mono text-neu-dim">unsloth/LaTeX_OCR</span>).
            </p>
          </div>
        )}

        {/* Hidden uploader */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsonl,.json,.csv,.parquet"
          className="sr-only"
          onChange={(e) => handleUpload(e.target.files[0])}
        />

        {source === 'uploaded' && (loading ? (
          <div className="neu-trough p-12 flex flex-col items-center justify-center gap-3 text-neu-dim rounded-xl">
            <Loader2 size={24} className="animate-spin text-neu-accent" />
            <p className="text-xs font-mono uppercase tracking-widest">Scanning datasets…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                onClick={() => setSelectedId(ds.id)}
                className={`relative neu-plate p-6 flex flex-col gap-4 cursor-pointer transition-all duration-300 group ${
                  selectedId === ds.id
                    ? 'ring-1 ring-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.2)]'
                    : 'hover:-translate-y-1'
                }`}
              >
                {selectedId === ds.id && (
                  <div className="absolute top-4 right-4 text-neu-accent">
                    <Check size={18} />
                  </div>
                )}
                {formatBadge(ds.format)}
                <div>
                  <h3
                    className={`text-lg font-bold transition-colors break-all ${
                      selectedId === ds.id ? 'text-neu-accent' : 'group-hover:text-neu-text text-neu-dim'
                    }`}
                  >
                    {ds.name}
                  </h3>
                  <p className="text-sm text-neu-dim/70 mt-2">
                    {ds.rows != null ? `${ds.rows.toLocaleString()} rows` : 'unknown rows'}
                    {ds.columns?.length ? ` · ${ds.columns.length} cols` : ''}
                  </p>
                </div>
              </div>
            ))}

            {/* Upload tile */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="neu-trough p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/5 hover:border-neu-dim/20 cursor-pointer transition-colors text-center rounded-xl"
            >
              <div className="w-12 h-12 rounded-full neu-inset flex items-center justify-center text-neu-dim">
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
              </div>
              <div>
                <p className="font-semibold text-neu-text">{uploading ? 'Uploading…' : 'Upload Dataset'}</p>
                <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                  JSONL · JSON · CSV
                </p>
              </div>
            </div>

            {datasets.length === 0 && (
              <div className="md:col-span-2 neu-trough p-8 flex flex-col items-center justify-center gap-2 text-center rounded-xl text-neu-dim">
                <Database size={22} className="opacity-50" />
                <p className="text-sm">No datasets yet — upload one to begin.</p>
              </div>
            )}
          </div>
        ))}

        {/* Selected dataset detail */}
        {selected && (
          <div className="neu-plate p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-neu-text font-bold text-sm">
              <FileJson size={16} className="text-neu-accent" />
              {selected.name}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-widest text-neu-dim">
              <span className="bg-neu-dark/60 px-2 py-1 rounded-md border border-white/5">
                Format: {FORMAT_LABEL[selected.format] || selected.format}
              </span>
              <span className="bg-neu-dark/60 px-2 py-1 rounded-md border border-white/5">
                Rows: {selected.rows ?? '?'}
              </span>
              {selected.columns?.length > 0 && (
                <span className="bg-neu-dark/60 px-2 py-1 rounded-md border border-white/5">
                  Columns: {selected.columns.join(', ')}
                </span>
              )}
            </div>
            {selectedUnsupported && (
              <div className="neu-alert-warn">
                <AlertTriangle size={16} />
                <span>
                  {selected.format === 'preference'
                    ? 'Preference data (chosen/rejected) is for DPO, not SFT. Pick an instruction/chat dataset.'
                    : 'Could not detect a known schema. SFT expects instruction, chat, or text columns.'}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-white/5 mt-4">
          <Button onClick={() => navigate('/finetune/new/model')} variant="outline" size="lg">
            Back
          </Button>
          <Button
            onClick={proceed}
            variant="primary"
            size="lg"
            disabled={!canProceed}
            className={!canProceed ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Next: Training Config
          </Button>
        </div>
      </div>
    </div>
  );
}
