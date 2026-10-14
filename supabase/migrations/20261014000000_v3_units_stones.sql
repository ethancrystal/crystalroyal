-- Crystal Royal Apartment, booking schema v3: apartment types, units, stones, exclusion constraint.
-- Written to run on a fresh database. The live project currently holds the earlier apartments-only schema
-- (no reservations); see docs/MIGRATING.md before applying it there.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

do $$ begin
  create type stone as enum ('lapis', 'jade');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pricing_type as enum ('per_stay','per_night','per_guest_per_night','per_trip','per_day');
exception when duplicate_object then null; end $$;
do $$ begin
  create type reservation_status as enum ('reserved','payment_submitted','confirmed','checked_in','completed','cancelled','expired');
exception when duplicate_object then null; end $$;
do $$ begin
  create type receipt_status as enum ('submitted','verified','rejected','none');
exception when duplicate_object then null; end $$;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table apartment_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  short_name text not null,
  stone stone not null,
  description text not null default '',
  bedrooms int not null,
  lounges int not null default 1,
  bathrooms text,
  bed_configuration text,
  size_sqft int,
  highlights text[] not null default '{}',
  standard_guests int check (standard_guests > 0),
  max_guests int check (max_guests >= standard_guests),
  min_nights int not null default 1 check (min_nights >= 1),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  apartment_type_id uuid not null references apartment_types(id),
  name text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rates (
  id uuid primary key default gen_random_uuid(),
  apartment_type_id uuid not null references apartment_types(id),
  nightly_rate int not null check (nightly_rate > 0),
  extra_adult_per_night int check (extra_adult_per_night >= 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table amenities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  pricing_type pricing_type not null,
  price int check (price >= 0),          -- null = not yet confirmed by the property
  max_quantity int not null default 1 check (max_quantity >= 1),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table unit_blocks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  starts_on date not null,
  ends_on date not null,
  reason text not null default 'other' check (reason in ('maintenance','owner_use','other')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on),
  constraint unit_blocks_no_overlap exclude using gist (unit_id with =, daterange(starts_on, ends_on, '[)') with &&)
);

create table settings (
  id boolean primary key default true check (id),
  tax_rate_percent numeric,
  tax_label text not null default '[Applicable taxes]',
  hold_hours int not null default 12 check (hold_hours between 1 and 168),
  confirm_within_hours text not null default '[__]',
  deposit_policy text not null default 'full' check (deposit_policy in ('full','50')),
  free_cancellation_days int,
  cancellation_text text not null default '[Free cancellation up to __ days before arrival. After that, the amount paid is retained.]',
  child_max_age int,
  child_extra_policy text not null default 'same_as_adult' check (child_extra_policy in ('same_as_adult','reduced','free')),
  child_extra_fee int,
  bank_name text not null default 'Meezan Bank Limited',
  account_title text not null default '[Crystal Royal Apartment]',
  account_number text not null default '[__________]',
  iban text not null default '[PK__ MEZN ____ ____ ____ ____]',
  branch text not null default '[Branch name and code]',
  swift text not null default '[MEZNPKKA — confirm]',
  raast_id text not null default '[optional Raast ID or mobile number]',
  whatsapp_number text not null default '[92XXXXXXXXXX]',
  phone_display text not null default '[+92 XXX XXXXXXX]',
  email text not null default '[reservations@crystalroyalapartment.com]',
  owner_notify_email text not null default '[owner@crystalroyalapartment.com]',
  check_in text not null default '[15:00]',
  check_out text not null default '[11:00]',
  min_nights int not null default 1,
  max_nights int not null default 30,
  receipt_retention_months int not null default 12,
  updated_at timestamptz not null default now()
);

create table reference_counters (
  yymm text primary key,
  last int not null default 0
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  access_token text unique not null,
  apartment_type_id uuid not null references apartment_types(id),
  unit_id uuid not null references units(id),
  check_in date not null,
  check_out date not null,
  adults int not null check (adults >= 1),
  children int not null default 0 check (children >= 0),
  guest_name text not null,
  guest_phone text not null,
  guest_email text not null,
  arrival_time text not null default '',
  requests text not null default '',
  status reservation_status not null default 'reserved',
  source text not null default 'web' check (source in ('web','admin')),
  nightly_rate int not null,
  nights int not null check (nights >= 1),
  subtotal_nights int not null,
  extra_adults int not null default 0,
  extra_adults_amount int not null default 0,
  amenities_amount int not null default 0,
  tax_rate_percent numeric,
  tax_label text not null default '',
  tax_amount int not null default 0,
  total int not null,
  amount_due int not null,
  currency text not null default 'PKR',
  hold_expires_at timestamptz,
  hold_extended boolean not null default false,
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancellation_requested_at timestamptz,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in)
);

