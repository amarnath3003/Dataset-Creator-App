import React from 'react';
import { AlertCircle, Trash2, StopCircle, RefreshCcw } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', variant = 'danger' }) {
    if (!isOpen) return null;

    // Variant handling
    const isDanger = variant === 'danger';
    const isWarn = variant === 'warn';

    // Choose icon based on context/variant
    const Icon = title.toLowerCase().includes('delete') ? Trash2 :
        title.toLowerCase().includes('stop') ? StopCircle :
            title.toLowerCase().includes('reset') ? RefreshCcw : AlertCircle;

    return (
        <div
            className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        >
            <div
                className="relative w-full max-w-[400px] mx-4 rounded-3xl p-7 flex flex-col gap-5 animate-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--bg-base, #212529)',
                    boxShadow: 'var(--sh-flat), 0 0 40px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.04)',
                }}
            >
                {/* Visual Flair / Icon Header */}
                <div className="flex justify-center mb-1 relative">
                    {/* Background glow behind icon */}
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full opacity-20 blur-xl pointer-events-none ${isDanger ? 'bg-red-500' : isWarn ? 'bg-yellow-500' : 'bg-neu-accent'
                        }`} />

                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center neu-inset shadow-inner border border-white/5 bg-[#1a1d21]">
                        <Icon size={24} className={
                            isDanger ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                                isWarn ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' :
                                    'text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.5)]'
                        } />
                    </div>
                </div>

                {/* Typography Block */}
                <div className="text-center px-2">
                    <h3 className="text-[19px] font-semibold text-neu-text tracking-tight mb-2">
                        {title}
                    </h3>
                    <p className="text-[13px] text-neu-dim/80 leading-relaxed font-medium">
                        {message}
                    </p>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-3 mt-2">
                    {/* Cancel Action */}
                    <button
                        onClick={onCancel}
                        className="py-3 px-4 rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all neu-btn border-transparent text-neu-dim hover:text-white"
                        style={{ outline: "none" }}
                    >
                        Cancel
                    </button>

                    {/* Primary Action (Confirm/Destructive) */}
                    <button
                        onClick={onConfirm}
                        className="py-3 px-4 rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all text-white border-transparent"
                        style={{
                            background: isDanger
                                ? 'linear-gradient(135deg, rgba(239,68,68,0.85) 0%, rgba(185,28,28,1) 100%)'
                                : isWarn
                                    ? 'linear-gradient(135deg, rgba(250,204,21,0.8) 0%, rgba(202,138,4,1) 100%)'
                                    : 'linear-gradient(135deg, rgba(255,107,0,0.8) 0%, rgba(200,80,0,1) 100%)',
                            boxShadow: isDanger
                                ? '0 0 15px rgba(239,68,68,0.25), inset 1px 1px 0 rgba(255,255,255,0.1)'
                                : isWarn
                                    ? '0 0 15px rgba(250,204,21,0.2), inset 1px 1px 0 rgba(255,255,255,0.1)'
                                    : '0 0 15px rgba(255,107,0,0.25), inset 1px 1px 0 rgba(255,255,255,0.1)',
                            textShadow: '0 1px 2px rgba(0,0,0,0.4)'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
