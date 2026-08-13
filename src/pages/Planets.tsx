import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { FadeArc } from '@/components/common/FadeArc';
import { BackendPlanetPreview } from '@/components/planets/BackendPlanetPreview';
import { PlanetMiningOverlay } from '@/components/planets/PlanetMiningOverlay';
import { PlanetTicketAction } from '@/components/planets/PlanetTicketAction';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import { useBackendPlanets } from '@/hooks/useBackendPlanets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { useWalletMining } from '@/hooks/useWalletMining';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { useWalletTickets } from '@/hooks/useWalletTickets';
import { requestBackendPlanetGeneration, type BackendPlanet, type BackendPlanetCollectionRow } from '@/lib/backendApi';
import { mergeMegasteraCollection, type MegasteraCollectionItem } from '@/lib/megasteraCollection';
import type { Ticket } from '@/lib/api';
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
  Uncommon: 'border-emerald-400/80 shadow-[0_18px_42px_rgba(16,185,129,0.12)]',
  Epic: 'border-violet-400/80 shadow-[0_18px_42px_rgba(167,139,250,0.16)]',
  Legendary: 'border-amber-300/90 shadow-[0_18px_42px_rgba(252,211,77,0.16)]',
};

const UNAVAILABLE_TICKET_STATUS: TicketStatus = { kind: 'unavailable' };

function rarityClass(rarity: string) {
  return RARITY_CLASSES[rarity] ?? 'border-[var(--border-strong)] shadow-[0_18px_42px_rgba(0,0,0,0.45)]';
}

function BackendPlanetCard({
  planet,
  mining,
  selected,
  onSelect,
  ticketStatus,
  onClaim,
  isClaimPending,
  claimError,
}: {
  planet: BackendPlanet;
  mining?: PlanetMiningSnapshot;
  selected: boolean;
  onSelect: () => void;
  ticketStatus: TicketStatus;
  onClaim: () => void;
  isClaimPending: boolean;
  claimError?: Error | null;
}) {
  return (
    <article
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
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
            <span className="rounded-full border border-white/15 bg-[#080914]/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/75 backdrop-blur-sm">
              {planet.planetType}
            </span>
            <span className="rounded-full border border-white/15 bg-[#080914]/80 px-2 py-1 font-mono text-[10px] text-white/65 backdrop-blur-sm">
              #{planet.ticketId}
            </span>
          </div>
          <PlanetMiningOverlay mining={mining} miningAsOf={mining?.activeSince} variant="compact" />
        </div>
        <div className="space-y-3 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="telemetry text-[var(--text-secondary)]">{planet.rarity} planet</p>
              <h2 className="mt-1 truncate font-hud text-lg font-bold tracking-[-0.03em] text-[var(--text-primary)]">{planet.name}</h2>
            </div>
            <span className="mt-1 shrink-0 font-mono text-[10px] text-[var(--text-secondary)]">VIEW ↗</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2.5 text-[11px] text-[var(--text-secondary)]">
            <span className="font-mono">DRAWING #{planet.ticket.drawingId}</span>
            <span className="font-semibold text-[var(--text-primary)]">{planet.baseMineralsPerDay}/day</span>
          </div>
        </div>
      </button>
      <div className="border-t border-[var(--border)] p-3">
        <PlanetTicketAction
          status={ticketStatus}
          onClaim={onClaim}
          isClaimPending={isClaimPending}
          claimError={claimError}
        />
      </div>
    </article>
  );
}

type TicketCoordinatesValue = Pick<BackendPlanet['ticket'], 'ticketId' | 'drawingId' | 'normals' | 'bonusBall'>;

