import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/api';
import {
    ArrowLeft, Play, Upload, Settings, FileText, Download,
    AlertCircle, Loader2, BarChart2, Square, Zap, Globe, Flame, Save, ArrowUpRight
} from 'lucide-react';
import SettingsPanel from '../components/SettingsPanel';
import DebugDashboard from '../components/DebugDashboard';
import PromptEditor from '../components/PromptEditor';
import ScrapingDashboard from './ScrapingDashboard';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { CustomSelect } from '../components/LLMSetup';

export default function Workspace() {
    const { name } = useParams();
    const [activeTab, setActiveTab] = useState('upload');
    const [pipelineConfig, setPipelineConfig] = useState({
        chunk_size: 800,
        chunk_overlap: 100,
        similarity_threshold: 0.92,
        chunking_method: 'recursive',
    });
    const [generationConfig, setGenerationConfig] = useState({
        provider: 'local',
        model_name: 'llama3.2',
        temperature: 0.7,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        max_tokens: 0,
        qa_density_factor: 1.0,
        domain: 'general',
        format: 'alpaca',
        api_key: '',
        base_url: '',
    });
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadMode, setUploadMode] = useState('overwrite');
    const [rawDraft, setRawDraft] = useState('');
    const [finetuneExported, setFinetuneExported] = useState(null);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [showStopModal, setShowStopModal] = useState(false);
    const queryClient = useQueryClient();
    const toast = useToast();

    const { data: status, isError } = useQuery({
        queryKey: ['status', name],
        queryFn: () => projectApi.getStatus(name),
        refetchInterval: (data) => (data?.running ? 1000 : 3000),
        retry: false,
    });

    const { data: rawInfo } = useQuery({
        queryKey: ['raw_text', name],
        queryFn: () => projectApi.getRawText(name),
        enabled: !!status?.has_raw && activeTab === 'upload',
    });

    useEffect(() => {
        if (rawInfo?.text !== undefined && !rawDraft) {
            setRawDraft(rawInfo.text);
        }
    }, [rawInfo?.text, rawDraft]);

    const uploadMutation = useMutation({
        mutationFn: ({ files, mode }) => projectApi.upload(name, files, mode),
        onSuccess: (res) => {
            queryClient.invalidateQueries(['status', name]);
            queryClient.invalidateQueries(['raw_text', name]);
            setRawDraft('');
            setUploadFiles([]);
            setActiveTab('settings');
            toast.success(res?.message || 'Files ingested successfully.');
        },
        onError: (e) => toast.error(`Upload failed: ${e.message}`),
    });

    const saveRawMutation = useMutation({
        mutationFn: ({ text, mode }) => projectApi.saveRawText(name, text, mode),
        onSuccess: () => {
            queryClient.invalidateQueries(['status', name]);
            queryClient.invalidateQueries(['raw_text', name]);
            toast.success('Corpus text saved to raw.txt');
        },
        onError: (e) => toast.error(`Failed to save text: ${e.message}`),
    });

    const sendToFinetuneMutation = useMutation({
        mutationFn: (fmt) => projectApi.exportToFinetune(name, fmt),
        onSuccess: (data) => {
            setFinetuneExported(data);
            toast.success(`Sent ${data.row_count} rows (${data.filename}) to Finetune Lab!`);
        },
        onError: (e) => toast.error(e.response?.data?.detail || e.message),
    });

    const runPipelineMutation = useMutation({
        mutationFn: () => projectApi.runPipeline(name, {
            pipeline_config: pipelineConfig,
            generation_config: generationConfig,
        }, false),
        onSuccess: () => {
            queryClient.invalidateQueries(['qa', name]);
            queryClient.invalidateQueries(['status', name]);
            toast.info(`Pipeline execution started.`);
        },
        onError: (e) => toast.error(`Failed to start pipeline: ${e.message}`),
    });

    const resumePipelineMutation = useMutation({
        mutationFn: () => projectApi.runPipeline(name, {
            pipeline_config: pipelineConfig,
            generation_config: generationConfig,
        }, true),
        onSuccess: () => {
            queryClient.invalidateQueries(['qa', name]);
            queryClient.invalidateQueries(['status', name]);
            setShowResumeModal(false);
            toast.success(`Pipeline resumed successfully.`);
        },
        onError: (e) => toast.error(`Failed to resume pipeline: ${e.message}`),
    });

    const stopMutation = useMutation({
        mutationFn: () => projectApi.stopPipeline(name),
        onSuccess: () => {
            queryClient.invalidateQueries(['status', name]);
            setShowStopModal(false);
            toast.warn(`Pipeline stopped. Partial results saved.`);
        },
        onError: (e) => toast.error(`Failed to stop pipeline: ${e.message}`),
    });

    // Called when user clicks the Engage button
    const handleEngageClick = () => {
        // Show resume modal if there are saved partial results (stopped mid-run)
        if (status?.has_partial || status?.stopped) {
            setShowResumeModal(true);
        } else {
            runPipelineMutation.mutate();
        }
    };

    const tabs = [
        { id: 'upload', label: 'Upload', icon: Upload },
        { id: 'scrape', label: 'Scraper', icon: Globe },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'prompt', label: 'Prompt', icon: FileText },
        { id: 'run', label: 'Run Pipeline', icon: Play },
        { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
        { id: 'export', label: 'Export', icon: Download },
    ];

    return (
        <div className="max-w-6xl mx-auto">
            {isError && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <AlertCircle size={48} className="text-red-400 mb-6" />
                    <h1 className="text-3xl font-light text-neu-text tracking-tight mb-2">Project Not Found</h1>
                    <p className="text-neu-dim mb-8">The workspace you are looking for does not exist or has been deleted.</p>
                    <Link to="/" className="neu-btn px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase flex items-center gap-2">
                        <ArrowLeft size={16} /> Return to Dashboard
                    </Link>
                </div>
            )}

            {!isError && (
                <>
                    {/* ── Workspace Header ──────────────────────────────────────── */}
                    <div className="mb-6 flex items-center justify-between">
                        <Link
                            to="/"
                            className="neu-btn flex items-center gap-2 px-4 py-2 text-sm text-neu-dim hover:text-neu-text rounded-xl no-underline"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </Link>

                        <div className="neu-inset px-4 py-2 rounded-xl">
                            <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">{name}</span>
                        </div>
                    </div>

                    {/* ── Status Bar ───────────────────────────────────────────── */}
                    <div className="neu-trough px-5 py-3.5 flex items-center justify-between mb-6 rounded-2xl">
                        <div className="flex gap-5">
                            <StatusItem label="Raw" active={status?.has_raw} />
                            <StatusItem label="Cleaned" active={status?.has_cleaned} />
                            <StatusItem label="Chunks" active={status?.has_chunks} count={status?.chunk_count} />
                            <StatusItem label="QA" active={status?.has_qa || status?.stopped} count={status?.qa_count} />
                        </div>

                        <div className="flex items-center gap-3">
                            {status?.running && (
                                <>
                                    <div className="flex items-center gap-2 neu-inset px-4 py-1.5 rounded-xl">
                                        <Loader2 size={12} className="animate-spin text-neu-accent" />
                                        <span className="text-xs font-bold text-neu-accent tracking-widest uppercase">Running</span>
                                    </div>
                                    <button
                                        onClick={() => setShowStopModal(true)}
                                        disabled={stopMutation.isPending}
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold text-red-400 neu-inset hover:shadow-[inset_5px_5px_10px_#141619,inset_-5px_-5px_10px_#2e343b,0_0_10px_rgba(239,68,68,0.3)] transition-all disabled:opacity-40"
                                    >
                                        {stopMutation.isPending
                                            ? <Loader2 size={11} className="animate-spin" />
                                            : <Square size={10} fill="currentColor" />
                                        }
                                        {stopMutation.isPending ? 'Stopping…' : 'Stop'}
                                    </button>
                                </>
                            )}
                            {!status?.running && status?.stopped && (
                                <div className="flex items-center gap-2 neu-inset px-4 py-1.5 rounded-xl">
                                    <div className="led led-on" />
                                    <span className="text-xs font-bold text-neu-accent tracking-widest uppercase">Stopped</span>
                                </div>
                            )}
                            {!status?.running && status?.has_error && (
                                <div className="flex items-center gap-2 neu-inset px-4 py-1.5 rounded-xl">
                                    <div className="led led-red" />
                                    <span className="text-xs font-bold text-red-400 tracking-widest uppercase">Error</span>
                                </div>
                            )}
                            {status?.finished && !status?.running && (
                                <div className="flex items-center gap-2 neu-inset px-4 py-1.5 rounded-xl">
                                    <div className="led led-green" />
                                    <span className="text-xs font-bold text-green-400 tracking-widest uppercase">Complete</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-6">
                        {/* ── Sidebar ────────────────────────────────────────── */}
                        <div className="w-52 flex-shrink-0 flex flex-col gap-3">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`relative group flex items-center gap-4 px-5 py-4 rounded-[20px] text-left outline-none shrink-0 touch-manipulation select-none overflow-hidden ${isActive
                                            ? 'bg-neu-dark text-neu-accent shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] border border-black/40 scale-[0.98]'
                                            : 'bg-neu-base text-neu-dim shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5'
                                            }`}
                                        style={{
                                            transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease'
                                        }}
                                    >
                                        {/* Icon Panel */}
                                        <div className={`flex-shrink-0 p-2.5 rounded-[12px] transition-all duration-150 ${isActive
                                            ? 'bg-[#15181b] shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20'
                                            : 'bg-neu-base shadow-[3px_3px_6px_#111315,-3px_-3px_6px_#2e343b]'
                                            }`}>
                                            <tab.icon
                                                size={18}
                                                strokeWidth={isActive ? 2 : 1.5}
                                                className={isActive ? 'text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.8)]' : 'text-neu-dim'}
                                            />
                                        </div>

                                        {/* Label */}
                                        <div className="flex-1 min-w-0 pr-4">
                                            <span className={`text-[13px] font-bold tracking-wide block truncate transition-colors duration-150 ${isActive ? 'text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]' : 'text-neu-text'
                                                }`}>
                                                {tab.label}
                                            </span>
                                        </div>

                                        {/* Status LED */}
                                        <div className={`absolute right-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-200 ${isActive
                                            ? 'bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]'
                                            : 'bg-black/40 shadow-[inset_1px_1px_2px_#000]'
                                            }`} />
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Content Panel ─────────────────────────────────── */}
                        <div className="flex-1 min-w-0 neu-plate p-8 min-h-[540px]">

                            {/* ▸ UPLOAD */}
                            {activeTab === 'upload' && (
                                <div className="space-y-8">
                                    <div className="flex flex-col items-center justify-center gap-6">
                                        <div className="flex items-center gap-3 self-end">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neu-dim">Ingest Mode:</span>
                                            {['overwrite', 'append'].map((m) => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setUploadMode(m)}
                                                    className={`neu-btn-sm text-[10px] uppercase font-bold ${uploadMode === m ? 'text-neu-accent ring-1 ring-neu-accent/40' : ''}`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>

                                        <label className="w-full cursor-pointer">
                                            <div className={`neu-trough rounded-2xl p-10 flex flex-col items-center gap-4 border-2 border-dashed transition-all duration-300 ${uploadFiles.length
                                                ? 'border-neu-accent/40 shadow-[inset_4px_4px_8px_#111315,inset_-4px_-4px_8px_#2c323a,0_0_20px_rgba(255,107,0,0.1)]'
                                                : 'border-white/5 hover:border-neu-dim/20'
                                                }`}>
                                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${uploadFiles.length ? 'bg-neu-accent/10 shadow-[0_0_20px_rgba(255,107,0,0.3)]' : 'neu-plate'}`}>
                                                    <Upload size={28} className={uploadFiles.length ? 'text-neu-accent' : 'text-neu-dim'} strokeWidth={1.5} />
                                                </div>

                                                {uploadFiles.length ? (
                                                    <>
                                                        <p className="font-bold text-neu-text tracking-tight text-center">
                                                            {uploadFiles.length === 1 ? uploadFiles[0].name : `${uploadFiles.length} files selected`}
                                                        </p>
                                                        <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">
                                                            {(uploadFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB total · Ready ({uploadMode})
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="font-semibold text-neu-text">Select one or more source documents</p>
                                                        <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">
                                                            Supports .TXT, .MD, .PDF, .DOCX, .CSV, .JSON, .JSONL, .HTML
                                                        </p>
                                                    </>
                                                )}

                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".txt,.md,.markdown,.pdf,.docx,.csv,.json,.jsonl,.html,.htm"
                                                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                                                    className="sr-only"
                                                />
                                            </div>
                                        </label>

                                        <button
                                            onClick={() => uploadFiles.length && uploadMutation.mutate({ files: uploadFiles, mode: uploadMode })}
                                            disabled={!uploadFiles.length || uploadMutation.isPending}
                                            className={`group relative flex items-center justify-center gap-4 px-10 py-4 rounded-[20px] font-bold tracking-widest text-[13px] uppercase touch-manipulation select-none outline-none ${!uploadFiles.length || uploadMutation.isPending
                                                ? 'bg-[#15181b] text-neu-dim/30 shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] cursor-not-allowed border-transparent'
                                                : 'bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33]'
                                                }`}
                                        >
                                            <Zap size={18} className={uploadFiles.length ? 'text-neu-accent' : ''} />
                                            <span>{uploadMutation.isPending ? 'Ingesting…' : `Ingest ${uploadFiles.length > 1 ? `${uploadFiles.length} Files` : 'Document'}`}</span>
                                        </button>
                                    </div>

                                    {/* Direct Raw Text Paste / Editor */}
                                    <div className="neu-trough p-6 rounded-2xl space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-xs font-bold text-neu-dim uppercase tracking-widest">Direct Corpus Editor (raw.txt)</h3>
                                                <p className="text-[10px] font-mono text-neu-dim/60 mt-0.5">
                                                    Paste or edit raw training corpus text directly without uploading a file.
                                                </p>
                                            </div>
                                            {rawInfo && (
                                                <div className="neu-inset px-3 py-1.5 rounded-xl text-[10px] font-mono text-neu-accent">
                                                    {rawInfo.words?.toLocaleString() || 0} words · {rawInfo.chars?.toLocaleString() || 0} chars
                                                </div>
                                            )}
                                        </div>

                                        <textarea
                                            rows={7}
                                            value={rawDraft}
                                            onChange={(e) => setRawDraft(e.target.value)}
                                            placeholder="Paste domain documentation, articles, markdown notes, or transcripts here..."
                                            className="neu-textarea font-mono text-xs"
                                        />

                                        <div className="flex items-center justify-between gap-3">
                                            {status?.has_raw ? (
                                                <div className="flex items-center gap-2 neu-inset px-3 py-1.5 rounded-xl">
                                                    <div className="led led-green" />
                                                    <span className="text-[10px] font-bold text-green-400 tracking-widest uppercase">Corpus Ready</span>
                                                </div>
                                            ) : <span />}

                                            <button
                                                type="button"
                                                disabled={!rawDraft.trim() || saveRawMutation.isPending}
                                                onClick={() => saveRawMutation.mutate({ text: rawDraft, mode: 'overwrite' })}
                                                className="neu-btn-sm text-neu-accent px-4 py-2"
                                            >
                                                <Save size={13} />
                                                {saveRawMutation.isPending ? 'Saving...' : 'Save Corpus Text'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ▸ SCRAPER */}
                            {activeTab === 'scrape' && (
                                <ScrapingDashboard
                                    onProceedToPipeline={() => {
                                        queryClient.invalidateQueries(['status', name]);
                                        queryClient.invalidateQueries(['raw_text', name]);
                                        setActiveTab('settings');
                                    }}
                                />
                            )}

                            {/* ▸ SETTINGS */}
                            {activeTab === 'settings' && (
                                <SettingsPanel
                                    pipelineConfig={pipelineConfig}
                                    setPipelineConfig={setPipelineConfig}
                                    generationConfig={generationConfig}
                                    setGenerationConfig={setGenerationConfig}
                                />
                            )}

                            {/* ▸ PROMPT */}
                            {activeTab === 'prompt' && <PromptEditor />}

                            {/* ▸ RUN */}
                            {activeTab === 'run' && (
                                <div className="flex flex-col items-center justify-center min-h-[420px] gap-8">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-light text-neu-text tracking-tight">
                                            Run Pipeline
                                        </h2>
                                        <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                                            Clean → Chunk → Embed → Generate
                                        </p>
                                    </div>

                                    {/* Running banner */}
                                    {status?.running && (
                                        <div className="neu-alert-info w-full max-w-md animate-in fade-in">
                                            <Loader2 size={16} className="animate-spin flex-shrink-0 text-blue-400" />
                                            <div>
                                                <p className="font-bold text-xs uppercase tracking-wide">Pipeline Active</p>
                                                <p className="text-[10px] font-mono opacity-70">Monitor live progress in the Inspector tab.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stopped banner */}
                                    {status?.stopped && !status?.running && (
                                        <div className="neu-alert-warn w-full max-w-md animate-in fade-in">
                                            <AlertCircle size={16} className="flex-shrink-0" />
                                            <div>
                                                <p className="font-bold text-xs uppercase tracking-wide">Generation Stopped</p>
                                                <p className="text-[10px] font-mono opacity-70">Partial results are viewable in Inspector.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Config manifest */}
                                    <div className="neu-trough w-full max-w-md p-5 rounded-2xl">
                                        <p className="text-[10px] font-bold text-neu-dim uppercase tracking-widest mb-4">Runtime Manifest</p>
                                        <div className="space-y-3">
                                            {[
                                                ['Chunking', `${pipelineConfig.chunk_size} tok (${pipelineConfig.chunking_method || 'recursive'})`],
                                                ['Provider', generationConfig.provider === 'openai'
                                                    ? 'OpenAI / Compatible'
                                                    : generationConfig.provider === 'anthropic'
                                                        ? 'Anthropic API'
                                                        : generationConfig.provider === 'extractive'
                                                            ? 'Offline Synthesizer'
                                                            : 'Ollama (Local)'],
                                                ['Model', generationConfig.model_name],
                                                ['Format', generationConfig.format],
                                            ].map(([key, val]) => (
                                                <div key={key} className="flex items-center justify-between gap-4">
                                                    <span className="text-xs text-neu-dim font-mono">{key}</span>
                                                    <span className="neu-badge neu-badge-accent font-mono">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Engage + Stop */}
                                    <div className="flex flex-col items-center gap-4">
                                        <button
                                            onClick={handleEngageClick}
                                            disabled={runPipelineMutation.isPending || resumePipelineMutation.isPending || status?.running || !status?.has_raw}
                                            className={`group relative flex items-center justify-center gap-4 px-12 py-5 rounded-[20px] font-bold tracking-widest text-[15px] uppercase touch-manipulation select-none outline-none ${status?.running || runPipelineMutation.isPending || resumePipelineMutation.isPending || !status?.has_raw
                                                ? 'bg-[#15181b] text-neu-dim/30 shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] cursor-not-allowed border-transparent'
                                                : 'bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98]'
                                                }`}
                                            style={{ transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease' }}
                                        >
                                            <div className={`flex items-center justify-center p-2.5 rounded-[12px] transition-all duration-150 ${status?.running || runPipelineMutation.isPending || resumePipelineMutation.isPending || !status?.has_raw
                                                ? 'bg-transparent text-neu-dim/30'
                                                : 'bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20 group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.8)]'
                                                }`}>
                                                {status?.running || runPipelineMutation.isPending || resumePipelineMutation.isPending
                                                    ? <Loader2 size={20} className="animate-spin" />
                                                    : <Play size={20} fill="currentColor" />
                                                }
                                            </div>
                                            <span className={status?.running || runPipelineMutation.isPending || resumePipelineMutation.isPending || !status?.has_raw ? '' : 'group-hover:text-neu-accent group-active:text-neu-accent group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.4)] transition-colors'}>
                                                {status?.running ? 'Processing…' : status?.stopped ? 'Resume / Rerun' : 'Engage'}
                                            </span>
                                        </button>

                                        {!status?.has_raw && (
                                            <p className="text-[10px] font-mono text-neu-dim uppercase tracking-wide">
                                                Upload a source file first
                                            </p>
                                        )}

                                        {status?.running && (
                                            <button
                                                onClick={() => setShowStopModal(true)}
                                                disabled={stopMutation.isPending}
                                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-red-400 neu-inset tracking-widest uppercase hover:shadow-[inset_5px_5px_10px_#141619,inset_-5px_-5px_10px_#2e343b,0_0_12px_rgba(239,68,68,0.25)] transition-all disabled:opacity-40"
                                            >
                                                {stopMutation.isPending
                                                    ? <Loader2 size={12} className="animate-spin" />
                                                    : <Square size={11} fill="currentColor" />
                                                }
                                                Stop
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ▸ DASHBOARD */}
                            {activeTab === 'dashboard' && (
                                <DebugDashboard projectName={name} status={status} stopMutation={stopMutation} />
                            )}

                            {/* ▸ EXPORT */}
                            {activeTab === 'export' && (
                                <div className="flex flex-col items-center justify-center min-h-[420px] gap-6">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-light text-neu-text tracking-tight">
                                            Export Dataset
                                        </h2>
                                        <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                                            Download formatted JSONL or send directly to Finetune Lab
                                        </p>
                                    </div>

                                    <div className="w-full max-w-sm">
                                        <label className="block text-[10px] font-bold text-neu-dim tracking-widest uppercase mb-2 text-center">
                                            Export Schema Format
                                        </label>
                                        <CustomSelect
                                            value={generationConfig.format}
                                            onChange={v => setGenerationConfig(prev => ({ ...prev, format: v }))}
                                            options={[
                                                { value: 'alpaca', label: 'Alpaca (Finetune Lab Standard)' },
                                                { value: 'sharegpt', label: 'ShareGPT' },
                                                { value: 'openai', label: 'OpenAI Chat' },
                                                { value: 'chatml', label: 'ChatML' },
                                                { value: 'dpo', label: 'DPO Preference' },
                                                { value: 'completion', label: 'Completion / CPT' },
                                            ]}
                                        />
                                    </div>

                                    {status?.has_qa && (
                                        <div className="neu-inset px-4 py-2 rounded-xl text-xs font-mono text-neu-accent font-bold uppercase tracking-widest flex items-center gap-2">
                                            <span>{generationConfig.format}</span>
                                            <span className="opacity-50">·</span>
                                            <span>{status.qa_count} pairs</span>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center justify-center gap-4">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const fmt = generationConfig.format;
                                                    const response = await projectApi.export(name, fmt);
                                                    const contentType = response.headers['content-type'];
                                                    const isJson = contentType && contentType.includes('application/json');
                                                    const ext = isJson ? 'json' : 'jsonl';

                                                    const url = window.URL.createObjectURL(response.data);
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.setAttribute('download', `${name}_${fmt}.${ext}`);
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    toast.success('Dataset exported successfully.');
                                                } catch (e) {
                                                    if (e.response?.data instanceof Blob) {
                                                        const text = await e.response.data.text();
                                                        try {
                                                            const json = JSON.parse(text);
                                                            toast.error(`Export failed: ${json.detail || 'Unknown error'}`);
                                                        } catch {
                                                            toast.error(`Export failed: ${text}`);
                                                        }
                                                    } else {
                                                        const serverMsg = e.response?.data?.detail || e.message;
                                                        toast.error(`Export failed: ${serverMsg}`);
                                                    }
                                                }
                                            }}
                                            disabled={!status?.has_qa}
                                            className={`group relative flex items-center justify-center gap-3 px-8 py-4 rounded-[20px] font-bold tracking-widest text-[13px] uppercase touch-manipulation select-none outline-none ${!status?.has_qa
                                                ? 'bg-[#15181b] text-neu-dim/30 shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] cursor-not-allowed border-transparent'
                                                : 'bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33]'
                                                }`}
                                        >
                                            <Download size={18} className={status?.has_qa ? 'text-neu-accent' : ''} />
                                            <span>Download File</span>
                                        </button>

                                        <button
                                            onClick={() => sendToFinetuneMutation.mutate(generationConfig.format)}
                                            disabled={!status?.has_qa || sendToFinetuneMutation.isPending}
                                            className={`group relative flex items-center justify-center gap-3 px-8 py-4 rounded-[20px] font-bold tracking-widest text-[13px] uppercase touch-manipulation select-none outline-none ${!status?.has_qa || sendToFinetuneMutation.isPending
                                                ? 'bg-[#15181b] text-neu-dim/30 shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] cursor-not-allowed border-transparent'
                                                : 'bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_15px_rgba(255,107,0,0.18)] ring-1 ring-neu-accent/30 hover:-translate-y-0.5'
                                                }`}
                                        >
                                            {sendToFinetuneMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
                                            <span>{sendToFinetuneMutation.isPending ? 'Sending…' : 'Send to Finetune Lab'}</span>
                                        </button>
                                    </div>

                                    {finetuneExported && (
                                        <div className="neu-trough px-5 py-3 rounded-2xl flex items-center gap-4 border border-neu-accent/20">
                                            <span className="text-xs font-mono text-green-400">
                                                Synced {finetuneExported.row_count} rows ({finetuneExported.filename})
                                            </span>
                                            <a
                                                href="http://localhost:5174/finetune/new/dataset"
                                                className="neu-btn-sm text-neu-accent no-underline"
                                            >
                                                Open Finetune Lab <ArrowUpRight size={12} />
                                            </a>
                                        </div>
                                    )}

                                    {!status?.has_qa && (
                                        <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">
                                            Run pipeline to generate QA pairs first
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Resume / Restart Modal ─────────────────────────────── */}
                    <ResumeModal
                        show={showResumeModal}
                        onClose={() => setShowResumeModal(false)}
                        status={status}
                        onContinue={() => resumePipelineMutation.mutate()}
                        onRestart={() => {
                            setShowResumeModal(false);
                            runPipelineMutation.mutate();
                        }}
                        isLoadingContinue={resumePipelineMutation.isPending}
                        isLoadingRestart={runPipelineMutation.isPending}
                    />

                    <ConfirmModal
                        isOpen={showStopModal}
                        title="Halt Pipeline Processing"
                        message="Are you sure you want to stop the pipeline? Don't worry, all generated QA pairs up to this point will safely remain in your dataset."
                        confirmText="Halt Pipeline"
                        variant="warn"
                        onConfirm={() => stopMutation.mutate()}
                        onCancel={() => setShowStopModal(false)}
                    />
                </>
            )}
        </div>
    );
}

// ─── Resume / Restart Modal ────────────────────────────────────────────────────
function ResumeModal({ show, onClose, status, onContinue, onRestart, isLoadingContinue, isLoadingRestart }) {
    if (!show) return null;
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md mx-4 rounded-3xl p-8 flex flex-col gap-6"
                style={{
                    background: 'var(--neu-base, #1f2428)',
                    boxShadow: '20px 20px 60px #111315, -10px -10px 40px #2c3036, 0 0 40px rgba(255,107,0,0.08)',
                    border: '1px solid rgba(255,255,255,0.05)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)' }}>
                        <Play size={28} className="text-neu-accent" />
                    </div>
                </div>

                {/* Copy */}
                <div className="text-center">
                    <h3 className="text-xl font-semibold text-neu-text tracking-tight mb-2">
                        Previous run was stopped
                    </h3>
                    <p className="text-sm text-neu-dim leading-relaxed">
                        {status?.qa_count > 0
                            ? <><span className="text-neu-accent font-bold">{status.qa_count} QA pairs</span> were saved from the last run.</>
                            : 'No QA pairs were saved from the last run.'
                        }
                    </p>
                    <p className="text-xs text-neu-dim/50 font-mono mt-2">
                        Would you like to continue from where you left off, or start fresh?
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3">
                    {/* Continue */}
                    <button
                        disabled={isLoadingContinue || isLoadingRestart}
                        onClick={onContinue}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,107,0,0.7) 0%, rgba(200,80,0,0.85) 100%)',
                            color: '#fff',
                            boxShadow: '0 0 20px rgba(255,107,0,0.25), 0 4px 16px rgba(0,0,0,0.35)',
                            border: '1px solid rgba(255,107,0,0.25)',
                            opacity: isLoadingContinue || isLoadingRestart ? 0.5 : 1,
                        }}
                    >
                        {isLoadingContinue
                            ? <Loader2 size={16} className="animate-spin" />
                            : <Play size={16} fill="currentColor" />
                        }
                        {isLoadingContinue ? 'Resuming…' : 'Continue from last stop'}
                    </button>

                    {/* Start Fresh */}
                    <button
                        disabled={isLoadingContinue || isLoadingRestart}
                        onClick={onRestart}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all neu-inset text-neu-dim hover:text-neu-text"
                        style={{ opacity: isLoadingContinue || isLoadingRestart ? 0.5 : 1 }}
                    >
                        {isLoadingRestart
                            ? <Loader2 size={16} className="animate-spin" />
                            : <Square size={14} />
                        }
                        {isLoadingRestart ? 'Starting fresh…' : 'Start fresh (override)'}
                    </button>
                </div>

                {/* Dismiss hint */}
                <p className="text-center text-[10px] text-neu-dim/30 font-mono uppercase tracking-widest">
                    Click outside to cancel
                </p>
            </div>
        </div>
    );
}

// ─── Status Indicator ─────────────────────────────────────────────────────────
function StatusItem({ label, active, count }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`led ${active ? 'led-green animate-pulse' : 'led-off'}`} />
            <span className={`text-[10px] font-bold tracking-widest uppercase ${active ? 'text-green-400' : 'text-neu-dim/40'}`}>
                {label}
            </span>
            {count !== undefined && active && (
                <span className="neu-badge neu-badge-green text-[9px]">{count}</span>
            )}
        </div>
    );
}
