import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PulseStack — Enterprise Multi-Tenant Health Monitoring & Background Job SaaS',
  description: 'Real-time telemetry, scheduled health checks, and webhook alerting platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
