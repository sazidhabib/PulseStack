'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMonitorSchema, CreateMonitorInput } from '@pulsestack/shared';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Radio, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type CreateMonitorFormData = z.input<typeof createMonitorSchema>;

interface CreateMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateMonitorModal({
  isOpen,
  onClose,
  onCreated,
}: CreateMonitorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMonitorFormData>({
    resolver: zodResolver(createMonitorSchema),
    defaultValues: {
      name: '',
      url: 'https://',
      method: 'GET',
      intervalSeconds: 60,
      timeout: 5000,
      expectedStatus: 200,
      isActive: true,
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: CreateMonitorFormData) => {
    setIsSubmitting(true);
    try {
      const res = await apiClient.post('/api/monitors', data);
      if (res.success) {
        toast.success(`Monitor "${data.name}" registered and scheduled!`);
        reset();
        onCreated();
        onClose();
      } else {
        toast.error(res.error?.message || 'Failed to create monitor');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create monitor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create New Monitor</h2>
              <p className="text-xs text-slate-400">Configure endpoint checks and ping cadence.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div>
            <Label htmlFor="name">Monitor Name</Label>
            <Input
              id="name"
              placeholder="e.g. Production API Gateway"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          <div>
            <Label htmlFor="url">Target URL</Label>
            <Input
              id="url"
              placeholder="https://api.yourdomain.com/health"
              error={errors.url?.message}
              {...register('url')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="method">HTTP Method</Label>
              <select
                id="method"
                className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                {...register('method')}
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div>
              <Label htmlFor="interval">Check Cadence</Label>
              <select
                id="interval"
                className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                {...register('intervalSeconds', { valueAsNumber: true })}
              >
                <option value={60}>Every 1 minute (60s)</option>
                <option value={300}>Every 5 minutes (300s)</option>
                <option value={900}>Every 15 minutes (900s)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expectedStatus">Expected HTTP Status</Label>
              <Input
                id="expectedStatus"
                type="number"
                placeholder="200"
                error={errors.expectedStatus?.message}
                {...register('expectedStatus', { valueAsNumber: true })}
              />
            </div>

            <div>
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                placeholder="5000"
                error={errors.timeout?.message}
                {...register('timeout', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500">
              Schedule Monitor <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
