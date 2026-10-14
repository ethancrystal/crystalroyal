import "server-only";
import { db } from "./sql";

// Per-night availability for the guest calendar. Never returns guest data: only a date and one of three words.

export type NightState = "free" | "reserved" | "blocked";

export interface NightStateRow {
  date: string;
  state: NightState;
}

/**
 * For each night in [from, to): "free" when at least one active unit of the type is free that night
 * (unit_is_free), otherwise "blocked" when every active unit has a block covering the night, else "reserved".
 * A type with no active units reads as "blocked" (nothing can be reserved, and nobody holds it).
 */
export async function nightStates(typeId: string, from: string, to: string): Promise<NightStateRow[]> {
  if (to <= from) return [];
  return db()<NightStateRow[]>`
    with u as (
      select id from units where apartment_type_id = ${typeId} and active
    ), nights as (
      select d::date as night
      from generate_series(${from}::date::timestamp, (${to}::date - 1)::timestamp, interval '1 day') d
    )
    select n.night::text as date,
      case
        when exists (select 1 from u where unit_is_free(u.id, n.night, n.night + 1)) then 'free'
        when not exists (
          select 1 from u
          where not exists (
            select 1 from unit_blocks b where b.unit_id = u.id and b.starts_on <= n.night and n.night < b.ends_on
          )
        ) then 'blocked'
        else 'reserved'
      end as state
    from nights n
    order by n.night`;
}
