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
      <div className="relative w-full">
        <div className="min-w-0">
          <div
            data-testid="expedition-core"
            data-layout-anchor="fixed"
            className="mx-auto w-full max-w-[840px]"
          >
            <div className="flex flex-col items-center">
              <h1 className="max-w-full text-center">
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
                    fontSize="clamp(3.45rem, 5.6vw, 5.3rem)"
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
                  <p
                    role="alert"
                    className="mt-3 text-center text-sm text-rose-600 dark:text-rose-400"
                  >
                    Ticket purchase failed. Please try again.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label={coordinatesLabel}
          aria-expanded={coordinatesOpen}
          onClick={() => setCoordinatesOpen((open) => !open)}
          className="fixed top-1/2 right-0 z-40 hidden h-60 w-20 -translate-y-1/2 items-center justify-center border-x border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] transition-[right,background-color] duration-300 ease-out hover:bg-[var(--surface-raised)] xl:flex"
          style={{ right: coordinatesOpen ? '380px' : '0px' }}
        >
          <span className="relative flex h-full w-full items-center justify-center" aria-hidden>
            <span className="-rotate-90 whitespace-nowrap telemetry text-[1rem] font-bold">
              Coordinates
            </span>
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[2.25rem] leading-none">
              {coordinatesOpen ? '›' : '‹'}
            </span>
          </span>
        </button>
        <div
          data-testid="coordinates-disclosure"
          data-side="right"
          data-state={coordinatesOpen ? 'open' : 'closed'}
          aria-hidden={!coordinatesOpen}
          inert={!coordinatesOpen || undefined}
          className={`fixed top-[7rem] right-0 z-30 hidden h-[calc(100svh-7rem)] overflow-hidden transition-[width,opacity,transform] duration-300 ease-out xl:block ${coordinatesOpen ? 'pointer-events-auto w-[380px] translate-x-0 opacity-100' : 'pointer-events-none w-0 translate-x-3 opacity-0'}`}
          style={{ right: '0px' }}
        >
          <div className="h-full w-[380px] overflow-y-auto">
            <CoordinatesPanel
              quantity={quantity}
              bounds={bounds}
              tickets={tickets}
              onTicketsChange={onTicketsChange}
            />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-5 w-full max-w-[560px] xl:hidden">
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
        {coordinatesOpen && (
          <div className="mt-3 border border-[var(--border-strong)]">
            <CoordinatesPanel
              quantity={quantity}
              bounds={bounds}
              tickets={tickets}
              onTicketsChange={onTicketsChange}
            />
          </div>
        )}
      </div>
    </section>
  );
}
