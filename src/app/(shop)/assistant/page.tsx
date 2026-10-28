import { AssistantChat } from "@/components/assistant/chat";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "AI assistant" };

export default function AssistantPage() {
  return (
    <Container className="py-8">
      <PageHeader
        eyebrow="Estimates, not specifications"
        title="Tell us the job"
        description="We'll suggest products and quantities from your measurements. Review every line before you buy — waste, openings and site conditions vary."
      />
      <div className="mt-8">
        <AssistantChat />
      </div>
    </Container>
  );
}
