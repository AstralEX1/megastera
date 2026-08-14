import { useId, type ReactNode } from 'react';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { formatMinerals } from '@/lib/minerals';
import { LiveMineralAmount } from './LiveMineralAmount';

type PlanetMiningOverlayProps = {
  mining?: PlanetMiningSnapshot;
  miningAsOf?: string;
  variant?: 'default' | 'compact';
};

type PlanetMiningMetricsProps = {
  mining?: PlanetMiningSnapshot;
  miningAsOf?: string;
};

function formatCollectionBonus(bps: number): string {
  return `+${bps / 100}%`;
}

const METRIC_TOOLTIPS = {
  rate: 'Minerals per day including boost',
  boost: 'Bonus from matching planet types',
  mined: 'Total minerals collected',
} as const;

function MetricTooltip({
  children,
  description,
  id,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  description: string;
  id: string;
  className: string;
  ariaLabel?: string;
}) {
  return (
    <div
      aria-describedby={id}
      aria-label={ariaLabel}
      tabIndex={0}
      className={`group relative min-w-0 outline-none focus-visible:ring-1 focus-visible:ring-[var(--rare)] ${className}`}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3.5 h-[22px] -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-[rgba(97,97,97,0.9)] px-2 text-center font-sans text-[10px] font-medium leading-[22px] text-white opacity-0 shadow-[0_2px_4px_rgba(0,0,0,0.24)] transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {description}
      </span>
    </div>
  );
}

type MetricsSize = 'default' | 'compact' | 'card';

function MetricsContent({ mining, miningAsOf, size }: PlanetMiningMetricsProps & { size: MetricsSize }) {
  const tooltipId = useId();
  if (!mining || !miningAsOf) {
    return <span className="telemetry text-[var(--text-secondary)]">Mining unavailable</span>;
  }

  const boosted = mining.collectionBonusBps > 0;
  const effectiveRateClass = boosted ? 'text-[var(--rare)]' : 'text-[var(--text-primary)]';
  const bonusClass = boosted ? 'text-[var(--rare)]' : 'text-[var(--text-secondary)]';
  const cellSpacing = size === 'compact' ? 'p-2' : 'p-3';
  const valueSize = size === 'default' ? 'text-lg' : size === 'compact' ? 'text-sm leading-none' : 'text-sm';
  const labelSize = size === 'default' ? 'text-[10px]' : 'text-[9px]';
  const labelClass = `telemetry truncate ${labelSize} text-[var(--text-secondary)]`;

  return (
    <>
      <div title={METRIC_TOOLTIPS.rate} className={`min-w-0 text-center ${cellSpacing}`}>
        <p className={labelClass}>RATE</p>
        <strong className={`mt-1 block font-hud tabular-nums whitespace-nowrap ${valueSize} ${effectiveRateClass}`}>
          {formatMinerals(BigInt(mining.effectiveMineralsPerDayMicros))}
        </strong>
      </div>
      <section title={METRIC_TOOLTIPS.boost} aria-label={boosted ? 'Boosted by same type collection bonus' : 'No same type collection bonus'} className={`min-w-0 text-center ${cellSpacing}`}>
        <p className={labelClass}>BOOST</p>
        <strong className={`mt-1 block font-hud tabular-nums whitespace-nowrap ${valueSize} ${bonusClass}`}>
          {formatCollectionBonus(mining.collectionBonusBps)}
        </strong>
      </section>
      <div title={METRIC_TOOLTIPS.mined} className={`min-w-0 border-l border-[var(--border)] text-center ${cellSpacing}`}>
        <p className={labelClass}>MINED</p>
        <LiveMineralAmount
          snapshotMicros={mining.earnedMicros}
          effectiveMineralsPerDayMicros={mining.effectiveMineralsPerDayMicros}
          asOf={miningAsOf}
          className={`mt-1 block font-hud tabular-nums whitespace-nowrap text-[var(--text-primary)] ${valueSize}`}
        />
      </div>
    </>
  );
}

export function PlanetMiningMetrics({ mining, miningAsOf }: PlanetMiningMetricsProps) {
  return (
    <div data-testid="planet-mining-metrics" className="grid min-w-0 grid-cols-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {mining && miningAsOf ? <MetricsContent mining={mining} miningAsOf={miningAsOf} size="card" /> : <span className="col-span-3 p-3 text-center telemetry text-[var(--text-secondary)]">Mining unavailable</span>}
    </div>
  );
}

export function PlanetMiningOverlay({ mining, miningAsOf, variant = 'default' }: PlanetMiningOverlayProps) {
  const compact = variant === 'compact';
  if (!mining || !miningAsOf) {
    return (
      <div data-testid="planet-mining-overlay" className={`absolute rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 text-center backdrop-blur-md ${compact ? 'inset-x-2 bottom-2 p-2' : 'inset-x-3 bottom-3 p-3'}`}>
        <span className="telemetry text-[var(--text-secondary)]">Mining unavailable</span>
      </div>
    );
  }

  return (
    <div data-testid="planet-mining-overlay" className={`absolute grid grid-cols-3 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 backdrop-blur-md ${compact ? 'inset-x-2 bottom-2' : 'inset-x-3 bottom-3'}`}>
      <MetricsContent mining={mining} miningAsOf={miningAsOf} size={compact ? 'compact' : 'default'} />
    </div>
  );
}
