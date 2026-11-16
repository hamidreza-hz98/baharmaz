"use client";
import { useState } from "react";
export function ContactForm() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, message }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.message || "ثبت پیام ممکن نشد.");
        return;
      }
      setName("");
      setMobile("");
      setMessage("");
      setStatus(data.message);
    } catch {
      setStatus("ارتباط برقرار نشد؛ لطفاً دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="contact-form" onSubmit={send}>
      <h2>پیام خود را بنویسید</h2>
      <label htmlFor="contact-name">نام و نام خانوادگی</label>
      <input
        id="contact-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
        maxLength={120}
        autoComplete="name"
      />
      <label htmlFor="contact-mobile">شماره همراه</label>
      <input
        id="contact-mobile"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        required
        maxLength={30}
        inputMode="tel"
        autoComplete="tel"
        dir="ltr"
      />
      <label htmlFor="contact-message">متن پیام</label>
      <textarea
        id="contact-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        minLength={5}
        maxLength={4000}
        rows={6}
      />
      <button className="catalog-button" disabled={busy}>
        {busy ? "در حال ثبت…" : "ثبت پیام"}
      </button>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
