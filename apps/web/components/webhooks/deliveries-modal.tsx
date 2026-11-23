'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DeliveryItem {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number | null;
  durationMs: number | null;
  attempt: number;
  deliveredAt: string;
}

interface DeliveriesModalProps {
  webhookId: string | null;
  webhookUrl: string;
  onClose: () => void;
}

export function DeliveriesModal({
  webhookId,
  webhookUrl,
  onClose,
}: DeliveriesModalProps) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDeliveries = useCallback(async () => {
    if (!webhookId) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<DeliveryItem[]>(
        `/api/webhooks/${webhookId}/deliveries?limit=20`
      );
      if (res.success && res.data) {
        setDeliveries(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [webhookId]);

  useEffect(() => {
    if (webhookId) {
      fetchDeliveries();
    }
  }, [webhookId, fetchDeliveries]);

  if (!webhookId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Webhook Delivery Logs</h2>
            <p className="text-xs text-slate-400 font-mono truncate max-w-lg mt-0.5">
              {webhookUrl}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">Audit history (last 20 dispatches)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchDeliveries}
              className="text-xs text-slate-400 h-7"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No delivery dispatches recorded yet for this webhook endpoint.
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
              {deliveries.map((d) => {
                const isSuccess = d.statusCode && d.statusCode >= 200 && d.statusCode < 300;

                return (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      {isSuccess ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{d.event}</span>
                          <Badge
                            variant={isSuccess ? 'success' : 'destructive'}
                            className="text-[10px] py-0"
                          >
                            {d.statusCode ? `HTTP ${d.statusCode}` : 'TIMEOUT / ERR'}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Attempt {d.attempt} • {d.durationMs}ms
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400">
                      {new Date(d.deliveredAt).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
