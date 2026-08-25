"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeletePersonaButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this persona? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/personas/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="touch-target shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-stage-muted transition-colors hover:bg-stage-con/10 hover:text-stage-con disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}
