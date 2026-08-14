import { Button } from '@/components/common/Button';
import { UsdcAmount } from '@/components/common/UsdcAmount';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import type { TicketStatus } from '@/lib/ticketStatus';

export type PlanetTicketActionProps = {
  status: TicketStatus;
  onClaim?: () => void;
  isClaimPending?: boolean;
  claimError?: Error | null;
  compact?: boolean;
};

export function PlanetTicketAction({
  status,
  onClaim,
  isClaimPending = false,
  claimError = null,
  compact = false,
}: PlanetTicketActionProps) {
  if (status.kind === 'claimable') {
    return (
      <div className={compact ? 'flex w-fit flex-col items-end gap-2' : 'space-y-2'} data-testid="planet-ticket-action">
        <Button
          variant="primary"
          size="sm"
          className={compact ? 'min-h-8 rounded-full bg-white px-3 py-1.5 text-black hover:bg-zinc-100' : 'w-full'}
          onClick={onClaim}
          disabled={isClaimPending}
        >
          {isClaimPending ? 'Claiming…' : <><span>Claim</span>{' '}<UsdcAmount value={status.amount} precision={2} unit={false} /> USDC</>}
        </Button>
        {claimError ? (
          <p role="alert" className={`text-[11px] text-rose-300 ${compact ? 'text-right' : 'text-center'}`}>
            Claim failed — try again.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="planet-ticket-action"
      className={compact ? 'inline-flex w-fit min-h-8 items-center' : 'flex min-h-10 items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2'}
    >
      <TicketStatusBadge status={status} appearance={compact ? 'compact' : 'default'} />
    </div>
  );
}
