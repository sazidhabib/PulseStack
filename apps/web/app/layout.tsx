import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/providers/auth-provider';
import { WsProvider } from '@/providers/ws-provider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'PulseStack — Enterprise Health Monitoring & Background Job SaaS',
  description: 'Real-time telemetry, scheduled health checks, and webhook alerting platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100 selection:bg-indigo-600 selection:text-white">
        <AuthProvider>
          <WsProvider>
            {children}
            <Toaster position="top-right" richColors theme="dark" />
          </WsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
