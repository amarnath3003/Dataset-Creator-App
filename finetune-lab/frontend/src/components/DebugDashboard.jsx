import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/api';
import {
    RefreshCw, Copy, ChevronDown, ChevronRight,
    Code2, ChevronsDownUp, ChevronsUpDown,
    CheckCircle, AlertCircle, Clock, Layers, MessageSquare,
    FileText, BarChart2, Loader2, Check, Square
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    });
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function Section({ title, icon: Icon, badge, children, copyData, loading }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        copyToClipboard(typeof copyData === 'string' ? copyData : JSON.stringify(copyData, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="neu-section">
            <div className="neu-section-header">
                <div className="flex items-center gap-4">
                    {/* Icon Orb */}
                    <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-neu-accent flex-shrink-0">
                        <Icon size={17} strokeWidth={2} />
                    </div>
                    <h3 className="font-semibold text-neu-text text-base tracking-tight">{title}</h3>
                    {loading && <Loader2 size={14} className="animate-spin text-neu-dim ml-1" />}
                    {badge !== undefined && !loading && (
                        <span className="neu-badge neu-badge-accent">{badge}</span>
                    )}
                </div>
                {copyData !== undefined && !loading && (
                    <button onClick={handleCopy} className="neu-btn-sm">
                        {copied
                            ? <><Check size={11} className="text-green-400" /> Copied</>
                            : <><Copy size={11} /> Copy</>
                        }
                    </button>
                )}
            </div>
            <div className="neu-section-body">{children}</div>
        </div>
    );
}

// ─── Empty / Waiting State ────────────────────────────────────────────────────
function EmptyState({ message, waiting }) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full neu-inset flex items-center justify-center mb-4">
                {waiting
                    ? <Loader2 size={24} className="animate-spin text-neu-dim" />
                    : <AlertCircle size={24} className="text-neu-dim/40" />
                }
            </div>
            <p className="text-sm text-neu-dim font-mono tracking-wide">{message}</p>
        </div>
    );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, highlight }) {
    return (
        <div className={`neu-stat ${highlight ? 'ring-1 ring-neu-accent/20' : ''}`}>
            <span className={`neu-stat-value ${highlight ? 'text-neu-accent' : ''}`}>{value ?? '—'}</span>
            <span className="neu-stat-label">{label}</span>
        </div>
    );
}

