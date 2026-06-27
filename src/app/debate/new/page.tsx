import { SetupWizard } from "@/components/setup/setup-wizard";
import { getPersonas, getTopics, getTopicPacks } from "@/lib/debate/content";

export default async function NewDebatePage() {
  const [personas, topics, packs] = await Promise.all([
    getPersonas(),
    getTopics(),
    getTopicPacks(),
  ]);
  return <SetupWizard personas={personas} topics={topics} packs={packs} />;
}
