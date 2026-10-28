import { ContentPage } from "@/components/content/prose";

export const metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <ContentPage title="Help centre" description="Short answers for the first release. Contact us if something isn't covered.">
      <h2>How does Tradepal work?</h2>
      <p>We&apos;re an online reseller. You order here; approved suppliers fulfil where the commercial arrangements allow. Stock shown as verified comes from a supplier feed. Other items are available to order and confirmed after you pay.</p>
      <h2>Delivery area</h2>
      <p>We currently quote for Birmingham, the Black Country and Coventry (postcode areas B, CV, DY, WS and WV). Enter your postcode to check.</p>
      <h2>AI estimates</h2>
      <p>The assistant calculates quantities from your measurements and typical waste. It is not a specification. Always review the list and your site before buying.</p>
      <h2>VAT</h2>
      <p>Retail prices include VAT. Trade accounts can switch to ex VAT. Checkout totals always include VAT.</p>
      <h2>Payments</h2>
      <p>Card payments go through Stripe when configured. Without Stripe keys this demo records a simulated payment so you can walk the order flow.</p>
    </ContentPage>
  );
}
