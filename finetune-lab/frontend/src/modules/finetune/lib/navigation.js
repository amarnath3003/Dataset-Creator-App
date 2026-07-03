import {
  Boxes,
  Cpu,
  LayoutDashboard,
  ListChecks,
  PackageOpen,
  Plus,
  Rocket,
  Server,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  {
    key: "dashboard",
    to: "/finetune/dashboard",
    label: "Dashboard",
    shortLabel: "Overview",
    icon: LayoutDashboard,
    pulse: "System status",
  },
  {
    key: "runs",
    to: "/finetune/runs",
    label: "Runs",
    shortLabel: "Training queue",
    icon: ListChecks,
    pulse: "Run history",
  },
  {
    key: "models",
    to: "/finetune/models",
    label: "Models",
    shortLabel: "Registry",
    icon: Boxes,
    pulse: "Base models",
  },
  {
    key: "exports",
    to: "/finetune/exports",
    label: "Exports",
    shortLabel: "Artifacts",
    icon: PackageOpen,
    pulse: "Merged outputs",
  },
  {
    key: "settings",
    to: "/finetune/settings",
    label: "Settings",
    shortLabel: "Local config",
    icon: Settings,
    pulse: "Browser defaults",
  },
];

export const WIZARD_STEPS = [
  { id: "model", path: "/finetune/new/model", label: "Model", icon: Server },
  { id: "dataset", path: "/finetune/new/dataset", label: "Dataset", icon: Boxes },
  { id: "config", path: "/finetune/new/config", label: "Config", icon: Settings },
  { id: "hardware", path: "/finetune/new/hardware", label: "Hardware", icon: Cpu },
  { id: "review", path: "/finetune/new/review", label: "Launch", icon: Rocket },
];

export function getRouteMeta(pathname) {
  if (pathname.startsWith("/finetune/new")) {
    const step = WIZARD_STEPS.find((item) => pathname.startsWith(item.path));
    return {
      key: "new",
      label: "New Run",
      shortLabel: step ? step.label : "Setup",
      pulse: "Training pipeline",
      icon: Plus,
    };
  }

  if (pathname.startsWith("/finetune/runs/")) {
    return {
      key: "runs",
      label: "Run Detail",
      shortLabel: "Telemetry",
      pulse: "Live monitoring",
      icon: ListChecks,
    };
  }

  return NAV_ITEMS.find((item) => pathname.startsWith(item.to)) || NAV_ITEMS[0];
}
