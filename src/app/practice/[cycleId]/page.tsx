import { PracticeClient } from "@/components/learning/practice-client";

export default async function PracticePage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <PracticeClient cycleId={cycleId} />;
}
