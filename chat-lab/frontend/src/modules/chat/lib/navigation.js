import { Archive, GitCompareArrows, ListChecks, MessagesSquare, Plus } from "lucide-react";

export const NAV_ITEMS = [
  {
    key: "chat",
    to: "/chat",
    label: "Chat",
    shortLabel: "Live session",
    icon: MessagesSquare,
    pulse: "Inference console",
  },
  {
    key: "compare",
    to: "/compare",
    label: "Compare",
    shortLabel: "A/B outputs",
    icon: GitCompareArrows,
    pulse: "Prompt matchup",
  },
  {
    key: "conversations",
    to: "/conversations",
    label: "History",
    shortLabel: "Saved chats",
    icon: Archive,
    pulse: "Conversation store",
  },
  {
    key: "presets",
    to: "/presets",
    label: "Presets",
    shortLabel: "Batch eval",
    icon: ListChecks,
    pulse: "Prompt harness",
  },
];

export function getRouteMeta(pathname) {
  if (pathname.startsWith("/chat?") || pathname === "/chat") {
    return NAV_ITEMS[0];
  }

  return NAV_ITEMS.find((item) => pathname.startsWith(item.to)) || {
    key: "new",
    label: "New Chat",
    shortLabel: "Live session",
    pulse: "Inference console",
    icon: Plus,
  };
}
