import type { FormState } from "./form-state";

// The bank details the owner edits (canvas fieldset "Meezan Bank details, shown to guests"). The bank's name is a
// fixed fact of the brief (Meezan Bank Limited), so it is shown but not edited here.

export const BANK_FORM_FIELDS = [
  { key: "account_title", label: "Account title", placeholder: "[Crystal Royal Apartment]" },
  { key: "account_number", label: "Account number", placeholder: "[__________]" },
  { key: "iban", label: "IBAN", placeholder: "[PK__ MEZN ____ ____ ____ ____]" },
  { key: "branch", label: "Branch name and code", placeholder: "[Branch name and code]" },
  { key: "swift", label: "SWIFT", placeholder: "[MEZNPKKA — confirm]" },
  { key: "raast_id", label: "Raast ID, optional", placeholder: "[optional]" },
] as const;

export type BankField = (typeof BANK_FORM_FIELDS)[number]["key"];

export interface BankReviewRow {
  key: BankField;
  label: string;
  from: string;
  to: string;
  changed: boolean;
}

export interface BankState extends FormState {
  review?: {
    rows: BankReviewRow[];
    /** the validated, normalised details the confirmation posts back */
    values: Record<BankField, string>;
    /** fingerprint of the stored details at review time */
    basis: string;
  };
}
