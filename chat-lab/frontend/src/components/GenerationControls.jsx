import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

export const DEFAULT_PARAMS = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 20,
  repetition_penalty: 1.1,
  max_new_tokens: 512,
  seed: null,
};

const SLIDERS = [
  { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.05, hint: '0 = deterministic, higher = more creative' },
  { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.01, hint: 'nucleus sampling' },
  { key: 'top_k', label: 'Top K', min: 0, max: 100, step: 1, hint: 'limit to K most likely tokens' },
  { key: 'repetition_penalty', label: 'Repetition Penalty', min: 1, max: 2, step: 0.01, hint: '>1 discourages repeats' },
  { key: 'max_new_tokens', label: 'Max New Tokens', min: 16, max: 4096, step: 16, hint: 'response length cap' },
];

function Track({ pct }) {
  return (
    <div className="neu-progress-track w-full mt-2" style={{ height: 6 }}>
      <div className="neu-progress-fill" style={{ width: `${pct}%` }}></div>
    </div>
  );
}

export default function GenerationControls({ params, onChange }) {
  const set = (key, val) => onChange({ ...params, [key]: val });

  return (
    <div className="neu-section">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold text-sm">
          <SlidersHorizontal size={16} className="text-neu-dim" />
          Generation
        </h2>
      </div>
      <div className="neu-section-body space-y-5">
        {SLIDERS.map(({ key, label, min, max, step, hint }) => {
          const val = params[key] ?? DEFAULT_PARAMS[key];
          const pct = ((val - min) / (max - min)) * 100;
          return (
            <div key={key}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neu-text">{label}</label>
                <span className="neu-chip">{val}</span>
              </div>
              <input
                type="range"
                min={min} max={max} step={step} value={val}
                onChange={(e) => set(key, key === 'top_k' || key === 'max_new_tokens' ? parseInt(e.target.value) : parseFloat(e.target.value))}
                className="w-full mt-1"
              />
              <Track pct={pct} />
              <p className="text-[10px] text-neu-dim/70 mt-1">{hint}</p>
            </div>
          );
        })}

        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-neu-text">Seed</label>
            <span className="text-[10px] text-neu-dim font-mono">{params.seed ?? 'random'}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="neu-input flex-1"
              placeholder="random"
              value={params.seed ?? ''}
              onChange={(e) => set('seed', e.target.value === '' ? null : parseInt(e.target.value))}
            />
            <button className="neu-btn px-4 text-xs" onClick={() => onChange({ ...DEFAULT_PARAMS })}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
