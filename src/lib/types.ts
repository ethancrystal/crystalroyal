import type { ReservationStatus } from "./status";

export type PricingType = "per_stay" | "per_night" | "per_guest_per_night" | "per_trip" | "per_day";
export type ChildPolicy = "adult" | "reduced" | "free";
export type DepositPolicy = "full" | "50";
export type ReceiptStatus = "submitted" | "verified" | "rejected";

export interface Apartment {
  id: string;
  slug: string;
  name: string;
  description: string;
  bedrooms: number;
  lounges: number;
  bathrooms: string | null;
  bed_configuration: string | null;
  /** null = not yet confirmed by the property; the apartment cannot be reserved online until set. */
  standard_guests: number | null;
  max_guests: number | null;
  min_nights: number;
  active: boolean;
}

export interface ApartmentRate {
  id: string;
  apartment_id: string;
  nightly_rate: number;
  /** null = no extra-guest rule for this apartment */
  extra_adult_per_night: number | null;
  effective_from: string;
}

export interface Amenity {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricing_type: PricingType;
  /** null = price not yet confirmed by the property ("[PKR __]") */
  price: number | null;
  max_quantity: number;
  active: boolean;
  sort: number;
}

export interface Settings {
  tax_rate_percent: number | null;
  tax_label: string;
  hold_hours: number;
  deposit_policy: DepositPolicy;
  free_cancellation_days: number | null;
  child_policy: ChildPolicy;
  child_extra_per_night: number | null;
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
  check_in: string;
  check_out: string;
}

export interface Reservation {
  id: string;
  reference: string;
  access_token: string;
  apartment_id: string;
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
  nightly_rate: number;
  nights: number;
  subtotal_nights: number;
  extra_guests: number;
  extra_adults_amount: number;
  amenities_amount: number;
  tax_rate_percent: number | null;
  tax_amount: number;
  total: number;
  amount_due: number;
  currency: string;
  hold_expires_at: string | null;
  hold_extended: boolean;
  source: "online" | "manual";
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationAmenity {
  reservation_id: string;
  amenity_id: string;
  name: string;
  pricing_type: PricingType;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
}

export interface Payment {
  id: string;
  reservation_id: string;
  method: "bank_transfer";
  amount_claimed: number | null;
  receipt_path: string | null;
  receipt_mime: string | null;
  receipt_status: ReceiptStatus;
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  bank_reference: string | null;
  created_at: string;
}

export interface BlockedDate {
  apartment_id: string;
  date: string;
  reason: string;
}

export interface ActivityEntry {
  id: string;
  reservation_id: string | null;
  actor: string;
  action: string;
  detail: string;
  created_at: string;
}
