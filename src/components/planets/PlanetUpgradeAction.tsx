import { Button } from '@/components/common/Button';
import type { PlanetUpgradeSnapshot } from '@/hooks/useWalletMining';
import { formatMinerals } from '@/lib/minerals';

type PlanetUpgradeActionProps = {
  upgradesEnabled: boolean;
  upgradeLevel: number;
  nextUpgrade: PlanetUpgradeSnapshot | null;
  currentBalanceMicros: string;
  isPending: boolean;
  error?: Error | null;
  onUpgrade: (targetLevel: number) => void;
};

export function PlanetUpgradeAction({
  upgradesEnabled,
  upgradeLevel,
  nextUpgrade,
  currentBalanceMicros,
  isPending,
  error,
  onUpgrade,
}: PlanetUpgradeActionProps) {
  const balanceMicros = BigInt(currentBalanceMicros);

  return (
    <section data-testid="planet-upgrade" aria-label="Planet upgrade" className="border-t border-[var(--border)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-hud text-sm font-bold text-[var(--text-secondary)]">Upgrades</h3>
        <span className="font-mono text-xs text-[var(--text-primary)]">Level L{upgradeLevel}</span>
      </div>
      {!upgradesEnabled ? (
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Upgrades are disabled.</p>
      ) : nextUpgrade === null ? (
        <p className="mt-2 text-xs leading-5 text-[var(--success)]">Maximum level reached.</p>
      ) : (() => {
        const insufficientBalance = balanceMicros < BigInt(nextUpgrade.costMicros);
        const disabled = isPending || insufficientBalance;
        return (
          <>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-[var(--text-secondary)]">Next upgrade: L{nextUpgrade.targetLevel}</span>
              <span className="font-mono tabular-nums text-[var(--text-primary)]">{formatMinerals(BigInt(nextUpgrade.costMicros))} minerals</span>
            </div>
            {error ? <p role="alert" className="mt-2 text-xs leading-5 text-[var(--danger)]">{error.message}</p> : null}
            {insufficientBalance ? <p role="status" className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Insufficient balance.</p> : null}
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              aria-label={`Upgrade to L${nextUpgrade.targetLevel}`}
              aria-busy={isPending}
              disabled={disabled}
              onClick={() => onUpgrade(nextUpgrade.targetLevel)}
            >
              {isPending ? 'Upgrading…' : `Upgrade to L${nextUpgrade.targetLevel}`}
            </Button>
          </>
        );
      })()}
    </section>
  );
}
