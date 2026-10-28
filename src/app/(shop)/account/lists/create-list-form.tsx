"use client";

import { useActionState } from "react";
import { createListAction } from "@/app/actions/account";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function CreateListForm() {
  const [state, action] = useActionState(createListAction, null);
  return (
    <form action={action} className="mt-4 flex max-w-lg flex-wrap items-end gap-3">
      <Field label="Name" name="name" className="flex-1">
        <Input id="name" name="name" required />
      </Field>
      <Field label="Type" name="kind">
        <Select id="kind" name="kind" defaultValue="saved">
          <option value="saved">Saved list</option>
          <option value="job">Job list</option>
        </Select>
      </Field>
      <SubmitButton>Create</SubmitButton>
      <FormMessage>{state?.message}</FormMessage>
    </form>
  );
}
