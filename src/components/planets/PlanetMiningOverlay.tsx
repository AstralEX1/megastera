import { useId, type ReactNode } from 'react';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { formatMinerals } from '@/lib/minerals';

type PlanetMiningOverlayProps = {
  mining?: PlanetMiningSnapshot;
  variant?: 'default' | 'compact';
};

type PlanetMiningMetricsProps = {
  mining?: PlanetMiningSnapshot;
};

function formatCollectionBonus(bps: number): string {
  return `+${bps / 100}%`;
}

const METRIC_TOOLTIPS = {
  rate: 'Minerals per day including boost',
  boost: 'Bonus from matching planet types',
} as const;

function MetricTooltip({
  children,
  description,
  id,
  className,
}: {
  children: ReactNode;
  description: string;
  id: string;
  className: string;
}) {
  return (
    <div
      aria-describedby={id}
      className={`group/metric relative min-w-0 ${className}`}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3.5 h-[22px] -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-[rgba(97,97,97,0.9)] px-2 text-center font-sans text-[10px] font-medium leading-[22px] text-white opacity-0 shadow-[0_2px_4px_rgba(0,0,0,0.24)] transition-opacity duration-150 ease-out group-hover/metric:opacity-100"
      >
        {description}
      </span>
    </div>
  );
}

type MetricsSize = 'default' | 'compact' | 'card';

function MetricsContent({ mining, size }: PlanetMiningMetricsProps & { size: MetricsSize }) {
  const tooltipId = useId();
  if (!mining) {
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
      <MetricTooltip description={METRIC_TOOLTIPS.rate} id={`${tooltipId}-rate`} className={`text-center ${cellSpacing}`}>
        <p className={labelClass}>RATE</p>
        <strong className={`mt-1 block font-hud tabular-nums whitespace-nowrap ${valueSize} ${effectiveRateClass}`}>
          {formatMinerals(BigInt(mining.effectiveMineralsPerDayMicros))}
        </strong>
      </MetricTooltip>
      <MetricTooltip description={METRIC_TOOLTIPS.boost} id={`${tooltipId}-boost`} className={`text-center ${cellSpacing}`}>
        <p className={labelClass}>BOOST</p>
        <strong className={`mt-1 block font-hud tabular-nums whitespace-nowrap ${valueSize} ${bonusClass}`}>
          {formatCollectionBonus(mining.collectionBonusBps)}
        </strong>
      </MetricTooltip>
    </>
  );
}

export function PlanetMiningMetrics({ mining }: PlanetMiningMetricsProps) {
  return (
    <div data-testid="planet-mining-metrics" className="grid min-w-0 grid-cols-2 overflow-visible rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {mining ? <MetricsContent mining={mining} size="card" /> : <span className="col-span-2 p-3 text-center telemetry text-[var(--text-secondary)]">Mining unavailable</span>}
    </div>
  );
}

export function PlanetMiningOverlay({ mining, variant = 'default' }: PlanetMiningOverlayProps) {
  const compact = variant === 'compact';
  if (!mining) {
    return (
      <div data-testid="planet-mining-overlay" className={`absolute rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 text-center backdrop-blur-md ${compact ? 'inset-x-2 bottom-2 p-2' : 'inset-x-3 bottom-3 p-3'}`}>
        <span className="telemetry text-[var(--text-secondary)]">Mining unavailable</span>
      </div>
    );
  }

  return (
    <div data-testid="planet-mining-overlay" className={`absolute grid grid-cols-2 overflow-visible rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 backdrop-blur-md ${compact ? 'inset-x-2 bottom-2' : 'inset-x-3 bottom-3'}`}>
      <MetricsContent mining={mining} size={compact ? 'compact' : 'default'} />
    </div>
  );
}
