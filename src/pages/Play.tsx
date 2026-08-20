import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { ExpeditionConfigurator } from '@/components/explore/ExpeditionConfigurator';
import {
  ExpeditionStatusScreen,
  RevealCompleteScreen,
} from '@/components/explore/ExpeditionSuccessScreens';
import { BulkProgress } from '@/components/lottery/BulkProgress';
import {
  BATCH_PURCHASE_FACILITATOR_ADDRESS,
  EXPLORER_TX_URL,
  JACKPOT_ADDRESS,
} from '@/config/contracts';
import { useBulkPurchase } from '@/hooks/useBulkPurchase';
import { useBuyTickets } from '@/hooks/useBuyTickets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { type BackendPlanet, requestBackendPlanetGeneration } from '@/lib/backendApi';
import { clampExpeditionQuantity } from '@/lib/expeditionFlow';
import type { PurchasedTicket } from '@/lib/purchaseReceipt';
import {
  BULK_THRESHOLD,
  type CustomTicket,
  isValidTicket,
  syncConfiguredTickets,
  totalCost,
} from '@/lib/tickets';

const GENERATION_RETRY_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000, 16_000] as const;

function waitForGenerationRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

export function Play() {
  const { address, isConnected } = useAccount();
  const {
    state,
    drawingId,
    phase,
    isLoading: isJackpotLoading,
    error: jackpotError,
    refetch: refetchJackpot,
  } = useJackpotState();
  const [count, setCount] = useState(3);
  const [configuredTickets, setConfiguredTickets] = useState<readonly CustomTicket[]>([]);
  const [flowActive, setFlowActive] = useState(false);
  const [generatedPlanets, setGeneratedPlanets] = useState<BackendPlanet[]>([]);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  const generatedKeys = useRef(new Set<string>());
  const generationInFlight = useRef(new Set<string>());
  const generationRunId = useRef(0);

  const ballMax = state?.ballMax;
  const bonusballMax = state?.bonusballMax;
  const bounds = useMemo(
    () => (ballMax !== undefined && bonusballMax !== undefined ? { ballMax, bonusballMax } : null),
    [ballMax, bonusballMax],
  );
  const concreteCount = Math.min(count, BULK_THRESHOLD);
  const isBulk = count > BULK_THRESHOLD;
  const bulkDraft = isBulk
    ? { dynamicCount: count - configuredTickets.length, staticTickets: configuredTickets }
    : null;
  const bulk = useBulkPurchase(bulkDraft);
  const direct = useBuyTickets();
  const ticketsReady =
    bounds !== null &&
    configuredTickets.length === concreteCount &&
    configuredTickets.every((ticket) => isValidTicket(ticket, bounds));
  const directReady = !isBulk && ticketsReady && direct.isReady;
  const meetsBulkMinimum =
    bulk.minimumTicketCount !== undefined && BigInt(count) >= bulk.minimumTicketCount;
  const bulkReady =
    isBulk && ticketsReady && meetsBulkMinimum && !bulk.hasActiveOrder && bulk.create.isReady;
  const total = state ? totalCost({ ticketPriceUsdcRaw: state.ticketPrice, count }) : 0n;
  const purchase = isBulk ? bulk.create : direct;
  const approvalSpender = isBulk ? BATCH_PURCHASE_FACILITATOR_ADDRESS : JACKPOT_ADDRESS;
  const approvalAmount = isBulk ? (bulkReady ? total : 0n) : directReady ? total : 0n;
  const jackpotStatus = isJackpotLoading ? 'loading' : jackpotError || !state ? 'error' : 'ready';
  const checkoutDisabled =
    jackpotStatus !== 'ready' ||
    !isConnected ||
    phase !== 'open' ||
    purchase.isPending ||
    !(isBulk ? bulkReady : directReady);
  const purchasedTickets: readonly PurchasedTicket[] = isBulk
    ? bulk.confirmedTickets
    : direct.purchasedTickets;
  const activeBatch = bulk.orderInfo?.[0];

  useEffect(() => {
    setConfiguredTickets((current) => syncConfiguredTickets({ count, tickets: current, bounds }));
  }, [bounds, count]);

  useEffect(() => {
    if (!flowActive || !address || purchasedTickets.length === 0) return;
    const runId = generationRunId.current;
    for (const ticket of purchasedTickets) {
      const key = `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`;
      if (generatedKeys.current.has(key) || generationInFlight.current.has(key)) continue;
      generatedKeys.current.add(key);
      generationInFlight.current.add(key);
      void (async () => {
        let lastError = new Error('Planet generation failed.');
        try {
          for (const delayMs of GENERATION_RETRY_DELAYS_MS) {
            if (runId !== generationRunId.current) return;
            if (delayMs > 0) await waitForGenerationRetry(delayMs);
            if (runId !== generationRunId.current) return;
            try {
              const planet = await requestBackendPlanetGeneration({
                transactionHash: ticket.originTxHash,
                logIndex: ticket.logIndex,
                recipient: address,
              });
              if (runId !== generationRunId.current) return;
              setGeneratedPlanets((current) =>
                current.some((item) => item.planetId === planet.planetId)
                  ? current
                  : [...current, planet],
              );
              return;
            } catch (error) {
              lastError = error instanceof Error ? error : new Error('Planet generation failed.');
            }
          }
          if (runId === generationRunId.current) setGenerationError(lastError);
        } finally {
          generationInFlight.current.delete(key);
        }
      })();
    }
  }, [address, flowActive, purchasedTickets]);

  const launch = () => {
    if (!address || drawingId === undefined) return;
    generatedKeys.current.clear();
    generationInFlight.current.clear();
    generationRunId.current += 1;
    setGeneratedPlanets([]);
    setGenerationError(null);
    setFlowActive(true);
    if (isBulk) void bulk.createOrder();
    else if (bounds) void direct.buy({ customTickets: configuredTickets, count, bounds });
  };

  const exploreAgain = useCallback(() => {
    generationRunId.current += 1;
    direct.reset();
    bulk.reset();
    generatedKeys.current.clear();
    generationInFlight.current.clear();
    setGeneratedPlanets([]);
    setGenerationError(null);
    setFlowActive(false);
  }, [bulk, direct]);

  const retryGeneration = () => {
    generationRunId.current += 1;
    generatedKeys.current.clear();
    generationInFlight.current.clear();
    setGenerationError(null);
    setGeneratedPlanets([]);
  };

  const purchaseConfirmed = purchasedTickets.length > 0;
  const purchaseFailed = flowActive && Boolean(purchase.error);
  const expectedCount = count;
  const ready = generatedPlanets.length >= expectedCount;
  const progress = `${Math.min(generatedPlanets.length, expectedCount)} / ${expectedCount} planets generated`;

  let content = (
    <ExpeditionConfigurator
      quantity={count}
      total={total}
      jackpotAmount={state?.prizePool}
      jackpotStatus={jackpotStatus}
      onRetryJackpot={refetchJackpot}
      bounds={bounds}
      tickets={configuredTickets}
      disabled={purchaseFailed ? false : flowActive ? true : checkoutDisabled}
      exploreLabel={purchaseFailed ? 'Try again' : flowActive ? 'Transaction…' : undefined}
      purchaseError={purchaseFailed ? purchase.error : null}
      approvalSpender={approvalSpender}
      approvalAmount={approvalAmount}
      onApproved={refetchJackpot}
      onQuantityChange={(value) => {
        const next = clampExpeditionQuantity(value);
        setCount(next);
        setConfiguredTickets((current) =>
          syncConfiguredTickets({ count: next, tickets: current, bounds }),
        );
      }}
      onTicketsChange={setConfiguredTickets}
      onExplore={launch}
    />
  );

  if (flowActive && ready) {
    content = (
      <RevealCompleteScreen
        drawingId={drawingId}
        onExploreAgain={exploreAgain}
        onViewPlanets={() => window.location.assign('/my-planets')}
        cards={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {generatedPlanets.map((planet) => (
              <article
                key={planet.planetId}
                className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)] text-left shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
              >
                <img
                  src={planet.gifUrl}
                  alt={`${planet.name} planet`}
                  style={{ imageRendering: 'pixelated' }}
                  className="aspect-square w-full object-cover"
                />
                <div className="space-y-1.5 border-t border-[var(--border)] p-4">
                  <p className="telemetry text-[var(--success)]">
                    {planet.planetType} · {planet.rarity}
                  </p>
                  <h2 className="font-hud text-xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
                    {planet.name}
                  </h2>
                  <p className="font-mono text-[11px] text-[var(--text-secondary)]">
                    TICKET #{planet.ticketId}
                  </p>
                </div>
              </article>
            ))}
          </div>
        }
      />
    );
  } else if (flowActive && generationError) {
    content = (
      <ExpeditionStatusScreen
        step="explore"
        eyebrow="GENERATION ERROR"
        title="The ticket is safe"
        description={generationError.message}
        action={
          <Button variant="primary" onClick={retryGeneration}>
            Retry generation
          </Button>
        }
      />
    );
  } else if (flowActive && purchaseConfirmed) {
    content = (
      <ExpeditionStatusScreen
        step="explore"
        eyebrow="EXPLORING PLANETS"
        title="Exploring planets…"
        description="Your ticket receipt is confirmed. We are waiting for finality, generating the Planet, and saving it to the Megastera backend."
        progress={progress}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-6">
      {phase !== 'open' && <Notice>Tickets are paused until the next drawing opens.</Notice>}
      {content}
      {isBulk && bulk.minimumTicketCount !== undefined && !meetsBulkMinimum && !flowActive && (
        <Notice>
          Megapot requires at least {bulk.minimumTicketCount.toString()} tickets for this order.
        </Notice>
      )}
      {flowActive && isBulk && bulk.hasActiveOrder && activeBatch ? (
        <section className="mx-auto max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <BulkProgress
            totalTickets={activeBatch.totalTicketsOrdered}
            remainingTickets={activeBatch.remainingTickets}
            remainingUSDC={activeBatch.remainingUSDC}
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={bulk.cancelOrder}
              disabled={bulk.cancel.isPending}
            >
              Cancel remaining order
            </Button>
            {bulk.createdOrder ? (
              <a
                className="text-sm font-semibold text-[var(--accent)]"
                href={`${EXPLORER_TX_URL}${bulk.createdOrder.creationTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            ) : null}
          </div>
          <TxStatus
            hash={bulk.cancel.txHash}
            isPending={bulk.cancel.isPending}
            isSuccess={bulk.cancel.isSuccess}
            error={bulk.cancel.error}
          />
        </section>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto max-w-[560px] rounded-xl border border-[var(--warning)]/40 bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
      {children}
    </p>
  );
}
