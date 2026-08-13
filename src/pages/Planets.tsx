import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { PlanetMiningOverlay } from '@/components/planets/PlanetMiningOverlay';
import { useBackendPlanets } from '@/hooks/useBackendPlanets';
import { useWalletMining } from '@/hooks/useWalletMining';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import type { BackendPlanet } from '@/lib/backendApi';

type PlanetsProps = {
  onNavigate: (key: 'play' | 'planets' | 'tickets' | 'history' | 'lab') => void;
  onViewPlanet: (planetId: string) => void;
  routePlanetId?: string;
};

function BackendPlanetCard({
  planet,
  mining,
  onSelect,
}: {
  planet: BackendPlanet;
  mining?: PlanetMiningSnapshot;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-raised)] text-left shadow-[0_18px_42px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 hover:border-[var(--rare)]"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--surface)]">
        <img src={planet.gifUrl} alt={`${planet.name} animated planet`} className="h-full w-full object-cover" loading="lazy" />
        <PlanetMiningOverlay mining={mining} miningAsOf={mining?.activeSince} />
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="telemetry text-[var(--text-secondary)]">{planet.planetType}</p>
            <h2 className="truncate font-hud text-xl font-bold text-[var(--text-primary)]">{planet.name}</h2>
          </div>
          <span className="shrink-0 font-mono text-xs text-[var(--text-secondary)]">#{planet.ticketId}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>{planet.rarity}</span>
          <span>{planet.baseMineralsPerDay} minerals/day</span>
        </div>
      </div>
    </button>
  );
}

function PlanetDetail({
  planet,
  mining,
  onBack,
}: {
  planet: BackendPlanet;
  mining?: PlanetMiningSnapshot;
  onBack: () => void;
}) {
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <button type="button" onClick={onBack} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Back to My Planets</button>
      <div className="overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-raised)]">
        <div className="relative aspect-square max-h-[58vh] overflow-hidden bg-[var(--surface)]">
          <img src={planet.gifUrl} alt={`${planet.name} animated planet`} className="h-full w-full object-contain" />
          <PlanetMiningOverlay mining={mining} miningAsOf={mining?.activeSince} />
        </div>
        <div className="space-y-5 p-5">
          <div>
            <p className="telemetry text-[var(--text-secondary)]">{planet.planetType}</p>
            <h1 className="mt-1 font-hud text-3xl font-bold text-[var(--text-primary)]">{planet.name}</h1>
            <p className="mt-2 font-mono text-xs text-[var(--text-secondary)]">Ticket #{planet.ticketId} · Drawing #{planet.ticket.drawingId}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-3">
            <div><dt className="text-[var(--text-secondary)]">Type</dt><dd className="font-semibold text-[var(--text-primary)]">{planet.planetType}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Terrain</dt><dd className="font-semibold text-[var(--text-primary)]">{planet.terrain}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Rarity</dt><dd className="font-semibold text-[var(--text-primary)]">{planet.rarity}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Satellites</dt><dd className="font-semibold text-[var(--text-primary)]">{planet.satelliteCount}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Ring</dt><dd className="font-semibold text-[var(--text-primary)]">{planet.hasRing ? 'Yes' : 'No'}</dd></div>
            <div><dt className="text-[var(--text-secondary)]">Mining rate</dt><dd className="font-semibold text-[var(--text-primary)]">{planet.baseMineralsPerDay}/day</dd></div>
          </dl>
          <a className="block text-sm text-[var(--rare)] underline" href={`https://sepolia.basescan.org/tx/${planet.ticket.originTxHash}`} target="_blank" rel="noreferrer">
            View source ticket receipt
          </a>
        </div>
      </div>
    </section>
  );
}

export function Planets({ onNavigate, onViewPlanet, routePlanetId }: PlanetsProps) {
  const { address } = useAccount();
  const planets = useBackendPlanets(address);
  const mining = useWalletMining(address);
  const miningByPlanetId = useMemo(
    () => new Map((mining.data?.planets ?? []).map((item) => [item.planetId ?? item.tokenId ?? '', item] as const)),
    [mining.data?.planets],
  );

  if (!address) {
    return <EmptyState title="Connect your wallet" description="Your backend Planet inventory will appear here." action={<Button variant="primary" onClick={() => onNavigate('play')}>Explore</Button>} />;
  }
  if (planets.isLoading) return <EmptyState title="Loading My Planets" description="Fetching your backend-generated planets…" />;
  if (planets.isError) return <EmptyState title="My Planets unavailable" description={planets.error.message} action={<Button variant="secondary" onClick={() => void planets.refetch()}>Retry</Button>} />;
  if (!planets.data?.length) return <EmptyState title="No planets yet" description="Buy a Megapot ticket to generate your first backend Planet." action={<Button variant="primary" onClick={() => onNavigate('play')}>Explore</Button>} />;

  const selected = routePlanetId ? planets.data.find((planet) => planet.planetId === routePlanetId) : undefined;
  if (routePlanetId && selected) {
    return <PlanetDetail planet={selected} mining={miningByPlanetId.get(selected.planetId)} onBack={() => onNavigate('planets')} />;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="telemetry text-[var(--success)]">BACKEND COLLECTION</p>
          <h1 className="mt-1 font-hud text-3xl font-bold text-[var(--text-primary)]">My Planets</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Generated from confirmed Megapot receipts. Mining stays active off-chain.</p>
        </div>
        <Button variant="secondary" onClick={() => void planets.refetch()}>Refresh</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planets.data.map((planet) => (
          <BackendPlanetCard key={planet.planetId} planet={planet} mining={miningByPlanetId.get(planet.planetId)} onSelect={() => onViewPlanet(planet.planetId)} />
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: import('react').ReactNode }) {
  return (
    <section className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] p-8 text-center">
      <h1 className="font-hud text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
