import { saveSettingsAction } from "@/app/actions/admin";
import { AdminForm } from "../admin-form";
import { PageHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/server/auth";
import { llmConfigured } from "@/lib/server/llm";
import { emailConfigured } from "@/lib/server/notify";
import { stripeConfigured } from "@/lib/server/payments";
import { getSettings } from "@/lib/server/settings";

export const metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  await requireStaff("settings.edit");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Settings" />
      <ul className="mt-4 text-sm text-ink-600">
        <li>Stripe: {stripeConfigured() ? "configured" : "demo payments"}</li>
        <li>Email: {emailConfigured() ? "Resend" : "logged to outbox only"}</li>
        <li>Assistant language model: {llmConfigured() ? "Gemini / configured" : "rules only — add GEMINI_API_KEY"}</li>
      </ul>
      <AdminForm action={saveSettingsAction} className="mt-8 max-w-xl space-y-4">
        <input type="hidden" name="group" value="business" />
        <h2 className="font-bold">Business</h2>
        <Field label="Trading name" name="tradingName">
          <Input name="tradingName" defaultValue={s.business.tradingName} />
        </Field>
        <Field label="Legal name" name="legalName">
          <Input name="legalName" defaultValue={s.business.legalName} />
        </Field>
        <Field label="Company number" name="companyNumber">
          <Input name="companyNumber" defaultValue={s.business.companyNumber} />
        </Field>
        <Field label="VAT number" name="vatNumber">
          <Input name="vatNumber" defaultValue={s.business.vatNumber} />
        </Field>
        <Checkbox name="vatRegistered" defaultChecked={s.business.vatRegistered} label="VAT registered" />
        <Field label="Address" name="address">
          <Textarea name="address" defaultValue={s.business.address} />
        </Field>
        <Field label="Email" name="email">
          <Input name="email" defaultValue={s.business.email} />
        </Field>
        <Field label="Phone" name="phone">
          <Input name="phone" defaultValue={s.business.phone} />
        </Field>
        <SubmitButton>Save business</SubmitButton>
      </AdminForm>
      <AdminForm action={saveSettingsAction} className="mt-10 max-w-xl space-y-4">
        <input type="hidden" name="group" value="commerce" />
        <h2 className="font-bold">Commerce</h2>
        <Field label="Card fee %" name="paymentFeePct">
          <Input name="paymentFeePct" defaultValue={String(s.commerce.paymentFeeBps / 100)} />
        </Field>
        <Field label="Card fee fixed £" name="paymentFeeFixed">
          <Input name="paymentFeeFixed" defaultValue={(s.commerce.paymentFeeFixed / 100).toFixed(2)} />
        </Field>
        <Field label="Default trade discount %" name="defaultTradeDiscountPct">
          <Input name="defaultTradeDiscountPct" defaultValue={String(s.commerce.defaultTradeDiscountBps / 100)} />
        </Field>
        <Field label="Trade floor margin %" name="tradeFloorMarginPct">
          <Input name="tradeFloorMarginPct" defaultValue={String(s.commerce.tradeFloorMarginBps / 100)} />
        </Field>
        <Field label="Hold POs over £" name="manualReviewOver">
          <Input name="manualReviewOver" defaultValue={(s.commerce.manualReviewOverGross / 100).toFixed(2)} />
        </Field>
        <Checkbox name="autoSendPurchaseOrders" defaultChecked={s.commerce.autoSendPurchaseOrders} label="Send purchase orders automatically after payment" />
        <SubmitButton>Save commerce</SubmitButton>
      </AdminForm>
      <AdminForm action={saveSettingsAction} className="mt-10 max-w-xl space-y-4">
        <input type="hidden" name="group" value="ai" />
        <h2 className="font-bold">Assistant</h2>
        <Checkbox name="llmEnabled" defaultChecked={s.ai.llmEnabled} label="Allow optional language-model understanding (quantities still use the built-in estimator)" />
        <Field label="Daily LLM call cap" name="dailyLlmLimit">
          <Input name="dailyLlmLimit" defaultValue={String(s.ai.dailyLlmLimit)} />
        </Field>
        <Field label="Visitor messages per hour" name="visitorHourlyLimit">
          <Input name="visitorHourlyLimit" defaultValue={String(s.ai.visitorHourlyLimit)} />
        </Field>
        <SubmitButton>Save AI</SubmitButton>
      </AdminForm>
    </div>
  );
}
