'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createWebhookSchema, CreateWebhookInput } from '@pulsestack/shared';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Webhook, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type CreateWebhookFormData = z.input<typeof createWebhookSchema>;

interface CreateWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateWebhookModal({
  isOpen,
  onClose,
  onCreated,
}: CreateWebhookModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWebhookFormData>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: {
      url: 'https://',
      secret: 'whsec_pulse_super_secret_signing_key_32',
      events: ['monitor.down', 'monitor.up'],
      isActive: true,
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: CreateWebhookFormData) => {
    setIsSubmitting(true);
    try {
      const res = await apiClient.post('/api/webhooks', data);
      if (res.success) {
        toast.success('Webhook endpoint registered successfully!');
        reset();
        onCreated();
        onClose();
      } else {
        toast.error(res.error?.message || 'Failed to create webhook');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create webhook');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Webhook className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Webhook Endpoint</h2>
              <p className="text-xs text-slate-400">Receive HMAC-SHA256 signed event notifications.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div>
            <Label htmlFor="url">Destination Endpoint URL</Label>
            <Input
              id="url"
              placeholder="https://hooks.slack.com/services/... or https://api.yourdomain.com/webhook"
              error={errors.url?.message}
              {...register('url')}
            />
          </div>

          <div>
            <Label htmlFor="secret">HMAC Signing Secret</Label>
            <Input
              id="secret"
              placeholder="whsec_pulse_super_secret_signing_key_32"
              error={errors.secret?.message}
              {...register('secret')}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Used to sign payload in the <code>X-Pulse-Signature</code> header.
            </p>
          </div>

          <div>
            <Label>Subscribed Event Triggers</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs text-slate-300">
              <label className="flex items-center gap-2 p-2 rounded border border-slate-800 bg-slate-950/40 cursor-pointer">
                <input
                  type="checkbox"
                  value="monitor.down"
                  defaultChecked
                  {...register('events')}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>monitor.down</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded border border-slate-800 bg-slate-950/40 cursor-pointer">
                <input
                  type="checkbox"
                  value="monitor.up"
                  defaultChecked
                  {...register('events')}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>monitor.up</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded border border-slate-800 bg-slate-950/40 cursor-pointer">
                <input
                  type="checkbox"
                  value="monitor.degraded"
                  {...register('events')}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>monitor.degraded</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded border border-slate-800 bg-slate-950/40 cursor-pointer">
                <input
                  type="checkbox"
                  value="*"
                  {...register('events')}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>All Events (*)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500">
              Register Webhook <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
