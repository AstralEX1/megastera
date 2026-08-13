import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { ExpeditionConfigurator } from '@/components/explore/ExpeditionConfigurator';
import { ExpeditionStatusScreen, RevealCompleteScreen } from '@/components/explore/ExpeditionSuccessScreens';
import { BulkProgress } from '@/components/lottery/BulkProgress';
import { BATCH_PURCHASE_FACILITATOR_ADDRESS, EXPLORER_TX_URL, JACKPOT_ADDRESS } from '@/config/contracts';
import { useBulkPurchase } from '@/hooks/useBulkPurchase';
import { useBuyTickets } from '@/hooks/useBuyTickets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { clampExpeditionQuantity } from '@/lib/expeditionFlow';
import { requestBackendPlanetGeneration, type BackendPlanet } from '@/lib/backendApi';
import { BULK_THRESHOLD, type CustomTicket, isValidTicket, totalCost } from '@/lib/tickets';
import type { PurchasedTicket } from '@/lib/purchaseReceipt';

export function Play() {
  const { address, isConnected } = useAccount();
  const { state, drawingId, phase, refetch: refetchJackpot } = useJackpotState();
  const [count, setCount] = useState(3);
  const [automaticQuickPick, setAutomaticQuickPick] = useState(true);
  const [staticTickets, setStaticTickets] = useState<readonly CustomTicket[]>([]);
  const [flowActive, setFlowActive] = useState(false);
  const [generatedPlanets, setGeneratedPlanets] = useState<BackendPlanet[]>([]);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  const generatedKeys = useRef(new Set<string>());

  const bounds = useMemo(
    () => (state ? { ballMax: state.ballMax, bonusballMax: state.bonusballMax } : null),
    [state],
  );
  const isBulk = count > BULK_THRESHOLD;
  const bulkDraft = isBulk ? { dynamicCount: count, staticTickets: [] } : null;
  const bulk = useBulkPurchase(bulkDraft);
  const direct = useBuyTickets();
  const validStaticTickets = bounds !== null && staticTickets.every((ticket) => isValidTicket(ticket, bounds));
  const manualSelectionComplete = automaticQuickPick || staticTickets.length === count;
  const directReady = !isBulk && bounds !== null && validStaticTickets && manualSelectionComplete && direct.isReady;
  const meetsBulkMinimum = bulk.minimumTicketCount !== undefined && BigInt(count) >= bulk.minimumTicketCount;
  const bulkReady = isBulk && meetsBulkMinimum && !bulk.hasActiveOrder && bulk.create.isReady;
  const total = state ? totalCost({ ticketPriceUsdcRaw: state.ticketPrice, count }) : 0n;
  const purchase = isBulk ? bulk.create : direct;
  const approvalSpender = isBulk ? BATCH_PURCHASE_FACILITATOR_ADDRESS : JACKPOT_ADDRESS;
  const approvalAmount = isBulk ? (bulkReady ? total : 0n) : directReady ? total : 0n;
  const checkoutDisabled = !isConnected || phase !== 'open' || purchase.isPending || !(isBulk ? bulkReady : directReady);
  const purchasedTickets: readonly PurchasedTicket[] = isBulk ? bulk.confirmedTickets : direct.purchasedTickets;
  const activeBatch = bulk.orderInfo?.[0];

  useEffect(() => {
    if (!flowActive || !address) return;
    for (const ticket of purchasedTickets) {
      const key = `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`;
      if (generatedKeys.current.has(key)) continue;
      generatedKeys.current.add(key);
      setGenerationError(null);
      void requestBackendPlanetGeneration({
        transactionHash: ticket.originTxHash,
        logIndex: ticket.logIndex,
        recipient: address,
      })
        .then((planet) => setGeneratedPlanets((current) => current.some((item) => item.planetId === planet.planetId) ? current : [...current, planet]))
        .catch((error) => setGenerationError(error instanceof Error ? error : new Error('Planet generation failed.')));
    }
  }, [address, flowActive, purchasedTickets]);

  const launch = () => {
    if (!address || drawingId === undefined) return;
    generatedKeys.current.clear();
    setGeneratedPlanets([]);
    setGenerationError(null);
    setFlowActive(true);
    if (isBulk) void bulk.createOrder();
    else if (bounds) void direct.buy({ customTickets: staticTickets, count, bounds });
  };

  const exploreAgain = useCallback(() => {
    direct.reset();
    bulk.create.reset();
    generatedKeys.current.clear();
    setGeneratedPlanets([]);
    setGenerationError(null);
    setFlowActive(false);
  }, [bulk.create, direct]);

  const retryGeneration = () => {
    generatedKeys.current.clear();
    setGenerationError(null);
    setGeneratedPlanets([]);
  };

  const purchaseConfirmed = purchasedTickets.length > 0 || (isBulk && (bulk.create.isSuccess || bulk.hasActiveOrder));
  const expectedCount = count;
  const ready = generatedPlanets.length >= expectedCount;
  const progress = `${Math.min(generatedPlanets.length, expectedCount)} / ${expectedCount}`;

  let content = (
    <ExpeditionConfigurator
      quantity={count}
      total={total}
      jackpotAmount={state?.prizePool}
      bounds={bounds}
      manuallyEditedTickets={staticTickets}
      automaticQuickPick={automaticQuickPick}
      disabled={flowActive ? true : checkoutDisabled}
      exploreLabel={flowActive ? 'Generating planets…' : undefined}
      approvalSpender={approvalSpender}
      approvalAmount={approvalAmount}
      onApproved={refetchJackpot}
      onQuantityChange={(value) => {
        const next = clampExpeditionQuantity(value);
        setCount(next);
        if (next > BULK_THRESHOLD) {
          setStaticTickets([]);
          setAutomaticQuickPick(true);
        } else setStaticTickets((current) => current.slice(0, next));
      }}
      onAutomaticQuickPickChange={setAutomaticQuickPick}
      onTicketsChange={setStaticTickets}
      onExplore={launch}
    />
  );

  if (flowActive && purchase.error) {
    content = <ExpeditionStatusScreen step="explore" eyebrow="PURCHASE FAILED" title="The expedition can be retried" description={purchase.error.message} action={<Button variant="primary" onClick={exploreAgain}>Try again</Button>} />;
  } else if (flowActive && generationError) {
    content = <ExpeditionStatusScreen step="discover" eyebrow="GENERATION ERROR" title="The ticket is safe" description={generationError.message} action={<Button variant="primary" onClick={retryGeneration}>Retry generation</Button>} />;
  } else if (flowActive && ready) {
    content = (
      <RevealCompleteScreen
        drawingId={drawingId}
        onExploreAgain={exploreAgain}
        onViewPlanets={() => window.location.assign('/my-planets')}
        cards={<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{generatedPlanets.map((planet) => <img key={planet.planetId} src={planet.gifUrl} alt={planet.name} className="aspect-square w-full rounded-2xl border border-[var(--border)] object-cover" />)}</div>}
      />
    );
  } else if (flowActive && purchaseConfirmed) {
    content = <ExpeditionStatusScreen step="discover" eyebrow="RECEIPT CONFIRMED" title="Generating your planets" description="The backend is rendering a GIF and saving your Planet to the database. You can safely keep this page open." progress={progress} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-6">
      {!isConnected && <Notice>Connect your wallet to buy tickets.</Notice>}
      {phase !== 'open' && <Notice>Tickets are paused until the next drawing opens.</Notice>}
      {content}
      {isBulk && bulk.minimumTicketCount !== undefined && !meetsBulkMinimum && !flowActive && <Notice>Megapot requires at least {bulk.minimumTicketCount.toString()} tickets for this order.</Notice>}
      {flowActive && isBulk && bulk.hasActiveOrder && activeBatch ? (
        <section className="mx-auto max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <BulkProgress totalTickets={activeBatch.totalTicketsOrdered} remainingTickets={activeBatch.remainingTickets} remainingUSDC={activeBatch.remainingUSDC} />
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={bulk.cancelOrder} disabled={bulk.cancel.isPending}>Cancel remaining order</Button>
            {bulk.createdOrder ? <a className="text-sm font-semibold text-[var(--accent)]" href={`${EXPLORER_TX_URL}${bulk.createdOrder.creationTxHash}`} target="_blank" rel="noreferrer">View transaction</a> : null}
          </div>
          <TxStatus hash={bulk.cancel.txHash} isPending={bulk.cancel.isPending} isSuccess={bulk.cancel.isSuccess} error={bulk.cancel.error} />
        </section>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto max-w-[560px] rounded-xl border border-[var(--warning)]/40 bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">{children}</p>;
}
