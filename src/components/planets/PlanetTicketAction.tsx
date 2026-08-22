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

const CLAIM_BUTTON_CLASS =
  'min-h-10 w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-white px-3 py-2 text-black hover:bg-zinc-100 sm:w-auto';

const STATUS_BADGE_CLASS = 'w-full max-w-full justify-center sm:w-auto';

export function PlanetTicketAction({
  status,
  onClaim,
  isClaimPending = false,
  claimError = null,
  compact = false,
}: PlanetTicketActionProps) {
  if (status.kind === 'claimable') {
    return (
      <div
        className={`flex w-full flex-col items-center gap-2 ${compact ? 'sm:items-end' : 'sm:items-start'}`}
        data-testid="planet-ticket-action"
      >
        <Button
          variant="primary"
          size="sm"
          className={CLAIM_BUTTON_CLASS}
          onClick={onClaim}
          disabled={isClaimPending}
        >
          {isClaimPending ? 'Claiming…' : <><span>Claim</span>{' '}<UsdcAmount value={status.amount} precision={2} unit={false} /> USDC</>}
        </Button>
        {claimError ? (
          <p
            role="alert"
            className={`max-w-full text-[11px] text-rose-300 ${compact ? 'text-center sm:text-right' : 'text-center'}`}
          >
            Claim failed — try again.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="planet-ticket-action"
      className={`flex w-full min-w-0 ${compact ? 'justify-center sm:justify-end' : 'justify-center sm:justify-start'}`}
    >
      <div
        className={`flex min-w-0 max-w-full overflow-hidden ${STATUS_BADGE_CLASS} [&>span]:min-w-0 [&>span]:max-w-full [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap`}
      >
        <TicketStatusBadge status={status} appearance="compact" />
      </div>
    </div>
  );
}
