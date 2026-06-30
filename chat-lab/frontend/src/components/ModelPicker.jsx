import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Sparkles, Box } from 'lucide-react';
import { modelApi } from '../modules/chat/services/modelApi';

/** Build the target payload the backend expects from a model record. */
export function toTarget(record) {
  if (!record) return null;
  return record.kind === 'finetuned'
    ? { run_id: record.run_id, base_model: null }
    : { run_id: null, base_model: record.base_model };
}

const keyOf = (r) => (r.kind === 'finetuned' ? `ft:${r.run_id}` : `base:${r.base_model}`);

/**
 * Dropdown of all chat-able models (fine-tuned runs + base models).
 * `value` is the selected record; `onChange(record)` fires on selection.
 */
export default function ModelPicker({ value, onChange, label = 'Model' }) {
  const [finetuned, setFinetuned] = useState([]);
  const [base, setBase] = useState([]);
  const [loading, setLoading] = useState(false);

  // Manual refresh (event handler) — fine to flip the spinner synchronously.
  const load = () => {
    setLoading(true);
    Promise.all([modelApi.getFinetuned(), modelApi.getBase()])
      .then(([ft, b]) => { setFinetuned(ft); setBase(b); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Initial fetch: state is set only inside the async callbacks, never
  // synchronously in the effect body.
  useEffect(() => {
    Promise.all([modelApi.getFinetuned(), modelApi.getBase()])
      .then(([ft, b]) => { setFinetuned(ft); setBase(b); })
      .catch(() => {});
  }, []);

  const lookup = useMemo(() => {
    const m = {};
    [...finetuned, ...base].forEach((r) => { m[keyOf(r)] = r; });
    return m;
  }, [finetuned, base]);

  const selectedKey = value ? keyOf(value) : '';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">{label}</label>
        <button onClick={load} className="neu-btn-sm" title="Refresh model list">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <select
        className="neu-input cursor-pointer"
        value={selectedKey}
        onChange={(e) => onChange(lookup[e.target.value] || null)}
      >
        <option value="" disabled>Select a model…</option>
        {finetuned.length > 0 && (
          <optgroup label="🔶 Fine-tuned runs">
            {finetuned.map((r) => (
              <option key={keyOf(r)} value={keyOf(r)}>
                {r.label}{r.final_loss != null ? ` · loss ${r.final_loss}` : ''}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="⬜ Base models">
          {base.map((r) => (
            <option key={keyOf(r)} value={keyOf(r)}>{r.label}</option>
          ))}
        </optgroup>
      </select>

      {value && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-neu-dim px-1">
          {value.kind === 'finetuned'
            ? <><Sparkles size={11} className="text-neu-accent" /> base: {value.base_model} · {value.training_type?.toUpperCase()} · {value.load_in_4bit ? '4-bit' : '16-bit'}</>
            : <><Box size={11} /> {value.base_model}</>}
        </div>
      )}
      {finetuned.length === 0 && !loading && (
        <p className="text-[10px] text-neu-dim/70 px-1 italic">
          No fine-tuned runs found yet — train one in Finetune Lab, or pick a base model.
        </p>
      )}
    </div>
  );
}
