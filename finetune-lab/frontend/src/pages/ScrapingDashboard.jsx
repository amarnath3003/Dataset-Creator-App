import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Globe, Search, Play, Square, Settings, RefreshCw, FileText, Image as ImageIcon, Download, Database, Check, Loader2, Zap, X, Cpu } from 'lucide-react';
import { Slider } from '../components/SettingsPanel';
import { ProviderBtn, LocalSection, ApiSection } from '../components/LLMSetup';

function DryRunSandbox({ previewData, onProcessDataset, isRefining }) {
    const rawText = previewData?.text
        ? previewData.text.slice(0, 2000) + (previewData.text.length > 2000 ? '\n...' : '')
        : '';

    return (
        <div className="pt-6 border-t border-white/[0.03] space-y-3">
            <div className="flex items-center gap-2 text-neu-dim">
                <FileText size={13} />
                <h5 className="text-[10px] font-bold tracking-widest uppercase">Dataset Preview</h5>
            </div>

            <div className="neu-inset rounded-xl border border-black/40 min-h-[120px] max-h-[200px] overflow-y-auto custom-scrollbar bg-[#08090a] p-3">
                {!rawText ? (
                    <div className="h-full flex items-center justify-center text-neu-dim/30 text-[9px] uppercase tracking-widest font-bold py-8">
                        Run a scrape job to see a preview here
                    </div>
                ) : (
                    <p className="text-[11px] font-mono whitespace-pre-wrap leading-[1.7] text-neu-dim/70">
                        {rawText}
                    </p>
                )}
            </div>

            <button
                onClick={onProcessDataset}
                disabled={isRefining}
                className="w-full neu-btn neu-btn-primary flex items-center justify-center gap-2 text-xs py-3 !rounded-xl"
            >
                {isRefining ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {isRefining ? 'Processing Dataset...' : 'Process Entire Dataset'}
            </button>
        </div>
    );
}




export default function ScrapingDashboard() {
    const { name } = useParams();
    const toast = useToast();

    const getStored = (key, defaultVal) => {
        const item = localStorage.getItem(`scraper_${name}_${key}`);
        if (item !== null) {
            try { return JSON.parse(item); } catch { return item; }
        }
        return defaultVal;
    };

    const [urls, setUrls] = useState(() => getStored('urls', ''));
    const [query, setQuery] = useState(() => getStored('query', ''));
    const [category] = useState(() => getStored('category', ''));
    const [extractImages, setExtractImages] = useState(() => getStored('extractImages', true));
    const [extractText, setExtractText] = useState(() => getStored('extractText', true));
    const [scraperLLMConfig, setScraperLLMConfig] = useState(() => getStored('llmConfig', {
        provider: 'local',
        model_name: 'llama3.2',
        api_key: '',
        prompt: `You are an expert dataset curator. Your task is to clean and refine the following web scraped text. Remove all navigational noise, ad fragments, cookie warnings, and broken formatting. Keep the factual content pristine and output it as well-structured markdown. Do not invent or add any new information. Output ONLY the cleaned text.`
    }));

    // Crawler parameters
    const [maxDepth, setMaxDepth] = useState(() => getStored('maxDepth', 1));
    const [maxPages, setMaxPages] = useState(() => getStored('maxPages', 50));
    const [relevanceThreshold, setRelevanceThreshold] = useState(() => getStored('relevanceThreshold', 0.0));
    const [domainRestricted, setDomainRestricted] = useState(() => getStored('domainRestricted', true));

    const [isScraping, setIsScraping] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [taskId, setTaskId] = useState(() => getStored('taskId', null));
    const [activeJobId, setActiveJobId] = useState(null); // Drives the live polling loop - separate from persisted taskId
    const [status, setStatus] = useState(null);
    const [logs, setLogs] = useState([]);
    const [previewData, setPreviewData] = useState(null);
    const [pipelineTextChecked, setPipelineTextChecked] = useState(true);
    const [previewImage, setPreviewImage] = useState(null);
    const [aiEnhanceActive, setAiEnhanceActive] = useState(() => getStored('aiEnhanceActive', false));

    // Mock API call to start job
    const handleStartScrape = async () => {
        if (!urls && !query && !category) {
            toast.error('Please provide a URL, search query, or category.');
            return;
        }

        setIsScraping(true);
        toast.success('Scraping job initiated.');

        try {
            const urlList = urls.split('\n').filter(u => u.trim());
            const response = await fetch(`http://localhost:8000/scrape/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_name: name,
                    urls: urlList,
                    query: query || null,
                    category: category || null,
                    extract_images: extractImages,
                    extract_text: extractText,
                    llm_config: scraperLLMConfig,
                    max_depth: parseInt(maxDepth),
                    max_pages: parseInt(maxPages),
                    relevance_threshold: parseFloat(relevanceThreshold),
                    domain_restricted: domainRestricted
                })
            });

            const data = await response.json();
            if (response.ok) {
                setTaskId(data.task_id);
                setActiveJobId(data.task_id);
            } else {
                toast.error(data.detail || 'Failed to start scraping');
                setIsScraping(false);
            }
        } catch {
            toast.error('Could not connect to server.');
            setIsScraping(false);
        }
    };

    const handleStartRefinement = async () => {
        setIsRefining(true);
        toast.info("Starting AI Refinement Pipeline...");
        try {
            const response = await fetch(`http://localhost:8000/scrape/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_name: name,
                    llm_config: scraperLLMConfig
                })
            });
            const data = await response.json();
            if (response.ok) {
                setTaskId(data.task_id);
                setActiveJobId(data.task_id); // Triggers the polling useEffect atomically
            } else {
                toast.error(data.detail || "Refinement failed to start.");
                setIsRefining(false);
            }
        } catch {
            toast.error("Could not connect to server.");
            setIsRefining(false);
        }
    };

    const handleCancelScrape = async () => {
        if (!taskId) return;
        try {
            await fetch(`http://localhost:8000/scrape/cancel/${taskId}`, { method: 'POST' });
            setIsScraping(false);
            toast.info('Scraping job cancelled.');
        } catch {
            toast.error('Failed to cancel job.');
        }
    };

    useEffect(() => {
        let interval;
        if (activeJobId) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`http://localhost:8000/scrape/status/${activeJobId}`);
                    const data = await res.json();
                    if (res.ok) {
                        setStatus(data);
                        setLogs((data.logs || []).slice(-200));

                        if (data.status === 'completed' || data.status === 'failed') {
                            const wasRefining = isRefining;
                            setIsScraping(false);
                            setIsRefining(false);
                            setActiveJobId(null);
                            clearInterval(interval);

                            if (data.status === 'completed') {
                                toast.success(wasRefining ? 'AI Refinement completed successfully!' : 'Scraping completed successfully.');
                                // Refresh the preview with the latest data (possibly AI-enhanced)
                                try {
                                    const prevRes = await fetch(`http://localhost:8000/scrape/preview/${encodeURIComponent(name)}`);
                                    if (prevRes.ok) setPreviewData(await prevRes.json());
                                } catch (e) { console.error('Preview error', e); }
                            } else {
                                toast.error(`Job failed: ${data.logs?.at(-1) || 'Unknown error'}`);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching status:', err);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeJobId, isRefining, name]);

    // Track states to localStorage
    useEffect(() => {
        localStorage.setItem(`scraper_${name}_urls`, JSON.stringify(urls));
        localStorage.setItem(`scraper_${name}_query`, JSON.stringify(query));
        localStorage.setItem(`scraper_${name}_category`, JSON.stringify(category));
        localStorage.setItem(`scraper_${name}_extractImages`, JSON.stringify(extractImages));
        localStorage.setItem(`scraper_${name}_extractText`, JSON.stringify(extractText));
        localStorage.setItem(`scraper_${name}_maxDepth`, JSON.stringify(maxDepth));
        localStorage.setItem(`scraper_${name}_maxPages`, JSON.stringify(maxPages));
        localStorage.setItem(`scraper_${name}_relevanceThreshold`, JSON.stringify(relevanceThreshold));
        localStorage.setItem(`scraper_${name}_domainRestricted`, JSON.stringify(domainRestricted));
        localStorage.setItem(`scraper_${name}_taskId`, JSON.stringify(taskId));
        localStorage.setItem(`scraper_${name}_llmConfig`, JSON.stringify(scraperLLMConfig));
        localStorage.setItem(`scraper_${name}_aiEnhanceActive`, JSON.stringify(aiEnhanceActive));
    }, [name, urls, query, category, extractImages, extractText, maxDepth, maxPages, relevanceThreshold, domainRestricted, taskId, scraperLLMConfig, aiEnhanceActive]);

    // Initial load check for background tasks (only on mount, never during an active job)
    useEffect(() => {
        if (taskId && !activeJobId && !isScraping && !isRefining && !status) {
            fetch(`http://localhost:8000/scrape/status/${taskId}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (!data) return; // Silently skip 404s (server restarted)
                    if (data.status === 'running' || data.status === 'queued') {
                        if (data.logs && data.logs.join(' ').includes('Refinement')) setIsRefining(true);
                        else setIsScraping(true);
                        setActiveJobId(taskId);
                    } else {
                        setStatus(data);
                        setLogs((data.logs || []).slice(-200));
                        if (data.status === 'completed') {
                            fetch(`http://localhost:8000/scrape/preview/${encodeURIComponent(name)}`)
                                .then(r => r.json()).then(setPreviewData).catch(console.error);
                        }
                    }
                }).catch(() => { }); // Silently ignore network errors on initial check
        }
    }, [taskId, activeJobId, isScraping, isRefining, status, name]);

    const handleDownloadScrape = () => {
        window.open(`http://localhost:8000/scrape/download/${encodeURIComponent(name)}`, '_blank');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-light text-neu-text tracking-tight flex items-center gap-3">
                        <Globe className="w-8 h-8 text-neu-accent" />
                        Web Scraper
                    </h1>
                    <p className="text-neu-dim mt-2 font-medium">Extract text and images directly into your dataset.</p>
                </div>

                <div className="flex items-center gap-4">
                    {!isScraping ? (
                        <button
                            onClick={handleStartScrape}
                            className={`group relative flex items-center gap-3 px-8 py-3.5 rounded-[20px] font-bold tracking-widest text-[13px] uppercase touch-manipulation select-none outline-none bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98]`}
                            style={{ transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease' }}
                        >
                            <div className={`flex items-center justify-center p-2 rounded-[12px] bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20 group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.8)] transition-all duration-150`}>
                                <Play size={16} fill="currentColor" />
                            </div>
                            <span className="group-hover:text-neu-accent group-active:text-neu-accent group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.4)] transition-colors">
                                Start Scraping
                            </span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 bg-neu-dark px-5 py-3 rounded-2xl border border-black/40 shadow-[inset_3px_3px_8px_#0e1012,inset_-3px_-3px_8px_#272d33]">
                                <Loader2 size={16} className="text-neu-accent animate-spin" />
                                <span className="text-xs font-bold text-neu-accent tracking-widest uppercase">Running</span>
                            </div>
                            <button
                                onClick={handleCancelScrape}
                                className="flex items-center gap-2 px-6 py-3.5 rounded-[20px] text-xs font-bold text-red-500 bg-neu-base shadow-[4px_4px_10px_#111315,-4px_-4px_10px_#2e343b] hover:shadow-[inset_4px_4px_10px_#141619,inset_-4px_-4px_10px_#2e343b,0_0_12px_rgba(239,68,68,0.25)] border border-white/5 active:scale-[0.98] transition-all tracking-widest uppercase"
                            >
                                <Square size={13} fill="currentColor" />
                                Stop
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Input Options */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    {/* Source Setup */}
                    <div className="neu-plate p-6 flex flex-col gap-6 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <div className="led led-on" />
                            <h3 className="text-xs font-bold text-neu-dim tracking-widest uppercase">Target Source</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-neu-dim tracking-widest uppercase mb-2">Direct URLs</label>
                                <textarea
                                    className="neu-input w-full min-h-[120px] resize-y"
                                    placeholder={`https://example.com/article\nhttps://example.com/blog/2`}
                                    value={urls}
                                    onChange={(e) => setUrls(e.target.value)}
                                    disabled={isScraping}
                                />
                            </div>

                            <div className="flex items-center gap-4 py-2">
                                <div className="h-[2px] bg-white/[0.03] flex-1 rounded-full shadow-[inset_1px_1px_1px_rgba(0,0,0,0.5)]"></div>
                                <span className="text-[10px] text-neu-dim font-bold uppercase tracking-widest">OR</span>
                                <div className="h-[2px] bg-white/[0.03] flex-1 rounded-full shadow-[inset_1px_1px_1px_rgba(0,0,0,0.5)]"></div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neu-dim tracking-widest uppercase mb-2 flex items-center gap-2">
                                    <Search className="w-3 h-3" /> Search Query
                                </label>
                                <input
                                    type="text"
                                    className="neu-input w-full"
                                    placeholder="e.g. quantum mechanics news"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    disabled={isScraping}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Checkboxes / Toggles using ProviderBtn logic / Led Toggle approach */}
                    <div className="neu-trough p-6 rounded-2xl">
                        <h4 className="text-[10px] font-bold text-neu-dim tracking-widest uppercase mb-4">Extraction Modules</h4>

                        <div className="flex flex-col gap-3">
                            {/* Toggle Text */}
                            <button
                                onClick={() => !isScraping && setExtractText(!extractText)}
                                disabled={isScraping}
                                className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${extractText ? 'bg-neu-dark shadow-[inset_3px_3px_8px_#0e1012,inset_-3px_-3px_8px_#272d33] border border-black/40' : 'bg-neu-base shadow-[4px_4px_8px_#111315,-4px_-4px_8px_#2e343b] border border-white/5 hover:-translate-y-0.5'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className={`w-4 h-4 ${extractText ? 'text-neu-accent' : 'text-neu-dim'}`} />
                                    <span className={`text-[11px] font-bold uppercase tracking-widest ${extractText ? 'text-neu-text' : 'text-neu-dim'}`}>Extract Text</span>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${extractText ? 'bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]' : 'bg-black/40 shadow-[inset_1px_1px_2px_#000]'}`} />
                            </button>

                            {/* Toggle Images */}
                            <button
                                onClick={() => !isScraping && setExtractImages(!extractImages)}
                                disabled={isScraping}
                                className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${extractImages ? 'bg-neu-dark shadow-[inset_3px_3px_8px_#0e1012,inset_-3px_-3px_8px_#272d33] border border-black/40' : 'bg-neu-base shadow-[4px_4px_8px_#111315,-4px_-4px_8px_#2e343b] border border-white/5 hover:-translate-y-0.5'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <ImageIcon className={`w-4 h-4 ${extractImages ? 'text-neu-accent' : 'text-neu-dim'}`} />
                                    <span className={`text-[11px] font-bold uppercase tracking-widest ${extractImages ? 'text-neu-text' : 'text-neu-dim'}`}>Extract Images</span>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${extractImages ? 'bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]' : 'bg-black/40 shadow-[inset_1px_1px_2px_#000]'}`} />
                            </button>

                        </div>
                    </div>



                    <div className="neu-plate p-6 rounded-2xl space-y-6 flex-1">
                        <div className="flex items-center gap-3">
                            <Settings className="w-4 h-4 text-neu-dim" />
                            <h4 className="text-[10px] font-bold text-neu-dim tracking-widest uppercase">Crawler Strategies</h4>
                        </div>

                        <div className="space-y-6">
                            <Slider
                                label="Crawl Depth"
                                min={0} max={5} step={1}
                                value={maxDepth}
                                onChange={setMaxDepth}
                                disabled={isScraping}
                            />

                            <Slider
                                label="Relevance Threshold"
                                min={0} max={25} step={0.5}
                                value={relevanceThreshold}
                                onChange={setRelevanceThreshold}
                                disabled={isScraping}
                            />

                            <div className="grid grid-cols-2 gap-6 pt-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-neu-dim tracking-widest uppercase mb-2">Max Pages</label>
                                    <input
                                        type="number" min="1" max="1000" value={maxPages}
                                        onChange={(e) => setMaxPages(e.target.value)}
                                        className="neu-input w-full font-mono text-xs"
                                        disabled={isScraping}
                                    />
                                </div>

                                <div className="flex flex-col justify-end">
                                    <button
                                        onClick={() => !isScraping && setDomainRestricted(!domainRestricted)}
                                        disabled={isScraping}
                                        className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${domainRestricted ? 'bg-neu-dark shadow-[inset_3px_3px_8px_#0e1012,inset_-3px_-3px_8px_#272d33] border border-black/40' : 'bg-neu-base shadow-[4px_4px_8px_#111315,-4px_-4px_8px_#2e343b] border border-white/5'}`}
                                    >
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${domainRestricted ? 'text-neu-accent' : 'text-neu-dim'}`}>Domain Lock</span>
                                        <div className={`w-1.5 h-1.5 rounded-full ${domainRestricted ? 'bg-neu-accent shadow-[0_0_8px_rgba(255,107,0,1)]' : 'bg-black/40 shadow-[inset_1px_1px_2px_#000]'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Status and Logs */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="neu-plate p-6 rounded-2xl h-full flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <RefreshCw className={`w-4 h-4 ${isScraping ? 'text-neu-accent animate-spin' : 'text-neu-dim'}`} />
                                <h3 className="text-xs font-bold text-neu-text tracking-widest uppercase">Job Status</h3>
                            </div>
                            {status && (
                                <div className="flex items-center gap-2 neu-inset px-4 py-1.5 rounded-xl self-start">
                                    <div className={`led ${status.status === 'running' ? 'led-blue animate-pulse' : status.status === 'completed' ? 'led-green' : status.status === 'failed' ? 'led-red' : 'led-off'}`} />
                                    <span className={`text-[10px] font-bold tracking-widest uppercase ${status.status === 'running' ? 'text-blue-400' : status.status === 'completed' ? 'text-green-400' : status.status === 'failed' ? 'text-red-400' : 'text-neu-dim/50'}`}>
                                        {status.status}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Progress display */}
                        <div className="mb-6 space-y-4">
                            <div className="neu-trough p-4 rounded-2xl">
                                <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase text-neu-dim mb-3">
                                    <span>Run Progress</span>
                                    <span className="text-neu-accent">{status?.progress ? status.progress.toFixed(0) : 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-[#111315] rounded-full overflow-hidden shadow-[inset_1px_1px_3px_rgba(0,0,0,0.8),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]">
                                    <div
                                        className="h-full bg-neu-accent transition-all duration-500 ease-out shadow-[0_0_10px_rgba(255,107,0,0.5)]"
                                        style={{ width: `${status?.progress || 0}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-mono text-neu-dim mt-4">
                                    <span className="tracking-wide uppercase">Pages Stored: <span className="text-neu-text font-bold">{status?.downloaded_items || 0}</span></span>
                                    {status?.current_url && (
                                        <div className="neu-inset px-2 py-1 rounded-md max-w-[200px] truncate shadow-[inset_2px_2px_4px_#0e1012] border border-black/20" title={status.current_url}>
                                            <span className="opacity-70">{status.current_url.split('/')[2]}</span>/..
                                        </div>
                                    )}
                                </div>
                            </div>

                            {(status?.status === 'running' || status?.status === 'completed') && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col items-center justify-center p-3 neu-inset rounded-xl border border-black/20 text-center">
                                        <div className="text-neu-text text-xl font-light mb-1">{status.total_urls || 0}</div>
                                        <div className="text-[9px] uppercase font-bold tracking-widest text-neu-dim">Discovered</div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-3 neu-inset rounded-xl border border-black/20 text-center">
                                        <div className="text-neu-text text-xl font-light mb-1">{status.duplicates_found || 0}</div>
                                        <div className="text-[9px] uppercase font-bold tracking-widest text-neu-dim">Skipped (Dup)</div>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-3 neu-inset rounded-xl border border-black/20 text-center">
                                        <div className="text-neu-text text-xl font-light mb-1">{status.dropped_items || 0}</div>
                                        <div className="text-[9px] uppercase font-bold tracking-widest text-neu-dim">Dropped</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Log Terminal */}
                        <div className="h-[350px] neu-inset rounded-2xl border border-black/40 p-4 font-mono text-xs overflow-y-auto custom-scrollbar w-full relative group">
                            <div className="absolute top-3 right-4 text-[9px] text-neu-dim/40 uppercase tracking-widest font-bold pointer-events-none select-none">sys_out</div>
                            {!logs.length ? (
                                <div className="h-full flex items-center justify-center text-neu-dim/30 uppercase tracking-widest text-[10px] font-bold">
                                    Awaiting Task Initialization...
                                </div>
                            ) : (
                                <div className="space-y-2 flex flex-col justify-end min-h-full">
                                    {logs.map((log, i) => (
                                        <div key={i} className={`font-mono text-[11px] leading-relaxed ${log.toLowerCase().includes('error') || log.toLowerCase().includes('failed') ? 'text-red-400' :
                                            log.toLowerCase().includes('success') || log.toLowerCase().includes('completed') ? 'text-green-400 drop-shadow-[0_0_2px_rgba(74,222,128,0.2)]' :
                                                log.toLowerCase().includes('scraping:') ? 'text-neu-accent drop-shadow-[0_0_2px_rgba(255,107,0,0.2)]' :
                                                    'text-neu-dim'
                                            }`}>
                                            <span className="text-neu-dim/30 mr-2 select-none">$&gt;</span>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Post-Scrape Actions and Preview */}
            {status?.status === 'completed' && (
                <div className="mt-8 neu-trough rounded-[24px] p-8 border border-neu-accent/10 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),0_0_20px_rgba(255,107,0,0.05)] animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-neu-dark flex items-center justify-center border border-black/40 shadow-[inset_2px_2px_4px_#333_0,inset_-2px_-2px_4px_#000]">
                                <Check className="w-5 h-5 text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-light text-neu-text tracking-tight">Scraping Complete</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-neu-dim mt-1">Ready for Pipeline</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setAiEnhanceActive(!aiEnhanceActive)}
                            className={`flex items-center gap-3 px-5 py-2.5 rounded-[12px] transition-all duration-300 font-bold tracking-widest text-[10px] uppercase border ${aiEnhanceActive ? 'bg-neu-dark text-neu-accent border-black/40 shadow-[inset_2px_2px_6px_#0e1012,inset_-2px_-2px_6px_#272d33] ring-1 ring-neu-accent/30' : 'bg-neu-base text-neu-dim border-white/5 shadow-[4px_4px_8px_#111315,-4px_-4px_8px_#2e343b] hover:-translate-y-0.5'}`}
                        >
                            <Zap size={14} className={aiEnhanceActive ? "drop-shadow-[0_0_8px_rgba(255,107,0,0.8)]" : ""} />
                            {aiEnhanceActive ? 'AI Enhancement Enabled' : 'Optional: AI Enhance'}
                        </button>
                    </div>

                    {aiEnhanceActive && (
                        <div className="mb-8 neu-plate p-6 rounded-[20px] border border-neu-accent/20 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),0_0_20px_rgba(255,107,0,0.02)] animate-in slide-in-from-top-4 duration-500 relative z-20">
                            <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-4">
                                <Cpu className="w-4 h-4 text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.6)]" />
                                <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase">Configure LLM Refinement</h3>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                                {/* Left Side: Provider Config */}
                                <div className="xl:col-span-4 space-y-6 flex flex-col">
                                    <h4 className="text-[10px] font-bold text-neu-dim uppercase tracking-widest border-b border-white/5 pb-3">Endpoint Configuration</h4>

                                    <div className="flex gap-4">
                                        <ProviderBtn active={scraperLLMConfig.provider === 'local'} onClick={() => setScraperLLMConfig(p => ({ ...p, provider: 'local' }))} icon={Cpu} label="Local" sublabel="Ollama" />
                                        <ProviderBtn active={scraperLLMConfig.provider === 'openai'} onClick={() => setScraperLLMConfig(p => ({ ...p, provider: 'openai' }))} icon={Globe} label="OpenAI" sublabel="API Key" />
                                    </div>

                                    <div className="neu-trough p-5 rounded-2xl flex-1 border border-white/5">
                                        {scraperLLMConfig.provider === 'local' ? (
                                            <LocalSection generationConfig={scraperLLMConfig} setGenerationConfig={setScraperLLMConfig} />
                                        ) : (
                                            <ApiSection generationConfig={scraperLLMConfig} setGenerationConfig={setScraperLLMConfig} />
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Prompt & Sandbox */}
                                <div className="xl:col-span-8 space-y-6 flex flex-col">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-neu-dim tracking-widest uppercase mb-3 border-b border-white/5 pb-3">Refinement Instructions</h4>
                                        <div className="neu-inset rounded-xl border border-black/40 overflow-hidden flex transition-all duration-250 focus-within:ring-1 focus-within:ring-neu-accent">
                                            <textarea
                                                value={scraperLLMConfig.prompt}
                                                onChange={e => setScraperLLMConfig(p => ({ ...p, prompt: e.target.value }))}
                                                spellCheck={false}
                                                className="w-full bg-transparent border-none outline-none text-[#4ade80] p-4 font-mono text-[11px] leading-relaxed resize-y min-h-[100px] custom-scrollbar m-0"
                                            />
                                        </div>
                                    </div>

                                    <DryRunSandbox
                                        llmConfig={scraperLLMConfig}
                                        previewData={previewData}
                                        onProcessDataset={handleStartRefinement}
                                        isRefining={isRefining}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Preview Section */}
                        <div className="space-y-6 flex flex-col">
                            <div>
                                <h4 className="text-[10px] font-bold text-neu-dim uppercase tracking-widest mb-3">Text Output Preview</h4>
                                <div className="neu-inset rounded-2xl p-4 border border-black/40 h-[140px] overflow-y-auto w-full custom-scrollbar bg-[#08090a]">
                                    <p className="text-[11px] text-neu-dim/80 font-mono whitespace-pre-wrap leading-[1.6]">
                                        {previewData?.text || "No text extracted."}
                                        {previewData?.text && <span className="text-neu-accent opacity-50 ml-1">...[EOF]</span>}
                                    </p>
                                </div>
                            </div>

                            {previewData?.images?.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-bold text-neu-dim uppercase tracking-widest mb-3">Extracted Media</h4>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 p-4 neu-plate rounded-2xl border border-white/5">
                                        {previewData.images.slice(0, 5).map((img, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setPreviewImage(img)}
                                                className="group relative aspect-square rounded-[14px] overflow-hidden bg-neu-base border border-white/5 shadow-[4px_4px_10px_#111315,-4px_-4px_10px_#2e343b] hover:shadow-[6px_6px_12px_#111315,-6px_-6px_12px_#2e343b] hover:-translate-y-0.5 active:bg-neu-dark active:shadow-[inset_2px_2px_6px_#0e1012,inset_-2px_-2px_6px_#272d33] transition-all duration-200"
                                            >
                                                <div className="absolute inset-2 rounded-[8px] overflow-hidden border border-black/40 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] bg-neu-dark">
                                                    <img src={`http://localhost:8000/scrape/image/${name}/${img}`} alt={`scraped ${i}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="absolute inset-0 bg-neu-accent/0 group-hover:bg-neu-accent/10 transition-colors pointer-events-none" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col justify-center gap-6">
                            <button
                                onClick={handleDownloadScrape}
                                className="w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[20px] font-bold tracking-widest text-[13px] uppercase transition-all duration-300 bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40"
                            >
                                <div className="p-1.5 rounded-lg bg-neu-dark shadow-[inset_2px_2px_4px_#0e1012] border border-black/30">
                                    <Download size={16} className="text-blue-400" />
                                </div>
                                Download Raw Archive (.zip)
                            </button>

                            <div className="neu-plate rounded-[20px] p-6 flex flex-col gap-5 border border-white/5">
                                <h4 className="text-[10px] font-bold text-neu-dim uppercase tracking-widest flex items-center gap-2">
                                    <Database className="w-3.5 h-3.5" />
                                    Import to Pipeline
                                </h4>

                                <div className="flex items-center gap-8">
                                    {/* Load Text Toggle */}
                                    <button
                                        onClick={() => setPipelineTextChecked(!pipelineTextChecked)}
                                        className={`flex items-center gap-3 p-3 flex-1 rounded-xl transition-all duration-200 ${pipelineTextChecked ? 'bg-neu-dark shadow-[inset_3px_3px_8px_#0e1012,inset_-3px_-3px_8px_#272d33] border border-black/40' : 'bg-neu-base shadow-[4px_4px_8px_#111315,-4px_-4px_8px_#2e343b] border border-white/5'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${pipelineTextChecked ? 'bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]' : 'bg-black/40 shadow-[inset_1px_1px_2px_#000]'}`} />
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${pipelineTextChecked ? 'text-neu-text' : 'text-neu-dim'}`}>Append Text</span>
                                    </button>

                                    {/* Load Images Toggle (WIP) */}
                                    <div className="flex items-center gap-3 p-3 flex-1 rounded-xl bg-neu-base/40 opacity-50 cursor-not-allowed border border-white/5 shadow-[inset_2px_2px_4px_#0e1012]" title="Image vision processing coming soon">
                                        <div className="w-2 h-2 rounded-full bg-black/60 shadow-[inset_1px_1px_2px_#000]" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-neu-dim">Append Images</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => window.location.reload()}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-[16px] font-bold tracking-widest text-[13px] uppercase transition-all duration-300 bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_15px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/30 hover:drop-shadow-[0_0_8px_rgba(255,107,0,0.6)] hover:-translate-y-0.5"
                                >
                                    <Play size={15} fill="currentColor" />
                                    Proceed to Dataset Lab
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center p-2 rounded-[24px] bg-[#111315] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8),inset_2px_2px_4px_rgba(255,255,255,0.02)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-4 -right-4 w-10 h-10 rounded-full flex items-center justify-center bg-neu-base border border-white/10 text-neu-dim shadow-[4px_4px_10px_#111315,-4px_-4px_10px_#2e343b] hover:text-red-400 hover:shadow-[6px_6px_12px_#111315,-6px_-6px_12px_#2e343b] active:shadow-[inset_2px_2px_4px_#0e1012] transition-colors z-10"
                        >
                            <X size={18} />
                        </button>
                        <div className="rounded-[16px] overflow-hidden shadow-[inset_2px_2px_8px_rgba(0,0,0,0.6)] bg-black">
                            <img
                                src={`http://localhost:8000/scrape/image/${name}/${previewImage}`}
                                alt="quick preview large"
                                className="max-w-full max-h-[85vh] object-contain rounded-[16px]"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
