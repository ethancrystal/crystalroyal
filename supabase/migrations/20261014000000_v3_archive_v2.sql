-- The live project first held an apartments-only schema (seed data only). It is moved, not dropped,
-- into schema legacy_v2 (not exposed by the API). On a fresh database this does nothing.
do $$
begin
  if to_regclass('public.apartments') is null then return; end if;
  create schema if not exists legacy_v2;
  revoke all on schema legacy_v2 from public, anon, authenticated;
  alter table public.activity_log set schema legacy_v2;
  alter table public.payments set schema legacy_v2;
  alter table public.reservation_amenities set schema legacy_v2;
  alter table public.reservations set schema legacy_v2;
  alter table public.blocked_dates set schema legacy_v2;
  alter table public.apartment_rates set schema legacy_v2;
  alter table public.apartments set schema legacy_v2;
  alter table public.amenities set schema legacy_v2;
  alter table public.settings set schema legacy_v2;
  alter table public.admins set schema legacy_v2;
  alter table public.reference_counters set schema legacy_v2;
  alter function public.create_reservation(jsonb) set schema legacy_v2;
  alter function public.expire_holds() set schema legacy_v2;
  alter function public.is_available(uuid, date, date) set schema legacy_v2;
  alter function public.transition_reservation(uuid, reservation_status, reservation_status, jsonb, text, text, text) set schema legacy_v2;
  alter function public.transition_allowed(reservation_status, reservation_status) set schema legacy_v2;
  alter function public.reservations_guard() set schema legacy_v2;
  alter function private.is_admin() set schema legacy_v2;
  alter type public.pricing_type set schema legacy_v2;
  alter type public.receipt_status set schema legacy_v2;
  alter type public.reservation_status set schema legacy_v2;
end $$;
