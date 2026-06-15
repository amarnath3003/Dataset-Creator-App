/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        if (duration) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const toast = {
        success: (msg, duration) => addToast(msg, 'success', duration),
        error: (msg, duration) => addToast(msg, 'error', duration),
        warn: (msg, duration) => addToast(msg, 'warn', duration),
        info: (msg, duration) => addToast(msg, 'info', duration),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-4 pointer-events-none">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    const ledStyles = {
        success: 'led-green shadow-[0_0_8px_rgba(74,222,128,0.3)]',
        error: 'led-red shadow-[0_0_8px_rgba(239,68,68,0.3)]',
        warn: 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.3)]',
        info: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.3)]',
    };

    const textStyles = {
        success: 'text-green-400',
        error: 'text-red-400',
        warn: 'text-yellow-400',
        info: 'text-blue-400',
    };

    return (
        <div className="pointer-events-auto neu-plate flex items-center gap-4 p-4 pr-12 min-w-[320px] max-w-md animate-toast-in relative overflow-hidden backdrop-blur-md border border-white/5 transition-all">

            {/* Left Edge LED Line */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${toast.type === 'success' ? 'bg-green-400/80 shadow-[0_0_12px_rgba(74,222,128,0.5)]' :
                    toast.type === 'error' ? 'bg-red-400/80 shadow-[0_0_12px_rgba(239,68,68,0.5)]' :
                        toast.type === 'warn' ? 'bg-yellow-400/80 shadow-[0_0_12px_rgba(250,204,21,0.5)]' :
                            'bg-blue-400/80 shadow-[0_0_12px_rgba(96,165,250,0.5)]'
                }`} />

            {/* Glowing Dot overlay - subtle background glow */}
            <div className={`absolute top-0 right-0 p-16 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-10 pointer-events-none ${toast.type === 'success' ? 'bg-green-400' :
                    toast.type === 'error' ? 'bg-red-400' :
                        toast.type === 'warn' ? 'bg-yellow-400' :
                            'bg-blue-400'
                }`} />

            <div className="flex items-center gap-3 w-full relative z-10 pl-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ledStyles[toast.type]}`} />
                <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold tracking-widest uppercase ${textStyles[toast.type]}`}>
                        {toast.type === 'warn' ? 'WARNING' : toast.type === 'error' ? 'ERROR' : toast.type === 'success' ? 'SUCCESS' : 'INFO'}
                    </span>
                    <span className="text-neu-dim/30">|</span>
                    <p className="text-[13px] font-medium text-neu-text tracking-wide truncate max-w-[200px]">
                        {toast.message}
                    </p>
                </div>
            </div>

            <button
                onClick={onRemove}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-neu-dim hover:text-white hover:bg-white/5 transition-all outline-none"
            >
                <X size={14} />
            </button>
        </div>
    );
};
