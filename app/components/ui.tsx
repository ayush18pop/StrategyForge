"use client";

import React from "react";

interface StatusBadgeProps {
  status: "draft" | "live" | "deprecated";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cls = `badge badge-${status}`;
  return (
    <span className={cls}>
      <span className={`pulse-dot pulse-dot-${status === "live" ? "live" : status === "draft" ? "draft" : "error"}`} />
      {status}
    </span>
  );
}

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
  return (
    <div className={`glass-card p-6 ${className}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  loading?: boolean;
}

export function Button({ variant = "primary", loading, children, disabled, ...props }: ButtonProps) {
  const cls = variant === "primary" ? "btn-primary" : "btn-secondary";
  return (
    <button className={`${cls} ${disabled || loading ? "opacity-50 pointer-events-none" : ""}`} disabled={disabled || loading} {...props}>
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function InputField({ label, error, ...props }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-xs uppercase tracking-widest text-text-secondary font-semibold">{label}</label>}
      <input className={`input-field ${error ? "!border-hot-red" : ""}`} {...props} />
      {error && <span className="text-xs text-hot-red">{error}</span>}
    </div>
  );
}

export function Divider() {
  return <hr className="divider-glow my-6" />;
}

export function AgentStatusIndicator({ status }: { status: "operational" | "learning" | "error" }) {
  const color = status === "operational" ? "bg-acid-green" : status === "learning" ? "bg-molten-amber" : "bg-hot-red";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
      <span className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
      <span className="text-text-secondary">{label}</span>
    </div>
  );
}
