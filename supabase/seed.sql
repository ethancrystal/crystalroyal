-- Seed: two apartment types, one unit each, current rates, sample amenities (prices unconfirmed), settings.
insert into apartment_types (slug, name, short_name, stone, description, bedrooms, lounges, standard_guests, max_guests, min_nights, sort) values
 ('three-bedroom','Three-Bedroom Apartment with Lounge','3-bed lounge','lapis','Three bedrooms around a generous lounge.',3,1,6,8,1,1),
 ('two-bedroom','Two-Bedroom Apartment with Lounge','2-bed lounge','jade','Two bedrooms and a lounge.',2,1,null,null,1,2);
insert into units (apartment_type_id, name, sort)
 select id, case slug when 'three-bedroom' then 'Three-bedroom apartment' else 'Two-bedroom apartment' end, 1 from apartment_types;
insert into rates (apartment_type_id, nightly_rate, extra_adult_per_night, effective_from)
 select id, case slug when 'three-bedroom' then 25000 else 17000 end, case slug when 'three-bedroom' then 5000 end, date '2026-10-01' from apartment_types;
insert into amenities (slug, name, description, pricing_type, price, max_quantity, sort) values
 ('airport-transfer','Airport transfer','A driver meets you at arrivals and brings you to the door.','per_trip',null,4,1),
 ('breakfast','Breakfast for the party','Served in the apartment at the hour you choose.','per_guest_per_night',null,1,2),
 ('housekeeping-daily','Daily housekeeping','Every day of your stay, at a time that suits you.','per_night',null,1,3),
 ('early-check-in','Early check-in','Arrive earlier than the standard hour.','per_stay',null,1,4),
 ('late-check-out','Late check-out','Leave later than the standard hour.','per_stay',null,1,5),
 ('extra-bedding','Extra bedding or cot','A cot or an extra bed made up before you arrive.','per_night',null,2,6),
 ('grocery-prestock','Kitchen pre-stocked','Essentials and your list, in the kitchen before you arrive.','per_stay',null,1,7),
 ('driver-on-call','Driver on call','A car and driver for the day, at your call.','per_day',null,30,8);
insert into settings (id) values (true);
