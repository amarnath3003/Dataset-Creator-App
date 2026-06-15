import React from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { Server, Database, Settings, Cpu, Activity } from 'lucide-react';

export default function WizardLayout() {
  const location = useLocation();
  const path = location.pathname;

  const steps = [
    { id: 'models', path: '/finetune/models', label: 'Models', icon: Server },
    { id: 'datasets', path: '/finetune/datasets', label: 'Datasets', icon: Database },
    { id: 'config', path: '/finetune/config', label: 'Config', icon: Settings },
    { id: 'hardware', path: '/finetune/hardware', label: 'Hardware', icon: Cpu },
  ];

  // We consider runs as a final destination, not really a step in the wizard.
  // But if we are in runs, all steps are done.
  const isRun = path.startsWith('/finetune/runs');
  
  const currentStepIndex = isRun ? steps.length : steps.findIndex(s => s.path === path);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Header */}
      <div className="text-center mb-12 mt-6">
        <h1 className="text-5xl font-light text-neu-text tracking-tight">
          Console <span className="text-neu-dim font-thin">/ Finetune</span>
        </h1>
        <p className="text-neu-dim/50 font-mono text-xs uppercase tracking-[0.3em] mt-4">
          Training Engine Configuration
        </p>
        <div className="w-16 h-px bg-neu-accent/30 mx-auto mt-5"></div>
      </div>

      {/* Pipeline Stage Bar */}
      {!isRun && (
        <div className="flex items-center justify-center w-full max-w-3xl mb-12">
          {steps.map((step, index) => {
            const isDone = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;
            
            return (
              <React.Fragment key={step.id}>
                {/* Node */}
                <div className="flex flex-col items-center relative">
                  <div className={`stage-node ${isDone || isCurrent ? 'stage-node-done' : 'stage-node-pending'}`}>
                    <step.icon size={16} />
                  </div>
                  <span className={`absolute top-10 whitespace-nowrap text-[10px] font-mono uppercase tracking-widest ${isCurrent ? 'text-neu-accent font-bold' : isDone ? 'text-neu-text' : 'text-neu-dim/50'}`}>
                    {step.label}
                  </span>
                </div>

                {/* Connector (if not last) */}
                {index < steps.length - 1 && (
                  <div className={`stage-connector mx-2 flex-1 mt-[-10px] ${isDone ? 'stage-connector-done' : 'stage-connector-pending'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Page Content */}
      <div className="w-full max-w-5xl">
        <Outlet />
      </div>
    </div>
  );
}
