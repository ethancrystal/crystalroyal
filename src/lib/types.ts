import type { ReservationStatus } from "./status";

export type PricingType = "per_stay" | "per_night" | "per_guest_per_night" | "per_trip" | "per_day";
export type ChildExtraPolicy = "same_as_adult" | "reduced" | "free";
export type DepositPolicy = "full" | "50";
export type Stone = "lapis" | "jade";
export type ReceiptStatus = "submitted" | "verified" | "rejected" | "none";
export type PaymentMethod = "bank_transfer" | "cash" | "other";

/** One of the two categories a guest chooses. Guests reserve a type, never a unit. */
export interface ApartmentType {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  stone: Stone;
  description: string;
  bedrooms: number;
  lounges: number;
  bathrooms: string | null;
  bed_configuration: string | null;
  size_sqft: number | null;
  highlights: string[];
  /** null = occupancy not yet confirmed; the type cannot be reserved online until set. */
  standard_guests: number | null;
  max_guests: number | null;
  min_nights: number;
  sort: number;
  active: boolean;
}

/** One physical apartment. Visible in admin only. */
export interface Unit {
  id: string;
  apartment_type_id: string;
  name: string;
  sort: number;
  active: boolean;
}

export interface Rate {
  id: string;
  apartment_type_id: string;
  nightly_rate: number;
  /** null = no extra-guest rule for this type */
  extra_adult_per_night: number | null;
  effective_from: string;
}

export interface Amenity {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricing_type: PricingType;
  /** null = price not yet confirmed ("[PKR __]"): requested, never charged. */
  price: number | null;
  max_quantity: number;
  sort: number;
  active: boolean;
}

export interface Settings {
  tax_rate_percent: number | null;
  tax_label: string;
  hold_hours: number;
  confirm_within_hours: string;
  deposit_policy: DepositPolicy;
  free_cancellation_days: number | null;
  cancellation_text: string;
  child_max_age: number | null;
  child_extra_policy: ChildExtraPolicy;
  child_extra_fee: number | null;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  branch: string;
  swift: string;
  raast_id: string;
  whatsapp_number: string;
  phone_display: string;
  email: string;
  owner_notify_email: string;
  check_in: string;
  check_out: string;
  min_nights: number;
  max_nights: number;
  receipt_retention_months: number;
}

export interface Reservation {
  id: string;
  reference: string;
  access_token: string;
  apartment_type_id: string;
  unit_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  arrival_time: string;
  requests: string;
  status: ReservationStatus;
  source: "web" | "admin";
  nightly_rate: number;
  nights: number;
  subtotal_nights: number;
  extra_adults: number;
  extra_adults_amount: number;
  amenities_amount: number;
  tax_rate_percent: number | null;
  tax_label: string;
  tax_amount: number;
  total: number;
  amount_due: number;
  currency: string;
  hold_expires_at: string | null;
  hold_extended: boolean;
  confirmed_at: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancellation_requested_at: string | null;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationAmenity {
  reservation_id: string;
  amenity_id: string;
  name_snapshot: string;
  pricing_type_snapshot: PricingType;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
}

export interface Payment {
  id: string;
  reservation_id: string;
  method: PaymentMethod;
  amount: number | null;
  receipt_path: string | null;
  receipt_status: ReceiptStatus;
  rejection_reason: string | null;
  bank_reference: string | null;
  recorded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  note: string;
  created_at: string;
}

export type BlockReason = "maintenance" | "owner_use" | "other";

export interface UnitBlock {
  id: string;
  unit_id: string;
  starts_on: string;
  ends_on: string;
  reason: BlockReason;
  note: string;
}

export interface ActivityEntry {
  id: string;
  reservation_id: string | null;
  actor: "guest" | "admin" | "system";
  actor_id: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}
