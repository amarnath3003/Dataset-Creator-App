import React from "react";
import { useLocation, Outlet, Link } from "react-router-dom";
import { Server, Database, Settings, Cpu, Rocket, X } from "lucide-react";

const STEPS = [
  { id: "model", path: "/finetune/new/model", label: "Model", icon: Server },
  { id: "dataset", path: "/finetune/new/dataset", label: "Dataset", icon: Database },
  { id: "config", path: "/finetune/new/config", label: "Config", icon: Settings },
  { id: "hardware", path: "/finetune/new/hardware", label: "Hardware", icon: Cpu },
  { id: "review", path: "/finetune/new/review", label: "Review", icon: Rocket },
];

export default function WizardLayout() {
  const { pathname } = useLocation();
  const currentStepIndex = Math.max(
    0,
    STEPS.findIndex((s) => pathname.startsWith(s.path))
  );

  return (
    <div className="flex flex-col items-center w-full">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-light text-neu-text tracking-tight">
            New Training Run
          </h1>
          <p className="text-neu-dim/50 font-mono text-[11px] uppercase tracking-[0.25em] mt-2">
            Model → Dataset → Config → Hardware → Launch
          </p>
        </div>
        <Link
          to="/finetune/dashboard"
          className="neu-btn flex items-center gap-2 px-4 py-2 text-sm text-neu-dim hover:text-neu-text rounded-xl no-underline"
        >
          <X size={16} /> Cancel
        </Link>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center w-full max-w-3xl mb-12">
        {STEPS.map((step, index) => {
          const isDone = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center relative">
                <div className={`stage-node ${isDone || isCurrent ? "stage-node-done" : "stage-node-pending"}`}>
                  <step.icon size={16} />
                </div>
                <span
                  className={`absolute top-10 whitespace-nowrap text-[10px] font-mono uppercase tracking-widest ${
                    isCurrent ? "text-neu-accent font-bold" : isDone ? "text-neu-text" : "text-neu-dim/50"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`stage-connector mx-2 flex-1 mt-[-10px] ${
                    isDone ? "stage-connector-done" : "stage-connector-pending"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="w-full max-w-5xl">
        <Outlet />
      </div>
    </div>
  );
}
