import { ContentPage } from "@/components/content/prose";

export const metadata = { title: "Delivery" };

export default function DeliveryPage() {
  return (
    <ContentPage title="Delivery" description="Launch area: West Midlands core.">
      <h2>How deliveries work</h2>
      <p>A basket can split across more than one supplier. Parcel, van and heavy (flatbed) items may arrive on different days. Checkout shows each estimated date.</p>
      <h2>Charges (illustrative)</h2>
      <p>West Midlands core: parcels from £4.99 (free over £50), van from £9.99 (free over £150), heavy from £29.99 (free over £600). Confirm live rates before launch.</p>
      <h2>Heavy goods</h2>
      <p>Kerbside delivery. Someone should be available to receive. We cannot currently book timed slots.</p>
    </ContentPage>
  );
}
