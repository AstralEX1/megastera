import { useState } from 'react';
import { TicketPicker } from '@/components/lottery/TicketPicker';
import {
  type CustomTicket,
  MAX_CUSTOM_TICKETS,
  randomTicket,
  type TicketBounds,
} from '@/lib/tickets';
import { ManualTicketRow } from './ManualTicketRow';

function DynamicTicketRow({ index }: { index: number }) {
  return (
    <div
      data-testid="dynamic-ticket"
      data-ticket-index={index + 1}
      className="ticket-row-enter grid min-h-14 grid-cols-[64px_minmax(0,1fr)] gap-x-2 gap-y-1 border-b border-[var(--border)] px-3 py-2 last:border-b-0"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className="row-span-2 self-center font-mono text-xs text-[var(--text-secondary)]">
        TICKET {String(index + 1).padStart(2, '0')}
      </span>
      <div
        role="img"
        className="flex min-w-0 flex-1 items-center gap-1"
        aria-label={`Ticket ${index + 1} numbers pending`}
      >
        {['normal-1', 'normal-2', 'normal-3', 'normal-4', 'normal-5'].map((slot) => (
          <span
            key={slot}
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--surface)] font-mono text-[10px] text-[var(--text-disabled)]"
          >
            ?
          </span>
        ))}
        <span aria-hidden className="mx-0.5 h-5 w-px bg-[var(--border-strong)]" />
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-[var(--rare)] bg-[color:color-mix(in_srgb,var(--rare)_10%,transparent)] font-mono text-[10px] text-[var(--rare)]"
        >
          ?
        </span>
      </div>
    </div>
  );
}

export function CoordinatesPanel({
  quantity,
  bounds,
  tickets,
  onTicketsChange,
}: {
  quantity: number;
  bounds: TicketBounds | null;
  tickets: readonly CustomTicket[];
  onTicketsChange: (tickets: readonly CustomTicket[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const concreteCount = Math.min(quantity, MAX_CUSTOM_TICKETS);
  const visibleTickets = tickets.slice(0, concreteCount);
  const dynamicCount = Math.max(0, quantity - visibleTickets.length);
  const updateTicket = (index: number, ticket: CustomTicket) =>
    onTicketsChange(
      tickets.map((current, currentIndex) => (currentIndex === index ? ticket : current)),
    );
  const shuffle = () => {
    if (!bounds) return;
    onTicketsChange(Array.from({ length: concreteCount }, () => randomTicket(bounds)));
  };
  const editingTicket = editingIndex === null ? undefined : visibleTickets[editingIndex];

  return (
    <section
      aria-label="Coordinates"
      className="w-full bg-[var(--surface)] px-5 py-6 md:border-l md:border-[var(--border-strong)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-hud text-lg font-bold text-[var(--text-primary)]">Coordinates</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Bonus Ball influences Planet generation.
          </p>
        </div>
        <button
          type="button"
          onClick={shuffle}
          disabled={!bounds}
          className="h-8 shrink-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 telemetry font-bold text-[var(--rare)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Shuffle
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
        <div className="grid grid-cols-[46px_minmax(0,1fr)] gap-2 border-b border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2.5 telemetry text-[9px] text-[var(--text-secondary)]">
          <span>TKT</span>
          <span className="text-center">01 · 02 · 03 · 04 · 05 · BONUS</span>
        </div>
        {visibleTickets.map((ticket, index) => (
          <ManualTicketRow
            // biome-ignore lint/suspicious/noArrayIndexKey: ticket slots are positional and duplicate combinations are valid purchases
            key={`${index}-${ticket.normals.join('-')}-${ticket.bonusball}`}
            ticket={ticket}
            index={index}
            onEdit={() => setEditingIndex(index)}
          />
        ))}
        {Array.from({ length: dynamicCount }, (_, offset) => (
          <DynamicTicketRow
            // biome-ignore lint/suspicious/noArrayIndexKey: dynamic ticket slots are positional and preserve their order as quantity changes
            key={`dynamic-ticket-${visibleTickets.length + offset + 1}`}
            index={visibleTickets.length + offset}
          />
        ))}
      </div>
      {bounds && editingTicket && editingIndex !== null && (
        <TicketPicker
          open
          onClose={() => setEditingIndex(null)}
          onSave={(ticket) => {
            updateTicket(editingIndex, ticket);
            setEditingIndex(null);
          }}
          ticket={editingTicket}
          bounds={bounds}
          index={editingIndex}
          total={visibleTickets.length}
        />
      )}
    </section>
  );
}