function TicketCoordinates({ ticket }: { ticket: TicketCoordinatesValue }) {
  return (
    <section aria-label="Ticket coordinates" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="telemetry text-[var(--text-secondary)]">Ticket coordinates</p>
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">DRAWING #{ticket.drawingId}</span>
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
    <article className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)]">
      <div className="grid aspect-square place-items-center border-b border-[var(--border)] bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.16),transparent_62%),#050610] px-8 text-center">
        <div>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-violet-300/40 text-2xl text-violet-200">TKT</div>
          <p className="mt-5 telemetry text-violet-200">MEGAPOT TICKET</p>
          <h2 className="mt-2 font-hud text-xl font-bold text-[var(--text-primary)]">No Megastera planet attached</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">This wallet ticket was not purchased through the Megastera site.</p>
        </div>
      </div>
      <div className="space-y-3 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="telemetry text-[var(--text-secondary)]">TICKET #{ticket.user_ticket_id}</span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">DRAWING #{ticket.round_id}</span>
        </div>
        <TicketCoordinates ticket={{ ticketId: ticket.user_ticket_id, drawingId: ticket.round_id, normals: ticket.normals, bonusBall: ticket.bonusball }} />
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
  onClaim,
  isClaimPending,
  claimError,
}: {
  planet: BackendPlanet;
  mining?: PlanetMiningSnapshot;
  onBack?: () => void;
  ticketStatus: TicketStatus;
  onClaim: () => void;
  isClaimPending: boolean;
  claimError?: Error | null;
}) {
  const generatedAt = new Date(planet.generatedAt);
  return (
    <section data-testid="planet-detail-panel" className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[0_22px_60px_rgba(0,0,0,0.42)]">
      <div className="border-b border-[var(--border)] px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          {onBack ? (
            <button type="button" onClick={onBack} className="min-h-10 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              ← Back to collection
            </button>
          ) : <span className="telemetry text-[var(--success)]">SELECTED PLANET</span>}
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">#{planet.ticketId}</span>
        </div>
      </div>
      <div className="relative mx-auto mt-4 aspect-square w-[min(100%-2rem,24rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-[#050610] sm:mt-5">
        <img
          src={planet.gifUrl}
          alt={`${planet.name} animated GIF`}
          className="h-full w-full object-contain"
          loading="eager"
          style={{ imageRendering: 'pixelated' }}
        />
        <PlanetMiningOverlay mining={mining} miningAsOf={mining?.activeSince} />
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="telemetry text-[var(--text-secondary)]">{planet.planetType} · {planet.rarity}</p>
          <h2 className="mt-1 font-hud text-2xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">{planet.name}</h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">Backend Planet · generated {Number.isNaN(generatedAt.getTime()) ? 'recently' : generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <TicketCoordinates ticket={planet.ticket} />
        <PlanetTicketAction
          status={ticketStatus}
          onClaim={onClaim}
          isClaimPending={isClaimPending}
          claimError={claimError}
        />
        <section aria-label="Planet details">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-hud text-base font-bold text-[var(--text-primary)]">Details</h3>
            <span className="telemetry text-[var(--success)]">MINING ACTIVE</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 sm:grid-cols-3">
            <DetailValue label="Type" value={planet.planetType} />
            <DetailValue label="Terrain" value={planet.terrain} />
            <DetailValue label="Rarity" value={planet.rarity} />
            <DetailValue label="Satellites" value={planet.satelliteCount} />
            <DetailValue label="Ring" value={planet.hasRing ? 'Yes' : 'No'} />
            <DetailValue label="Base rate" value={`${planet.baseMineralsPerDay}/day`} />
          </dl>
        </section>
        <a className="block rounded-xl border border-[var(--border)] px-3 py-2.5 text-center text-sm text-[var(--rare)] transition-colors hover:bg-[var(--surface-hover)]" href={`https://sepolia.basescan.org/tx/${planet.ticket.originTxHash}`} target="_blank" rel="noreferrer">
          View source ticket receipt ↗
        </a>
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
          drawingTime: jackpot.state?.drawingTime,
          nowMs,
          apiTicket: ticketsById.get(ticket.ticketId),
        })] as const;
      }),
    ),
    [collection, jackpot.drawingId, jackpot.phase, jackpot.state?.drawingTime, nowMs, ticketsById],
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
    return <EmptyState title="My Planets temporarily unavailable" description="The site registry or Megapot ticket history could not be reached. Try again shortly." action={<Button variant="secondary" onClick={() => { void planets.refetch(); void ticketHistory.refetch(); }}>Refresh</Button>} role="alert" />;
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
      ticketStatus={selectedTicketStatus}
      onClaim={() => claimTicket(selected.ticket.ticketId)}
      isClaimPending={selected.ticket.ticketId === claimingTicketId && claim.isPending}
      claimError={selected.ticket.ticketId === claimingTicketId ? claim.error : null}
    />
  ) : null;
  const totalRate = mining.data?.effectiveMineralsPerDayMicros ? formatMinerals(BigInt(mining.data.effectiveMineralsPerDayMicros)) : '—';
  const generatedCount = generatedRows.length;
  const pendingCount = collection.filter((item) => item.kind === 'site' && item.site.generationStatus === 'pending').length;
  const ticketOnlyCount = collection.filter((item) => item.kind === 'ticket-only').length;

  return (
    <section className="mx-auto space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <p className="telemetry text-[var(--success)]">MY INVENTORY · {generatedCount} PLANETS · {pendingCount} PENDING · {ticketOnlyCount} TICKETS</p>
          <h1 className="mt-1 font-hud text-3xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-4xl">My Planets</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">Every Megastera purchase remains visible as a Planet or a retryable pending card. Other wallet tickets stay visible as tickets.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden border-l border-[var(--border)] pl-4 sm:block">
            <p className="telemetry text-[var(--text-secondary)]">LIVE RATE</p>
            <p className="mt-1 font-hud text-lg font-bold text-[var(--text-primary)]">{totalRate}<span className="ml-1 text-xs font-normal text-[var(--text-secondary)]">/day</span></p>
          </div>
          <Button variant="secondary" onClick={() => { void planets.refetch(); void ticketHistory.refetch(); }}>Refresh</Button>
        </div>
      </header>

      {planets.isError ? <div role="status" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">The Megastera site registry is temporarily unavailable. Wallet tickets remain visible; refresh to retry Planet rows.</div> : null}
      {ticketHistory.error ? <div role="status" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">Megapot ticket statuses are temporarily unavailable. Site Planet rows remain visible.</div> : null}
      {generationError ? <div role="alert" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{generationError.message}</div> : null}
      {mining.isError ? <div role="status" className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">Mining is temporarily unavailable. Planet details remain available.</div> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
        <section aria-label="Planet and ticket collection">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="telemetry text-[var(--text-secondary)]">COLLECTION / {collection.length.toString().padStart(2, '0')}</p>
            <p className="hidden text-xs text-[var(--text-secondary)] sm:block">Planet rows update automatically</p>
          </div>
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
              return <BackendPlanetCard key={item.key} planet={planet} mining={miningByPlanetId.get(planet.planetId)} selected={planet.planetId === selected?.planetId} onSelect={() => selectPlanet(planet.planetId)} ticketStatus={status} onClaim={() => claimTicket(ticketId)} isClaimPending={ticketId === claimingTicketId && claim.isPending} claimError={ticketId === claimingTicketId ? claim.error : null} />;
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
