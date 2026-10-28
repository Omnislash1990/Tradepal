import { ContentPage } from "@/components/content/prose";

export const metadata = { title: "Returns" };

export default function ReturnsPage() {
  return (
    <ContentPage title="Returns & refunds">
      <p>UK consumer rights apply to DIY customers. Trade customers should check the product and quantities on delivery.</p>
      <h2>How to return</h2>
      <p>Open the order in your account and submit a return request, or contact us with the order number. Unused, resaleable stock is usually collected or accepted back by the fulfilling supplier.</p>
      <h2>Refunds</h2>
      <p>Refunds go to the original payment method and typically show within 5–10 working days after we receive the goods. Made-to-order or cut materials may not be returnable.</p>
    </ContentPage>
  );
}
