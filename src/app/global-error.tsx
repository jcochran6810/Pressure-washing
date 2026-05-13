"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, background: "#f8fafc" }}>
        <div
          style={{
            maxWidth: 560,
            margin: "60px auto",
            padding: 24,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#b91c1c" }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 8, color: "#475569", fontSize: 14 }}>
            We hit an unexpected error. The team has been notified. You can try again, or jump back to
            the dashboard.
          </p>
          {error?.digest && (
            <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
              Reference: {error.digest}
            </p>
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "8px 16px",
                background: "#2563eb",
                color: "#fff",
                border: 0,
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                padding: "8px 16px",
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
