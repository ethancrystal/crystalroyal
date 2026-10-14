// Shared between the step 3 server action and its client form.

export type DetailField = "name" | "phone" | "email" | "arrivalTime" | "requests" | "acceptRules";

export interface DetailValues {
  name: string;
  phone: string;
  email: string;
  arrivalTime: string;
  requests: string;
  acceptRules: boolean;
}

export interface DetailsState {
  errors: Partial<Record<DetailField, string>>;
  values: DetailValues;
  /** Increments on each refused submit, so the form moves focus to the first field that needs attention. */
  attempt: number;
}

export const EMPTY_DETAILS: DetailValues = {
  name: "",
  phone: "",
  email: "",
  arrivalTime: "",
  requests: "",
  acceptRules: false,
};

/** Order in which fields are shown (and focused when they need attention). */
export const DETAIL_ORDER: DetailField[] = ["name", "phone", "email", "arrivalTime", "requests", "acceptRules"];
