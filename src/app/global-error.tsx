"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          background: "#fffbf5",
          color: "#2e2524",
          fontFamily: "Tahoma, sans-serif",
          margin: 0,
        }}
      >
        <main
          style={{
            maxWidth: 640,
            margin: "4rem auto",
            padding: "0 1.5rem",
            textAlign: "center",
          }}
        >
          <h1>مشکلی پیش آمد</h1>
          <p>لطفاً دوباره تلاش کنید.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "8px 16px", cursor: "pointer" }}
          >
            تلاش دوباره
          </button>
        </main>
      </body>
    </html>
  );
}
