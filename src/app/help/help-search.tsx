"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HelpSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/help${params.toString() ? `?${params}` : ""}`);
  }
  return (
    <form onSubmit={onSubmit} className="mb-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search articles…"
        className="w-full text-base"
      />
    </form>
  );
}
