"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>RecallAI hit an unexpected error</h1>
          <button onClick={reset} style={{ marginTop: 12, padding: "6px 14px", cursor: "pointer" }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
