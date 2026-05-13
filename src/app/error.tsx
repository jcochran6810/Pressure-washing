"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="card-padded max-w-md w-full text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <h1 className="text-xl font-bold text-red-700">Something went wrong</h1>
        <p className="text-sm text-gray-600 mt-2">
          {error?.message?.slice(0, 240) || "An unexpected error occurred."}
        </p>
        {error?.digest && (
          <p className="text-xs text-gray-400 mt-1">Reference: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center mt-4">
          <button onClick={() => reset()} className="btn-primary">Try again</button>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
