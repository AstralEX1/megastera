import type { CSSProperties } from 'react';
import mineIcon from '@/assets/mine-icon.png';
import mineralIcon from '@/assets/mineral-icon.png';
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

function MaskIcon({ src, label, className }: { src: string; label: string; className: string }) {
  const style = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  } as CSSProperties;
  return <span role="img" aria-label={label} className={`${className} shrink-0 bg-white`} style={style} />;
}

type MetricsSize = 'default' | 'compact' | 'card';

function MetricsContent({ mining, miningAsOf, size }: PlanetMiningMetricsProps & { size: MetricsSize }) {
  if (!mining || !miningAsOf) {
    return <span className="telemetry text-[var(--text-secondary)]">Mining unavailable</span>;
  }

  const boosted = mining.collectionBonusBps > 0;
  const effectiveRateClass = boosted ? 'text-[var(--rare)]' : 'text-[var(--text-primary)]';
  const bonusClass = boosted ? 'text-[var(--rare)]' : 'text-[var(--text-secondary)]';
  const iconSize = size === 'default' ? 'h-7 w-7' : size === 'compact' ? 'h-4 w-4' : 'h-5 w-5';
  const cellSpacing = size === 'compact' ? 'gap-1.5 p-2' : 'gap-2 p-3';
  const valueSize = size === 'default' ? 'text-lg' : size === 'compact' ? 'text-sm leading-none' : 'text-sm';

  return (
    <>
      <div className={`flex min-w-0 items-center border-r border-[var(--border)] ${cellSpacing}`}>
        <img src={mineralIcon} alt="Minerals" className={`${iconSize} shrink-0 object-contain invert`} />
        <span className="flex min-w-0 items-baseline whitespace-nowrap">
          <strong className={`font-hud tabular-nums whitespace-nowrap ${valueSize} ${effectiveRateClass}`}>
            {formatMinerals(BigInt(mining.effectiveMineralsPerDayMicros))}
          </strong>
        </span>
      </div>
      <div className={`flex min-w-0 items-center ${cellSpacing}`}>
        <MaskIcon src={mineIcon} label="Mined" className={iconSize} />
        <span className="flex min-w-0 items-baseline whitespace-nowrap">
          <LiveMineralAmount
            snapshotMicros={mining.earnedMicros}
            effectiveMineralsPerDayMicros={mining.effectiveMineralsPerDayMicros}
            asOf={miningAsOf}
            className={`font-hud tabular-nums whitespace-nowrap text-[var(--text-primary)] ${valueSize}`}
          />
        </span>
      </div>
      <section aria-label={boosted ? 'Boosted by same type collection bonus' : 'No same type collection bonus'} className={`flex min-w-0 items-center justify-center border-l border-[var(--border)] ${size === 'compact' ? 'p-2' : 'p-3'}`}>
        <strong className={`font-hud tabular-nums ${valueSize} ${bonusClass}`}>
          {formatCollectionBonus(mining.collectionBonusBps)}
        </strong>
      </section>
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
