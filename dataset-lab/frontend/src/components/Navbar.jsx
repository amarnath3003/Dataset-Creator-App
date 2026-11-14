import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, Flame, MessagesSquare } from 'lucide-react';

const LABS = [
    { label: 'Dataset Lab', href: 'http://localhost:5173', icon: Layers, active: true },
    { label: 'Finetune Lab', href: 'http://localhost:5174', icon: Flame, active: false },
    { label: 'Chat Lab', href: 'http://localhost:5273', icon: MessagesSquare, active: false },
];

export default function Navbar() {
    return (
        <header className="px-8 py-6 mb-4 flex flex-wrap items-center justify-between gap-4 z-50 relative">
            <Link to="/" className="flex items-center gap-4 group no-underline">
                <div className="w-12 h-12 rounded-2xl neu-plate flex items-center justify-center text-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)] group-hover:shadow-[0_0_20px_rgba(255,107,0,0.4)] transition-all duration-500">
                    <Layers size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neu-text tracking-tight group-hover:text-neu-accent transition-colors duration-300">
                        Dataset Lab
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-neu-accent/50 animate-pulse"></div>
                        <span className="text-xs text-neu-dim font-medium tracking-wider uppercase">Control Console</span>
                    </div>
                </div>
            </Link>

            <nav className="inline-flex items-center gap-1.5 neu-trough p-1.5 rounded-full border border-black/30 shadow-[inset_2px_2px_6px_#13161a,inset_-2px_-2px_6px_#2a3038,0_10px_24px_rgba(0,0,0,0.18)]">
                {LABS.map(({ label, href, icon: Icon, active }) => (
                    <a
                        key={label}
                        href={href}
                        className={`group flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold tracking-widest uppercase transition-all duration-200 no-underline ${
                            active
                                ? 'bg-neu-dark text-neu-accent shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33,0_0_14px_rgba(255,107,0,0.12)] border border-black/40 scale-[0.98]'
                                : 'text-neu-dim hover:text-neu-text hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(0,0,0,0.16)]'
                        }`}
                    >
                        <Icon size={14} className={active ? 'text-neu-accent' : 'transition-all duration-200 group-hover:text-neu-accent'} />
                        {label}
                    </a>
                ))}
            </nav>
        </header>
    );
}
