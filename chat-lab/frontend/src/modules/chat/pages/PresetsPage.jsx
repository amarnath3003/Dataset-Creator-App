import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ListChecks, Play, Gauge, Hash, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../../../components/Button";
import { useToast } from "../../../components/Toast";
import ModelPicker from "../../../components/ModelPicker";
import GenerationControls, { DEFAULT_PARAMS } from "../../../components/GenerationControls";
import { PageHero, ConsoleSection, EmptyPanel } from "../../../components/ConsolePage";
import { compare } from "../services/chatApi";

const STARTER_SETS = {
  Reasoning: [
    "If a train travels 60 km in 45 minutes, what is its speed in km/h?",
    "A bat and a ball cost $1.10 together. The bat costs $1 more than the ball. How much is the ball?",
    "Explain step by step why the sky appears blue.",
  ],
  Summarization: [
    "Summarize the theory of relativity in two sentences.",
    "Give me a one-line TL;DR of how transformers work.",
  ],
  "Style / persona": [
    "Introduce yourself.",
    "Write a haiku about machine learning.",
    "Explain recursion to a five year old.",
  ],
};

export default function PresetsPage() {
  const toast = useToast();
  const [model, setModel] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [promptsText, setPromptsText] = useState("");
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState({});
  const [showSettings, setShowSettings] = useState(false);

  const prompts = promptsText.split("\n").map((l) => l.trim()).filter(Boolean);
  const targetOf = (m) => (m.kind === "finetuned" ? { run_id: m.run_id } : { base_model: m.base_model });

  const runAll = async () => {
    if (!model) {
      toast.error("Pick a model");
      return;
    }
    if (!prompts.length) {
      toast.error("Add at least one prompt");
      return;
    }
    setRunning(true);
    setResults([]);
    setProgress(0);
    const collected = [];
    for (let i = 0; i < prompts.length; i++) {
      try {
        const { results: res } = await compare({
          targets: [targetOf(model)],
          system_prompt: systemPrompt,
          messages: [{ role: "user", content: prompts[i] }],
          params,
        });
        collected.push({ prompt: prompts[i], ...res[0] });
      } catch (e) {
        collected.push({ prompt: prompts[i], error: e.message });
      }
      setProgress(i + 1);
      setResults([...collected]);
    }
    setRunning(false);
    toast.success(`Ran ${prompts.length} prompts`);
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Presets"
        description="Batch prompt harness for repeatable sanity checks"
        badge={<span className="font-mono text-xs text-neu-accent tracking-widest uppercase">{prompts.length || 0} queued prompts</span>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <ConsoleSection title="Batch Eval" icon={ListChecks} badge="Prompt set, target selection, generation recipe" className="!mb-0">
            <div className="space-y-5">
              <ModelPicker value={model} onChange={setModel} />
              <div>
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">System Prompt</label>
                <textarea className="neu-textarea mt-2" rows={2} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Prompts (one per line)</label>
                  <span className="text-[10px] text-neu-dim font-mono">{prompts.length}</span>
                </div>
                <textarea
                  className="neu-textarea mt-2"
                  rows={6}
                  value={promptsText}
                  onChange={(e) => setPromptsText(e.target.value)}
                  placeholder="Ask one thing per line..."
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.keys(STARTER_SETS).map((k) => (
                    <button key={k} className="neu-btn-sm" onClick={() => setPromptsText((p) => (p ? p + "\n" : "") + STARTER_SETS[k].join("\n"))}>
                      + {k}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowSettings((s) => !s)}>
                {showSettings ? "Hide generation settings" : "Show generation settings"}
              </Button>
              <Button variant="primary" size="lg" className="w-full gap-2" onClick={runAll} disabled={running}>
                <Play size={16} />
                {running ? `Running ${progress}/${prompts.length}...` : `Run ${prompts.length || ""} Prompts`}
              </Button>
              {running && (
                <div className="neu-progress-track w-full">
                  <div className="neu-progress-fill" style={{ width: `${(progress / prompts.length) * 100}%` }} />
                </div>
              )}
            </div>
          </ConsoleSection>
          {showSettings && <GenerationControls params={params} onChange={setParams} />}
        </div>

        <div className="space-y-3">
          {results.length === 0 ? (
            <ConsoleSection title="Results" icon={ListChecks} badge="Rendered prompt outputs" className="!mb-0">
              <EmptyPanel
                icon={ListChecks}
                title="Results will appear here"
                description="Use this page to replay the same prompt pack against a fine-tuned target and inspect output quality quickly."
              />
            </ConsoleSection>
          ) : (
            results.map((r, i) => {
              const isOpen = open[i] ?? true;
              return (
                <div key={i} className="neu-chunk">
                  <div className="neu-chunk-header" onClick={() => setOpen((o) => ({ ...o, [i]: !isOpen }))}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown size={14} className="text-neu-dim flex-shrink-0" /> : <ChevronRight size={14} className="text-neu-dim flex-shrink-0" />}
                      <span className="text-sm font-semibold text-neu-text truncate">{r.prompt}</span>
                    </div>
                    {r.stats && (
                      <div className="flex items-center gap-3 text-[10px] text-neu-dim font-mono flex-shrink-0">
                        <span className="flex items-center gap-1"><Hash size={10} />{r.stats.completion_tokens}</span>
                        <span className="flex items-center gap-1"><Gauge size={10} />{r.stats.tokens_per_second}/s</span>
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1">
                      {r.error ? (
                        <p className="text-red-400 text-sm font-mono">Error: {r.error}</p>
                      ) : (
                        <div className="prose-chat text-sm leading-relaxed neu-trough p-4">
                          <ReactMarkdown>{r.text || ""}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
