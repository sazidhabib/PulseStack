'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CreateWebhookModal } from '@/components/webhooks/create-webhook-modal';
import { DeliveriesModal } from '@/components/webhooks/deliveries-modal';
import {
  Webhook,
  Plus,
  Send,
  History,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<{ id: string; url: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await apiClient.get<WebhookItem[]>('/api/webhooks');
      if (res.success && res.data) {
        setWebhooks(res.data);
      }
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleTestWebhook = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiClient.post(`/api/webhooks/${id}/test`);
      if (res.success) {
        toast.success('Test payload dispatched to BullMQ queue!');
      } else {
        toast.error(res.error?.message || 'Failed to dispatch test');
      }
    } catch {
      toast.error('Failed to dispatch test webhook');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      const res = await apiClient.delete(`/api/webhooks/${id}`);
      if (res.success) {
        toast.success('Webhook deleted');
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
      }
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Webhook className="h-6 w-6 text-indigo-400" /> Webhook Subscriptions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dispatch HMAC-SHA256 signed JSON payloads on downtime and recovery events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWebhooks}
            className="text-slate-300 border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-md shadow-indigo-600/30"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New Webhook
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Webhook className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No webhooks configured yet</h3>
            <p className="text-sm text-slate-400 max-w-sm mt-1 mb-4">
              Connect external destinations (Slack, Discord, PagerDuty, or custom servers) to receive instant notifications.
            </p>
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Your First Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((hook) => (
            <Card key={hook.id} className="border-slate-800/80 bg-slate-900/60 shadow-sm">
              <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-white truncate max-w-md">
                      {hook.url}
                    </span>
                    <Badge variant={hook.isActive ? 'success' : 'outline'} className="text-[10px] py-0">
                      {hook.isActive ? 'ACTIVE' : 'PAUSED'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-500 mr-1">Events:</span>
                    {hook.events.map((evt) => (
                      <Badge
                        key={evt}
                        variant="secondary"
                        className="text-[10px] font-mono bg-slate-800/80 text-indigo-300"
                      >
                        {evt}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestWebhook(hook.id)}
                    isLoading={testingId === hook.id}
                    className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
                  >
                    <Send className="h-3 w-3 mr-1.5" /> Test Dispatch
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedWebhook({ id: hook.id, url: hook.url })}
                    className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
                  >
                    <History className="h-3 w-3 mr-1.5" /> Logs
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(hook.id)}
                    className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateWebhookModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={fetchWebhooks}
      />

      <DeliveriesModal
        webhookId={selectedWebhook?.id || null}
        webhookUrl={selectedWebhook?.url || ''}
        onClose={() => setSelectedWebhook(null)}
      />
    </div>
  );
}
