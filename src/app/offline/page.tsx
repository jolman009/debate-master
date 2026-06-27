export const metadata = {
  title: "Offline · Debate Master",
};

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-stage-text">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-stage-muted">
        Debate Master needs a connection to run live debates. Reconnect and try
        again — your saved debates will be here when you&apos;re back.
      </p>
    </div>
  );
}
