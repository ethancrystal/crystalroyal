import { Button, Field, TextLink } from "@/components/admin/ui";
import { STATUS_OPTIONS, type FilterValues } from "./shared";

// The canvas filter bar ("Find reservations"): search, status and arrival dates, plus type and unit on the list.
// A plain GET form to /admin/reservations, so filters live in the URL, survive a reload and work without script.

export interface FilterOptions {
  types: { id: string; label: string }[];
  units: { id: string; label: string }[];
}

export function FilterBar({
  values,
  options,
  compact = false,
}: {
  values: FilterValues;
  /** omitted in the compact (detail page) bar */
  options?: FilterOptions;
  /** the detail page's three-field bar (search, status, arrival from), labels visually hidden as on the canvas */
  compact?: boolean;
}) {
  const active = Object.values(values).some(Boolean);
  const hidden = compact;
  return (
    <form
      action="/admin/reservations"
      method="get"
      role="search"
      aria-label="Find reservations"
      className="flex flex-wrap items-end gap-3 border-b border-taupe pb-5"
    >
      <Field
        label="Search"
        labelHidden={hidden}
        name="q"
        id={compact ? "flt-q-c" : "flt-q"}
        type="search"
        defaultValue={values.q ?? ""}
        placeholder="Reference, phone or name"
        maxLength={100}
        className={compact ? "flex-[1_1_280px]" : "flex-[1_1_160px] min-w-[160px]"}
      />
      <Field
        as="select"
        label="Status"
        labelHidden={hidden}
        name="status"
        id={compact ? "flt-status-c" : "flt-status"}
        defaultValue={values.status ?? ""}
        options={STATUS_OPTIONS}
        className={compact ? "flex-[0_1_240px] min-w-[160px]" : "flex-[0_1_180px] min-w-[150px]"}
      />
      {!compact && options ? (
        <>
          <Field
            as="select"
            label="Apartment"
            name="type"
            id="flt-type"
            defaultValue={values.type ?? ""}
            options={[{ value: "", label: "Both apartments" }, ...options.types.map((t) => ({ value: t.id, label: t.label }))]}
            className="flex-[0_1_180px] min-w-[150px]"
          />
          {options.units.length > options.types.length ? (
            <Field
              as="select"
              label="Unit"
              name="unit"
              id="flt-unit"
              defaultValue={values.unit ?? ""}
              options={[{ value: "", label: "All units" }, ...options.units.map((u) => ({ value: u.id, label: u.label }))]}
              className="flex-[0_1_200px] min-w-[150px]"
            />
          ) : values.unit ? (
            <input type="hidden" name="unit" value={values.unit} />
          ) : null}
        </>
      ) : null}
      <Field
        label="Arrival from"
        labelHidden={hidden}
        name="from"
        id={compact ? "flt-from-c" : "flt-from"}
        type="date"
        defaultValue={values.from ?? ""}
        className={compact ? "flex-[0_1_200px] min-w-[150px]" : "flex-[0_1_170px] min-w-[150px]"}
      />
      {!compact ? (
        <Field
          label="Arrival to"
          name="to"
          id="flt-to"
          type="date"
          defaultValue={values.to ?? ""}
          className="flex-[0_1_170px] min-w-[150px]"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary">
          Find
        </Button>
        {!compact && active ? (
          <TextLink href="/admin/reservations" className="inline-flex min-h-[44px] items-center">
            Clear filters
          </TextLink>
        ) : null}
      </div>
    </form>
  );
}
