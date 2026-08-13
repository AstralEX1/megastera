import { Button } from '@/components/common/Button';
import { UsdcAmount } from '@/components/common/UsdcAmount';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import type { TicketStatus } from '@/lib/ticketStatus';

export type PlanetTicketActionProps = {
  status: TicketStatus;
  onClaim?: () => void;
  isClaimPending?: boolean;
  claimError?: Error | null;
};

export function PlanetTicketAction({
  status,
  onClaim,
  isClaimPending = false,
  claimError = null,
}: PlanetTicketActionProps) {
  if (status.kind === 'claimable') {
    return (
      <div className="space-y-2" data-testid="planet-ticket-action">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={onClaim}
          disabled={isClaimPending}
        >
          {isClaimPending ? 'Claiming…' : <><span>Claim</span>{' '}<UsdcAmount value={status.amount} precision={2} unit={false} /> USDC</>}
        </Button>
        {claimError ? (
          <p role="alert" className="text-center text-[11px] text-rose-300">
            Claim failed — try again.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="planet-ticket-action"
      className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
    >
      <TicketStatusBadge status={status} />
    </div>
  );
}
