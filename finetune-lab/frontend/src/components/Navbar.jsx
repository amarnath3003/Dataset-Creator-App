import React from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';

export default function Navbar() {
    return (
        <header className="px-8 py-6 mb-4 flex items-center justify-between z-50 relative">
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
        </header>
    );
}