-- Double-booking is impossible at the database level. Adjacent stays are allowed by the half-open range.
alter table reservations add constraint reservations_no_overlap
  exclude using gist (unit_id with =, daterange(check_in, check_out, '[)') with &&)
  where (status in ('reserved','payment_submitted','confirmed','checked_in'));

create table reservation_amenities (
  reservation_id uuid not null references reservations(id) on delete cascade,
  amenity_id uuid not null references amenities(id),
  name_snapshot text not null,
  pricing_type_snapshot pricing_type not null,
  quantity int not null check (quantity >= 1),
  unit_price int,
  line_total int,
  primary key (reservation_id, amenity_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  method text not null default 'bank_transfer' check (method in ('bank_transfer','cash','other')),
  amount int,
  receipt_path text,
  receipt_status receipt_status not null default 'none',
  rejection_reason text,
  bank_reference text,
  recorded_by text,
  verified_by text,
  verified_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin',
  active boolean not null default true
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id) on delete set null,
  actor text not null check (actor in ('guest','admin','system')),
  actor_id text,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on reservations (apartment_type_id, check_in, check_out);
create index on reservations (status, hold_expires_at);
create index on payments (reservation_id);
create index on activity_log (reservation_id, created_at);

create trigger t_updated before update on apartment_types for each row execute function set_updated_at();
create trigger t_updated before update on units for each row execute function set_updated_at();
create trigger t_updated before update on rates for each row execute function set_updated_at();
create trigger t_updated before update on amenities for each row execute function set_updated_at();
create trigger t_updated before update on unit_blocks for each row execute function set_updated_at();
create trigger t_updated before update on reservations for each row execute function set_updated_at();

-- RLS on every table. No anonymous policies: public reads go through server code with the service role.
alter table apartment_types enable row level security;
alter table units enable row level security;
alter table rates enable row level security;
alter table amenities enable row level security;
alter table unit_blocks enable row level security;
alter table settings enable row level security;
alter table reference_counters enable row level security;
alter table reservations enable row level security;
alter table reservation_amenities enable row level security;
alter table payments enable row level security;
alter table admins enable row level security;
alter table activity_log enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid() and active)
$$;
revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['apartment_types','units','rates','amenities','unit_blocks','settings','reservations',
                           'reservation_amenities','payments','activity_log'] loop
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
create policy admin_read_self on admins for select to authenticated using (user_id = auth.uid());

-- Pure status table, mirrored by src/lib/status.ts.
create or replace function transition_allowed(f reservation_status, t reservation_status) returns boolean
language sql immutable as $$
  select case f
    when 'reserved' then t in ('payment_submitted','confirmed','cancelled','expired')
    when 'payment_submitted' then t in ('confirmed','reserved','cancelled')
    when 'confirmed' then t in ('checked_in','cancelled')
    when 'checked_in' then t in ('completed')
    else false end
$$;

-- The application never updates status directly.
create or replace function transition_reservation(
  p_id uuid, p_to reservation_status, p_actor text, p_actor_id text, p_detail jsonb default '{}'
) returns reservations language plpgsql security definer set search_path = public as $$
declare r reservations; hours int;
begin
  select * into r from reservations where id = p_id for update;
  if not found then raise exception 'reservation not found'; end if;
  if not transition_allowed(r.status, p_to) then
    raise exception 'A reservation cannot move from % to %', r.status, p_to using errcode = 'P0001';
  end if;
  select hold_hours into hours from settings where id;
  update reservations set
    status = p_to,
    confirmed_at = case when p_to = 'confirmed' then now() else confirmed_at end,
    checked_in_at = case when p_to = 'checked_in' then now() else checked_in_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end,
    cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
    cancel_reason = case when p_to = 'cancelled' then p_detail->>'reason' else cancel_reason end,
    -- receipt rejected: hold extended once
    hold_expires_at = case when r.status = 'payment_submitted' and p_to = 'reserved' and not r.hold_extended
                           then now() + make_interval(hours => hours) else hold_expires_at end,
    hold_extended = case when r.status = 'payment_submitted' and p_to = 'reserved' then true else hold_extended end
  where id = p_id returning * into r;
  insert into activity_log (reservation_id, actor, actor_id, action, detail)
    values (p_id, p_actor, p_actor_id, 'status:' || p_to, p_detail);
  return r;
end $$;
revoke all on function transition_reservation(uuid, reservation_status, text, text, jsonb) from public, anon, authenticated;

-- Is a unit free for every night of [p_in, p_out)?
create or replace function unit_is_free(p_unit uuid, p_in date, p_out date, p_ignore uuid default null)
returns boolean language sql stable as $$
  select not exists (
    select 1 from reservations r
    where r.unit_id = p_unit and r.id is distinct from p_ignore
      and r.status in ('reserved','payment_submitted','confirmed','checked_in')
      and daterange(r.check_in, r.check_out, '[)') && daterange(p_in, p_out, '[)')
  ) and not exists (
    select 1 from unit_blocks b
    where b.unit_id = p_unit and daterange(b.starts_on, b.ends_on, '[)') && daterange(p_in, p_out, '[)')
  )
