import { type ReactNode, useState } from 'react';
import { formatUnits } from 'viem';
import { ApprovalButton } from '@/components/common/ApprovalButton';
import { DepthText } from '@/components/common/DepthText';
import type { CustomTicket, TicketBounds } from '@/lib/tickets';
import { CompactPlanetDial } from './CompactPlanetDial';
import { CoordinatesPanel } from './CoordinatesDisclosure';
import { ExploreButton } from './ExploreButton';
import { StaticDepthStack } from './StaticDepthStack';

function formatJackpot(amount: bigint) {
  return Number(formatUnits(amount, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatPurchaseError(error: Error) {
  const message = error.message.toLowerCase();
  if (
    /(insufficient|not enough|exceeds balance|balance too low)/.test(message) &&
    /(balance|fund|usdc|transfer)/.test(message)
  ) {
    return 'Not enough USDC balance for this purchase.';
  }
  if (
    /(user rejected|user denied|rejected the request|denied transaction|cancelled)/.test(message)
  ) {
    return 'Transaction cancelled. Try again when you’re ready.';
  }
  if (/(network|rpc|chain|disconnected)/.test(message)) {
    return 'Wallet connection or network error. Check your wallet and try again.';
  }
  return 'We couldn’t complete the ticket purchase. Check your USDC balance and try again.';
}

export type JackpotStatus = 'loading' | 'ready' | 'error';

export function ExpeditionConfigurator({
  quantity,
  total,
  jackpotAmount = 0n,
  jackpotStatus = 'ready',
  onRetryJackpot,
  bounds,
  tickets,
  disabled,
  exploreLabel,
  purchaseError,
  approvalSpender,
  approvalAmount,
  onApproved,
  onQuantityChange,
  onTicketsChange,
  onExplore,
}: {
  quantity: number;
  total: bigint;
  jackpotAmount?: bigint;
  jackpotStatus?: JackpotStatus;
  onRetryJackpot?: () => void;
  bounds: TicketBounds | null;
  tickets: readonly CustomTicket[];
  disabled: boolean;
  exploreLabel?: ReactNode;
  purchaseError?: Error | null;
  approvalSpender?: `0x${string}`;
  approvalAmount?: bigint;
  onApproved?: () => void;
  onQuantityChange: (value: number) => void;
  onTicketsChange: (tickets: readonly CustomTicket[]) => void;
  onExplore: () => void;
}) {
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const coordinatesLabel = coordinatesOpen ? 'Close coordinates' : 'Open coordinates';
  const checkoutDisabled = disabled || jackpotStatus !== 'ready';
  const exploreButtonLabel =
    exploreLabel ??
    (jackpotStatus === 'loading'
      ? 'Loading drawing data…'
      : jackpotStatus === 'error'
        ? 'Drawing data unavailable'
        : undefined);

  return (
    <section className="relative mx-auto w-full px-4 py-0 sm:px-6">
      <div className="relative w-full min-w-0 overflow-x-clip">
        <div className="min-w-0">
          <div
            data-testid="expedition-core"
            data-layout-anchor="flow"
            className="mx-auto w-full min-w-0 max-w-[1120px]"
          >
            <div className="flex flex-col items-center">
              <h1 className="w-full min-w-0 max-w-full overflow-hidden text-center text-balance">
                {jackpotStatus === 'ready' ? (
                  <DepthText
                    text={`Win up to $${formatJackpot(jackpotAmount)}`}
                    faceColor="#f8fafc"
                    depthColor="#7c3aed"
                    layers={32}
                    depth={4}
                    tilt={10.5}
                    smoothing={0.3}
                    perspective={1_500}
                    orbitSpeed={0.1}
                    pointerTracking={false}
                    autoOrbit
                    className="block w-full min-w-0 max-w-full [&_.depth-text__stage]:w-full [&_.depth-text__stage]:min-w-0 [&_.depth-text__layer]:whitespace-normal [&_.depth-text__layer]:break-words [&_.depth-text__face]:whitespace-normal [&_.depth-text__face]:break-words"
                    fontSize="clamp(2rem, 7vw, 5.3rem)"
                    fontWeight={800}
                    shadow
                  />
                ) : (
                  <span className="block px-4 font-hud text-3xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-5xl">
                    {jackpotStatus === 'loading' ? 'Loading jackpot…' : 'Jackpot unavailable'}
                  </span>
                )}
              </h1>
              {jackpotStatus === 'error' ? (
                <div
                  role="alert"
                  className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]"
                >
                  <span>Drawing data unavailable.</span>
                  {onRetryJackpot ? (
                    <button
                      type="button"
                      onClick={onRetryJackpot}
                      className="font-semibold text-[var(--rare)] underline-offset-4 hover:underline"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
              <StaticDepthStack quantity={quantity} />
              <div className="w-full">
                <CompactPlanetDial quantity={quantity} onChange={onQuantityChange} />
              </div>
              <div className="w-full">
                {approvalSpender !== undefined && approvalAmount !== undefined ? (
                  <ApprovalButton
                    spender={approvalSpender}
                    amount={approvalAmount}
                    onApproved={onApproved}
                  >
                    <ExploreButton
                      quantity={quantity}
                      total={total}
                      disabled={checkoutDisabled}
                      label={exploreButtonLabel}
                      onClick={onExplore}
                    />
                  </ApprovalButton>
                ) : (
                  <ExploreButton
                    quantity={quantity}
                    total={total}
                    disabled={checkoutDisabled}
                    label={exploreButtonLabel}
                    onClick={onExplore}
                  />
                )}
                {purchaseError ? (
                  <div className="mt-3 space-y-1 text-center text-sm text-rose-600 dark:text-rose-400">
                    <p role="alert">{formatPurchaseError(purchaseError)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Need help?{' '}
                      <a
                        href="https://t.me/astralex163"
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-[var(--text-primary)]"
                      >
                        Message support if you have any issues
                      </a>
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-5 w-full max-w-[1120px]">
        <button
          type="button"
          aria-label={coordinatesLabel}
          aria-expanded={coordinatesOpen}
          onClick={() => setCoordinatesOpen((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between border-t border-[var(--border)] pt-3 font-hud text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]"
        >
          <span>{coordinatesOpen ? '⌄ Hide coordinates' : '› Choose coordinates'}</span>
          <span className="text-xs normal-case tracking-normal text-[var(--text-secondary)]">
            Optional
          </span>
        </button>
        <div
          data-testid="coordinates-disclosure"
          data-side="in-flow"
          data-state={coordinatesOpen ? 'open' : 'closed'}
          aria-hidden={!coordinatesOpen}
          inert={!coordinatesOpen || undefined}
          className={`mt-3 overflow-hidden border border-[var(--border-strong)] transition-[max-height,opacity] duration-300 ease-out ${coordinatesOpen ? 'opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`}
        >
          <CoordinatesPanel
            quantity={quantity}
            bounds={bounds}
            tickets={tickets}
            onTicketsChange={onTicketsChange}
          />
        </div>
      </div>
    </section>
  );
}
