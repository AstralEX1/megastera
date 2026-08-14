import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { FadeArc } from '@/components/common/FadeArc';
import { Ball } from '@/components/lottery/Ball';
import { BackendPlanetPreview } from '@/components/planets/BackendPlanetPreview';
import { PlanetMiningMetrics } from '@/components/planets/PlanetMiningOverlay';
import { PlanetTicketAction } from '@/components/planets/PlanetTicketAction';
import { EXPLORER_TX_URL } from '@/config/contracts';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import { useBackendPlanets } from '@/hooks/useBackendPlanets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { useRound } from '@/hooks/useRound';
import { useWalletMining } from '@/hooks/useWalletMining';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { useWalletTickets } from '@/hooks/useWalletTickets';
import { requestBackendPlanetGeneration, type BackendPlanet, type BackendPlanetCollectionRow } from '@/lib/backendApi';
import { mergeMegasteraCollection, type MegasteraCollectionItem } from '@/lib/megasteraCollection';
import type { Round, Ticket, WinningNumbers as MegapotWinningNumbers } from '@/lib/api';
import { PURCHASED_TICKETS_UPDATED_EVENT, readPersistedPurchasedTickets, type PurchasedTicket } from '@/lib/purchaseReceipt';
import { deriveTicketStatus } from '@/lib/ticketStatus';
import type { TicketStatus } from '@/lib/ticketStatus';
import { formatMinerals } from '@/lib/minerals';

type PlanetsProps = {
  onNavigate: (key: 'play' | 'planets' | 'tickets' | 'history' | 'lab') => void;
  onViewPlanet: (planetId: string) => void;
  routePlanetId?: string;
};

const RARITY_CLASSES: Record<string, string> = {
  Common: 'border-zinc-500/80 shadow-[0_18px_42px_rgba(0,0,0,0.45)]',
  Uncommon: 'border-emerald-400/90 shadow-[0_0_18px_rgba(52,211,153,0.35),0_18px_42px_rgba(16,185,129,0.12)]',
  Epic: 'border-violet-400/90 shadow-[0_0_22px_rgba(167,139,250,0.45),0_18px_42px_rgba(167,139,250,0.16)]',
  Legendary: 'border-amber-300/95 shadow-[0_0_26px_rgba(252,211,77,0.5),0_18px_42px_rgba(252,211,77,0.16)]',
};

const UNAVAILABLE_TICKET_STATUS: TicketStatus = { kind: 'unavailable' };

function rarityClass(rarity: string) {
  return RARITY_CLASSES[rarity] ?? 'border-[var(--border-strong)] shadow-[0_18px_42px_rgba(0,0,0,0.45)]';
}

function CollectionSummary({
  planetCount,
  ticketCount,
  miningRate,
  mined,
}: {
  planetCount: number;
  ticketCount: number;
  miningRate: string;
  mined: string;
}) {
  const metrics = [
    { label: 'Planets', value: planetCount, testId: 'summary-planets' },
    { label: 'Tickets', value: ticketCount, testId: 'summary-tickets' },
    { label: 'Mining Rate', value: miningRate, testId: 'summary-rate', accent: true },
    { label: 'Mined', value: mined, testId: 'summary-mined', accent: true },
  ];

  return (
    <dl data-testid="collection-summary" className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] sm:grid-cols-4">
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`min-w-0 px-4 py-3.5 ${index % 2 === 0 ? 'border-r border-[var(--border)]' : ''} ${index < 2 ? 'border-b border-[var(--border)]' : ''} sm:border-b-0 sm:border-r sm:last:border-r-0`}>
          <dt className="telemetry truncate text-[var(--text-secondary)]">{metric.label}</dt>
          <dd data-testid={metric.testId} className={`mt-1 whitespace-nowrap font-hud text-xl font-bold tabular-nums tracking-[-0.03em] ${metric.accent ? 'text-[var(--rare)]' : 'text-[var(--text-primary)]'}`}>
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BackendPlanetCard({
  planet,
  mining,
  selected,
  onSelect,
}: {
  planet: BackendPlanet;
  mining?: PlanetMiningSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      data-testid={`backend-planet-card-${planet.planetId}`}
      data-selected={selected ? 'true' : 'false'}
      data-rarity={planet.rarity}
      className={`group relative overflow-hidden rounded-2xl border-2 bg-[var(--surface-raised)] transition-[transform,background-color,box-shadow] duration-200 ${rarityClass(planet.rarity)} ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--background)]' : 'hover:-translate-y-1 hover:bg-[var(--surface-hover)]'}`}
    >
      <button
        type="button"
        aria-label={`Select ${planet.name}`}
        onClick={onSelect}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      >
        <div className="relative aspect-square overflow-hidden border-b border-[var(--border)] bg-[#050610]">
          <BackendPlanetPreview planet={planet} />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start gap-2">
            <span className="min-w-0 max-w-[80%] truncate rounded-full border border-white/15 bg-[#080914]/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/75 backdrop-blur-sm">
              {planet.planetType}
            </span>
          </div>
        </div>
        <div className="p-3.5">
          <h2 className="truncate font-hud text-lg font-bold tracking-[-0.03em] text-[var(--text-primary)]">{planet.name}</h2>
        </div>
      </button>
      <div className="p-3.5">
        <PlanetMiningMetrics mining={mining} miningAsOf={mining?.activeSince} />
      </div>
    </article>
  );
}

