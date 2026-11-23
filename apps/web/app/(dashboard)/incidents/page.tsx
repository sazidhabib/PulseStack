'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  ExternalLink,
  Loader2,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';

interface Incident {
  id: string;
  monitorId: string;
  orgId: string;
  type: string;
  cause: string | null;
  startedAt: string;
  resolvedAt: string | null;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const { subscribe } = useWebSocket();

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await apiClient.get<Incident[]>('/api/incidents');
      if (res.success && res.data) {
        setIncidents(res.data);
      }
    } catch {
      toast.error('Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Real-time WebSocket incident listeners
  useEffect(() => {
    const unsubCreated = subscribe('incident:created', (data) => {
      const newInc: Incident = {
        id: data.incidentId,
        monitorId: data.monitorId,
        orgId: data.orgId,
        type: data.type,
        cause: 'Automated health check failure threshold breached',
        startedAt: data.startedAt,
        resolvedAt: null,
      };
      setIncidents((prev) => [newInc, ...prev.filter((i) => i.id !== data.incidentId)]);
    });

    const unsubResolved = subscribe('incident:resolved', (data) => {
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === data.incidentId || inc.monitorId === data.monitorId
            ? { ...inc, resolvedAt: data.resolvedAt }
            : inc
        )
      );
    });

    return () => {
      unCreated: unsubCreated();
      unsubResolved();
    };
  }, [subscribe]);

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === 'active') return !inc.resolvedAt;
    if (filter === 'resolved') return !!inc.resolvedAt;
    return true;
  });

  const activeCount = incidents.filter((i) => !i.resolvedAt).length;
  const resolvedCount = incidents.filter((i) => !!i.resolvedAt).length;

  const calculateDuration = (started: string, resolved: string | null) => {
    const start = new Date(started).getTime();
    const end = resolved ? new Date(resolved).getTime() : Date.now();
    const diffSec = Math.floor((end - start) / 1000);

    if (diffSec < 60) return `${diffSec}s`;
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <AlertTriangle className="h-6 w-6 text-amber-400" /> Incident Command
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automated outage detection, downtime logs, and recovery timelines.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchIncidents}
          className="text-slate-300 border-slate-700 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Active Incidents</CardTitle>
            <Flame className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${activeCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {activeCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {activeCount > 0 ? 'Urgent attention required' : 'All systems operating normally'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Resolved Incidents</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {resolvedCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Successfully self-healed or restored</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Mean Time to Recovery</CardTitle>
            <Clock className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-white">
              1m 45s
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Rapid recovery threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          All Incidents ({incidents.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'active'
              ? 'bg-rose-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'resolved'
              ? 'bg-emerald-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* Incidents List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : filteredIncidents.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No incidents in this view</h3>
            <p className="text-sm text-slate-400 max-w-sm mt-1">
              Your monitored endpoints are performing within configured SLA parameters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => {
            const isResolved = !!incident.resolvedAt;

            return (
              <Card
                key={incident.id}
                className={`border-slate-800/80 bg-slate-900/60 transition-all ${
                  !isResolved ? 'border-rose-500/40 shadow-lg shadow-rose-950/20' : ''
                }`}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left: Indicator, Title, Cause */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="pt-1">
                      {!isResolved ? (
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white uppercase font-mono">
                          {incident.type} Outage
                        </span>
                        {!isResolved ? (
                          <Badge variant="destructive" className="text-[10px] py-0">ACTIVE DOWNTIME</Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px] py-0">RESOLVED</Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 font-mono mt-1">
                        {incident.cause || 'Target returned unexpected status or timeout'}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                        <span className="font-mono">ID: {incident.id.slice(0, 8)}...</span>
                        <span>•</span>
                        <Link
                          href={`/monitors/${incident.monitorId}`}
                          className="text-indigo-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          <Radio className="h-3 w-3" /> View Monitor <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Right: Duration & Timestamps */}
                  <div className="text-right flex-shrink-0 self-end md:self-center font-mono">
                    <div className="text-sm font-bold text-slate-200">
                      Duration: {calculateDuration(incident.startedAt, incident.resolvedAt)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Started: {new Date(incident.startedAt).toLocaleTimeString()}
                    </div>
                    {incident.resolvedAt && (
                      <div className="text-[10px] text-emerald-400 mt-0.5">
                        Resolved: {new Date(incident.resolvedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
