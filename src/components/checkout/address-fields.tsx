import { Field, Input, Textarea } from "@/components/ui/field";
import type { AddressSnapshot } from "@/lib/db/schema";

export function AddressFields({ defaults, prefix = "" }: { defaults?: Partial<AddressSnapshot>; prefix?: string }) {
  const n = (name: string) => `${prefix}${name}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name on the delivery" name={n("name")} className="sm:col-span-2">
        <Input id={n("name")} name={n("name")} defaultValue={defaults?.name ?? ""} autoComplete="name" required />
      </Field>
      <Field label="Address line 1" name={n("line1")} className="sm:col-span-2">
        <Input id={n("line1")} name={n("line1")} defaultValue={defaults?.line1 ?? ""} autoComplete="address-line1" required />
      </Field>
      <Field label="Address line 2" name={n("line2")} className="sm:col-span-2">
        <Input id={n("line2")} name={n("line2")} defaultValue={defaults?.line2 ?? ""} autoComplete="address-line2" />
      </Field>
      <Field label="Town / city" name={n("town")}>
        <Input id={n("town")} name={n("town")} defaultValue={defaults?.town ?? ""} autoComplete="address-level2" required />
      </Field>
      <Field label="County" name={n("county")}>
        <Input id={n("county")} name={n("county")} defaultValue={defaults?.county ?? ""} autoComplete="address-level1" />
      </Field>
      <Field label="Postcode" name={n("postcode")}>
        <Input id={n("postcode")} name={n("postcode")} defaultValue={defaults?.postcode ?? ""} autoComplete="postal-code" required />
      </Field>
      <Field label="Phone" name={n("phone")}>
        <Input id={n("phone")} name={n("phone")} type="tel" defaultValue={defaults?.phone ?? ""} autoComplete="tel" />
      </Field>
      <Field label="Delivery instructions" name={n("instructions")} className="sm:col-span-2">
        <Textarea id={n("instructions")} name={n("instructions")} defaultValue={defaults?.instructions ?? ""} rows={2} />
      </Field>
    </div>
  );
}
