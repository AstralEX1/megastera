import { useId, type ReactNode } from 'react';
import { Button } from '@/components/common/Button';
import type { PlanetUpgradeSnapshot } from '@/hooks/useWalletMining';
import { formatMinerals } from '@/lib/minerals';

const UPGRADE_LEVELS = [1, 2, 3] as const;
const UPGRADE_BONUS_LABELS = ['+10%', '+25%', '+50%'] as const;

type UpgradeLevelState = 'complete' | 'current' | 'next' | 'locked';

function upgradeLevelState(
  level: number,
  currentLevel: number,
  nextUpgrade: PlanetUpgradeSnapshot | null,
): UpgradeLevelState {
  if (level < currentLevel) return 'complete';
  if (level === currentLevel) return 'current';
  if (nextUpgrade?.targetLevel === level) return 'next';
  return 'locked';
}

function UpgradeTooltip({
  children,
  id,
  targetLevel,
  bonusLabel,
  costLabel,
}: {
  children: ReactNode;
  id: string;
  targetLevel: number;
  bonusLabel: string;
  costLabel: string;
}) {
  return (
    <span className="group/upgrade-tooltip relative block">
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[18rem] -translate-x-1/2 rounded-[2px] bg-[rgba(97,97,97,0.94)] px-2 py-1 text-center font-sans text-[10px] font-medium leading-4 text-white opacity-0 shadow-[0_2px_4px_rgba(0,0,0,0.24)] transition-opacity duration-150 ease-out group-hover/upgrade-tooltip:opacity-100 group-focus-within/upgrade-tooltip:opacity-100"
      >
        Upgrade to Level {targetLevel} · {bonusLabel} bonus · Cost: {costLabel} minerals
      </span>
    </span>
  );
}

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
  const upgradeTooltipId = useId();

  return (
    <section
      data-testid="planet-upgrade"
      aria-label="Planet upgrade"
      className="border-t border-[var(--border)] pt-4"
    >
      <h3 className="font-hud text-sm font-bold text-[var(--text-secondary)]">Upgrades</h3>
      <div
        data-testid="upgrade-progression"
        role="progressbar"
        aria-label="Upgrade progression"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={Math.min(3, Math.max(0, upgradeLevel))}
        aria-valuetext={`Level ${Math.min(3, Math.max(0, upgradeLevel))} of Level 3`}
        className="mt-3"
      >
        <div className="grid grid-cols-3 text-center font-mono text-[10px] text-[var(--text-secondary)]">
          {UPGRADE_BONUS_LABELS.map((bonus) => (
            <span key={bonus}>{bonus}</span>
          ))}
        </div>
        <div className="mt-1 grid h-4 grid-cols-3 overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface)]">
          {UPGRADE_LEVELS.map((level) => {
            const state = upgradeLevelState(level, upgradeLevel, nextUpgrade);
            const filled = state === 'complete' || state === 'current';
            return (
              <div
                key={level}
                data-testid={`upgrade-level-${level}`}
                data-state={state}
                className={`flex min-w-0 items-center justify-center border-r border-[var(--border-strong)] text-center last:border-r-0 ${filled ? 'bg-[var(--rare)] text-black' : 'bg-[var(--surface)] text-[var(--text-secondary)]'}`}
              >
                <strong className="font-mono text-[10px]">{level}</strong>
              </div>
            );
          })}
        </div>
      </div>
      {!upgradesEnabled ? (
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
          Upgrades are disabled.
        </p>
      ) : nextUpgrade === null ? (
        <p className="mt-2 text-xs leading-5 text-[var(--success)]">Maximum level reached.</p>
      ) : (
        (() => {
          const insufficientBalance = balanceMicros < BigInt(nextUpgrade.costMicros);
          const disabled = isPending || insufficientBalance;
          const costLabel = formatMinerals(BigInt(nextUpgrade.costMicros));
          const buttonLabel = `Upgrade · ${costLabel} minerals`;
          const bonusLabel = UPGRADE_BONUS_LABELS[nextUpgrade.targetLevel - 1] ?? '—';
          return (
            <>
              {error ? (
                <p role="alert" className="mt-2 text-xs leading-5 text-[var(--danger)]">
                  {error.message}
                </p>
              ) : null}
              {insufficientBalance ? (
                <p role="status" className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  Insufficient balance.
                </p>
              ) : null}
              <UpgradeTooltip
                id={upgradeTooltipId}
                targetLevel={nextUpgrade.targetLevel}
                bonusLabel={bonusLabel}
                costLabel={costLabel}
              >
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3 w-full rounded-full bg-white text-black normal-case hover:bg-zinc-100"
                  aria-label={buttonLabel}
                  aria-describedby={upgradeTooltipId}
                  aria-busy={isPending}
                  disabled={disabled}
                  onClick={() => onUpgrade(nextUpgrade.targetLevel)}
                >
                  {isPending ? (
                    'Upgrading…'
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>Upgrade</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[10px]">{costLabel} minerals</span>
                    </span>
                  )}
                </Button>
              </UpgradeTooltip>
            </>
          );
        })()
      )}
    </section>
  );
}
