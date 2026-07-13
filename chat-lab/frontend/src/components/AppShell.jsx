import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-neu-base text-neu-text selection:bg-neu-accent selection:text-white font-sans antialiased overflow-x-hidden">
      <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
        <Navbar />
        <main className="neu-plate rounded-[30px] p-6 lg:p-8 xl:p-10 animate-in fade-in duration-500">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
