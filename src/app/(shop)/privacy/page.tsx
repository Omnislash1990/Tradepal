import { ContentPage } from "@/components/content/prose";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy notice">
      <p>This is a working draft for the demo. Have it reviewed before collecting real customer data.</p>
      <h2>What we store</h2>
      <p>Account details, addresses, orders, support messages, and (if you use the assistant) the text of your job description. We use a visitor cookie so assistant usage limits work.</p>
      <h2>Payments</h2>
      <p>Card details are handled by Stripe. We store payment references, not full card numbers.</p>
      <h2>Your rights</h2>
      <p>You can ask for a copy of your data, corrections, or deletion, subject to records we must keep for tax and consumer law. Email the address in account settings.</p>
    </ContentPage>
  );
}