type TicketCoordinatesValue = Pick<BackendPlanet['ticket'], 'ticketId' | 'drawingId' | 'normals' | 'bonusBall'>;

function TicketCoordinates({ ticket, variant = 'panel' }: { ticket: TicketCoordinatesValue; variant?: 'panel' | 'stub' }) {
  const isStub = variant === 'stub';
  return (
    <section aria-label={isStub ? 'Ticket numbers' : 'Ticket coordinates'} className={isStub ? '' : 'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3'}>
      <div className="flex items-center justify-between gap-3">
        <p className="telemetry text-[var(--text-secondary)]">{isStub ? 'YOUR NUMBERS' : 'Ticket coordinates'}</p>
        {!isStub ? <span className="font-mono text-[10px] text-[var(--text-secondary)]">DRAWING #{ticket.drawingId}</span> : null}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {ticket.normals.map((coordinate) => (
          <span key={coordinate} className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] font-mono text-[11px] font-bold text-[var(--text-primary)]">
            {coordinate}
          </span>
        ))}
        <span aria-hidden className="mx-1 h-6 w-px bg-[var(--border-strong)]" />
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--rare)] font-mono text-[11px] font-bold text-black" title="Bonus number">
          {ticket.bonusBall}
        </span>
      </div>
    </section>
  );
}

function WinningNumbers({ winningNumbers }: { winningNumbers: MegapotWinningNumbers }) {
  return (
    <section data-testid="winning-numbers" aria-label="Winning numbers" className="mt-4 border-t border-[var(--border)] pt-3">
      <p className="telemetry text-[var(--text-secondary)]">Winning numbers</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {winningNumbers.normals.map((number) => (
          <Ball key={number} n={number} selected size="md" />
        ))}
        <span aria-hidden className="mx-1 h-6 w-px bg-[var(--border-strong)]" />
        <Ball n={winningNumbers.bonusball} variant="bonus" selected size="md" title="Bonus number" />
      </div>
    </section>
  );
}

function TicketBlock({
  ticket,
  winningNumbers,
  status,
  onClaim,
  isClaimPending,
  claimError,
  originTxHash,
}: {
  ticket: TicketCoordinatesValue;
  winningNumbers: MegapotWinningNumbers | null;
  status: TicketStatus;
  onClaim: () => void;
  isClaimPending: boolean;
  claimError?: Error | null;
  originTxHash: string;
}) {
  return (
    <section data-testid="ticket-block" aria-label="Ticket" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-hud text-base font-bold text-[var(--text-primary)]">Ticket</h3>
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">DRAWING #{ticket.drawingId}</span>
      </div>
      <div className="mt-3">
        <p className="telemetry text-[var(--text-secondary)]">Your numbers</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {ticket.normals.map((coordinate) => (
            <span key={coordinate} className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] font-mono text-[11px] font-bold text-[var(--text-primary)]">
              {coordinate}
            </span>
          ))}
          <span aria-hidden className="mx-1 h-6 w-px bg-[var(--border-strong)]" />
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--rare)] font-mono text-[11px] font-bold text-black" title="Bonus number">
            {ticket.bonusBall}
          </span>
        </div>
      </div>
      {winningNumbers ? <WinningNumbers winningNumbers={winningNumbers} /> : null}
      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <PlanetTicketAction status={status} onClaim={onClaim} isClaimPending={isClaimPending} claimError={claimError} />
      </div>
      <a className="mt-3 block rounded-xl border border-[var(--border)] px-3 py-2.5 text-center text-sm text-[var(--rare)] transition-colors hover:bg-[var(--surface-hover)]" href={`${EXPLORER_TX_URL}${originTxHash}`} target="_blank" rel="noreferrer">
        View source ticket receipt ↗
      </a>
    </section>
  );
}

