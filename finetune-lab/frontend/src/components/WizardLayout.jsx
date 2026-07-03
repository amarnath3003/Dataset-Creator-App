import React from "react";
import { useLocation, Outlet, Link } from "react-router-dom";
import { X } from "lucide-react";
import { PageHero, StatusStrip } from "../modules/finetune/components/ConsolePage";
import { WIZARD_STEPS } from "../modules/finetune/lib/navigation";

export default function WizardLayout() {
  const { pathname } = useLocation();
  const currentStepIndex = Math.max(
    0,
    WIZARD_STEPS.findIndex((s) => pathname.startsWith(s.path))
  );

  return (
    <div className="w-full space-y-8">
      <PageHero
        title="New Training Run"
        description="Model -> Dataset -> Config -> Hardware -> Launch"
        badge={
          <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
            Step {currentStepIndex + 1} / {WIZARD_STEPS.length}
          </span>
        }
        actions={
          <Link
            to="/finetune/dashboard"
            className="neu-btn flex items-center gap-2 px-4 py-2 text-sm text-neu-dim hover:text-neu-text rounded-xl no-underline"
          >
            <X size={16} /> Cancel
          </Link>
        }
      />

      <StatusStrip
        items={WIZARD_STEPS.map((step, index) => ({
          label: step.label,
          active: index <= currentStepIndex,
          count: index === currentStepIndex ? currentStepIndex + 1 : null,
        }))}
        right={
          <span className="text-[10px] font-mono uppercase tracking-widest text-neu-dim">
            Guided setup
          </span>
        }
      />

      <div className="flex items-center justify-center w-full">
        <div className="flex items-center w-full max-w-4xl">
          {WIZARD_STEPS.map((step, index) => {
            const isDone = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center relative min-w-[72px]">
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
                {index < WIZARD_STEPS.length - 1 && (
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
      </div>

      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}
