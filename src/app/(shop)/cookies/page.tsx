import { ContentPage } from "@/components/content/prose";

export const metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <ContentPage title="Cookies">
      <p>We use essential cookies only in this first release: sign-in, basket, delivery postcode, VAT display preference, and an anonymous visitor id for assistant rate limits. No advertising cookies.</p>
    </ContentPage>
  );
}
