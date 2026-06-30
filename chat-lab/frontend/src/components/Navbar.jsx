import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { MessagesSquare, GitCompareArrows, Archive, ListChecks, Cpu } from 'lucide-react';
import { modelApi } from '../modules/chat/services/modelApi';

const TABS = [
    { to: '/chat', label: 'Chat', icon: MessagesSquare },
    { to: '/compare', label: 'Compare', icon: GitCompareArrows },
    { to: '/conversations', label: 'History', icon: Archive },
    { to: '/presets', label: 'Presets', icon: ListChecks },
];

export default function Navbar() {
    const [status, setStatus] = useState(null);

    useEffect(() => {
        let alive = true;
        const poll = () => modelApi.getStatus().then(s => alive && setStatus(s)).catch(() => {});
        poll();
        const id = setInterval(poll, 5000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    const gpu = status?.gpu || {};
    const torchOk = status?.torch_available;
    const loadedCount = status?.loaded?.length || 0;

    let ledClass = 'led-off';
    let statusText = 'Offline';
    if (torchOk && gpu.cuda) { ledClass = 'led-green'; statusText = loadedCount ? `${loadedCount} model${loadedCount > 1 ? 's' : ''} resident` : 'GPU ready'; }
    else if (torchOk) { ledClass = 'led-on'; statusText = 'CPU only'; }
    else if (status) { ledClass = 'led-red'; statusText = 'No ML stack'; }

    return (
        <header className="px-8 py-6 mb-2 flex items-center justify-between z-50 relative">
            <Link to="/chat" className="flex items-center gap-4 group no-underline">
                <div className="w-12 h-12 rounded-2xl neu-plate flex items-center justify-center text-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)] group-hover:shadow-[0_0_20px_rgba(255,107,0,0.4)] transition-all duration-500">
                    <MessagesSquare size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neu-text tracking-tight group-hover:text-neu-accent transition-colors duration-300">
                        Chat Lab
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-neu-accent/50 animate-pulse"></div>
                        <span className="text-xs text-neu-dim font-medium tracking-wider uppercase">Model Test Console</span>
                    </div>
                </div>
            </Link>

            {/* Center nav tabs */}
            <nav className="hidden md:flex items-center gap-1.5 neu-trough p-1.5 rounded-full">
                {TABS.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-300 no-underline ${isActive
                                ? 'bg-neu-base text-neu-accent shadow-[var(--sh-flat)]'
                                : 'text-neu-dim hover:text-neu-text'}`
                        }
                    >
                        <Icon size={15} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* GPU status pill */}
            <div className="flex items-center gap-3 neu-plate px-4 py-2.5 rounded-full" title={gpu.device || statusText}>
                <Cpu size={15} className="text-neu-dim" />
                <div className="flex flex-col leading-tight">
                    <div className="flex items-center gap-2">
                        <div className={`led ${ledClass}`} style={{ width: 8, height: 8 }}></div>
                        <span className="text-[11px] font-bold text-neu-text tracking-wide">{statusText}</span>
                    </div>
                    {gpu.cuda && gpu.vram_total_mb ? (
                        <span className="text-[9px] font-mono text-neu-dim uppercase tracking-wider">
                            {Math.round((gpu.vram_used_mb / gpu.vram_total_mb) * 100)}% · {(gpu.vram_total_mb / 1024).toFixed(0)}GB
                        </span>
                    ) : null}
                </div>
            </div>
        </header>
    );
}
