import React, { useRef, useCallback } from 'react';
import { Cpu, Globe, ChevronDown } from 'lucide-react';

import { OPENAI_MODELS, CustomSelect, ProviderBtn, LocalSection, ApiSection } from './LLMSetup';

// ─── Slider ───────────────────────────────────────────────────────────────────

export function Slider({ label, min, max, step, value, onChange, disabled }) {
    const trackRef = useRef(null);
    const isDragging = useRef(false);
    const [active, setActive] = React.useState(false);
    const [dragPct, setDragPct] = React.useState(null); // Pure visual tracking

    const clamp = useCallback((raw) => {
        const steps = Math.round((raw - min) / step);
        const snapped = min + steps * step;
        const clamped = Math.min(max, Math.max(min, snapped));
        return step < 1 ? parseFloat(clamped.toFixed(2)) : Math.round(clamped);
    }, [min, max, step]);

    const handlePointerMove = useCallback((e) => {
        if (!trackRef.current || disabled) return;
        const rect = trackRef.current.getBoundingClientRect();
        // Calculate clamped ratio strictly between 0 and 1
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));

        // 1. Update visual indicator smoothly (no steps)
        setDragPct(ratio * 100);

        // 2. Propagate the snapped value to parent
        onChange(clamp(min + ratio * (max - min)));
    }, [min, max, clamp, onChange, disabled]);

    const onPointerDown = useCallback((e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        setActive(true);
        handlePointerMove(e);
    }, [disabled, handlePointerMove]);

    const onPointerMove = useCallback((e) => {
        if (!isDragging.current) return;
        handlePointerMove(e);
    }, [handlePointerMove]);

    const onPointerUp = useCallback(() => {
        isDragging.current = false;
        setActive(false);
        setDragPct(null); // Snap back to true value visually on release
    }, []);

    // If actively dragging, use the buttery smooth internal percentage. 
    // Otherwise, base the visual position on the parent's actual grounded value.
    const pct = active && dragPct !== null
        ? dragPct
        : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

    return (
        <div className="select-none">
            <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold text-neu-dim tracking-widest uppercase">{label}</label>
                <span
                    className="text-xs font-mono px-2 py-0.5 rounded border transition-all duration-200"
                    style={{
                        color: active ? 'var(--accent-light)' : 'var(--accent)',
                        background: active ? 'rgba(255,107,0,0.15)' : 'rgba(255,107,0,0.08)',
                        borderColor: active ? 'rgba(255,107,0,0.4)' : 'rgba(255,107,0,0.2)',
                        boxShadow: active ? '0 0 8px rgba(255,107,0,0.3)' : 'none',
                    }}
                >
                    {value}
                </span>
            </div>

            {/* Track area — captures pointer events */}
            <div
                ref={trackRef}
                className={`relative h-10 flex items-center touch-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                {/* Sunken trough */}
                <div
                    className="absolute inset-y-0 my-auto w-full rounded-full pointer-events-none"
                    style={{
                        height: '8px',
                        background: 'var(--bg-dark)',
                        boxShadow: 'inset 3px 3px 7px #111315, inset -3px -3px 7px #2c323a',
                        border: '1px solid rgba(0,0,0,0.35)',
                    }}
                />

                {/* Filled portion */}
                <div
                    className="absolute left-0 rounded-full pointer-events-none"
                    style={{
                        height: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: `${pct}%`,
                        background: active
                            ? 'linear-gradient(90deg, #ff6b00, #ff9d4d)'
                            : 'linear-gradient(90deg, #cc5500, #ff6b00)',
                        boxShadow: active
                            ? '0 0 12px rgba(255,107,0,0.7), 0 0 24px rgba(255,107,0,0.3)'
                            : '0 0 6px rgba(255,107,0,0.4)',
                        transition: 'background 0.2s ease, box-shadow 0.2s ease',
                        borderRadius: '99px',
                    }}
                />

                {/* Thumb */}
                <div
                    className="absolute pointer-events-none flex items-center justify-center"
                    style={{
                        left: `calc(${pct}% - ${active ? 13 : 11}px)`,
                        top: '50%',
                        transform: `translateY(-50%) scale(${active ? 1.15 : 1})`,
                        width: active ? '26px' : '22px',
                        height: active ? '26px' : '22px',
                        borderRadius: '50%',
                        background: 'var(--bg-dark)',
                        border: active ? '2px solid var(--accent)' : '1px solid rgba(255,107,0,0.4)',
                        boxShadow: active
                            ? `0 0 16px rgba(255,107,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1), 4px 4px 10px rgba(0,0,0,0.6)`
                            : `0 4px 8px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.05)`,
                        transition: 'width 0.15s ease, height 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, border 0.15s ease',
                        zIndex: 10,
                    }}
                >
                    {/* Inner glowing core */}
                    <div
                        style={{
                            width: active ? '8px' : '4px',
                            height: active ? '8px' : '4px',
                            borderRadius: '50%',
                            background: active ? 'var(--accent-light)' : 'var(--accent)',
                            boxShadow: active ? '0 0 10px var(--accent-light)' : 'none',
                            transition: 'all 0.15s ease',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Main Settings Panel ──────────────────────────────────────────────────────
export default function SettingsPanel({ pipelineConfig, setPipelineConfig, generationConfig, setGenerationConfig }) {
    const provider = generationConfig.provider ?? 'local';
    const setProvider = (p) => setGenerationConfig(prev => ({
        ...prev, provider: p,
        model_name: p === 'openai' ? OPENAI_MODELS[0].id : prev.model_name,
    }));

    return (
        <div className="space-y-10">

            {/* ── Chunking ────────────────────────────────────────── */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="led led-on" />
                    <h3 className="text-xs font-bold text-neu-dim tracking-widest uppercase">Chunking</h3>
                </div>
                <div className="neu-trough p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Slider
                        label="Chunk Size (tokens)"
                        min={200} max={2000} step={50}
                        value={pipelineConfig.chunk_size}
                        onChange={v => setPipelineConfig(prev => ({ ...prev, chunk_size: v }))}
                    />
                    <Slider
                        label="Chunk Overlap"
                        min={0} max={500} step={10}
                        value={pipelineConfig.chunk_overlap}
                        onChange={v => setPipelineConfig(prev => ({ ...prev, chunk_overlap: v }))}
                    />
                    <Slider
                        label="Similarity Threshold"
                        min={0.5} max={1.0} step={0.01}
                        value={pipelineConfig.similarity_threshold}
                        onChange={v => setPipelineConfig(prev => ({ ...prev, similarity_threshold: v }))}
                    />
                </div>
            </section>

            {/* ── Generation ──────────────────────────────────────── */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="led led-on" />
                    <h3 className="text-xs font-bold text-neu-dim tracking-widest uppercase">Generation</h3>
                </div>

                <div className="neu-plate rounded-2xl overflow-hidden">
                    {/* Provider toggle */}
                    <div className="flex gap-4 p-5 border-b border-white/[0.03]">
                        <ProviderBtn
                            active={provider === 'local'}
                            onClick={() => setProvider('local')}
                            icon={Cpu}
                            label="Local (Ollama)"
                            sublabel="Free · Runs on your machine"
                        />
                        <ProviderBtn
                            active={provider === 'openai'}
                            onClick={() => setProvider('openai')}
                            icon={Globe}
                            label="OpenAI API"
                            sublabel="GPT-4o · Requires API key"
                        />
                    </div>

                    {/* Provider-specific fields */}
                    <div className="p-6 border-b border-white/[0.03]">
                        {provider === 'local'
                            ? <LocalSection generationConfig={generationConfig} setGenerationConfig={setGenerationConfig} />
                            : <ApiSection generationConfig={generationConfig} setGenerationConfig={setGenerationConfig} />
                        }
                    </div>

                    {/* Shared params */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-white/[0.03]">
                        <Slider
                            label="Temperature"
                            min={0.0} max={2.0} step={0.1}
                            value={generationConfig.temperature}
                            onChange={v => setGenerationConfig(prev => ({ ...prev, temperature: v }))}
                        />
                        <div>
                            <label className="block text-xs font-bold text-neu-dim tracking-widest uppercase mb-3">Output Format</label>
                            <CustomSelect
                                value={generationConfig.format}
                                onChange={v => setGenerationConfig(prev => ({ ...prev, format: v }))}
                                options={[
                                    { value: 'alpaca', label: 'Alpaca' },
                                    { value: 'sharegpt', label: 'ShareGPT' },
                                    { value: 'openai', label: 'OpenAI Chat' },
                                ]}
                            />
                        </div>
                        <div className="col-span-full">
                            <label className="block text-xs font-bold text-neu-dim tracking-widest uppercase mb-3">Domain Context</label>
                            <input
                                type="text"
                                value={generationConfig.domain}
                                onChange={e => setGenerationConfig(prev => ({ ...prev, domain: e.target.value }))}
                                placeholder="e.g. Finance, Biology, General"
                                className="neu-input"
                            />
                            <p className="text-[10px] font-mono text-neu-dim mt-2">Helps the LLM tailor QA pairs to your content area.</p>
                        </div>
                    </div>

                    {/* Advanced (collapsible) */}
                    <div className="p-6">
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer list-none mb-0">
                                <span className="text-xs font-bold text-neu-dim tracking-widest uppercase">Advanced Parameters</span>
                                <div className="neu-btn-sm !p-1.5">
                                    <ChevronDown size={12} className="group-open:rotate-180 transition-transform duration-300" />
                                </div>
                            </summary>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-white/[0.03]">
                                <Slider
                                    label="Top P"
                                    min={0.0} max={1.0} step={0.05}
                                    value={generationConfig.top_p ?? 1.0}
                                    onChange={v => setGenerationConfig(prev => ({ ...prev, top_p: v }))}
                                />
                                <Slider
                                    label="Presence Penalty"
                                    min={0.0} max={2.0} step={0.1}
                                    value={generationConfig.presence_penalty ?? 0.0}
                                    onChange={v => setGenerationConfig(prev => ({ ...prev, presence_penalty: v }))}
                                />
                                <Slider
                                    label="Frequency Penalty"
                                    min={0.0} max={2.0} step={0.1}
                                    value={generationConfig.frequency_penalty ?? 0.0}
                                    onChange={v => setGenerationConfig(prev => ({ ...prev, frequency_penalty: v }))}
                                />
                                <Slider
                                    label="QA Count Multiplier"
                                    min={0.5} max={3.0} step={0.1}
                                    value={generationConfig.qa_density_factor ?? 1.0}
                                    onChange={v => setGenerationConfig(prev => ({ ...prev, qa_density_factor: v }))}
                                />
                                <div>
                                    <label className="block text-xs font-bold text-neu-dim tracking-widest uppercase mb-3">Max Response Tokens</label>
                                    <input
                                        type="number"
                                        value={generationConfig.max_tokens ?? 0}
                                        onChange={e => setGenerationConfig(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 0 }))}
                                        className="neu-input font-mono"
                                    />
                                    <p className="text-[10px] font-mono text-neu-dim mt-2">Set to 0 for model default.</p>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>
            </section>
        </div>
    );
}