function PendingPlanetCard({
  row,
  status,
  onRetry,
  retrying,
  onClaim,
  isClaimPending,
  claimError,
}: {
  row: BackendPlanetCollectionRow;
  status: TicketStatus;
  onRetry: () => void;
  retrying: boolean;
  onClaim: () => void;
  isClaimPending: boolean;
  claimError?: Error | null;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-amber-300/60 bg-[var(--surface-raised)] shadow-[0_18px_42px_rgba(245,158,11,0.08)]">
      <div className="grid aspect-square place-items-center border-b border-[var(--border)] bg-[#050610] px-8 text-center">
        <div>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-amber-300/50 text-3xl text-amber-200">✦</div>
          <p className="mt-5 telemetry text-amber-200">PLANET GENERATION PENDING</p>
          <h2 className="mt-2 font-hud text-xl font-bold text-[var(--text-primary)]">The ticket is safe</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Your receipt is saved. The backend will finish this Planet automatically.</p>
        </div>
      </div>
      <div className="space-y-3 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="telemetry text-[var(--text-secondary)]">TICKET #{row.ticket.ticketId}</span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">DRAWING #{row.ticket.drawingId}</span>
        </div>
        <TicketCoordinates ticket={row.ticket} />
        <PlanetTicketAction status={status} onClaim={onClaim} isClaimPending={isClaimPending} claimError={claimError} />
        <Button variant="secondary" size="sm" className="w-full" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying generation…' : 'Retry generation'}
        </Button>
      </div>
    </article>
  );
}

function TicketOnlyCard({
  ticket,
  status,
  onClaim,
  isClaimPending,
  claimError,
}: {
  ticket: Ticket;
  status: TicketStatus;
  onClaim: () => void;
  isClaimPending: boolean;
  claimError?: Error | null;
}) {
  return (
    <article data-testid={`wallet-ticket-card-${ticket.id}`} aria-label={`Ticket #${ticket.user_ticket_id}`} className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[0_18px_40px_rgba(0,0,0,0.16)] transition-[border-color,box-shadow] duration-200 hover:border-violet-300/50 hover:shadow-[0_20px_46px_rgba(124,58,237,0.12)]">
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_0%,rgba(167,139,250,0.2),transparent_42%),linear-gradient(135deg,#0b0b18,#111125)] px-4 pb-5 pt-4 sm:px-5">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="telemetry text-violet-200">TICKET</p>
            <h2 className="mt-1 font-hud text-2xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">#{ticket.user_ticket_id}</h2>
          </div>
          <div className="text-right">
            <p className="telemetry text-[var(--text-secondary)]">DRAWING</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">#{ticket.round_id}</p>
          </div>
        </div>
      </div>
      <div className="relative space-y-3 border-t border-dashed border-[var(--border-strong)] px-4 py-4 sm:px-5">
        <span aria-hidden className="pointer-events-none absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-[var(--surface)]" />
        <span aria-hidden className="pointer-events-none absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-[var(--surface)]" />
        <TicketCoordinates variant="stub" ticket={{ ticketId: ticket.user_ticket_id, drawingId: ticket.round_id, normals: ticket.normals, bonusBall: ticket.bonusball }} />
        <PlanetTicketAction status={status} onClaim={onClaim} isClaimPending={isClaimPending} claimError={claimError} />
      </div>
    </article>
  );
}

function DetailValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-[var(--border)] py-2 last:border-b-0">
      <dt className="telemetry text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function PlanetDetail({
  planet,
  mining,
  onBack,
  ticketStatus,
  round,
  onClaim,
  isClaimPending,
  claimError,
}: {
  planet: BackendPlanet;
  mining?: PlanetMiningSnapshot;
  onBack?: () => void;
  ticketStatus: TicketStatus;
  round?: Round;
  onClaim: () => void;
  isClaimPending: boolean;
  claimError?: Error | null;
}) {
  const winningNumbers = round?.status === 'settled' ? round.winning_numbers : null;
  return (
    <section data-testid="planet-detail-panel" className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
      {onBack ? (
        <div className="px-4 pt-3.5">
          <button type="button" onClick={onBack} className="min-h-10 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            ← Back to collection
          </button>
        </div>
      ) : null}
      <div data-testid="planet-detail-image" className={`relative mx-auto mt-4 aspect-square w-[min(100%-2rem,24rem)] overflow-hidden rounded-xl border-2 bg-[#050610] sm:mt-5 ${rarityClass(planet.rarity)}`}>
        <img
          src={planet.gifUrl}
          alt={`${planet.name} animated GIF`}
          className="h-full w-full object-contain"
          loading="eager"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div data-testid="planet-detail-title">
          <h2 className="font-hud text-2xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">{planet.name}</h2>
        </div>
        <section data-testid="planet-detail-info" aria-label="Planet info" className="space-y-4">
          <section data-testid="planet-detail-mining" aria-label="Mining" className="min-w-0">
            <PlanetMiningMetrics mining={mining} miningAsOf={mining?.activeSince} />
          </section>
          <section data-testid="planet-detail-details" aria-label="Planet details" className="mt-4 border-t border-[var(--border)] pt-4">
            <h3 className="mb-2 font-hud text-sm font-bold text-[var(--text-secondary)]">Details</h3>
            <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              <DetailValue label="Type" value={planet.planetType} />
              <DetailValue label="Terrain" value={planet.terrain} />
              <DetailValue label="Rarity" value={planet.rarity} />
              <DetailValue label="Satellites" value={planet.satelliteCount} />
              <DetailValue label="Ring" value={planet.hasRing ? 'Yes' : 'No'} />
              <DetailValue label="Base rate" value={`${planet.baseMineralsPerDay}/day`} />
            </dl>
          </section>
        </section>
        <TicketBlock
          ticket={planet.ticket}
          winningNumbers={winningNumbers}
          status={ticketStatus}
          onClaim={onClaim}
          isClaimPending={isClaimPending}
          claimError={claimError}
          originTxHash={planet.ticket.originTxHash}
        />
      </div>
    </section>
  );
}

