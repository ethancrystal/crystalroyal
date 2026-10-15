-- DEMO DATA. Fills every screen with sample reservations, payments, a block and activity history.
-- Never run this on the live project: the stays would block real dates and appear in the owner's admin.
-- Every demo guest has "(demo)" in the name and an @example.com email; remove them all with:
--   delete from reservations where guest_email like '%@example.com';  (cascades to payments and amenities)
--   delete from unit_blocks where note like 'Demo:%';
-- Dates are relative to today in Karachi. Run after supabase/seed.sql.

do $$
declare
  today date := (now() at time zone 'Asia/Karachi')::date;
  t3 uuid := (select id from apartment_types where slug = 'three-bedroom');
  t2 uuid := (select id from apartment_types where slug = 'two-bedroom');
  u3 uuid := (select id from units where apartment_type_id = (select id from apartment_types where slug = 'three-bedroom') order by sort limit 1);
  u2 uuid := (select id from units where apartment_type_id = (select id from apartment_types where slug = 'two-bedroom') order by sort limit 1);
  am_transfer uuid := (select id from amenities where slug = 'airport-transfer');
  am_breakfast uuid := (select id from amenities where slug = 'breakfast');
  am_bedding uuid := (select id from amenities where slug = 'extra-bedding');
  r jsonb;
  rid uuid;

  -- Creates one reservation through the real database function and returns its id.
  -- p_extra = extra guests above six (3-bedroom), charged PKR 5,000 per night each.
