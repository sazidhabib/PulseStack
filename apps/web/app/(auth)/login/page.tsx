'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@pulsestack/shared';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Sparkles, ArrowRight, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginDemo, isLoading, isAuthenticated } = useAuth();
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const onSubmit = async (data: LoginInput) => {
    const res = await login(data);
    if (res.success) {
      toast.success('Signed in successfully');
      router.push('/dashboard');
    } else {
      toast.error(res.error || 'Failed to sign in');
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    try {
      const res = await loginDemo();
      if (res.success) {
        toast.success('Welcome to PulseStack Demo Instance!');
        router.push('/dashboard');
      } else {
        toast.error(res.error || 'Demo login failed');
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <Card className="border-slate-800/80 bg-slate-900/70 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-bold tracking-tight text-white">
          Sign In
        </CardTitle>
        <CardDescription className="text-slate-400">
          Enter your credentials to access your monitoring dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 1-Click Demo Login Banner */}
        <div className="rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 to-purple-950/40 p-3.5 text-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Recruiter & Reviewer Sandbox
            </span>
            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-mono font-medium text-indigo-300">
              demo@pulsestack.io
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Instant 1-click login pre-seeded with live simulated monitors and telemetry.
          </p>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 font-semibold shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-400"
            isLoading={isDemoLoading}
            onClick={handleDemoLogin}
          >
            Launch 1-Click Demo <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="relative my-4 flex items-center justify-center text-xs uppercase">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-800" />
          </div>
          <span className="relative bg-slate-900 px-2 text-slate-500 font-medium">
            or continue with credentials
          </span>
        </div>

        {/* Regular Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-2 font-medium"
            isLoading={isSubmitting || isLoading}
          >
            <Lock className="mr-2 h-4 w-4" /> Sign In
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-slate-800/80 pt-4 text-xs text-slate-400">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="ml-1 font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          Create Organization
        </Link>
      </CardFooter>
    </Card>
  );
}
