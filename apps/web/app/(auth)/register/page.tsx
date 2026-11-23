'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@pulsestack/shared';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Building2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerAuth, isLoading, isAuthenticated } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      orgName: '',
      email: '',
      password: '',
    },
  });

  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const onSubmit = async (data: RegisterInput) => {
    const res = await registerAuth(data);
    if (res.success) {
      toast.success('Organization created successfully! Welcome to PulseStack.');
      router.push('/dashboard');
    } else {
      toast.error(res.error || 'Failed to create account');
    }
  };

  return (
    <Card className="border-slate-800/80 bg-slate-900/70 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Building2 className="h-5 w-5 text-indigo-400" />
          Create Organization
        </CardTitle>
        <CardDescription className="text-slate-400">
          Get started with enterprise multi-tenant monitoring in seconds.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Alex Morgan"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>

            <div>
              <Label htmlFor="orgName">Organization</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="Acme Corp"
                error={errors.orgName?.message}
                {...register('orgName')}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="alex@acme.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-4 font-semibold bg-indigo-600 hover:bg-indigo-500"
            isLoading={isSubmitting || isLoading}
          >
            Create Account & Launch <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-slate-800/80 pt-4 text-xs text-slate-400">
        Already have an organization?{' '}
        <Link
          href="/login"
          className="ml-1 font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}
