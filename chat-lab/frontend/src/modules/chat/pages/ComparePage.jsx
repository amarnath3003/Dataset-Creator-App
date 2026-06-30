import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { GitCompareArrows, Play, Wand2, Gauge, Timer, Hash } from 'lucide-react';
import { useToast } from '../../../components/Toast';
import ModelPicker from '../../../components/ModelPicker';
import GenerationControls, { DEFAULT_PARAMS } from '../../../components/GenerationControls';
import { compare } from '../services/chatApi';

function ResultColumn({ side, model, result, running }) {
  return (
    <div className="neu-section !mb-0 flex flex-col">
      <div className="neu-section-header">
        <h3 className="flex items-center gap-2 text-neu-text font-bold text-sm">
          <span className={`neu-badge ${side === 'A' ? 'neu-badge-accent' : 'neu-badge-green'}`}>{side}</span>
          {model ? model.label : 'No model'}
        </h3>
      </div>
      <div className="neu-section-body flex-1">
        {running && <p className="text-neu-dim text-sm flex items-center gap-2"><span className="inline-block w-1.5 h-1.5 rounded-full bg-neu-accent animate-pulse" /> generating…</p>}
        {!running && result?.error && <p className="text-red-400 text-sm font-mono">⚠ {result.error}</p>}
        {!running && result?.text && (
          <>
            <div className="prose-chat text-sm leading-relaxed"><ReactMarkdown>{result.text}</ReactMarkdown></div>
            {result.stats && (
              <div className="flex items-center gap-3 text-[10px] text-neu-dim font-mono mt-4 pt-3 border-t border-white/5">
                <span className="flex items-center gap-1"><Hash size={11} />{result.stats.completion_tokens} tok</span>
                <span className="flex items-center gap-1"><Gauge size={11} />{result.stats.tokens_per_second} tok/s</span>
                <span className="flex items-center gap-1"><Timer size={11} />{result.stats.time_to_first_token_s}s TTFT</span>
              </div>
            )}
          </>
        )}
        {!running && !result && <p className="text-neu-dim/50 text-sm italic">Run a prompt to see this model's response.</p>}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const toast = useToast();
  const [modelA, setModelA] = useState(null);
  const [modelB, setModelB] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [prompt, setPrompt] = useState('');
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const [results, setResults] = useState([null, null]);
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const baseVsFinetuned = () => {
    const ft = [modelA, modelB].find((m) => m?.kind === 'finetuned');
    if (!ft) { toast.warn('Pick a fine-tuned model first (A or B)'); return; }
    setModelA(ft);
    setModelB({ kind: 'base', base_model: ft.base_model, label: `${ft.base_model.split('/').pop()} · BASE`, load_in_4bit: ft.load_in_4bit, max_seq_length: ft.max_seq_length });
    toast.info('Set B to the base model of A');
  };

  const targetOf = (m) => (m.kind === 'finetuned' ? { run_id: m.run_id } : { base_model: m.base_model });

  const run = async () => {
    if (!modelA || !modelB) { toast.error('Pick both models'); return; }
    if (!prompt.trim()) { toast.error('Enter a prompt'); return; }
    setRunning(true);
    setResults([null, null]);
    try {
      const { results: res } = await compare({
        targets: [targetOf(modelA), targetOf(modelB)],
        system_prompt: systemPrompt,
        messages: [{ role: 'user', content: prompt.trim() }],
        params,
      });
      setResults(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="neu-section !mb-0">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold text-sm">
            <GitCompareArrows size={16} className="text-neu-dim" /> Side-by-side Compare
          </h2>
          <button className="neu-btn-sm" onClick={baseVsFinetuned} title="Set B to the base model of A">
            <Wand2 size={13} /> Base vs Fine-tuned
          </button>
        </div>
        <div className="neu-section-body space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ModelPicker label="Model A" value={modelA} onChange={setModelA} />
            <ModelPicker label="Model B" value={modelB} onChange={setModelB} />
          </div>

          <div>
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">System Prompt</label>
            <textarea className="neu-textarea mt-2" rows={2} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
          </div>

          <div>
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Prompt</label>
            <textarea
              className="neu-textarea mt-2" rows={4}
              placeholder="Ask both models the same thing…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <button className="neu-btn px-4 py-2 text-xs" onClick={() => setShowSettings((s) => !s)}>
              {showSettings ? 'Hide' : 'Show'} generation settings
            </button>
            <button className="neu-btn-primary px-8 py-3 disabled:opacity-40" onClick={run} disabled={running}>
              <Play size={16} /> {running ? 'Running…' : 'Run Comparison'}
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="max-w-md"><GenerationControls params={params} onChange={setParams} /></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResultColumn side="A" model={modelA} result={results[0]} running={running} />
        <ResultColumn side="B" model={modelB} result={results[1]} running={running} />
      </div>
    </div>
  );
}
