'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import {
  Activity,
  LayoutDashboard,
  Radio,
  AlertTriangle,
  Webhook,
  Settings,
  LogOut,
  Building,
  Shield,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Monitors', href: '/monitors', icon: Radio },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, org, isLoading, isAuthenticated, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30 animate-pulse">
            <Activity className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-sm font-medium tracking-wide">Initializing secure session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                Pulse<span className="text-indigo-400">Stack</span>
              </span>
              <span className="block text-[10px] font-mono text-slate-400 tracking-wider uppercase">
                Enterprise Cloud
              </span>
            </div>
          </div>

          {/* Org Switcher / Details pill */}
          <div className="p-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-indigo-400" />
                  {org?.name || 'My Organization'}
                </span>
                <Badge variant="default" className="text-[10px] px-1.5 py-0 uppercase">
                  {org?.plan || 'PRO'}
                </Badge>
              </div>
              <p className="text-[11px] font-mono text-slate-500 truncate">
                tenant: {user?.orgId?.slice(0, 16)}...
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
              <p className="text-[11px] text-slate-400 capitalize flex items-center gap-1">
                <Shield className="h-3 w-3 text-indigo-400" />
                {user?.role}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/30"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              )}
            </span>
            <span className="text-xs font-mono font-medium text-slate-300">
              {isConnected ? 'Telemetry Stream Live' : 'Connecting to Stream...'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-mono border-slate-700 bg-slate-900/60 text-slate-300">
              v1.0.0
            </Badge>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
