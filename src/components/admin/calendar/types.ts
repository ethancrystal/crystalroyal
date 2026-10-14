// Serialisable shapes the calendar page hands to its client board. One row per unit; a row is a run of cells, each a
// free night or a reservation / block spanning one or more nights of the month.

export type StayTone = "ok" | "wait" | "bad" | "neutral";

export interface CalDay {
  date: string;
  /** day of the month */
  day: number;
  /** "MO".."SU" */
  dow: string;
  /** "Monday 2 November" */
  spoken: string;
  past: boolean;
  today: boolean;
}

export type CalCell =
  | { kind: "free"; date: string; past: boolean }
  | {
      kind: "stay";
      start: string;
      span: number;
      id: string;
      reference: string;
      guestName: string;
      statusWord: string;
      tone: StayTone;
      /** "2 – 5 Nov" (check-in to check-out) */
      range: string;
      startsBefore: boolean;
      endsAfter: boolean;
    }
  | {
      kind: "block";
      start: string;
      span: number;
      id: string;
      reasonLabel: string;
      note: string;
      /** "27 – 29 Nov" (first night to the morning it is free again) */
      range: string;
      startsBefore: boolean;
      endsAfter: boolean;
    };

export interface CalRow {
  unitId: string;
  unitName: string;
  typeName: string;
  typeShortName: string;
  typeSlug: string;
  active: boolean;
  cells: CalCell[];
}

export interface UnitOption {
  id: string;
  label: string;
}
