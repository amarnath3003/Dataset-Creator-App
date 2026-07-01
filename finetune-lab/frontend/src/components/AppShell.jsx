import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-neu-base text-neu-text selection:bg-neu-accent selection:text-white font-sans antialiased">
      <Sidebar />
      <main className="flex-1 min-w-0 p-8 lg:p-10 animate-in fade-in duration-500">
        <div className="max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
