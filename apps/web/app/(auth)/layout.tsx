import React from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-12 selection:bg-indigo-600 selection:text-white overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[600px] rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[400px] w-[500px] rounded-full bg-cyan-600/10 blur-[130px]" />

      {/* Brand Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-transform hover:scale-105"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <Activity className="h-6 w-6 text-white transition-transform group-hover:scale-110" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Pulse<span className="text-indigo-400">Stack</span>
          </span>
        </Link>
        <p className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          Enterprise Telemetry & Background Job Platform
        </p>
      </div>

      {/* Form Card Content */}
      <div className="w-full max-w-md relative z-10">{children}</div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} PulseStack Inc. Zero-trust multi-tenant architecture.
      </footer>
    </div>
  );
}
