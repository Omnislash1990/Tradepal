import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/ui/card";

export function ContentPage({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Container width="narrow" className="py-10">
      <PageHeader title={title} description={description} />
      <div className="prose mt-8 max-w-none space-y-4 text-ink-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-900">{children}</div>
    </Container>
  );
}
