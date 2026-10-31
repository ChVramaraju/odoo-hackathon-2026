import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isEvaluatorMode, role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 w-full">
        <Header onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)} />

        {/* Persistent DEMO PREVIEW Banner throughout the Application */}
        {isEvaluatorMode && (
          <aside
            role="status"
            aria-label="Demo Preview Active"
            className="mt-16 z-20 bg-amber-950/95 border-b border-amber-500/50 text-amber-200 px-4 sm:px-6 py-2 text-xs flex items-center justify-between shadow-lg shadow-amber-950/30 backdrop-blur-md"
          >
            <div className="flex items-center gap-2 font-mono">
              <span className="px-2 py-0.5 rounded font-extrabold text-[10px] tracking-wider uppercase bg-amber-500 text-forest-950 shadow-sm animate-pulse">
                DEMO PREVIEW
              </span>
              <span className="font-semibold text-amber-300">
                Simulated UI Mode Active — Not Authenticated with Supabase
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[11px] text-amber-300/90">
              <span className="hidden md:inline">
                Persona: <strong className="text-amber-100 capitalize">{role}</strong> • Unauthenticated simulation
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] font-semibold transition-all hover:border-amber-400 flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Exit Preview</span>
              </button>
            </div>
          </aside>
        )}

        <main className={`flex-1 ${isEvaluatorMode ? 'pt-4' : 'pt-16'} px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-y-auto`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
