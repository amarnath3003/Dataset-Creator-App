import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { llmApi } from '../api/api';
import { Save, RefreshCw, AlertCircle, Info, CheckCircle, RotateCcw } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmModal from './ConfirmModal';

export default function PromptEditor() {
    const [prompt, setPrompt] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saved, setSaved] = useState(false);
    const queryClient = useQueryClient();
    const toast = useToast();

    const { data, isLoading } = useQuery({
        queryKey: ['prompt'],
        queryFn: llmApi.getPrompt,
        staleTime: Infinity,
    });

    useEffect(() => {
        // eslint-disable-next-line
        if (data?.prompt) { setPrompt(data.prompt); setIsDirty(false); }
    }, [data]);

    const saveMutation = useMutation({
        mutationFn: (newPrompt) => llmApi.savePrompt(newPrompt),
        onSuccess: () => {
            queryClient.invalidateQueries(['prompt']);
            setIsDirty(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        },
        onError: (e) => toast.error(`Failed to save prompt: ${e.message}`)
    });

    const handleReset = () => {
        const defaultPrompt =
            `Context Domain: {domain}.

You are a helpful assistant that generates Question-Answer pairs from text.
Please create exactly {qa_count} high-quality QA pairs from the following text chunk.

Text Chunk:
{chunk}

Instructions:
1. Cover important facts in the chunk.
2. Behave like a normal helpful LLM.
3. You may expand slightly for clarity, but stick to the facts in the text.
4. Output MUST be a valid JSON list of objects strictly following this structure:
[
  {"question": "The generated question", "answer": "The generated answer"}
]
5. Do not include any explanation, only the raw JSON list.
`;
        setPrompt(defaultPrompt);
        setIsDirty(true);
        setShowResetModal(false);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-16 h-16 rounded-full neu-inset flex items-center justify-center">
                <RefreshCw className="animate-spin text-neu-accent" size={22} />
            </div>
            <span className="text-neu-dim font-mono text-xs uppercase tracking-widest">Loading prompt template…</span>
        </div>
    );

    return (
        <div className="space-y-7 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-light text-neu-text tracking-tight">
                        Generation <span className="text-neu-dim font-thin">/ Prompt</span>
                    </h2>
                    <p className="text-[10px] text-neu-dim font-mono uppercase tracking-widest mt-1">
                        Customize how the LLM synthesizes QA pairs from your fragments
                    </p>
                </div>

                <div className="flex items-center gap-3 pt-1 flex-shrink-0">
                    <button
                        onClick={() => setShowResetModal(true)}
                        className="neu-btn-sm"
                    >
                        <RotateCcw size={11} />
                        Reset
                    </button>
                    <button
                        onClick={() => saveMutation.mutate(prompt)}
                        disabled={!isDirty || saveMutation.isPending}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 ${isDirty
                            ? 'neu-btn neu-btn-primary !rounded-xl shadow-[var(--sh-flat),var(--glow-sm)]'
                            : 'text-neu-dim/30 cursor-not-allowed neu-inset'
                            }`}
                    >
                        {saveMutation.isPending ? (
                            <RefreshCw size={14} className="animate-spin" />
                        ) : saved ? (
                            <CheckCircle size={14} className="text-green-400" />
                        ) : (
                            <Save size={14} />
                        )}
                        {saveMutation.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Dirty banner */}
            {isDirty && (
                <div className="neu-alert-warn animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span className="font-medium text-xs tracking-wide">Unsaved changes — save to apply to next pipeline run.</span>
                </div>
            )}

            {/* Textarea */}
            <div
                className="relative group bg-[#111315] shadow-[var(--sh-deep)] rounded-[16px] border border-black/50 overflow-hidden flex transition-all duration-250 focus-within:ring-1 focus-within:ring-neu-accent focus-within:border-neu-accent/40"
            >
                {/* Physical Gutter */}
                <div className="w-12 bg-black/20 border-r border-white/5 shrink-0 pointer-events-none select-none" />

                <textarea
                    value={prompt}
                    onChange={(e) => { setPrompt(e.target.value); setIsDirty(true); }}
                    spellCheck={false}
                    className="flex-1 bg-transparent border-none outline-none text-[#4ade80] p-6 font-mono text-sm leading-[1.7] resize-y min-h-[460px] custom-scrollbar block w-full m-0"
                />

                {/* Floating variable chips */}
                <div className="absolute right-4 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                    <div className="neu-badge neu-badge-accent text-[9px] flex items-center gap-1 self-end">
                        <Info size={9} />
                        Variables
                    </div>
                    {['{domain}', '{qa_count}', '{chunk}'].map(v => (
                        <div key={v} className="neu-chip self-end pointer-events-none">{v}</div>
                    ))}
                </div>
            </div>

            {/* Info banner */}
            <div className="neu-alert-info">
                <Info size={16} className="flex-shrink-0 text-blue-400" />
                <div>
                    <p className="font-bold text-xs tracking-wide mb-1 uppercase">Pro Tip — Explicit Output Format</p>
                    <p className="text-[11px] opacity-80 font-mono leading-relaxed">
                        Always include precise JSON structure requirements. If removed, the parser may fail to extract questions and answers.
                    </p>
                </div>
            </div>

            <ConfirmModal
                isOpen={showResetModal}
                title="Reset Prompt Template"
                message="Are you sure you want to revert to the default prompt? Any custom instructions you've added here will be lost."
                confirmText="Reset"
                variant="warn"
                onConfirm={handleReset}
                onCancel={() => setShowResetModal(false)}
            />
        </div>
    );
}
