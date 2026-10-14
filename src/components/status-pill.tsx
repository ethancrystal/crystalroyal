import type { ReservationStatus } from "@/lib/status";

// Status words from the copy deck, always paired with their colour.
export const STATUS_WORD: Record<ReservationStatus, string> = {
  reserved: "Reserved",
  payment_submitted: "Receipt received",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Hold ended",
};

const TONE: Record<ReservationStatus, "ok" | "wait" | "bad" | "neutral"> = {
  reserved: "wait",
  payment_submitted: "wait",
  confirmed: "ok",
  checked_in: "ok",
  completed: "neutral",
  cancelled: "bad",
  expired: "bad",
};

export function StatusPill({ status }: { status: ReservationStatus }) {
  return <span className={`pill pill-${TONE[status]}`}>{STATUS_WORD[status]}</span>;
}
