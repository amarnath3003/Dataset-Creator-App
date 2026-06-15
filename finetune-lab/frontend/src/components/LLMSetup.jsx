/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { llmApi } from '../api/api';
import { RefreshCw, ChevronDown } from 'lucide-react';

export const OPENAI_MODELS = [
    { id: 'gpt-4o', label: 'Recommended' },
    { id: 'gpt-4o-mini', label: 'Fast · Cheap' },
    { id: 'gpt-4-turbo', label: 'Turbo' },
    { id: 'gpt-3.5-turbo', label: 'Economy' },
];

export function CustomSelect({ value, options, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
        <div ref={containerRef} className={`relative ${isOpen ? 'z-50' : 'z-30'}`}>
            {/* The closed / trigger state */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full neu-input flex items-center justify-between text-left transition-all duration-200 relative z-20 ${isOpen
                    ? 'rounded-b-none border-t-neu-accent border-l-neu-accent border-r-neu-accent border-b-transparent shadow-[0_0_15px_rgba(255,107,0,0.2)] bg-neu-dark'
                    : 'border-transparent'
                    }`}
                style={isOpen ? { boxShadow: '0 -4px 12px rgba(255,107,0,0.1)' } : {}}
            >
                <span className={!value ? 'text-neu-dim/30' : 'text-neu-text'}>
                    {selectedOption?.label || value || "Select..."}
                </span>
                <ChevronDown size={14} className={`text-neu-dim transition-transform duration-300 ${isOpen ? 'rotate-180 text-neu-accent' : ''}`} />
            </button>

            {/* The open dropdown menu */}
            {isOpen && (
                <div className="absolute top-[100%] left-0 w-full bg-neu-dark overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.8)] border border-t-0 border-neu-accent rounded-b-xl animate-in fade-in slide-in-from-top-1 duration-200 z-10 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/5">
                    <div className="max-h-60 overflow-y-auto w-full custom-scrollbar pb-1">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 flex items-center justify-between group ${value === opt.value
                                    ? 'bg-neu-accent/10 border-l-[3px] border-neu-accent text-neu-accent font-medium'
                                    : 'hover:bg-white/[0.03] text-neu-dim hover:text-neu-text border-l-[3px] border-transparent'
                                    }`}
                            >
                                <span>{opt.label}</span>
                                {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-neu-accent shadow-[0_0_8px_rgba(255,107,0,0.8)]" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// eslint-disable-next-line no-unused-vars
export function ProviderBtn({ active, onClick, icon: Icon, label, sublabel }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center gap-3 py-5 px-4 rounded-2xl relative overflow-hidden shrink-0 touch-manipulation select-none outline-none ${active
                ? 'bg-neu-dark text-neu-accent shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] border border-black/40 scale-[0.98]'
                : 'bg-neu-base text-neu-dim shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5'
                }`}
            style={{
                transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease'
            }}
        >
            <div className={`p-3 rounded-[14px] transition-all duration-150 ${active
                ? 'bg-[#15181b] shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_15px_rgba(255,107,0,0.15)] text-neu-accent ring-1 ring-neu-accent/20'
                : 'bg-neu-base shadow-[4px_4px_8px_#111315,-4px_-4px_8px_#2e343b] text-neu-dim'
                }`}>
                <Icon size={24} strokeWidth={active ? 2 : 1.5} className={active ? 'drop-shadow-[0_0_8px_rgba(255,107,0,0.8)]' : ''} />
            </div>

            <div className="flex flex-col items-center gap-1 mt-1">
                <p className={`text-[13px] font-bold tracking-widest uppercase transition-colors duration-150 ${active ? 'text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]' : 'text-neu-text'}`}>
                    {label}
                </p>
                <p className={`text-[10px] font-mono transition-colors duration-150 ${active ? 'text-neu-accent/70' : 'text-neu-dim/70'}`}>
                    {sublabel}
                </p>
            </div>

            {/* Active Indication LED */}
            <div className={`absolute top-4 right-4 w-2 h-2 rounded-full transition-all duration-200 ${active
                ? 'bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]'
                : 'bg-black/40 shadow-[inset_1px_1px_2px_#000]'
                }`} />
        </button>
    );
}

export function LocalSection({ generationConfig, setGenerationConfig }) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['ollama-models'],
        queryFn: llmApi.getOllamaModels,
        staleTime: 30_000,
        retry: false,
    });

    const models = data?.models ?? [];
    const ollamaUp = data?.available ?? false;

    useEffect(() => {
        if (models.length > 0 && !models.includes(generationConfig.model_name)) {
            setGenerationConfig(prev => ({ ...prev, model_name: models[0], provider: 'local' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [models]);

    return (
        <div className="space-y-5">
            {/* Status */}
            <div className={`neu-trough flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold tracking-wide uppercase`}>
                <div className="flex items-center gap-3">
                    <div className={`led ${ollamaUp ? 'led-green animate-pulse' : 'led-red'} ${isLoading ? 'animate-pulse' : ''}`} />
                    <span className={ollamaUp ? 'text-green-400' : 'text-red-400'}>
                        {isLoading
                            ? 'Connecting…'
                            : ollamaUp
                                ? `Ollama Running · ${models.length} model${models.length !== 1 ? 's' : ''}`
                                : 'Ollama not reachable — run: ollama serve'
                        }
                    </span>
                </div>
                <button type="button" onClick={() => refetch()} className="neu-btn-sm !p-1.5" title="Refresh">
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Model picker (when Ollama is up) */}
            {ollamaUp && models.length > 0 ? (
                <div>
                    <label className="block text-xs font-bold text-neu-dim tracking-widest uppercase mb-3">Select Model</label>
                    <CustomSelect
                        value={generationConfig.model_name}
                        onChange={v => setGenerationConfig(prev => ({ ...prev, model_name: v, provider: 'local' }))}
                        options={models.map(m => ({ value: m, label: m }))}
                    />
                    <p className="text-[10px] font-mono text-neu-dim mt-2">These are your locally pulled Ollama models.</p>
                </div>
            ) : !isLoading && (
                <div>
                    <label className="block text-xs font-bold text-neu-dim tracking-widest uppercase mb-3">Model Name</label>
                    <input
                        type="text"
                        value={generationConfig.model_name}
                        onChange={e => setGenerationConfig(prev => ({ ...prev, model_name: e.target.value, provider: 'local' }))}
                        placeholder="e.g. llama3.2, mistral, phi3"
                        className="neu-input"
                    />
                    <p className="text-[10px] font-mono text-neu-dim mt-2">
                        Pull a model first:&nbsp;
                        <span className="neu-chip !text-[10px]">ollama pull llama3.2</span>
                    </p>
                </div>
            )}
        </div>
    );
}

export function ApiSection({ generationConfig, setGenerationConfig }) {
    const [showKey, setShowKey] = useState(false);
    const set = (key, val) => setGenerationConfig(prev => ({ ...prev, [key]: val, provider: 'openai' }));

    return (
        <div className="space-y-6">
            {/* API Key */}
            <div>
                <label className="block text-xs font-bold text-neu-dim tracking-widest uppercase mb-3">OpenAI API Key</label>
                <div className="relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={generationConfig.api_key ?? ''}
                        onChange={e => set('api_key', e.target.value)}
                        placeholder="sk-..."
                        className="neu-input pr-20 font-mono text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(p => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 neu-btn-sm text-[10px] uppercase font-bold"
                    >
                        {showKey ? 'Hide' : 'Show'}
                    </button>
                </div>
                <p className="text-[10px] font-mono text-neu-dim mt-2">Key is kept only in browser memory — never persisted to disk.</p>
            </div>

            {/* Model picker */}
            <div>
                <label className="block text-xs font-bold text-neu-dim tracking-widest uppercase mb-3">Model</label>
                <div className="grid grid-cols-2 gap-3">
                    {OPENAI_MODELS.map(m => {
                        const active = generationConfig.model_name === m.id;
                        return (
                            <button
                                type="button"
                                key={m.id}
                                onClick={() => set('model_name', m.id)}
                                className={`flex flex-col gap-1 px-4 py-3 rounded-2xl relative overflow-hidden shrink-0 touch-manipulation select-none outline-none text-left ${active
                                    ? 'bg-neu-dark shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] border border-black/40 scale-[0.98]'
                                    : 'bg-neu-base shadow-[4px_4px_10px_#111315,-4px_-4px_10px_#2e343b] hover:shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:-translate-y-0.5 border border-white/5'
                                    }`}
                                style={{
                                    transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease'
                                }}
                            >
                                <span className={`font-mono text-[13px] font-bold transition-colors duration-150 ${active ? 'text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]' : 'text-neu-text'}`}>
                                    {m.id}
                                </span>
                                <span className={`text-[9px] font-mono uppercase tracking-wide transition-colors duration-150 ${active ? 'text-neu-accent/70' : 'text-neu-dim/70'}`}>
                                    {m.label}
                                </span>

                                {/* Status LED */}
                                <div className={`absolute top-4 right-4 w-2 h-2 rounded-full transition-all duration-200 ${active
                                    ? 'bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]'
                                    : 'bg-black/40 shadow-[inset_1px_1px_2px_#000]'
                                    }`} />
                            </button>
                        );
                    })}
                </div>

                {/* Custom model ID */}
                <div className="mt-4">
                    <label className="block text-[10px] font-bold text-neu-dim tracking-widest uppercase mb-2">Custom Model ID</label>
                    <input
                        type="text"
                        value={OPENAI_MODELS.some(m => m.id === generationConfig.model_name) ? '' : generationConfig.model_name}
                        onChange={e => set('model_name', e.target.value)}
                        placeholder="e.g. gpt-4-vision-preview"
                        className="neu-input text-sm"
                    />
                </div>
            </div>
        </div>
    );
}
