import { SetupWizard } from "@/components/setup/setup-wizard";
import { getPersonas, getTopics, getTopicPacks } from "@/lib/debate/content";
import { isTwa } from "@/lib/platform/twa-server";

import { Difficulty } from "@/lib/debate/types";

function toDifficulty(value: string | undefined): Difficulty | undefined {
  return value === "beginner" || value === "intermediate" || value === "advanced"
    ? value
    : undefined;
}

export default async function NewDebatePage({
  searchParams,
}: {
  searchParams?: { motion?: string; difficulty?: string; goal?: string };
}) {
  const [personas, topics, packs] = await Promise.all([
    getPersonas(),
    getTopics(),
    getTopicPacks(),
  ]);
  return (
    <SetupWizard
      personas={personas}
      topics={topics}
      packs={packs}
      // Play policy: the upgrade link is hidden inside the Android app.
      inTwa={isTwa()}
      initialCustomTopic={searchParams?.motion ?? ""}
      initialDifficulty={toDifficulty(searchParams?.difficulty)}
      initialCoachingGoal={searchParams?.goal}
    />
  );
}
