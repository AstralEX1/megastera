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
  return <span role="img" aria-label={label} className={`${className} shrink-0 bg-[var(--rare)]`} style={style} />;
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

  const boosted = mining.collectionBonusBps > 0;
  const effectiveRateClass = boosted ? 'text-[var(--rare)]' : 'text-[var(--text-primary)]';
  const bonusClass = boosted ? 'text-[var(--rare)]' : 'text-[var(--text-secondary)]';

  return (
    <div data-testid="planet-mining-overlay" className={`absolute grid grid-cols-3 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 backdrop-blur-md ${compact ? 'inset-x-2 bottom-2' : 'inset-x-3 bottom-3'}`}>
      <div className={`flex min-w-0 items-center border-r border-[var(--border)] ${compact ? 'gap-1.5 p-2' : 'gap-2 p-3'}`}>
        <img src={mineralIcon} alt="Minerals" className={`${compact ? 'h-4 w-4' : 'h-7 w-7'} shrink-0 object-contain invert`} />
        <span className="flex min-w-0 items-baseline">
          <strong className={`font-hud ${compact ? 'text-sm leading-none' : 'text-lg'} ${effectiveRateClass}`}>
            {formatMinerals(BigInt(mining.effectiveMineralsPerDayMicros))}
          </strong>
          <span className="ml-0.5 text-xs text-[var(--text-secondary)]">/day</span>
        </span>
      </div>
      <div className={`flex min-w-0 items-center ${compact ? 'gap-1.5 p-2' : 'gap-2 p-3'}`}>
        <MaskIcon src={mineIcon} label="Mined" className={compact ? 'h-4 w-4' : 'h-7 w-7'} />
        <span className="flex min-w-0 items-baseline">
          <LiveMineralAmount
            snapshotMicros={mining.earnedMicros}
            effectiveMineralsPerDayMicros={mining.effectiveMineralsPerDayMicros}
            asOf={miningAsOf}
            className={`font-hud text-[var(--text-primary)] ${compact ? 'text-sm leading-none' : 'text-lg'}`}
          />
          <span className="ml-1 text-xs text-[var(--text-secondary)]">mined</span>
        </span>
      </div>
      <section aria-label={boosted ? 'Boosted by same type collection bonus' : 'No same type collection bonus'} className={`flex min-w-0 items-center justify-center border-l border-[var(--border)] ${compact ? 'p-2' : 'p-3'}`}>
        <strong className={`font-hud ${compact ? 'text-sm leading-none' : 'text-lg'} ${bonusClass}`}>
          {formatCollectionBonus(mining.collectionBonusBps)}
        </strong>
      </section>
    </div>
  );
}
