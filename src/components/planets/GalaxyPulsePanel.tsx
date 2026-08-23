export type GalaxyPulseSlot = {
  planetType: string;
  modifierBps: number;
};

export type GalaxyPulse = {
  drawingId: string;
  settledAt: string;
  slots: readonly GalaxyPulseSlot[];
};

export type GalaxyPulsePanelProps = {
  pulse: GalaxyPulse | null;
};

const PLANET_TYPE_ICONS: Record<string, string> = {
  Nebula: '/galaxy-pulse/nebula.png',
  Desert: '/galaxy-pulse/desert.png',
  Triplex: '/galaxy-pulse/triplex.png',
  Toxic: '/galaxy-pulse/toxic.png',
  Void: '/galaxy-pulse/void.png',
  Gaia: '/galaxy-pulse/gaia.png',
  Volcanic: '/galaxy-pulse/volcanic.png',
  'Gas Giant': '/galaxy-pulse/gas-giant.png',
  Rocky: '/galaxy-pulse/rocky.png',
  Oceanic: '/galaxy-pulse/oceanic.png',
};

function formatModifierBps(modifierBps: number): string {
  const value = Math.abs(modifierBps / 100)
    .toFixed(2)
    .replace(/\.?0+$/, '');
  return `${modifierBps < 0 ? '-' : '+'}${value}%`;
}

function formatSettledAt(settledAt: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(settledAt));
}

export function GalaxyPulsePanel({ pulse }: GalaxyPulsePanelProps) {
  const slotOccurrences = new Map<string, number>();

  return (
    <section
      data-testid="galaxy-pulse-panel"
      aria-labelledby="galaxy-pulse-heading"
      className="mx-auto w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <p className="telemetry text-[var(--text-secondary)]">ACTIVE DRAWING</p>
          <h2
            id="galaxy-pulse-heading"
            className="mt-1 font-hud text-lg font-bold tracking-[-0.03em] text-[var(--text-primary)]"
          >
            Galaxy Pulse
          </h2>
        </div>
        {pulse ? (
          <div className="flex flex-col items-end gap-1 text-right font-mono text-[10px] text-[var(--text-secondary)]">
            <span>DRAWING #{pulse.drawingId}</span>
            <time dateTime={pulse.settledAt}>Settled {formatSettledAt(pulse.settledAt)} UTC</time>
          </div>
        ) : null}
      </header>

      {pulse ? (
        <ol aria-label="Galaxy Pulse slots" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pulse.slots.map((slot) => {
            const baseKey = `${slot.planetType}-${slot.modifierBps}`;
            const occurrence = slotOccurrences.get(baseKey) ?? 0;
            slotOccurrences.set(baseKey, occurrence + 1);
            const icon = PLANET_TYPE_ICONS[slot.planetType];

            return (
              <li
                key={`${baseKey}-${occurrence}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {icon ? (
                    <img
                      src={icon}
                      alt=""
                      aria-hidden="true"
                      width={40}
                      height={40}
                      loading="lazy"
                      className="size-10 shrink-0 object-contain [image-rendering:pixelated]"
                    />
                  ) : null}
                  <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-primary)]">
                    {slot.planetType}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                  {formatModifierBps(slot.modifierBps)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="pt-3 text-sm text-[var(--text-secondary)]">No active Galaxy Pulse</p>
      )}
    </section>
  );
}
