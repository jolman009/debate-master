import { DebateStage } from "@/components/debate/debate-stage";

interface DebatePageProps {
  params: { debateId: string };
}

export default function DebatePage({ params }: DebatePageProps) {
  return <DebateStage debateId={params.debateId} />;
}
