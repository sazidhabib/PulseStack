'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Settings, Building, Shield, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const { user, org } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-indigo-400" /> Organization Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your organization profile, multi-tenant isolation, and access controls.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Organization Card */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5 text-indigo-400" />
                Organization Details
              </CardTitle>
              <Badge variant="default" className="uppercase font-mono text-xs">
                {org?.plan || 'PRO PLAN'}
              </Badge>
            </div>
            <CardDescription>
              Organization-wide configurations and tenant identifier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Organization Name</Label>
                <Input value={org?.name || ''} readOnly className="bg-slate-950/60 text-slate-300" />
              </div>
              <div>
                <Label>Tenant ID (UUID)</Label>
                <Input value={org?.id || user?.orgId || ''} readOnly className="bg-slate-950/60 font-mono text-xs text-slate-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Profile Card */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-400" />
              User Profile
            </CardTitle>
            <CardDescription>
              Your active credentials and role permissions in this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Email Address</Label>
                <Input value={user?.email || ''} readOnly className="bg-slate-950/60 text-slate-300" />
              </div>
              <div>
                <Label>Role</Label>
                <div className="flex items-center h-10 px-3 rounded-lg border border-slate-700 bg-slate-950/60 text-sm text-slate-300 capitalize">
                  <Shield className="h-4 w-4 mr-2 text-indigo-400" />
                  {user?.role || 'member'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