$$;

-- Per-night availability for a type: true when at least one active unit is free that night. No guest data.
create or replace function type_night_availability(p_type uuid, p_from date, p_to date)
returns table (night date, available boolean) language sql stable as $$
  select d::date, exists (
    select 1 from units u where u.apartment_type_id = p_type and u.active and unit_is_free(u.id, d::date, d::date + 1)
  ) from generate_series(p_from, p_to - 1, interval '1 day') d
$$;

-- One transaction: serialise per type, validate, assign the lowest-sorted free unit, allocate the reference, insert.
-- Totals come from the caller (the server recomputes with priceStay() from database rows before calling).
-- Returns (ok, reservation, error): a clean "not available" result, never an exception, when no unit is free.
create or replace function create_reservation(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t apartment_types; v_unit uuid; v_ref text; v_token text; v_yymm text; v_n int; v_hours int;
  v_in date := (p->>'check_in')::date; v_out date := (p->>'check_out')::date;
  v_id uuid; a jsonb; v_status reservation_status := coalesce((p->>'status')::reservation_status, 'reserved');
begin
  select * into t from apartment_types where id = (p->>'apartment_type_id')::uuid and active for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown_type'); end if;
  if v_out <= v_in then return jsonb_build_object('ok', false, 'error', 'bad_dates'); end if;

  select u.id into v_unit from units u
    where u.apartment_type_id = t.id and u.active and unit_is_free(u.id, v_in, v_out)
    order by u.sort, u.name limit 1;
  if v_unit is null then return jsonb_build_object('ok', false, 'error', 'not_available'); end if;

  v_yymm := to_char(now() at time zone 'Asia/Karachi', 'YYMM');
  insert into reference_counters (yymm, last) values (v_yymm, 1)
    on conflict (yymm) do update set last = reference_counters.last + 1 returning last into v_n;
  v_ref := 'CRA-' || v_yymm || '-' || lpad(v_n::text, 4, '0');
  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  select hold_hours into v_hours from settings where id;

  insert into reservations (reference, access_token, apartment_type_id, unit_id, check_in, check_out, adults, children,
      guest_name, guest_phone, guest_email, arrival_time, requests, status, source,
      nightly_rate, nights, subtotal_nights, extra_adults, extra_adults_amount, amenities_amount,
      tax_rate_percent, tax_label, tax_amount, total, amount_due, hold_expires_at, confirmed_at)
  values (v_ref, v_token, t.id, v_unit, v_in, v_out, (p->>'adults')::int, (p->>'children')::int,
      p->>'guest_name', p->>'guest_phone', p->>'guest_email', coalesce(p->>'arrival_time',''), coalesce(p->>'requests',''),
      v_status, coalesce(p->>'source','web'),
      (p->>'nightly_rate')::int, (p->>'nights')::int, (p->>'subtotal_nights')::int, (p->>'extra_adults')::int,
      (p->>'extra_adults_amount')::int, (p->>'amenities_amount')::int,
      nullif(p->>'tax_rate_percent','')::numeric, coalesce(p->>'tax_label',''), (p->>'tax_amount')::int,
      (p->>'total')::int, (p->>'amount_due')::int,
      case when v_status = 'reserved' then now() + make_interval(hours => v_hours) end,
      case when v_status = 'confirmed' then now() end)
  returning id into v_id;

  for a in select * from jsonb_array_elements(coalesce(p->'amenities','[]')) loop
    insert into reservation_amenities (reservation_id, amenity_id, name_snapshot, pricing_type_snapshot, quantity, unit_price, line_total)
    values (v_id, (a->>'amenity_id')::uuid, a->>'name', (a->>'pricing_type')::pricing_type, (a->>'quantity')::int,
            nullif(a->>'unit_price','')::int, nullif(a->>'line_total','')::int);
  end loop;

  insert into activity_log (reservation_id, actor, action, detail)
  values (v_id, case when coalesce(p->>'source','web') = 'admin' then 'admin' else 'guest' end, 'created', jsonb_build_object('unit_id', v_unit));
  return jsonb_build_object('ok', true, 'id', v_id, 'reference', v_ref, 'access_token', v_token, 'unit_id', v_unit);
exception when exclusion_violation then
  return jsonb_build_object('ok', false, 'error', 'not_available');
end $$;
revoke all on function create_reservation(jsonb) from public, anon, authenticated;

-- Cron: expire past-due holds only. Idempotent.
create or replace function expire_holds() returns setof reservations
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from reservations where status = 'reserved' and hold_expires_at < now() for update skip locked loop
    return next transition_reservation(r.id, 'expired', 'system', null, '{}'::jsonb);
  end loop;
end $$;
revoke all on function expire_holds() from public, anon, authenticated;

-- Private receipts bucket.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
