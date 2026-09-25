import { PracticeClient } from "@/components/learning/practice-client";

export default function PracticePage({ params }: { params: { cycleId: string } }) {
  return <PracticeClient cycleId={params.cycleId} />;
}
