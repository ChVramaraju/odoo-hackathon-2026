import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar />
      <div className="flex-1 pl-64 flex flex-col">
        <Header />
        <main className="flex-1 pt-16 px-8 py-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

