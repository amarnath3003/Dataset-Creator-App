import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/api';
import { Link } from 'react-router-dom';
import { FolderPlus, Folder, Trash2 } from 'lucide-react';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Dashboard() {
    const [newProjectName, setNewProjectName] = useState('');
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [createError, setCreateError] = useState('');
    const queryClient = useQueryClient();
    const toast = useToast();

    const { data: projects = [], isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: projectApi.list
    });

    const createMutation = useMutation({
        mutationFn: (name) => projectApi.create(name),
        onSuccess: () => {
            queryClient.invalidateQueries(['projects']);
            setNewProjectName('');
            setCreateError('');
            toast.success(`Project "${newProjectName}" initialized successfully.`);
        },
        onError: (e) => {
            const serverMsg = e.response?.data?.detail || e.message;
            toast.error(`Create failed: ${serverMsg}`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (name) => projectApi.delete(name),
        onSuccess: () => {
            queryClient.invalidateQueries(['projects']);
            toast.info(`Project deleted permanently.`);
        },
        onError: (e) => toast.error(`Delete failed: ${e.message}`)
    });

    const handleCreate = (e) => {
        e.preventDefault();
        setCreateError('');
        const trimmedName = newProjectName.trim();
        if (!trimmedName) return;

        if (/[^a-zA-Z0-9\-_]/.test(trimmedName)) {
            setCreateError('Invalid name. Only alphanumeric characters, hyphens, and underscores are allowed.');
            return;
        }
        if (projects.includes(trimmedName)) {
            setCreateError('A project with this name already exists.');
            return;
        }

        createMutation.mutate(trimmedName);
    };

    const handleDeleteClick = (e, name) => {
        e.preventDefault(); // Prevent Link navigation
        e.stopPropagation();
        setProjectToDelete(name);
    };

    const confirmDelete = () => {
        if (projectToDelete) {
            deleteMutation.mutate(projectToDelete);
            setProjectToDelete(null);
        }
    };

    return (
        <div className="flex flex-col items-center w-full">

            {/* Hero Header */}
            <div className="text-center mb-12 mt-6">
                <h1 className="text-5xl font-light text-neu-text tracking-tight">
                    Console <span className="text-neu-dim font-thin">/ Projects</span>
                </h1>
                <p className="text-neu-dim/50 font-mono text-xs uppercase tracking-[0.3em] mt-4">
                    Dataset Engineering Workspace
                </p>
                <div className="w-16 h-px bg-neu-accent/30 mx-auto mt-5"></div>
            </div>

            {/* Create Form — centered */}
            <div className="mb-14 w-full max-w-xl relative z-10 px-2">
                <form onSubmit={handleCreate} className="flex items-center gap-4 w-full">
                    <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => {
                            setNewProjectName(e.target.value);
                            if (createError) setCreateError('');
                        }}
                        placeholder="Nomenclature for new protocol..."
                        className={`flex-1 neu-input h-14 pl-6 text-lg placeholder-neu-dim/30 focus:text-neu-accent !rounded-2xl transition-all ${createError ? 'border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
                    />
                    <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className={`group flex items-center justify-center gap-3 h-14 px-8 rounded-2xl font-bold tracking-widest text-[13px] uppercase shrink-0 transition-all duration-300 ${createMutation.isPending
                            ? 'bg-[#15181b] text-neu-dim/30 shadow-[var(--sh-trough)] cursor-not-allowed border border-transparent'
                            : 'bg-neu-dark text-neu-dim shadow-[var(--sh-trough)] border border-transparent hover:border-neu-accent/30 hover:text-neu-text hover:shadow-[var(--sh-trough),_0_0_15px_rgba(255,107,0,0.1)] active:scale-[0.98]'
                            }`}
                    >
                        <FolderPlus
                            size={18}
                            strokeWidth={2}
                            className={`transition-colors duration-300 ${createMutation.isPending ? '' : 'group-hover:text-neu-accent'}`}
                        />
                        <span className={`transition-colors duration-300 ${createMutation.isPending ? '' : 'group-hover:text-neu-accent'}`}>
                            CREATE
                        </span>
                    </button>
                </form>
                {createError && (
                    <p className="absolute -bottom-6 left-6 text-red-400 text-[11px] font-mono tracking-wide">
                        {createError}
                    </p>
                )}
            </div>

            {/* Projects Grid */}
            {isLoading ? (
                <div className="text-neu-dim animate-pulse font-mono tracking-widest text-sm uppercase mt-8">Loading sector map...</div>
            ) : (
                <div className="w-full max-w-5xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {projects.map((name) => (
                            <div key={name} className="relative group perspective-1000">
                                <Link
                                    to={`/project/${name}`}
                                    className="neu-plate p-8 flex flex-col gap-6 w-full h-full min-h-[200px] group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 ease-out relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-32 bg-neu-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

                                    <div className="flex items-start justify-between z-10">
                                        <div className="w-14 h-14 rounded-2xl neu-inset flex items-center justify-center text-neu-dim group-hover:text-neu-accent transition-colors duration-300 shadow-inner border border-white/5">
                                            <Folder size={28} strokeWidth={1.5} />
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-2 h-2 rounded-full bg-neu-dim/20 group-hover:bg-neu-accent group-hover:shadow-[0_0_8px_rgba(255,107,0,0.8)] transition-all duration-500 delay-100"></div>
                                            <div className="w-2 h-2 rounded-full bg-neu-dim/20 group-hover:bg-neu-accent group-hover:shadow-[0_0_8px_rgba(255,107,0,0.8)] transition-all duration-500 delay-200"></div>
                                        </div>
                                    </div>

                                    <div className="z-10 mt-auto">
                                        <span className="text-xl font-medium text-neu-text tracking-tight block truncate group-hover:text-white transition-colors" title={name}>{name}</span>
                                        <span className="text-xs font-mono text-neu-dim/60 mt-2 block uppercase tracking-widest">Active Protocol</span>
                                    </div>
                                </Link>

                                {/* Delete Button */}
                                <button
                                    onClick={(e) => handleDeleteClick(e, name)}
                                    disabled={deleteMutation.isPending}
                                    title="Purge Protocol"
                                    className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-neu-base shadow-[5px_5px_10px_#16191c,-5px_-5px_10px_#2c3036] flex items-center justify-center text-neu-dim hover:text-red-500 hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 hover:scale-110"
                                >
                                    <Trash2 size={16} strokeWidth={2} />
                                </button>
                            </div>
                        ))}
                        {projects.length === 0 && (
                            <div className="col-span-full py-28 text-center rounded-3xl border-2 border-dashed border-neu-dim/10 bg-neu-base/50">
                                <div className="w-20 h-20 mx-auto rounded-full neu-inset flex items-center justify-center text-neu-dim/20 mb-6 shadow-inner">
                                    <FolderPlus size={36} strokeWidth={1} />
                                </div>
                                <p className="text-neu-dim font-light text-lg">Sector Empty</p>
                                <p className="text-neu-dim/40 text-xs mt-2 font-mono uppercase tracking-widest">Initialize new protocol to begin</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!projectToDelete}
                title="Purge Protocol Data"
                message={`Are you sure you want to permanently delete "${projectToDelete}"? This action cannot be reversed.`}
                confirmText="Purge"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setProjectToDelete(null)}
            />
        </div>
    );
}
