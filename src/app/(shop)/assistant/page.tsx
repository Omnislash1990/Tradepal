import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/chat";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "AI assistant" };
export const maxDuration = 30;

export default function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  return (
    <Container className="py-8">
      <PageHeader
        eyebrow="Estimates, not specifications"
        title="Tell us the job"
        description="We'll suggest products and quantities from your measurements. Review every line before you buy — waste, openings and site conditions vary."
      />
      <div className="mt-8">
        <Suspense fallback={<AssistantChat />}>
          <AssistantFromQuery searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function AssistantFromQuery({
  searchParams,
}: {
  searchParams: PageProps<"/assistant">["searchParams"];
}) {
  const sp = await searchParams;
  const initialQuery = typeof sp.q === "string" ? sp.q.trim().slice(0, 500) : "";
  return <AssistantChat initialQuery={initialQuery} />;
}
