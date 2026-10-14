import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { listAllAmenities, PRICING_TYPES, type AdminAmenity } from "@/lib/db/admin-queries";
import {
  ButtonLink,
  DataTable,
  Notice,
  PRICING_LABEL,
  Panel,
  Ph,
  Section,
  TextLink,
  fmtNum,
  type Column,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/shell";
import { ActionForm, FormCheckbox, FormField, RowActionForm } from "@/components/admin/settings/form-kit";
import { deleteAmenityAction, moveAmenityAction, saveAmenityAction, setAmenityShownAction } from "./actions";

// Amenities (canvas AdminSettings "Amenities" table: Name, Pricing, Price PKR, Max qty, Shown, Edit). Add, edit,
// reorder, hide/show, and delete one that no reservation has used. An empty price is shown as a dashed red
// placeholder: the amenity can be requested but is quoted separately and never added to a total.

export const metadata: Metadata = { title: "Amenities" };

const PATH = "/admin/settings/amenities";
const PRICE_HINT =
  "Leave empty while the price is to be confirmed. Guests can still ask for it; it shows as [PKR __], is quoted separately and is not added to the total.";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const pricingOptions = PRICING_TYPES.map((p) => ({ value: p, label: PRICING_LABEL[p] }));

function AmenityFields({ amenity }: { amenity?: AdminAmenity }) {
  return (
    <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
      <FormField label="Name" name="name" defaultValue={amenity?.name ?? ""} maxLength={80} />
      <FormField as="select" label="Pricing" name="pricing_type" defaultValue={amenity?.pricing_type ?? "per_stay"} options={pricingOptions} />
      <FormField
        label="Price, PKR"
        name="price"
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="[__]"
        defaultValue={amenity?.price ?? ""}
        placeholderValue={amenity ? amenity.price === null : false}
        hint={PRICE_HINT}
      />
      <FormField
        label="Max qty"
        name="max_quantity"
        type="number"
        inputMode="numeric"
        min={1}
        max={30}
        defaultValue={amenity?.max_quantity ?? 1}
        hint="The most a guest can add to one stay."
      />
      <FormField
        as="textarea"
        label="Line shown to guests"
        name="description"
        rows={2}
        defaultValue={amenity?.description ?? ""}
        className="[grid-column:1/-1]"
        hint="One line under the name when guests choose what they need."
      />
    </div>
  );
}

function Editor({ amenity }: { amenity: AdminAmenity }) {
  return (
    <Panel as="section" aria-labelledby="amenity-editor-h" id="amenity-editor" className="gap-5 p-5 min-[600px]:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="amenity-editor-h" className="eyebrow text-bronze">
          Edit {amenity.name}
        </h3>
        <TextLink href={PATH}>Close</TextLink>
      </div>
      <ActionForm action={saveAmenityAction} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={amenity.id} />
        <AmenityFields amenity={amenity} />
        <p className="m-0 text-[13px] text-ink-2">
          Reservations already made keep the name and price they were made with.
        </p>
        <div>
          <SubmitButton pendingText="Saving">Save amenity</SubmitButton>
        </div>
      </ActionForm>
      <div className="border-t border-taupe pt-4">
        {amenity.used ? (
          <p className="m-0 text-[14px] text-ink-2">
            Used by a reservation, so it cannot be deleted. Hide it instead to stop offering it.
          </p>
        ) : (
          <RowActionForm action={deleteAmenityAction}>
            <input type="hidden" name="id" value={amenity.id} />
            <SubmitButton variant="danger" pendingText="Deleting" confirm={`Delete ${amenity.name}? This cannot be undone.`}>
              Delete amenity
            </SubmitButton>
          </RowActionForm>
        )}
      </div>
    </Panel>
  );
}

function Creator() {
  return (
    <Panel as="section" aria-labelledby="amenity-editor-h" id="amenity-editor" className="gap-5 p-5 min-[600px]:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="amenity-editor-h" className="eyebrow text-bronze">
          Add an amenity
        </h3>
        <TextLink href={PATH}>Close</TextLink>
      </div>
      <ActionForm action={saveAmenityAction} className="flex flex-col gap-5">
        <AmenityFields />
        <FormCheckbox label="Shown to guests" name="active" defaultChecked />
        <div>
          <SubmitButton pendingText="Adding">Add amenity</SubmitButton>
        </div>
      </ActionForm>
    </Panel>
  );
}

const smallButton = "min-h-[44px] px-3 text-[11px]";

export default async function AmenitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const amenities = await listAllAmenities();
  const editId = one(sp.edit);
  const editing = editId ? amenities.find((a) => a.id === editId) : undefined;
  const creating = one(sp.new) === "1";

  const columns: Column<AdminAmenity>[] = [
    {
      key: "name",
      header: "Name",
      rowHeader: true,
      cell: (a) => <span className={`font-normal ${a.active ? "" : "text-ink-2"}`}>{a.name}</span>,
    },
    { key: "pricing", header: "Pricing", cell: (a) => PRICING_LABEL[a.pricing_type] },
    {
      key: "price",
      header: "Price, PKR",
      num: true,
      cell: (a) =>
        a.price === null ? (
          <>
            <Ph value="[__]" className="text-bad" />
            <span className="sr-only"> (to be confirmed)</span>
          </>
        ) : (
          fmtNum(a.price)
        ),
    },
    { key: "max", header: "Max qty", num: true, cell: (a) => a.max_quantity },
    {
      key: "shown",
      header: "Shown",
      cell: (a) => (
        <RowActionForm action={setAmenityShownAction} className="flex flex-wrap items-center gap-x-3">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="active" value={a.active ? "false" : "true"} />
          <span>{a.active ? "Yes" : "No"}</span>
          <SubmitButton variant="secondary" className={smallButton}>
            {a.active ? "Hide" : "Show"}
            <span className="sr-only"> {a.name} {a.active ? "from guests" : "to guests"}</span>
          </SubmitButton>
        </RowActionForm>
      ),
    },
    {
      key: "order",
      header: "Order",
      cell: (a, i) => (
        <div className="flex gap-1.5">
          <RowActionForm action={moveAmenityAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="direction" value="up" />
            <SubmitButton variant="secondary" className={smallButton} disabled={i === 0}>
              Up<span className="sr-only">: move {a.name} up</span>
            </SubmitButton>
          </RowActionForm>
          <RowActionForm action={moveAmenityAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="direction" value="down" />
            <SubmitButton variant="secondary" className={smallButton} disabled={i === amenities.length - 1}>
              Down<span className="sr-only">: move {a.name} down</span>
            </SubmitButton>
          </RowActionForm>
        </div>
      ),
    },
    {
      key: "edit",
      header: "Edit",
      srOnlyHeader: true,
      align: "right",
      cell: (a) => (
        <TextLink href={`${PATH}?edit=${a.id}#amenity-editor`} cell aria-current={editing?.id === a.id ? "true" : undefined}>
          Edit<span className="sr-only"> {a.name}</span>
        </TextLink>
      ),
    },
  ];

  return (
    <Section
      id="amen"
      title="Amenities"
      variant="display"
      gap={14}
      actions={
        creating ? null : (
          <ButtonLink href={`${PATH}?new=1#amenity-editor`} variant="secondary">
            Add an amenity
          </ButtonLink>
        )
      }
    >
      {one(sp.done) === "deleted" ? <Notice tone="ok">Amenity deleted.</Notice> : null}
      {editId && !editing ? (
        <Notice tone="bad" title="Not found.">
          That amenity no longer exists.
        </Notice>
      ) : null}
      {editing ? <Editor key={editing.id} amenity={editing} /> : null}
      {creating ? <Creator /> : null}
      <DataTable label="Amenities" columns={columns} rows={amenities} rowKey={(a) => a.id} minWidth={820} empty="No amenities yet." />
      <p className="m-0 text-[13px] text-ink-2">
        Guests see shown amenities in this order. A hidden amenity stays on the reservations that already include it.
      </p>
    </Section>
  );
}
