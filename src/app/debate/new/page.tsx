import { SetupWizard } from "@/components/setup/setup-wizard";
import { getPersonas, getTopics } from "@/lib/debate/content";

export default async function NewDebatePage() {
  const [personas, topics] = await Promise.all([getPersonas(), getTopics()]);
  return <SetupWizard personas={personas} topics={topics} />;
}