export function Planets({ onNavigate, onViewPlanet, routePlanetId }: PlanetsProps) {
  const { address } = useAccount();
  const planets = useBackendPlanets(address);
  const mining = useWalletMining(address);
  const jackpot = useJackpotState();
  const ticketHistory = useWalletTickets(address, { pageSize: 100, loadAll: true });
  const claim = useClaimWinnings();
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(routePlanetId ?? null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [claimingTicketId, setClaimingTicketId] = useState<string | null>(null);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  const [locallyConfirmedTickets, setLocallyConfirmedTickets] = useState<readonly PurchasedTicket[]>([]);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const siteRows = planets.data ?? [];

  useEffect(() => {
    if (!address) {
      setLocallyConfirmedTickets([]);
      return;
    }
    const sync = () => {
      try {
        const persisted = readPersistedPurchasedTickets(address).tickets;
        setLocallyConfirmedTickets(
          persisted.flatMap((ticket) =>
            ticket.originTxHash !== null && ticket.logIndex !== null
              ? [{
                  ticketId: ticket.ticketId,
                  drawingId: ticket.drawingId,
                  normals: ticket.normals,
                  bonusBall: ticket.bonusBall,
                  originTxHash: ticket.originTxHash,
                  logIndex: ticket.logIndex,
                }]
              : [],
          ),
        );
      } catch {
        setLocallyConfirmedTickets([]);
      }
    };
    sync();
    window.addEventListener(PURCHASED_TICKETS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PURCHASED_TICKETS_UPDATED_EVENT, sync);
  }, [address]);

  const collection = useMemo(
    () => mergeMegasteraCollection(siteRows, ticketHistory.tickets, locallyConfirmedTickets),
    [locallyConfirmedTickets, siteRows, ticketHistory.tickets],
  );
  const generatedRows = useMemo(
    () => siteRows.filter((row): row is BackendPlanetCollectionRow & { planet: BackendPlanet } => row.generationStatus === 'generated' && row.planet !== null),
    [siteRows],
  );
  const miningByPlanetId = useMemo(
    () => new Map((mining.data?.planets ?? []).map((item) => [item.planetId ?? item.tokenId ?? '', item] as const)),
    [mining.data?.planets],
  );
  const ticketsById = useMemo(
    () => new Map(ticketHistory.tickets.map((ticket) => [ticket.user_ticket_id, ticket] as const)),
    [ticketHistory.tickets],
  );
  const selectedPlanetForRound = generatedRows.find((row) => row.planet.planetId === selectedPlanetId)?.planet;
  const selectedRound = useRound(selectedPlanetForRound?.ticket.drawingId, { pollUntilSettled: true });
  const ticketStatusByTicketId = useMemo(
    () => new Map(
      collection.map((item) => {
        const ticket = item.kind === 'site' ? item.site.ticket : {
          ticketId: item.apiTicket.user_ticket_id,
          drawingId: item.apiTicket.round_id,
          normals: item.apiTicket.normals,
          bonusBall: item.apiTicket.bonusball,
        };
        return [ticket.ticketId, deriveTicketStatus({
          ticketId: ticket.ticketId,
          drawingId: ticket.drawingId,
          currentDrawingId: jackpot.drawingId,
          phase: jackpot.phase,
          drawingStateLoading: jackpot.isLoading,
          drawingTime: jackpot.state?.drawingTime,
          nowMs,
          apiTicket: ticketsById.get(ticket.ticketId),
        })] as const;
      }),
    ),
    [collection, jackpot.drawingId, jackpot.isLoading, jackpot.phase, jackpot.state?.drawingTime, nowMs, ticketsById],
  );
  const shouldTickCountdown = jackpot.phase === 'open' && jackpot.drawingId !== undefined && collection.some((item) => {
    const drawingId = item.kind === 'site' ? item.site.ticket.drawingId : item.apiTicket.round_id;
    return BigInt(drawingId) === jackpot.drawingId;
  });

  useEffect(() => {
    if (routePlanetId) {
      setSelectedPlanetId(routePlanetId);
      return;
    }
    setSelectedPlanetId((current) => {
      if (current && generatedRows.some((row) => row.planet.planetId === current)) return current;
      return generatedRows[0]?.planet.planetId ?? null;
    });
  }, [generatedRows, routePlanetId]);

  useEffect(() => {
    if (!shouldTickCountdown) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [shouldTickCountdown]);

  useEffect(() => {
    if (!claim.isSuccess || claimingTicketId === null) return;
    void ticketHistory.refetch();
    setClaimingTicketId(null);
    claim.reset();
  }, [claim.isSuccess, claim.reset, claimingTicketId, ticketHistory.refetch]);

  const handleRefresh = async () => {
    const startedAt = Date.now();
    setManualRefreshing(true);

    try {
      await Promise.all([
        planets.refetch(),
        ticketHistory.refetch(),
        mining.refetch(),
        selectedPlanetForRound ? selectedRound.refetch() : Promise.resolve(),
        jackpot.refetch(),
      ]);

      const remaining = 500 - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
      }
    } finally {
      setManualRefreshing(false);
      setNowMs(Date.now());
    }
  };

  const refreshing = manualRefreshing || planets.isFetching || ticketHistory.isFetching || mining.isFetching || selectedRound.isFetching;

  if (!address) {
    return <EmptyState title="Connect your wallet" description="Your Megastera ticket and Planet inventory will appear here." action={<Button variant="primary" onClick={() => onNavigate('play')}>Explore</Button>} />;
  }
  if (planets.isLoading && !planets.data) {
    return (
      <section aria-live="polite" className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-8 text-center">
        <FadeArc aria-label="Loading My Planets" className="h-10 w-10 text-[var(--success)] [--duration:1.1s]" />
        <h1 className="mt-5 font-hud text-2xl font-bold text-[var(--text-primary)]">Loading My Planets</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Reading the backend registry and the complete Megapot wallet ticket list…</p>
      </section>
    );
  }
  if (collection.length === 0 && (planets.isError || ticketHistory.error)) {
    return <EmptyState title="My Planets temporarily unavailable" description="The site registry or Megapot ticket history could not be reached. Try again shortly." action={<Button variant="secondary" onClick={() => void handleRefresh()}>Refresh</Button>} role="alert" />;
  }
  if (!collection.length) return <EmptyState title="No tickets yet" description="Buy a Megapot ticket through Megastera and its Planet will appear here after generation." action={<Button variant="primary" onClick={() => onNavigate('play')}>Explore</Button>} />;

  const selected = generatedRows.find((row) => row.planet.planetId === selectedPlanetId)?.planet;
  if (routePlanetId && !selected) {
    return <EmptyState title="Planet not found" description="This Planet is not in the connected wallet collection." action={<Button variant="secondary" onClick={() => onNavigate('planets')}>Back to My Planets</Button>} />;
  }

  const claimTicket = (ticketId: string) => {
    claim.reset();
    setClaimingTicketId(ticketId);
    void claim.claim([BigInt(ticketId)]);
  };
  const retryGeneration = async (row: BackendPlanetCollectionRow, key: string) => {
    if (!address) return;
    setRetryingKey(key);
    setGenerationError(null);
    try {
      await requestBackendPlanetGeneration({
        transactionHash: row.ticket.originTxHash,
        logIndex: BigInt(row.ticket.logIndex),
        recipient: address,
      });
      await planets.refetch();
      await mining.refetch();
    } catch (error) {
      setGenerationError(error instanceof Error ? error : new Error('Planet generation failed.'));
    } finally {
      setRetryingKey(null);
    }
  };
  const selectPlanet = (planetId: string) => {
    setSelectedPlanetId(planetId);
    onViewPlanet(planetId);
  };
  const clearRoute = () => onNavigate('planets');
  const selectedTicketStatus = selected ? ticketStatusByTicketId.get(selected.ticket.ticketId) ?? UNAVAILABLE_TICKET_STATUS : UNAVAILABLE_TICKET_STATUS;
  const detail = selected ? (
    <PlanetDetail
      planet={selected}
      mining={miningByPlanetId.get(selected.planetId)}
      onBack={routePlanetId ? clearRoute : undefined}
      round={selectedRound.data}
      ticketStatus={selectedTicketStatus}
      onClaim={() => claimTicket(selected.ticket.ticketId)}
      isClaimPending={selected.ticket.ticketId === claimingTicketId && claim.isPending}
      claimError={selected.ticket.ticketId === claimingTicketId ? claim.error : null}
    />
  ) : null;
  const totalRate = mining.data?.effectiveMineralsPerDayMicros ? `${formatMinerals(BigInt(mining.data.effectiveMineralsPerDayMicros))}/day` : '—';
  const totalMined = mining.data?.earnedMicros ? formatMinerals(BigInt(mining.data.earnedMicros)) : '—';
  const generatedCount = generatedRows.length;

  return (
    <section className="mx-auto space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="font-hud text-3xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-4xl">My Planets</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? 'Refreshing My Planets' : 'Refresh'}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Refreshing…
              </span>
            ) : 'Refresh'}
          </Button>
        </div>
      </header>

      <CollectionSummary planetCount={generatedCount} ticketCount={collection.length} miningRate={totalRate} mined={totalMined} />

      {planets.isError ? <div role="status" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">The Megastera site registry is temporarily unavailable. Wallet tickets remain visible; refresh to retry Planet rows.</div> : null}
      {ticketHistory.error ? <div role="status" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">Megapot ticket statuses are temporarily unavailable. Site Planet rows remain visible.</div> : null}
      {generationError ? <div role="alert" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{generationError.message}</div> : null}
      {mining.isError ? <div role="status" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">Mining is temporarily unavailable. Planet details remain available.</div> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
        <section aria-label="Planet and ticket collection">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {collection.map((item: MegasteraCollectionItem) => {
              if (item.kind === 'ticket-only') {
                const ticketId = item.apiTicket.user_ticket_id;
                return <TicketOnlyCard key={item.key} ticket={item.apiTicket} status={ticketStatusByTicketId.get(ticketId) ?? UNAVAILABLE_TICKET_STATUS} onClaim={() => claimTicket(ticketId)} isClaimPending={ticketId === claimingTicketId && claim.isPending} claimError={ticketId === claimingTicketId ? claim.error : null} />;
              }
              const ticketId = item.site.ticket.ticketId;
              const status = ticketStatusByTicketId.get(ticketId) ?? UNAVAILABLE_TICKET_STATUS;
              if (!item.site.planet) {
                return <PendingPlanetCard key={item.key} row={item.site} status={status} onRetry={() => void retryGeneration(item.site, item.key)} retrying={retryingKey === item.key} onClaim={() => claimTicket(ticketId)} isClaimPending={ticketId === claimingTicketId && claim.isPending} claimError={ticketId === claimingTicketId ? claim.error : null} />;
              }
              const planet = item.site.planet;
              return <BackendPlanetCard key={item.key} planet={planet} mining={miningByPlanetId.get(planet.planetId)} selected={planet.planetId === selected?.planetId} onSelect={() => selectPlanet(planet.planetId)} />;
            })}
          </div>
        </section>
        <aside aria-label="Selected planet detail" className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
          {detail}
        </aside>
      </div>

      <div className="lg:hidden">
        {routePlanetId ? detail : null}
      </div>
    </section>
  );
}

function EmptyState({ title, description, action, role }: { title: string; description: string; action?: import('react').ReactNode; role?: 'status' | 'alert' }) {
  return (
    <section role={role} className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-8 text-center">
      <h1 className="font-hud text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
