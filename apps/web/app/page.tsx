import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-between p-8 md:p-16 max-w-6xl mx-auto w-full">
      <header className="flex justify-between items-center py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            P
          </div>
          <span className="text-xl font-bold tracking-tight">PulseStack</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium px-4 py-2 rounded-md bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      <div className="py-24 text-center max-w-3xl mx-auto flex flex-col items-center gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Enterprise Multi-Tenant Monitoring
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
          Background Job Execution &amp; Real-Time Health Telemetry
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl">
          High-performance distributed health checks powered by BullMQ, Redis, PostgreSQL, and
          Next.js 16. Monitor endpoint latencies, catch outages before users do, and dispatch
          secure webhooks.
        </p>
        <div className="flex flex-wrap gap-4 justify-center pt-4">
          <Link
            href="/demo"
            className="px-6 py-3 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Launch 1-Click Demo
          </Link>
          <a
            href="http://localhost:4000/health"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg border border-slate-700 hover:bg-slate-900 text-slate-200 transition-colors"
          >
            API Health Check
          </a>
        </div>
      </div>

      <footer className="py-8 border-t border-slate-800 text-center text-xs text-slate-500">
        PulseStack — Built with TypeScript, BullMQ, Drizzle ORM, Express &amp; Next.js 16
      </footer>
    </main>
  );
}
