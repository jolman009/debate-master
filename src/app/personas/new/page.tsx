import { PersonaForm } from "@/components/personas/persona-form";

export const metadata = {
  title: "Create Persona · Debate Master",
};

export default function NewPersonaPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stage-text">
        Create a custom persona
      </h1>
      <p className="mb-6 mt-1 text-sm text-stage-muted">
        Design an AI opponent with its own style and voice. It will appear in
        your persona picker when you set up a debate.
      </p>
      <PersonaForm />
    </div>
  );
}
