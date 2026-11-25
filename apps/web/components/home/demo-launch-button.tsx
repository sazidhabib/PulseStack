'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

interface DemoLaunchButtonProps extends Omit<ButtonProps, 'onClick' | 'isLoading'> {
  label?: string;
}

export function DemoLaunchButton({
  label = 'Launch 1-Click Demo',
  className,
  size = 'lg',
  ...props
}: DemoLaunchButtonProps) {
  const router = useRouter();
  const { loginDemo, isAuthenticated } = useAuth();
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleLaunchDemo = async () => {
    if (isAuthenticated) {
      router.push('/dashboard');
      return;
    }

    setIsDemoLoading(true);
    try {
      const res = await loginDemo();
      if (res.success) {
        toast.success('Signed in as demo@pulsestack.io');
        router.push('/dashboard');
      } else {
        toast.error(res.error || 'Demo login failed');
        router.push('/login');
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <Button
      size={size}
      className={className}
      isLoading={isDemoLoading}
      onClick={handleLaunchDemo}
      {...props}
    >
      <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
      {label}
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );
}
