import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Rocket, FolderGit2, Settings, Activity } from 'lucide-react';
import LaunchPage from './pages/LaunchPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SettingsPage from './pages/SettingsPage';

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
            : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Auto<span className="text-blue-400">Ship</span>
            </span>
            <span className="hidden sm:inline text-xs text-surface-500 border border-surface-700 px-2 py-0.5 rounded-full ml-1">
              MVP
            </span>
          </div>

          <nav className="flex items-center gap-1">
            <NavItem to="/" icon={Rocket} label="Launch" />
            <NavItem to="/projects" icon={FolderGit2} label="Projects" />
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<LaunchPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      <footer className="border-t border-surface-800 py-4 text-center text-xs text-surface-600">
        AutoShip Engine — AI-native autonomous SDLC execution
      </footer>
    </div>
  );
}