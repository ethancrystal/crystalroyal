import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { listTypesWithUnits, type TypeWithUnits } from "@/lib/db/admin-queries";
import type { Unit } from "@/lib/types";
import { Panel, Section, TypeMarker } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/shell";
import { ActionForm, FormField, RowActionForm } from "@/components/admin/settings/form-kit";
import { saveUnitAction, setUnitActiveAction } from "./actions";

// Units (brief: name, active; a unit with future reservations cannot be deactivated). One block per apartment type:
// each unit can be renamed and reordered, activated or deactivated, and a unit can be added. Unit names appear only
// in the console; guests reserve a type and the system assigns the unit.

export const metadata: Metadata = { title: "Units" };

function UnitRow({ unit }: { unit: Unit }) {
  return (
    <li className="flex flex-col gap-3 border-b border-taupe py-4 min-[760px]:flex-row min-[760px]:items-start min-[760px]:justify-between">
      <ActionForm action={saveUnitAction} notice="bottom" className="flex min-w-0 flex-1 flex-col gap-3">
        <input type="hidden" name="id" value={unit.id} />
        <input type="hidden" name="typeId" value={unit.apartment_type_id} />
        <div className="flex flex-wrap items-end gap-3">
          <FormField id={`unit-${unit.id}-name`} label="Unit name" name="name" defaultValue={unit.name} maxLength={60} className="min-w-[200px] flex-[1_1_240px]" />
          <FormField
            id={`unit-${unit.id}-sort`}
            label="Order"
            name="sort"
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            defaultValue={unit.sort}
            className="w-[110px]"
          />
          <SubmitButton variant="secondary" pendingText="Saving">
            Save<span className="sr-only"> {unit.name}</span>
          </SubmitButton>
        </div>
      </ActionForm>
      <RowActionForm action={setUnitActiveAction} className="flex flex-wrap items-center gap-3 min-[760px]:max-w-[300px] min-[760px]:justify-end min-[760px]:pt-[26px]">
        <input type="hidden" name="id" value={unit.id} />
        <input type="hidden" name="active" value={unit.active ? "false" : "true"} />
        <span className={`text-[14px] ${unit.active ? "text-ok" : "text-ink-2"}`}>{unit.active ? "Active" : "Not active"}</span>
        <SubmitButton
          variant={unit.active ? "danger" : "secondary"}
          pendingText={unit.active ? "Deactivating" : "Activating"}
          confirm={unit.active ? `Deactivate ${unit.name}? It will take no new reservations.` : undefined}
        >
          {unit.active ? "Deactivate" : "Activate"}
          <span className="sr-only"> {unit.name}</span>
        </SubmitButton>
      </RowActionForm>
    </li>
  );
}

function TypeUnits({ type }: { type: TypeWithUnits }) {
  const active = type.units.filter((u) => u.active).length;
  return (
    <Section
      id={`units-${type.slug}`}
      title={<TypeMarker slug={type.slug}>{type.short_name}</TypeMarker>}
      gap={8}
      description={`${type.name} · ${active} of ${type.units.length} ${type.units.length === 1 ? "unit" : "units"} active`}
    >
      {type.units.length === 0 ? (
        <p className="m-0 text-[14px] text-ink-2">No units yet. This apartment cannot be reserved until it has an active unit.</p>
      ) : (
        <ul className="m-0 list-none border-t border-bronze p-0">
          {type.units.map((u) => (
            <UnitRow key={u.id} unit={u} />
          ))}
        </ul>
      )}
      <Panel as="section" aria-labelledby={`add-unit-${type.slug}-h`} className="mt-3">
        <h3 id={`add-unit-${type.slug}-h`} className="eyebrow text-bronze">
          Add a unit to the {type.short_name}
        </h3>
        <ActionForm action={saveUnitAction} notice="bottom" className="flex flex-col gap-3">
          <input type="hidden" name="typeId" value={type.id} />
          <div className="flex flex-wrap items-end gap-3">
            <FormField id={`add-unit-${type.slug}-name`} label="Unit name" name="name" maxLength={60} className="min-w-[200px] flex-[1_1_240px]" />
            <SubmitButton pendingText="Adding">Add unit</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </Section>
  );
}

export default async function UnitsPage() {
  await requireAdmin();
  const types = await listTypesWithUnits();
  return (
    <Section id="units" title="Units" variant="display" gap={32}>
      <p className="m-0 max-w-[720px] text-[14px] text-ink-2">
        Each unit is one physical apartment. Guests reserve an apartment type and dates; a free unit of that type is
        assigned in order. Unit names appear only here in the console. A unit with reservations that have not ended
        cannot be deactivated; move those reservations to another unit first.
      </p>
      {types.map((t) => (
        <TypeUnits key={t.id} type={t} />
      ))}
    </Section>
  );
}
