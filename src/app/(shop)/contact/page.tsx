import { ContactForm } from "./contact-form";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <Container width="narrow" className="py-10">
      <PageHeader title="Contact us" description="We aim to reply within one working day." />
      <ContactForm name={user?.name ?? ""} email={user?.email ?? ""} />
    </Container>
  );
}
