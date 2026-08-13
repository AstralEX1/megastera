import type { LifecyclePhase } from '@/hooks/useJackpotState';
import type { RoundStatus, Ticket } from '@/lib/api';

export type TicketStatus =
  | { kind: 'countdown'; time: string }
  | { kind: 'drawing' }
  | { kind: 'claimable'; amount: bigint; ticketId: bigint }
  | { kind: 'claimed'; amount: bigint }
  | { kind: 'drawn' }
  | { kind: 'unavailable' };

export type TicketStatusInput = {
  ticketId: string | bigint;
  drawingId: string | bigint;
  currentDrawingId?: bigint;
  phase?: LifecyclePhase;
  drawingTime?: bigint;
  nowMs: number;
  drawingStatus?: RoundStatus;
  apiTicket?: Pick<Ticket, 'matched_normals' | 'winnings_amount' | 'claimed'>;
};

export function formatTicketCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

export function deriveTicketStatus({
  ticketId,
  drawingId,
  currentDrawingId,
  phase,
  drawingTime,
  nowMs,
  drawingStatus,
  apiTicket,
}: TicketStatusInput): TicketStatus {
  if (apiTicket?.matched_normals !== null && apiTicket?.matched_normals !== undefined) {
    const amount = apiTicket.winnings_amount ? BigInt(apiTicket.winnings_amount.amount) : 0n;
    if (amount > 0n) {
      return apiTicket.claimed
        ? { kind: 'claimed', amount }
        : { kind: 'claimable', amount, ticketId: BigInt(ticketId) };
    }
    return { kind: 'drawn' };
  }

  const isCurrent = currentDrawingId !== undefined && BigInt(drawingId) === currentDrawingId;
  if (isCurrent && phase === 'open' && drawingTime !== undefined) {
    const remaining = Number(drawingTime) - Math.floor(nowMs / 1_000);
    if (remaining > 0) return { kind: 'countdown', time: formatTicketCountdown(remaining) };
    return { kind: 'drawing' };
  }
  if (isCurrent && (phase === 'awaiting' || phase === 'settling' || phase === 'unlocked')) {
    return { kind: 'drawing' };
  }
  if (drawingStatus === 'active') return { kind: 'drawing' };
  return { kind: 'unavailable' };
}
