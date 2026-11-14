import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/api';
import {
    Copy, ChevronDown, ChevronRight, Code2, ChevronsDownUp, ChevronsUpDown,
    CheckCircle, AlertCircle, Layers, MessageSquare, FileText, BarChart2,
    Loader2, Check, Square, Search, Trash2, Edit3, Plus, Save, X, Terminal
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useToast } from './Toast';

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
function Section({ title, icon: Icon, badge, children, copyData, loading, headerExtra }) {
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
                    <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-neu-accent flex-shrink-0">
                        <Icon size={17} strokeWidth={2} />
                    </div>
                    <h3 className="font-semibold text-neu-text text-base tracking-tight">{title}</h3>
                    {loading && <Loader2 size={14} className="animate-spin text-neu-dim ml-1" />}
                    {badge !== undefined && !loading && (
                        <span className="neu-badge neu-badge-accent">{badge}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {headerExtra}
                    {copyData !== undefined && !loading && (
                        <button onClick={handleCopy} className="neu-btn-sm">
                            {copied
                                ? <><Check size={11} className="text-green-400" /> Copied</>
                                : <><Copy size={11} /> Copy</>
                            }
                        </button>
                    )}
                </div>
            </div>
            <div className="neu-section-body">{children}</div>
        </div>
    );
}

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

function StatPill({ label, value, highlight }) {
    return (
        <div className={`neu-stat ${highlight ? 'ring-1 ring-neu-accent/20' : ''}`}>
            <span className={`neu-stat-value ${highlight ? 'text-neu-accent' : ''}`}>{value ?? '—'}</span>
            <span className="neu-stat-label">{label}</span>
        </div>
    );
}

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

// ─── Error Diagnostics Section ────────────────────────────────────────────────
function ErrorDiagnosticsSection({ projectName, hasError }) {
    const { data } = useQuery({
        queryKey: ['logs', projectName],
        queryFn: () => projectApi.getLogs(projectName),
        enabled: !!hasError,
    });

    if (!hasError || !data?.error_log) return null;

    return (
        <Section title="Pipeline Error Diagnostics" icon={Terminal} badge="Error Log" copyData={data.error_log}>
            <div className="neu-inset rounded-xl p-4 border border-red-500/20 bg-[#0b0d0f] max-h-60 overflow-y-auto custom-scrollbar">
                <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap leading-relaxed">
                    {data.error_log}
                </pre>
            </div>
        </Section>
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
    const preview = cleaned_text.slice(0, 2000);
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
                    First {Math.min(preview.length, 2000)} characters
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
                    value={preview + (cleaned_text.length > 2000 ? '\n\n… (truncated)' : '')}
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
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 10;
    const queryClient = useQueryClient();
    const toast = useToast();

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['chunks', projectName],
        queryFn: () => projectApi.getChunks(projectName),
        enabled: !!hasChunks,
        staleTime: 30_000,
    });

    const deleteChunkMut = useMutation({
        mutationFn: (chunkId) => projectApi.deleteChunk(projectName, chunkId),
        onSuccess: () => {
            queryClient.invalidateQueries(['chunks', projectName]);
            queryClient.invalidateQueries(['status', projectName]);
            toast.success('Chunk removed');
        },
        onError: (e) => toast.error(e.message),
    });

    const chunks = useMemo(() => data?.chunks ?? [], [data]);
    const filtered = useMemo(() => {
        if (!search.trim()) return chunks;
        const q = search.toLowerCase();
        return chunks.filter((c) => (typeof c === 'string' ? c : c.text || '').toLowerCase().includes(q));
    }, [chunks, search]);

    if (!hasChunks) return <Section title="Chunking Preview" icon={Layers}><EmptyState waiting message="Waiting for chunking stage to complete…" /></Section>;
    if (isLoading) return <Section title="Chunking Preview" icon={Layers} loading><EmptyState waiting message="Loading chunks…" /></Section>;
    if (chunks.length === 0) return <Section title="Chunking Preview" icon={Layers}><EmptyState message="No chunks available." /></Section>;

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const sizes = chunks.map(c => (typeof c === 'string' ? c.length : c.text?.length ?? JSON.stringify(c).length));
    const avgSize = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const strategy = chunks[0]?.strategy || 'recursive';
    const allExpanded = pageItems.every((_, i) => expandedChunks[safePage * PAGE_SIZE + i]);
    const toggleAll = () => {
        const next = { ...expandedChunks };
        pageItems.forEach((_, i) => { next[safePage * PAGE_SIZE + i] = !allExpanded; });
        setExpandedChunks(next);
    };
    const toggleChunk = (idx) => setExpandedChunks(prev => ({ ...prev, [idx]: !prev[idx] }));

    return (
        <Section
            title="Chunking Inspector"
            icon={Layers}
            badge={`${chunks.length} chunks · ${strategy}`}
            copyData={pageItems}
            loading={isFetching && !isLoading}
        >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <StatPill label="Total Chunks" value={chunks.length} highlight />
                <StatPill label="Avg Size" value={`${avgSize} ch`} />
                <StatPill label="Min Size" value={`${minSize} ch`} />
                <StatPill label="Max Size" value={`${maxSize} ch`} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neu-dim" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Filter chunks..."
                        className="neu-input pl-9 py-2 text-xs"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleAll} className="neu-btn-sm">
                        {allExpanded ? <ChevronsDownUp size={11} /> : <ChevronsUpDown size={11} />}
                        {allExpanded ? 'Collapse' : 'Expand'} Page
                    </button>
                    <button onClick={() => setShowRaw(!showRaw)} className="neu-btn-sm">
                        <Code2 size={11} />
                        {showRaw ? 'List View' : 'Raw JSON'}
                    </button>
                </div>
            </div>

            {showRaw
                ? <pre className="neu-terminal max-h-96">{JSON.stringify(pageItems, null, 2)}</pre>
                : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {pageItems.map((chunk, i) => {
                            const globalIdx = safePage * PAGE_SIZE + i;
                            const text = typeof chunk === 'string' ? chunk : chunk.text ?? JSON.stringify(chunk);
                            const chunkId = chunk.chunk_id ?? globalIdx;
                            const isOpen = !!expandedChunks[globalIdx];
                            return (
                                <div key={chunkId} className="neu-chunk">
                                    <div onClick={() => toggleChunk(globalIdx)} className="neu-chunk-header">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isOpen ? 'bg-neu-accent text-white shadow-[0_0_8px_rgba(255,107,0,0.5)]' : 'neu-inset text-neu-dim'}`}>
                                                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            </div>
                                            <span className="text-sm font-medium text-neu-text truncate">Fragment #{chunkId + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {chunk.token_count && <span className="text-[10px] font-mono text-neu-dim">{chunk.token_count} tok</span>}
                                            <span className="neu-badge neu-badge-accent">{text.length} ch</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); deleteChunkMut.mutate(chunkId); }}
                                                className="text-neu-dim hover:text-red-400 p-1"
                                                title="Delete chunk"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
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

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.04] text-[10px] font-mono text-neu-dim uppercase">
                    <span>Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                    <div className="flex gap-2">
                        <button disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="neu-btn-sm disabled:opacity-40">Prev</button>
                        <button disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} className="neu-btn-sm disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}
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
                Pairs stream in as each fragment completes.
            </p>
        </div>
    );
}

// ─── Interactive QA Pairs Curation & Analytics ────────────────────────────────
function QAPairsSection({ projectName, hasQA, progress, stopped, finished }) {
    const [showRaw, setShowRaw] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [editingIdx, setEditingIdx] = useState(null);
    const [editDraft, setEditDraft] = useState({ question: '', answer: '' });
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDraft, setNewDraft] = useState({ question: '', answer: '' });
    const PAGE_SIZE = 12;
    const queryClient = useQueryClient();
    const toast = useToast();

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

    const addMut = useMutation({
        mutationFn: (payload) => projectApi.addQAPair(projectName, payload),
        onSuccess: () => {
            queryClient.invalidateQueries(['qa', projectName]);
            queryClient.invalidateQueries(['status', projectName]);
            setNewDraft({ question: '', answer: '' });
            setShowAddForm(false);
            toast.success('QA pair added');
        },
        onError: (e) => toast.error(e.message),
    });

    const updateMut = useMutation({
        mutationFn: ({ index, payload }) => projectApi.updateQAPair(projectName, index, payload),
        onSuccess: () => {
            queryClient.invalidateQueries(['qa', projectName]);
            setEditingIdx(null);
            toast.success('QA pair updated');
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteMut = useMutation({
        mutationFn: (index) => projectApi.deleteQAPair(projectName, index),
        onSuccess: () => {
            queryClient.invalidateQueries(['qa', projectName]);
            queryClient.invalidateQueries(['status', projectName]);
            toast.success('QA pair deleted');
        },
        onError: (e) => toast.error(e.message),
    });

    const pairs = useMemo(() => data?.qa_pairs ?? [], [data]);
    const indexedPairs = useMemo(() => pairs.map((p, idx) => ({ pair: p, index: idx })), [pairs]);
    const filtered = useMemo(() => {
        if (!search.trim()) return indexedPairs;
        const q = search.toLowerCase();
        return indexedPairs.filter(({ pair }) => {
            const qt = (pair.instruction ?? pair.question ?? '').toLowerCase();
            const at = (pair.output ?? pair.answer ?? '').toLowerCase();
            return qt.includes(q) || at.includes(q);
        });
    }, [indexedPairs, search]);

    const analytics = useMemo(() => {
        if (!pairs.length) return null;
        let totalWords = 0;
        let totalQual = 0;
        let qualCount = 0;
        const vocab = new Set();
        pairs.forEach((p) => {
            const a = (p.output ?? p.answer ?? '').trim();
            const q = (p.instruction ?? p.question ?? '').trim();
            const words = a.split(/\s+/).filter(Boolean);
            totalWords += words.length;
            words.concat(q.split(/\s+/)).forEach((w) => vocab.add(w.toLowerCase().replace(/\W/g, '')));
            if (typeof p.quality_score === 'number') {
                totalQual += p.quality_score;
                qualCount++;
            }
        });
        return {
            avgAnswerWords: Math.round(totalWords / pairs.length),
            avgQuality: qualCount ? Math.round((totalQual / qualCount) * 100) + '%' : '—',
            vocabSize: vocab.size,
        };
    }, [pairs]);

    const isWaiting = !hasQA && !isGenerating;
    const loading = isLoading && hasQA;

    if (isWaiting) return (
        <Section title="QA Pairs Studio" icon={MessageSquare}>
            <EmptyState waiting message="Waiting for synthesis to complete…" />
        </Section>
    );

    if (stopped && (!data || data.qa_pairs?.length === 0)) return (
        <Section title="QA Pairs Studio" icon={MessageSquare}>
            <div className="neu-alert-warn">
                <AlertCircle size={18} className="flex-shrink-0" />
                <p>Generation was stopped by the user. Partial results will appear if available.</p>
            </div>
        </Section>
    );

    if (isGenerating && (!data || data.qa_pairs?.length === 0)) return (
        <Section title="QA Pairs Studio" icon={MessageSquare}>
            <GenerationProgressBar progress={progress} />
        </Section>
    );

    if (loading) return (
        <Section title="QA Pairs Studio" icon={MessageSquare} loading>
            <EmptyState waiting message="Loading QA pairs…" />
        </Section>
    );

    if (pairs.length === 0) return (
        <Section title="QA Pairs Studio" icon={MessageSquare}>
            {isGenerating
                ? <GenerationProgressBar progress={progress} />
                : <EmptyState message="No QA pairs generated yet." />
            }
        </Section>
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    return (
        <Section
            title="QA Pairs Studio"
            icon={MessageSquare}
            badge={finished
                ? `${pairs.length} pairs ✓ Complete`
                : isGenerating
                    ? `${pairs.length} pairs (live…)`
                    : `${pairs.length} pairs`}
            copyData={pageItems.map((x) => x.pair)}
            loading={isFetching && !isLoading}
            headerExtra={
                <button
                    type="button"
                    onClick={() => setShowAddForm((s) => !s)}
                    className="neu-btn-sm text-neu-accent"
                >
                    <Plus size={12} /> Add Pair
                </button>
            }
        >
            {isGenerating && <div className="mb-6"><GenerationProgressBar progress={progress} /></div>}

            {analytics && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <StatPill label="Avg Answer Words" value={analytics.avgAnswerWords} />
                    <StatPill label="Avg Quality Score" value={analytics.avgQuality} highlight />
                    <StatPill label="Unique Vocabulary" value={analytics.vocabSize.toLocaleString()} />
                </div>
            )}

            {showAddForm && (
                <div className="neu-trough p-5 rounded-2xl mb-6 space-y-3 border border-neu-accent/20">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neu-accent">New Curated QA Pair</span>
                        <button type="button" onClick={() => setShowAddForm(false)} className="text-neu-dim hover:text-neu-text"><X size={14} /></button>
                    </div>
                    <input
                        type="text"
                        placeholder="Question / Instruction..."
                        value={newDraft.question}
                        onChange={(e) => setNewDraft(d => ({ ...d, question: e.target.value }))}
                        className="neu-input text-sm"
                    />
                    <textarea
                        rows={3}
                        placeholder="Expected Answer..."
                        value={newDraft.answer}
                        onChange={(e) => setNewDraft(d => ({ ...d, answer: e.target.value }))}
                        className="neu-textarea text-xs"
                    />
                    <div className="flex justify-end">
                        <button
                            type="button"
                            disabled={!newDraft.question.trim() || !newDraft.answer.trim() || addMut.isPending}
                            onClick={() => addMut.mutate(newDraft)}
                            className="neu-btn-sm text-neu-accent"
                        >
                            <Save size={12} /> {addMut.isPending ? 'Saving...' : 'Save Pair'}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neu-dim" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Search questions or answers..."
                        className="neu-input pl-9 py-2 text-xs"
                    />
                </div>
                <button onClick={() => setShowRaw(!showRaw)} className="neu-btn-sm">
                    <Code2 size={11} />
                    {showRaw ? 'Card View' : 'Raw JSON'}
                </button>
            </div>

            {showRaw
                ? <pre className="neu-terminal max-h-96">{JSON.stringify(pageItems.map(x => x.pair), null, 2)}</pre>
                : (
                    <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1">
                        {pageItems.map(({ pair, index }) => {
                            const q = pair.instruction ?? pair.question ?? pair.input ?? `Pair ${index + 1}`;
                            const a = pair.output ?? pair.answer ?? pair.response ?? '';
                            const isEditing = editingIdx === index;

                            return (
                                <div key={index} className="neu-chunk">
                                    <div className="px-5 py-4">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="neu-badge neu-badge-accent text-[9px]">Q {index + 1}</span>
                                                {typeof pair.quality_score === 'number' && (
                                                    <span className="text-[10px] font-mono text-neu-dim">
                                                        Quality {Math.round(pair.quality_score * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateMut.mutate({ index, payload: editDraft })}
                                                            disabled={updateMut.isPending}
                                                            className="neu-btn-sm text-green-400"
                                                        >
                                                            <Save size={11} /> Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingIdx(null)}
                                                            className="neu-btn-sm"
                                                        >
                                                            <X size={11} /> Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setEditingIdx(index); setEditDraft({ question: q, answer: a }); }}
                                                            className="neu-btn-sm"
                                                            title="Edit QA pair"
                                                        >
                                                            <Edit3 size={11} /> Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteMut.mutate(index)}
                                                            className="neu-btn-sm hover:!text-red-400"
                                                            title="Delete QA pair"
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-3 mt-2">
                                                <input
                                                    type="text"
                                                    value={editDraft.question}
                                                    onChange={(e) => setEditDraft(d => ({ ...d, question: e.target.value }))}
                                                    className="neu-input text-sm"
                                                />
                                                <textarea
                                                    rows={4}
                                                    value={editDraft.answer}
                                                    onChange={(e) => setEditDraft(d => ({ ...d, answer: e.target.value }))}
                                                    className="neu-textarea text-xs"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <p className="font-semibold text-neu-text text-sm mb-4 leading-snug">{q}</p>
                                                <div className="neu-divider mb-4" />
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="neu-badge neu-badge-green text-[9px]">Answer</span>
                                                </div>
                                                <p className="text-xs text-neu-dim leading-relaxed font-mono whitespace-pre-wrap">{a}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.04] text-[10px] font-mono text-neu-dim uppercase">
                    <span>Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                    <div className="flex gap-2">
                        <button disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="neu-btn-sm disabled:opacity-40">Prev</button>
                        <button disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} className="neu-btn-sm disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}
        </Section>
    );
}

// ─── Main Debug Dashboard ─────────────────────────────────────────────────────
export default function DebugDashboard({ projectName, status, stopMutation }) {
    const [showStopModal, setShowStopModal] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (status?.finished) {
            queryClient.invalidateQueries(['qa', projectName]);
        }
    }, [status?.finished, projectName, queryClient]);

    return (
        <div>
            <div className="relative mb-8 overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                {status?.running && (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-r from-red-950/60 via-red-900/40 to-red-950/60" />
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
                                className="flex-shrink-0 flex items-center gap-3 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest bg-red-600 text-white"
                            >
                                <Square size={15} fill="currentColor" /> Stop Generation
                            </button>
                        </div>
                    </>
                )}

                {!status?.running && status?.stopped && (
                    <div className="px-7 py-5 flex items-center justify-between gap-4" style={{ background: 'linear-gradient(135deg, rgba(120,53,15,0.35), rgba(92,45,12,0.2))' }}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                <AlertCircle size={22} className="text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-sm font-black uppercase tracking-widest text-yellow-400">Generation Stopped</p>
                                <p className="text-[11px] font-mono mt-0.5 text-yellow-400/60">
                                    {status?.qa_count > 0 ? `${status.qa_count} QA pairs saved · ` : ''}
                                    Go to “Run Pipeline” to continue or start fresh
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!status?.running && !status?.stopped && (
                    <div className="px-7 py-5 flex items-center justify-between gap-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <Square size={20} className="text-neu-dim/30" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-neu-dim/60 uppercase tracking-widest">
                                    {status?.finished ? 'Pipeline Complete' : 'No Pipeline Running'}
                                </p>
                                <p className="text-[11px] text-neu-dim/40 font-mono mt-0.5">
                                    {status?.finished
                                        ? `${status?.qa_count ?? 0} QA pairs ready — edit inline or export below`
                                        : 'Start a pipeline from the “Run Pipeline” tab'}
                                </p>
                            </div>
                        </div>
                        <div className="flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/5 text-neu-dim/50">
                            {status?.finished ? 'Complete' : 'Idle'}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-light text-neu-text tracking-tight">
                        Pipeline <span className="text-neu-dim font-thin">/ Inspector &amp; Curator</span>
                    </h2>
                    <p className="text-[10px] text-neu-dim font-mono uppercase tracking-widest mt-1">
                        Inspect chunks, curate QA pairs inline, and review quality analytics
                    </p>
                </div>
                <div className="flex items-center gap-3 neu-inset px-4 py-2 rounded-xl">
                    <div className="led led-green animate-pulse" />
                    <span className="text-[10px] text-neu-dim font-mono font-bold tracking-wider">AUTO-REFRESH · 2s</span>
                </div>
            </div>

            <ErrorDiagnosticsSection projectName={projectName} hasError={status?.has_error} />
            <MetadataSection status={status} projectName={projectName} />
            <CleaningSection projectName={projectName} hasCleaned={status?.has_cleaned} />
            <ChunkingSection projectName={projectName} hasChunks={status?.has_chunks} />
            <QAPairsSection
                projectName={projectName}
                hasQA={status?.has_qa}
                progress={status?.progress}
                stopped={status?.stopped}
                finished={status?.finished}
            />

            <ConfirmModal
                isOpen={showStopModal}
                title="Halt Pipeline Generation"
                message="Are you sure you want to stop the pipeline? All QA pairs generated so far will be saved."
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
