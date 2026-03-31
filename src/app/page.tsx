import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-stage-accent to-purple-400 bg-clip-text text-transparent">
        Debate Master
      </h1>
      <p className="text-stage-muted text-lg text-center max-w-xl mb-10">
        Step onto the virtual debate stage. Choose a topic, pick your AI
        opponent, and sharpen your rhetorical skills in structured, turn-based
        debates.
      </p>
      <Link href="/debate/new" className="btn-primary text-lg px-8 py-3">
        Start a Debate
      </Link>
    </div>
  );
}
