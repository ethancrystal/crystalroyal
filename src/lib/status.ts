export const RESERVATION_STATUSES = [
  "reserved",
  "payment_submitted",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "expired",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Allowed transitions. Mirrored by `transition_reservation()` in the database migration.
 * payment_submitted -> reserved is "receipt rejected" (hold extended once).
 */
export const TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  reserved: ["payment_submitted", "confirmed", "cancelled", "expired"],
  payment_submitted: ["confirmed", "reserved", "cancelled"],
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["completed"],
  completed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {}

export function assertTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(`A reservation cannot move from ${from} to ${to}.`);
  }
}

/** Statuses that hold nights in the inventory. */
export const OCCUPYING: readonly ReservationStatus[] = [
  "reserved",
  "payment_submitted",
  "confirmed",
  "checked_in",
];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  reserved: "Reserved, awaiting transfer",
  payment_submitted: "Payment received, being verified",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Hold expired",
};

export const STATUS_TONE: Record<ReservationStatus, "ok" | "wait" | "bad" | "neutral"> = {
  reserved: "wait",
  payment_submitted: "wait",
  confirmed: "ok",
  checked_in: "ok",
  completed: "neutral",
  cancelled: "bad",
  expired: "bad",
};
