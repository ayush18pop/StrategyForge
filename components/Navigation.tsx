"use client";

import React from "react";
import { AgentStatusIndicator } from "./ui";

interface SidebarProps {
  activePage: "dashboard" | "forge" | "strategies";
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "forge", label: "Forge", icon: "⚡" },
  { id: "strategies", label: "Strategies", icon: "◈" },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[56px] hover:w-[240px] bg-panel-steel/80 backdrop-blur-lg border-r border-deep-graphite z-50 transition-all duration-300 group overflow-hidden flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-deep-graphite min-h-[64px]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-neon-cyan to-[#6C5CE7] flex items-center justify-center text-void-black font-bold text-sm flex-shrink-0">
          S
        </div>
        <span className="text-sm font-bold uppercase tracking-widest text-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          StrategyForge
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 px-4 py-3 text-left transition-all relative ${
              activePage === item.id
                ? "text-neon-cyan"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {activePage === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-neon-cyan rounded-r" />
            )}
            <span className="text-lg flex-shrink-0 w-6 text-center">{item.icon}</span>
            <span className="text-xs uppercase tracking-widest font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Agent Status */}
      <div className="px-4 py-4 border-t border-deep-graphite">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <AgentStatusIndicator status="operational" />
        </div>
      </div>
    </aside>
  );
}

interface TopBarProps {
  title: string;
  breadcrumbs?: string[];
  onLogout?: () => void;
}

export function TopBar({ title, breadcrumbs, onLogout }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-deep-graphite bg-void-black/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-muted-metal uppercase tracking-widest">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                <span className={i === breadcrumbs.length - 1 ? "text-text-secondary" : ""}>{crumb}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 className="text-sm font-bold uppercase tracking-wider">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <AgentStatusIndicator status="operational" />
        {onLogout && (
          <button onClick={onLogout} className="text-xs text-muted-metal hover:text-hot-red transition-colors uppercase tracking-widest">
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
