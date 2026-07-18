import { SetupWizard } from "@/components/setup/setup-wizard";
import { getPersonas, getTopics, getTopicPacks } from "@/lib/debate/content";
import { isTwa } from "@/lib/platform/twa-server";

export default async function NewDebatePage() {
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
    />
  );
}