// ─── Stage Progress ───────────────────────────────────────────────────────────
function StageProgress({ status }) {
    const stages = [
        { key: 'has_raw', label: 'Upload' },
        { key: 'has_cleaned', label: 'Cleaning' },
        { key: 'has_chunks', label: 'Chunking' },
        { key: 'has_qa', label: 'QA Gen' },
    ];

    return (
        <div className="flex items-center gap-1 mb-8">
            {stages.map((s, i) => {
                const done = !!status?.[s.key];
                const isLast = i === stages.length - 1;
                return (
                    <React.Fragment key={s.key}>
                        <div className="flex flex-col items-center gap-2">
                            <div className={`stage-node ${done ? 'stage-node-done' : 'stage-node-pending'}`}>
                                {done ? <CheckCircle size={16} /> : <span>{i + 1}</span>}
                            </div>
                            <span className={`text-[10px] font-bold tracking-widest uppercase ${done ? 'text-neu-accent' : 'text-neu-dim/40'}`}>
                                {s.label}
                            </span>
                        </div>
                        {!isLast && (
                            <div className={`stage-connector ${done ? 'stage-connector-done' : 'stage-connector-pending'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Pipeline Metadata ────────────────────────────────────────────────────────
function MetadataSection({ status }) {
    const hasAny = status?.has_raw || status?.has_cleaned || status?.has_chunks || status?.has_qa;

    const overallStatus = status?.has_qa ? 'Completed'
        : status?.has_raw ? 'In Progress'
            : 'Not Started';

    const currentStage = status?.has_qa ? 'QA Generation'
        : status?.has_chunks ? 'Chunking'
            : status?.has_cleaned ? 'Cleaning'
                : status?.has_raw ? 'Upload'
                    : null;

    if (!hasAny) {
        return (
            <Section title="Pipeline Metadata" icon={BarChart2}>
                <EmptyState message="Pipeline not executed yet." />
            </Section>
        );
    }

    return (
        <Section title="Pipeline Metadata" icon={BarChart2} copyData={JSON.stringify(status, null, 2)}>
            <StageProgress status={status} />

            <div className="flex flex-wrap gap-3 mb-6">
                {/* Status badge */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase neu-inset ${overallStatus === 'Completed' ? 'text-green-400' :
                    overallStatus === 'In Progress' ? 'text-neu-accent' : 'text-neu-dim'
                    }`}>
                    {overallStatus === 'Completed'
                        ? <div className="led led-green animate-pulse" />
                        : overallStatus === 'In Progress'
                            ? <div className="led led-on animate-pulse" />
                            : <div className="led led-off" />
                    }
                    {overallStatus}
                </div>

                {currentStage && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase neu-inset text-neu-dim">
                        <Layers size={12} />
                        Stage: {currentStage}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatPill label="Raw Text" value={status?.has_raw ? '✓' : '✗'} />
                <StatPill label="Cleaned" value={status?.has_cleaned ? '✓' : '✗'} />
                <StatPill label="Chunks" value={status?.chunk_count ?? 0} highlight={!!status?.has_chunks} />
                <StatPill label="QA Pairs" value={status?.qa_count ?? 0} highlight={!!status?.has_qa} />
            </div>
        </Section>
    );
}

// ─── Cleaning Preview ─────────────────────────────────────────────────────────
function CleaningSection({ projectName, hasCleaned }) {
    const [showRaw, setShowRaw] = useState(false);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['cleaned', projectName],
        queryFn: () => projectApi.getCleanedText(projectName),
        enabled: !!hasCleaned,
        staleTime: 30_000,
    });

    if (!hasCleaned) return <Section title="Cleaning Preview" icon={FileText}><EmptyState waiting message="Waiting for cleaning stage to complete…" /></Section>;
    if (isLoading) return <Section title="Cleaning Preview" icon={FileText} loading><EmptyState waiting message="Loading cleaned text…" /></Section>;
    if (!data) return <Section title="Cleaning Preview" icon={FileText}><EmptyState message="No cleaned text available." /></Section>;

    const { cleaned_text, cleaned_length, raw_length } = data;
    const preview = cleaned_text.slice(0, 1000);
    const diff = raw_length && cleaned_length ? raw_length - cleaned_length : null;

    return (
        <Section
            title="Cleaning Preview"
            icon={FileText}
            badge={`${cleaned_length?.toLocaleString()} chars`}
            copyData={cleaned_text}
            loading={isFetching && !isLoading}
        >
            <div className="grid grid-cols-3 gap-4 mb-6">
                <StatPill label="Raw Length" value={raw_length?.toLocaleString() ?? '—'} />
                <StatPill label="Cleaned Length" value={cleaned_length?.toLocaleString() ?? '—'} highlight />
                <StatPill label="Chars Removed" value={diff !== null ? diff.toLocaleString() : '—'} />
            </div>

            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-neu-dim font-bold uppercase tracking-widest">
                    First {Math.min(preview.length, 1000)} characters
                </span>
                <button onClick={() => setShowRaw(!showRaw)} className="neu-btn-sm">
                    <Code2 size={11} />
                    {showRaw ? 'Text View' : 'Raw JSON'}
                </button>
            </div>

            {showRaw
                ? <pre className="neu-terminal">{JSON.stringify(data, null, 2)}</pre>
                : <textarea
                    readOnly
                    value={preview + (cleaned_text.length > 1000 ? '\n\n… (truncated)' : '')}
                    className="neu-textarea h-48 resize-none"
                />
            }
        </Section>
    );
}

// ─── Chunking Preview ─────────────────────────────────────────────────────────
function ChunkingSection({ projectName, hasChunks }) {
    const [expandedChunks, setExpandedChunks] = useState({});
    const [showRaw, setShowRaw] = useState(false);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['chunks', projectName],
        queryFn: () => projectApi.getChunks(projectName),
        enabled: !!hasChunks,
        staleTime: 30_000,
    });

    if (!hasChunks) return <Section title="Chunking Preview" icon={Layers}><EmptyState waiting message="Waiting for chunking stage to complete…" /></Section>;
    if (isLoading) return <Section title="Chunking Preview" icon={Layers} loading><EmptyState waiting message="Loading chunks…" /></Section>;

    const chunks = data?.chunks ?? [];
    if (chunks.length === 0) return <Section title="Chunking Preview" icon={Layers}><EmptyState message="No chunks available." /></Section>;

    const first5 = chunks.slice(0, 5);
    const sizes = chunks.map(c => (typeof c === 'string' ? c.length : c.text?.length ?? JSON.stringify(c).length));
    const avgSize = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const allExpanded = first5.every((_, i) => expandedChunks[i]);
    const toggleAll = () => { const next = {}; first5.forEach((_, i) => { next[i] = !allExpanded; }); setExpandedChunks(next); };
    const toggleChunk = (i) => setExpandedChunks(prev => ({ ...prev, [i]: !prev[i] }));

    return (
        <Section
            title="Chunking Preview"
            icon={Layers}
            badge={`${chunks.length} chunks`}
            copyData={chunks.slice(0, 5)}
            loading={isFetching && !isLoading}
        >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <StatPill label="Total Chunks" value={chunks.length} highlight />
                <StatPill label="Avg Size" value={`${avgSize} ch`} />
                <StatPill label="Min Size" value={`${minSize} ch`} />
                <StatPill label="Max Size" value={`${maxSize} ch`} />
            </div>

            <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-neu-dim font-bold uppercase tracking-widest">
                    First {first5.length} of {chunks.length} chunks
                </span>
                <div className="flex gap-2">
                    <button onClick={toggleAll} className="neu-btn-sm">
                        {allExpanded ? <ChevronsDownUp size={11} /> : <ChevronsUpDown size={11} />}
                        {allExpanded ? 'Collapse' : 'Expand'} All
                    </button>
                    <button onClick={() => setShowRaw(!showRaw)} className="neu-btn-sm">
                        <Code2 size={11} />
                        {showRaw ? 'List View' : 'Raw JSON'}
                    </button>
                </div>
            </div>

            {showRaw
                ? <pre className="neu-terminal">{JSON.stringify(first5, null, 2)}</pre>
                : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {first5.map((chunk, i) => {
                            const text = typeof chunk === 'string' ? chunk : chunk.text ?? JSON.stringify(chunk);
                            const size = text.length;
                            const isOpen = !!expandedChunks[i];
                            return (
                                <div key={i} className="neu-chunk">
                                    <div onClick={() => toggleChunk(i)} className="neu-chunk-header">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isOpen ? 'bg-neu-accent text-white shadow-[0_0_8px_rgba(255,107,0,0.5)]' : 'neu-inset text-neu-dim'
                                                }`}>
                                                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            </div>
                                            <span className="text-sm font-medium text-neu-text">Fragment {i + 1}</span>
                                        </div>
                                        <span className="neu-badge neu-badge-accent">{size} chars</span>
                                    </div>
                                    {isOpen && (
                                        <div className="px-5 py-4 border-t border-white/[0.03]">
                                            <p className="text-xs text-neu-dim font-mono whitespace-pre-wrap leading-relaxed">{text}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            }
        </Section>
    );
}

// ─── Generation Progress Bar ──────────────────────────────────────────────────
function GenerationProgressBar({ progress }) {
    const { done = 0, total = 0, percent = 0 } = progress ?? {};
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Loader2 size={15} className="animate-spin text-neu-accent" />
                    <span className="text-sm font-medium text-neu-text">
                        Synthesizing…&nbsp;
                        <span className="font-mono text-neu-accent">{done}</span>
                        <span className="text-neu-dim">/{total}</span> chunks
                    </span>
                </div>
                <span className="font-mono text-sm font-bold text-neu-accent">{percent}%</span>
            </div>

            <div className="neu-progress-track">
                <div className="neu-progress-fill" style={{ width: `${Math.max(percent, 1)}%` }} />
            </div>

            <p className="text-[10px] text-neu-dim font-mono tracking-wide">
                Large documents may take 20–60 min. Pairs stream in as each fragment finishes.
            </p>
        </div>
    );
}

// ─── QA Pairs Preview ─────────────────────────────────────────────────────────
function QAPairsSection({ projectName, hasQA, progress, stopped, finished }) {
    const [showRaw, setShowRaw] = useState(false);

    const isGenerating = progress
        && progress.status !== 'done'
        && progress.status !== 'error'
        && progress.status !== 'stopped';

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['qa', projectName],
        queryFn: () => projectApi.getQAPairs(projectName),
        enabled: !!hasQA,
        refetchInterval: isGenerating ? 5000 : false,
        staleTime: isGenerating ? 0 : 30_000,
    });

    const isWaiting = !hasQA && !isGenerating;
    const loading = isLoading && hasQA;

    if (isWaiting) return (
        <Section title="QA Pairs Preview" icon={MessageSquare}>
            <EmptyState waiting message="Waiting for synthesis to complete…" />
        </Section>
    );

    if (stopped && (!data || data.qa_pairs?.length === 0)) return (
        <Section title="QA Pairs Preview" icon={MessageSquare}>
            <div className="neu-alert-warn">
                <AlertCircle size={18} className="flex-shrink-0" />
                <p>Generation was stopped by the user. Partial results will appear if available.</p>
            </div>
        </Section>
    );

    if (isGenerating && (!data || data.qa_pairs?.length === 0)) return (
        <Section title="QA Pairs Preview" icon={MessageSquare}>
            <GenerationProgressBar progress={progress} />
        </Section>
    );

    if (loading) return (
        <Section title="QA Pairs Preview" icon={MessageSquare} loading>
            <EmptyState waiting message="Loading QA pairs…" />
        </Section>
    );

    const pairs = data?.qa_pairs ?? [];
    if (pairs.length === 0) return (
        <Section title="QA Pairs Preview" icon={MessageSquare}>
            {isGenerating
                ? <GenerationProgressBar progress={progress} />
                : <EmptyState message="No QA pairs generated yet." />
            }
        </Section>
    );

    const first10 = pairs.slice(0, 10);

    return (
        <Section
            title="QA Pairs Preview"
            icon={MessageSquare}
            badge={finished
                ? `${pairs.length} pairs ✓ Complete`
                : isGenerating
                    ? `${pairs.length} pairs (live…)`
                    : `${pairs.length} pairs`}
            copyData={first10}
            loading={isFetching && !isLoading}
        >
            {isGenerating && <div className="mb-6"><GenerationProgressBar progress={progress} /></div>}

            <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] text-neu-dim font-bold uppercase tracking-widest">
                    Showing {first10.length} of {pairs.length} pairs
                </p>
                <button onClick={() => setShowRaw(!showRaw)} className="neu-btn-sm">
                    <Code2 size={11} />
                    {showRaw ? 'Card View' : 'Raw JSON'}
                </button>
            </div>

            {showRaw
                ? <pre className="neu-terminal max-h-96">{JSON.stringify(first10, null, 2)}</pre>
                : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                        {first10.map((pair, i) => {
                            const q = pair.instruction ?? pair.question ?? pair.input ?? `Pair ${i + 1}`;
                            const a = pair.output ?? pair.answer ?? pair.response ?? '';
                            return (
                                <div key={i} className="neu-chunk">
                                    <div className="px-5 py-4">
                                        {/* Question */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="neu-badge neu-badge-accent text-[9px]">Q {i + 1}</span>
                                        </div>
                                        <p className="font-semibold text-neu-text text-sm mb-4 leading-snug">{q}</p>

                                        <div className="neu-divider mb-4" />

                                        {/* Answer */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="neu-badge neu-badge-green text-[9px]">Answer</span>
                                        </div>
                                        <p className="text-xs text-neu-dim leading-relaxed font-mono">{a}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }
        </Section>
    );
}

// ─── Main Debug Dashboard ─────────────────────────────────────────────────────
export default function DebugDashboard({ projectName, status, stopMutation }) {
    const [showStopModal, setShowStopModal] = useState(false);
    const queryClient = useQueryClient();

    // Auto-refresh QA list when pipeline finishes
    useEffect(() => {
        if (status?.finished) {
            queryClient.invalidateQueries(['qa', projectName]);
        }
    }, [status?.finished, projectName, queryClient]);

    return (
        <div>
            {/* ── PIPELINE CONTROLS — Always visible, adapts to state ───── */}
            <div className="relative mb-8 overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>

                {/* ---- STATE: RUNNING ---------------------------------------- */}
                {status?.running && (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-r from-red-950/60 via-red-900/40 to-red-950/60" />
                        <div className="absolute inset-0" style={{ border: '1px solid rgba(239,68,68,0.3)' }} />
                        <style>{`
                            @keyframes stopPulse {
                                0%,100% { box-shadow: 0 0 18px rgba(239,68,68,0.15), inset 0 0 18px rgba(239,68,68,0.05); }
                                50%      { box-shadow: 0 0 42px rgba(239,68,68,0.40), inset 0 0 30px rgba(239,68,68,0.12); }
                            }
                        `}</style>
                        <div className="absolute inset-0" style={{ animation: 'stopPulse 2s ease-in-out infinite' }} />

                        <div className="relative z-10 flex items-center justify-between px-7 py-5 gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <Loader2 size={22} className="text-red-400 animate-spin" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-red-300 uppercase tracking-widest">Pipeline Running</p>
                                    <p className="text-[11px] text-red-400/60 font-mono mt-0.5">
                                        {status?.progress
                                            ? `Chunk ${status.progress.done} / ${status.progress.total} · ${status.progress.percent}%`
                                            : 'Initialising…'}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowStopModal(true)}
                                disabled={stopMutation?.isPending}
                                style={{
                                    background: stopMutation?.isPending ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,rgba(239,68,68,0.85),rgba(185,28,28,0.95))',
                                    color: stopMutation?.isPending ? 'rgba(239,68,68,0.4)' : '#fff',
                                    boxShadow: stopMutation?.isPending ? 'none' : '0 0 22px rgba(239,68,68,0.45), 0 4px 16px rgba(0,0,0,0.45)',
                                    border: '1px solid rgba(239,68,68,0.35)',
                                    cursor: stopMutation?.isPending ? 'not-allowed' : 'pointer',
                                }}
                                className="flex-shrink-0 flex items-center gap-3 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200"
                            >
                                {stopMutation?.isPending
                                    ? <><Loader2 size={17} className="animate-spin" /> Stopping…</>
                                    : <><Square size={15} fill="currentColor" /> Stop Generation</>}
                            </button>
                        </div>

                        {status?.progress && (
                            <div className="relative z-10 h-1 mx-7 mb-4 rounded-full overflow-hidden" style={{ background: 'rgba(127,29,29,0.6)' }}>
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                        width: `${Math.max(status.progress.percent, 1)}%`,
                                        background: 'linear-gradient(90deg, #ef4444, #f87171)',
                                    }}
                                />
                            </div>
                        )}
                    </>
                )}

                {/* ---- STATE: STOPPED (partial results saved) ---------------- */}
                {!status?.running && status?.stopped && (
                    <div className="px-7 py-5 flex items-center justify-between gap-4"
                        style={{ background: 'linear-gradient(135deg, rgba(120,53,15,0.35), rgba(92,45,12,0.2))' }}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                <AlertCircle size={22} className="text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-sm font-black uppercase tracking-widest" style={{ color: '#fbbf24' }}>
                                    Generation Stopped
                                </p>
                                <p className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(251,191,36,0.55)' }}>
                                    {status?.qa_count > 0 ? `${status.qa_count} QA pairs saved · ` : ''}
                                    Go to “Run Pipeline” to continue or start fresh
                                </p>
                            </div>
                        </div>
                        <div className="flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', color: 'rgba(251,191,36,0.5)' }}>
                            Stopped
                        </div>
                    </div>
                )}

                {/* ---- STATE: IDLE / COMPLETE -------------------------------- */}
                {!status?.running && !status?.stopped && (
                    <div className="px-7 py-5 flex items-center justify-between gap-4"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <Square size={20} className="text-neu-dim/30" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neu-dim/50 uppercase tracking-widest">
                                    {status?.finished ? 'Pipeline Complete' : 'No Pipeline Running'}
                                </p>
                                <p className="text-[11px] text-neu-dim/30 font-mono mt-0.5">
                                    {status?.finished
                                        ? `${status?.qa_count ?? 0} QA pairs generated · ready to export`
                                        : 'Start a pipeline from the “Run Pipeline” tab'}
                                </p>
                            </div>
                        </div>
                        <div className="flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.15)' }}>
                            {status?.finished ? 'Complete' : 'Idle'}
                        </div>
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-light text-neu-text tracking-tight">
                        Pipeline <span className="text-neu-dim font-thin">/ Inspector</span>
                    </h2>
                    <p className="text-[10px] text-neu-dim font-mono uppercase tracking-widest mt-1">
                        Live pipeline inspection — streams as each stage completes
                    </p>
                </div>
                <div className="flex items-center gap-3 neu-inset px-4 py-2 rounded-xl">
                    <div className="led led-green animate-pulse" />
                    <span className="text-[10px] text-neu-dim font-mono font-bold tracking-wider">AUTO-REFRESH · 2s</span>
                </div>
            </div>

            <MetadataSection status={status} projectName={projectName} />
            <CleaningSection projectName={projectName} hasCleaned={status?.has_cleaned} />
            <ChunkingSection projectName={projectName} hasChunks={status?.has_chunks} />
            <QAPairsSection projectName={projectName} hasQA={status?.has_qa}
                progress={status?.progress} stopped={status?.stopped} finished={status?.finished} />

            <ConfirmModal
                isOpen={showStopModal}
                title="Halt Pipeline Generation"
                message="Are you sure you want to stop the pipeline? All QA pairs generated so far will be saved. You can safely resume later."
                confirmText="Halt Pipeline"
                variant="warn"
                onConfirm={() => {
                    stopMutation?.mutate();
                    setShowStopModal(false);
                }}
                onCancel={() => setShowStopModal(false)}
            />
        </div>
    );
}
