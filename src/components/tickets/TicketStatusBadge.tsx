import { UsdcAmount } from '@/components/common/UsdcAmount';
import type { TicketStatus } from '@/lib/ticketStatus';

function ClockIcon() {
  return (
    <svg
      role="img"
      aria-label="Countdown"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

const BASE = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';
const COMPACT_BASE = 'inline-flex min-h-10 items-center gap-1 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide';

export function TicketStatusBadge({ status, appearance = 'default' }: { status: TicketStatus; appearance?: 'default' | 'compact' }) {
  const base = appearance === 'compact' ? COMPACT_BASE : BASE;

  if (status.kind === 'countdown') {
    return (
      <span
        data-testid="ticket-status-countdown"
        className={`${base} ${appearance === 'compact' ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300'}`}
      >
        <ClockIcon />
        Drawing in {status.time}
      </span>
    );
  }

  if (status.kind === 'drawing') {
    return (
      <span
        data-testid="ticket-status-drawing"
        className={`${base} ${appearance === 'compact' ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}
      >
        Drawing…
      </span>
    );
  }

  if (status.kind === 'checking') {
    return (
      <span
        data-testid="ticket-status-checking"
        className={`${base} border-zinc-700 bg-zinc-800 text-zinc-300`}
      >
        Checking…
      </span>
    );
  }

  if (status.kind === 'claimable') {
    return (
      <span
        data-testid="ticket-status-claimable"
        className={`${BASE} border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300`}
      >
        Claimable · <UsdcAmount value={status.amount} precision={2} unit={false} />
      </span>
    );
  }

  if (status.kind === 'claimed') {
    return (
      <span
        data-testid="ticket-status-claimed"
        className={`${base} ${appearance === 'compact' ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
      >
        Claimed <UsdcAmount value={status.amount} precision={2} unit={false} /> USDC
      </span>
    );
  }

  if (status.kind === 'drawn') {
    return (
      <span
        data-testid="ticket-status-drawn"
        className={`${base} ${appearance === 'compact' ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300'}`}
      >
        Drawn
      </span>
    );
  }

  return (
    <span
      data-testid="ticket-status-unavailable"
      className={`${base} ${appearance === 'compact' ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'}`}
    >
      Unavailable
    </span>
  );
}
