"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Alert, Button, TextField } from "@mui/material";

export function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ورود ممکن نشد.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <section className="admin-login-form">
          <Link href="/" className="admin-login-brand">
            <Image
              src="/brand/baharmaz-mark.png"
              width={48}
              height={48}
              alt=""
            />
            بهارمز
          </Link>
          <h1>ورود به پنل مدیریت</h1>
          <p>برای مدیریت فروشگاه وارد حساب مدیریت شوید.</p>
          <form onSubmit={submit}>
            <TextField
              label="نام کاربری"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              fullWidth
              slotProps={{ htmlInput: { dir: "ltr", maxLength: 64 } }}
            />
            <div className="admin-password">
              <TextField
                label="رمز عبور"
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                fullWidth
                slotProps={{ htmlInput: { dir: "ltr", maxLength: 1024 } }}
              />
              <Button
                type="button"
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? "پنهان" : "نمایش"}
              </Button>
            </div>
            {error && (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            )}
            <Button type="submit" variant="contained" disabled={busy} fullWidth>
              {busy ? "در حال بررسی…" : "ورود"}
            </Button>
          </form>
          <Link href="/">بازگشت به فروشگاه</Link>
        </section>
        <aside className="admin-login-art">
          <h2>مدیریت فروشگاه بهارمز</h2>
          <p>ابزارهای مدیریت فروشگاه در یک نگاه</p>
        </aside>
      </div>
    </main>
  );
}