begin
  if exists (select 1 from reservations where guest_email like '%@example.com') then
    raise notice 'Demo data already present; skipping.';
    return;
  end if;

  -- 1. Confirmed, arriving in 9 days: 2 adults + 4 children, airport transfer requested (price not yet set).
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t3, 'check_in', today + 9, 'check_out', today + 12, 'adults', 2, 'children', 4,
    'guest_name', 'Sana Ahmed (demo)', 'guest_phone', '+923001234567', 'guest_email', 'sana.ahmed@example.com',
    'arrival_time', '14:30', 'requests', 'Please have two cots ready for the younger children.',
    'nightly_rate', 25000, 'nights', 3, 'subtotal_nights', 75000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 75000, 'amount_due', 75000, 'status', 'reserved',
    'amenities', jsonb_build_array(jsonb_build_object('amenity_id', am_transfer, 'name', 'Airport transfer',
      'pricing_type', 'per_trip', 'quantity', 1, 'unit_price', null, 'line_total', null))));
  rid := (r->>'id')::uuid;
  perform transition_reservation(rid, 'payment_submitted', 'guest', null);
  insert into payments (reservation_id, method, amount, receipt_status, verified_by, verified_at, bank_reference, note)
    values (rid, 'bank_transfer', 75000, 'verified', 'owner@example.com', now() - interval '1 day', 'MEZN-88231', 'Demo: matched to the statement');
  perform transition_reservation(rid, 'confirmed', 'admin', 'owner@example.com');

  -- 2. Eight guests (the maximum), receipt uploaded and waiting for verification.
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t3, 'check_in', today + 20, 'check_out', today + 23, 'adults', 4, 'children', 4,
    'guest_name', 'Imran Qureshi (demo)', 'guest_phone', '+923215550142', 'guest_email', 'imran.qureshi@example.com',
    'arrival_time', '16:00', 'requests', 'Family wedding in the city; late arrival likely.',
    'nightly_rate', 25000, 'nights', 3, 'subtotal_nights', 75000, 'extra_adults', 2, 'extra_adults_amount', 30000,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 105000, 'amount_due', 105000, 'status', 'reserved'));
  rid := (r->>'id')::uuid;
  insert into payments (reservation_id, method, amount, receipt_status, note)
    values (rid, 'bank_transfer', 105000, 'submitted', 'Demo: receipt image not stored in the sample data');
  perform transition_reservation(rid, 'payment_submitted', 'guest', null);

  -- 3. Reserved, hold still running (reserved moments ago).
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t3, 'check_in', today + 32, 'check_out', today + 34, 'adults', 3, 'children', 2,
    'guest_name', 'Nadia Farooq (demo)', 'guest_phone', '+923335557788', 'guest_email', 'nadia.farooq@example.com',
    'arrival_time', '12:00', 'requests', '',
    'nightly_rate', 25000, 'nights', 2, 'subtotal_nights', 50000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 50000, 'amount_due', 50000, 'status', 'reserved',
    'amenities', jsonb_build_array(
      jsonb_build_object('amenity_id', am_breakfast, 'name', 'Breakfast for the party', 'pricing_type', 'per_guest_per_night', 'quantity', 1, 'unit_price', null, 'line_total', null),
      jsonb_build_object('amenity_id', am_bedding, 'name', 'Extra bedding or cot', 'pricing_type', 'per_night', 'quantity', 1, 'unit_price', null, 'line_total', null))));

  -- 4. Checked in, staying now.
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t3, 'check_in', today - 1, 'check_out', today + 2, 'adults', 2, 'children', 3,
    'guest_name', 'Hamza Siddiqui (demo)', 'guest_phone', '+923004449900', 'guest_email', 'hamza.siddiqui@example.com',
    'arrival_time', '15:30', 'requests', 'Quiet floor if possible.',
    'nightly_rate', 25000, 'nights', 3, 'subtotal_nights', 75000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 75000, 'amount_due', 75000, 'status', 'confirmed'));
  rid := (r->>'id')::uuid;
  insert into payments (reservation_id, method, amount, receipt_status, verified_by, verified_at, bank_reference)
    values (rid, 'bank_transfer', 75000, 'verified', 'owner@example.com', now() - interval '6 days', 'MEZN-87102');
  perform transition_reservation(rid, 'checked_in', 'admin', 'owner@example.com');

  -- 5. Completed stay last month.
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t3, 'check_in', today - 22, 'check_out', today - 19, 'adults', 4, 'children', 2,
    'guest_name', 'Ayesha Malik (demo)', 'guest_phone', '+923459876543', 'guest_email', 'ayesha.malik@example.com',
    'arrival_time', '13:00', 'requests', '',
    'nightly_rate', 25000, 'nights', 3, 'subtotal_nights', 75000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 75000, 'amount_due', 75000, 'status', 'confirmed'));
  rid := (r->>'id')::uuid;
  insert into payments (reservation_id, method, amount, receipt_status, verified_by, verified_at, bank_reference)
    values (rid, 'bank_transfer', 75000, 'verified', 'owner@example.com', now() - interval '30 days', 'MEZN-80455');
  perform transition_reservation(rid, 'checked_in', 'admin', 'owner@example.com');
  perform transition_reservation(rid, 'completed', 'admin', 'owner@example.com');

  -- 6. Cancelled by the owner at the guest's request.
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t3, 'check_in', today + 40, 'check_out', today + 43, 'adults', 2, 'children', 2,
    'guest_name', 'Bilal Raza (demo)', 'guest_phone', '+923111234000', 'guest_email', 'bilal.raza@example.com',
    'arrival_time', '', 'requests', '',
    'nightly_rate', 25000, 'nights', 3, 'subtotal_nights', 75000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 75000, 'amount_due', 75000, 'status', 'reserved'));
  rid := (r->>'id')::uuid;
  update reservations set cancellation_requested_at = now() - interval '2 days' where id = rid;
  perform transition_reservation(rid, 'cancelled', 'admin', 'owner@example.com', jsonb_build_object('reason', 'Guest changed travel dates.'));

  -- 7. Hold ended without a transfer.
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t3, 'check_in', today + 45, 'check_out', today + 47, 'adults', 2, 'children', 0,
    'guest_name', 'Zainab Hussain (demo)', 'guest_phone', '+923227771122', 'guest_email', 'zainab.hussain@example.com',
    'arrival_time', '', 'requests', '',
    'nightly_rate', 25000, 'nights', 2, 'subtotal_nights', 50000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 50000, 'amount_due', 50000, 'status', 'reserved'));
  perform transition_reservation((r->>'id')::uuid, 'expired', 'system', null);

  -- 8. Two-bedroom phone booking entered by the owner (the two-bedroom cannot be reserved online until its
  --    occupancy is set), paid in cash on arrival.
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t2, 'check_in', today + 4, 'check_out', today + 6, 'adults', 2, 'children', 0,
    'guest_name', 'Omar Sheikh (demo)', 'guest_phone', '+923018885566', 'guest_email', 'omar.sheikh@example.com',
    'arrival_time', '11:00', 'requests', 'Booked by phone.', 'source', 'admin',
    'nightly_rate', 17000, 'nights', 2, 'subtotal_nights', 34000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 34000, 'amount_due', 34000, 'status', 'confirmed'));
  rid := (r->>'id')::uuid;
  insert into payments (reservation_id, method, amount, receipt_status, verified_by, verified_at, recorded_by, note)
    values (rid, 'cash', 34000, 'verified', 'owner@example.com', now(), 'owner@example.com', 'Demo: cash received at the front desk');

  -- 9. Another two-bedroom stay next month.
  r := create_reservation(jsonb_build_object(
    'apartment_type_id', t2, 'check_in', today + 15, 'check_out', today + 18, 'adults', 2, 'children', 1,
    'guest_name', 'Fatima Noor (demo)', 'guest_phone', '+923336667788', 'guest_email', 'fatima.noor@example.com',
    'arrival_time', '17:00', 'requests', '', 'source', 'admin',
    'nightly_rate', 17000, 'nights', 3, 'subtotal_nights', 51000, 'extra_adults', 0, 'extra_adults_amount', 0,
    'amenities_amount', 0, 'tax_amount', 0, 'total', 51000, 'amount_due', 51000, 'status', 'reserved'));

  -- Maintenance block on the three-bedroom, later in the year.
  insert into unit_blocks (unit_id, starts_on, ends_on, reason, note)
    values (u3, today + 60, today + 63, 'maintenance', 'Demo: deep clean and repainting');
  insert into unit_blocks (unit_id, starts_on, ends_on, reason, note)
    values (u2, today + 26, today + 28, 'owner_use', 'Demo: family stay');
end $$;
