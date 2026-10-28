import { ContentPage } from "@/components/content/prose";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <ContentPage title="Terms of sale">
      <p>Draft terms for the first release. They need legal review before taking real orders.</p>
      <h2>Contract</h2>
      <p>When you pay, you buy from Tradepal. We then order from suppliers to fulfil. Title passes when goods are delivered.</p>
      <h2>Prices</h2>
      <p>The price at checkout is the price you pay. AI estimates are not offers.</p>
      <h2>Availability</h2>
      <p>If a supplier cannot fulfil, we will substitute with your agreement, cancel the line, or refund.</p>
    </ContentPage>
  );
}
