import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/api';
import {
    ArrowLeft, Play, Upload, Settings, FileText, Download,
    CheckCircle, AlertCircle, Loader2, BarChart2, Square, Zap, Globe
} from 'lucide-react';
import SettingsPanel from '../components/SettingsPanel';
import DebugDashboard from '../components/DebugDashboard';
import PromptEditor from '../components/PromptEditor';
import ScrapingDashboard from './ScrapingDashboard';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Workspace() {
    const { name } = useParams();
    const [activeTab, setActiveTab] = useState('upload');
    const [pipelineConfig, setPipelineConfig] = useState({
        chunk_size: 800,
        chunk_overlap: 100,
        similarity_threshold: 0.92,
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
    });
    const [uploadFile, setUploadFile] = useState(null);
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

    const uploadMutation = useMutation({
        mutationFn: (file) => projectApi.upload(name, file),
        onSuccess: () => {
            queryClient.invalidateQueries(['status', name]);
            setActiveTab('settings');
            toast.success(`File uploaded successfully.`);
        },
        onError: (e) => toast.error(`Upload failed: ${e.message}`),
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
                                <div className="flex flex-col items-center justify-center min-h-[420px] gap-8">
                                    {/* Drop zone */}
                                    <label className="w-full max-w-md cursor-pointer">
                                        <div className={`neu-trough rounded-2xl p-12 flex flex-col items-center gap-4 border-2 border-dashed transition-all duration-300 ${uploadFile
                                            ? 'border-neu-accent/40 shadow-[inset_4px_4px_8px_#111315,inset_-4px_-4px_8px_#2c323a,0_0_20px_rgba(255,107,0,0.1)]'
                                            : 'border-white/5 hover:border-neu-dim/20'
                                            }`}>
                                            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${uploadFile ? 'bg-neu-accent/10 shadow-[0_0_20px_rgba(255,107,0,0.3)]' : 'neu-plate'
                                                }`}>
                                                <Upload size={32} className={uploadFile ? 'text-neu-accent' : 'text-neu-dim'} strokeWidth={1.5} />
                                            </div>

                                            {uploadFile ? (
                                                <>
                                                    <p className="font-bold text-neu-text tracking-tight">{uploadFile.name}</p>
                                                    <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">
                                                        {(uploadFile.size / 1024).toFixed(1)} KB · Ready
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-semibold text-neu-text">Select source text</p>
                                                    <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">TXT files only</p>
                                                </>
                                            )}

                                            <input
                                                type="file" accept=".txt"
                                                onChange={(e) => setUploadFile(e.target.files[0])}
                                                className="sr-only"
                                            />
                                        </div>
                                    </label>

                                    {/* Upload CTA */}
                                    <button
                                        onClick={() => uploadFile && uploadMutation.mutate(uploadFile)}
                                        disabled={!uploadFile || uploadMutation.isPending}
                                        className={`group relative flex items-center justify-center gap-4 px-10 py-4 rounded-[20px] font-bold tracking-widest text-[13px] uppercase touch-manipulation select-none outline-none ${!uploadFile || uploadMutation.isPending
                                            ? 'bg-[#15181b] text-neu-dim/30 shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] cursor-not-allowed border-transparent'
                                            : 'bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98]'
                                            }`}
                                        style={{ transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease' }}
                                    >
                                        <div className={`flex items-center justify-center p-2 rounded-[12px] transition-all duration-150 ${!uploadFile || uploadMutation.isPending
                                            ? 'bg-transparent text-neu-dim/30'
                                            : 'bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20 group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.8)]'
                                            }`}>
                                            {uploadMutation.isPending
                                                ? <Loader2 size={18} className="animate-spin" />
                                                : <Zap size={18} />
                                            }
                                        </div>
                                        <span className={!uploadFile || uploadMutation.isPending ? '' : 'group-hover:text-neu-accent group-active:text-neu-accent group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.4)] transition-colors'}>
                                            {uploadMutation.isPending ? 'Uploading…' : 'Ingest File'}
                                        </span>
                                    </button>

                                    {status?.has_raw && (
                                        <div className="flex items-center gap-3 neu-inset px-5 py-3 rounded-xl">
                                            <div className="led led-green" />
                                            <span className="text-xs font-bold text-green-400 tracking-widest uppercase">File Uploaded</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ▸ SCRAPER */}
                            {activeTab === 'scrape' && (
                                <ScrapingDashboard />
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
                                                ['Chunk Size', pipelineConfig.chunk_size],
                                                ['Provider', generationConfig.provider === 'openai' ? 'OpenAI API' : 'Ollama (Local)'],
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
                                <div className="flex flex-col items-center justify-center min-h-[420px] gap-8">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-light text-neu-text tracking-tight">
                                            Export Dataset
                                        </h2>
                                        <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                                            Download your generated QA pairs
                                        </p>
                                    </div>

                                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center neu-plate">
                                        <Download
                                            size={32}
                                            strokeWidth={1.5}
                                            className={status?.has_qa ? 'text-neu-accent' : 'text-neu-dim/30'}
                                        />
                                    </div>

                                    {status?.has_qa && (
                                        <div className="neu-inset px-4 py-2 rounded-xl text-xs font-mono text-neu-accent font-bold uppercase tracking-widest flex items-center gap-2">
                                            <span>{generationConfig.format}</span>
                                            <span className="opacity-50">·</span>
                                            <span>{status.qa_count} pairs</span>
                                        </div>
                                    )}

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
                                        className={`group relative flex items-center justify-center gap-4 px-10 py-4 rounded-[20px] font-bold tracking-widest text-[13px] uppercase touch-manipulation select-none outline-none ${!status?.has_qa
                                            ? 'bg-[#15181b] text-neu-dim/30 shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] cursor-not-allowed border-transparent'
                                            : 'bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98]'
                                            }`}
                                        style={{ transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease' }}
                                    >
                                        <div className={`flex items-center justify-center p-2 rounded-[12px] transition-all duration-150 ${!status?.has_qa
                                            ? 'bg-transparent text-neu-dim/30'
                                            : 'bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20 group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.8)]'
                                            }`}>
                                            <Download size={18} />
                                        </div>
                                        <span className={!status?.has_qa ? '' : 'group-hover:text-neu-accent group-active:text-neu-accent group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.4)] transition-colors'}>
                                            Download JSONL
                                        </span>
                                    </button>

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
