import MagicBento from '@/components/common/reactBits/MagicBento';

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

const GALAXY_PULSE_TOOLTIP_ID = 'galaxy-pulse-details';

const PLANET_TYPE_ICONS: Record<string, string> = {
  nebula: '/galaxy-pulse/nebula.png',
  desert: '/galaxy-pulse/desert.png',
  triplex: '/galaxy-pulse/triplex.png',
  toxic: '/galaxy-pulse/toxic.png',
  void: '/galaxy-pulse/void.png',
  gaia: '/galaxy-pulse/gaia.png',
  volcanic: '/galaxy-pulse/volcanic.png',
  'gas-giant': '/galaxy-pulse/gas-giant.png',
  rocky: '/galaxy-pulse/rocky.png',
  oceanic: '/galaxy-pulse/oceanic.png',
};

function getPlanetTypeIcon(planetType: string): string | undefined {
  return PLANET_TYPE_ICONS[planetType.trim().toLowerCase().replace(/\s+/g, '-')];
}

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
  const previewSlotOccurrences = new Map<string, number>();
  const effectSlotOccurrences = new Map<string, number>();

  return (
    <section
      data-testid="galaxy-pulse-panel"
      aria-labelledby="galaxy-pulse-heading"
      className="w-full min-w-0 lg:w-fit lg:justify-self-center"
    >
      <div className="group relative min-w-0">
        <MagicBento
          testId="galaxy-pulse-frame"
          className="w-full rounded-xl bg-gradient-to-r from-red-500 via-fuchsia-500 to-violet-600 p-px"
          textAutoHide
          enableStars
          enableSpotlight
          enableBorderGlow
          enableTilt
          enableMagnetism
          clickEffect={false}
          spotlightRadius={300}
          particleCount={12}
          glowColor="132, 0, 255"
        >
          <div className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[calc(0.75rem-1px)] bg-[var(--surface-raised)] px-3 py-2 text-left transition-[background-color] duration-150 group-hover:bg-[var(--surface-hover)] motion-reduce:transition-none">
            <div className="flex min-w-0 shrink-0 flex-col">
              <h2
                id="galaxy-pulse-heading"
                className="font-hud text-sm font-bold tracking-[-0.03em] text-[var(--text-primary)]"
              >
                GALAXY PULSE
              </h2>
              {pulse ? (
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  DRAWING #{pulse.drawingId}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  No active GALAXY PULSE
                </span>
              )}
            </div>

            {pulse ? (
              <span aria-hidden="true" className="ml-auto flex min-w-0 items-center gap-1">
                {pulse.slots.map((slot) => {
                  const icon = getPlanetTypeIcon(slot.planetType);
                  const baseKey = `${slot.planetType}-${slot.modifierBps}`;
                  const occurrence = previewSlotOccurrences.get(baseKey) ?? 0;
                  previewSlotOccurrences.set(baseKey, occurrence + 1);
                  return (
                    <span
                      key={`${baseKey}-${occurrence}`}
                      className="grid size-10 shrink-0 place-items-center"
                    >
                      {icon ? (
                        <img
                          src={icon}
                          alt=""
                          aria-hidden="true"
                          width={32}
                          height={32}
                          className="size-8 object-contain [image-rendering:pixelated]"
                        />
                      ) : null}
                    </span>
                  );
                })}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            data-testid="galaxy-pulse-tooltip-trigger"
            aria-label="Galaxy Pulse details"
            aria-describedby={GALAXY_PULSE_TOOLTIP_ID}
            className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          />
        </MagicBento>

        <div
          id={GALAXY_PULSE_TOOLTIP_ID}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-full translate-y-1 rounded-xl bg-gradient-to-r from-red-500 via-fuchsia-500 to-violet-600 p-px text-left opacity-0 shadow-[0_18px_42px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none"
        >
          <div className="rounded-[calc(0.75rem-1px)] bg-[var(--surface-raised)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="telemetry text-[var(--text-secondary)]">GALAXY PULSE</p>
              {pulse ? (
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  DRAWING #{pulse.drawingId}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-primary)]">
              GALAXY PULSE is a set of mining modifiers selected for this drawing. Each effect
              applies to planets of the matching type.
            </p>

            {pulse ? (
              <>
                <h3 className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                  Effects
                </h3>
                <ol aria-label="Galaxy Pulse effects" className="mt-2 space-y-1.5">
                  {pulse.slots.map((slot) => {
                    const icon = getPlanetTypeIcon(slot.planetType);
                    const baseKey = `${slot.planetType}-${slot.modifierBps}`;
                    const occurrence = effectSlotOccurrences.get(baseKey) ?? 0;
                    effectSlotOccurrences.set(baseKey, occurrence + 1);
                    return (
                      <li
                        key={`${baseKey}-detail-${occurrence}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {icon ? (
                            <img
                              src={icon}
                              alt=""
                              aria-hidden="true"
                              width={28}
                              height={28}
                              className="size-7 shrink-0 object-contain [image-rendering:pixelated]"
                            />
                          ) : null}
                          <span className="truncate font-mono text-xs text-[var(--text-primary)]">
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
                <time
                  dateTime={pulse.settledAt}
                  className="mt-3 block font-mono text-[10px] text-[var(--text-secondary)]"
                >
                  Settled {formatSettledAt(pulse.settledAt)} UTC
                </time>
              </>
            ) : (
              <p className="mt-3 text-xs text-[var(--text-secondary)]">No active GALAXY PULSE</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
