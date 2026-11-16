"use client";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { formatTehranJalali } from "@/shared/locale";
type AdminProfile = { name: string; username: string; mobile: string };
type AdminSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};
export function AdminAccount() {
  const router = useRouter();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  async function load() {
    try {
      const res = await fetch("/api/admin/account", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLoadError(false);
      setProfile({
        name: data.profile.name || "",
        username: data.profile.username,
        mobile: data.profile.mobile || "",
      });
      setSessions(data.sessions);
    } catch {
      setLoadError(true);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/account", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setProfile({
          name: data.profile.name || "",
          username: data.profile.username,
          mobile: data.profile.mobile || "",
        });
        setSessions(data.sessions);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, []);
  async function send(body: object) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "درخواست انجام نشد.");
        return null;
      }
      return data;
    } catch {
      setMessage("ارتباط برقرار نشد.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    const result = await send({ action: "profile", ...profile });
    if (result) {
      setProfile(result.profile);
      setMessage("اطلاعات ذخیره شد.");
    }
  }
  async function revoke(id: string) {
    const result = await send({ action: "revoke", sessionId: id });
    if (!result) return;
    if (result.current) {
      router.push("/admin/login");
      router.refresh();
      return;
    }
    setSessions((items) => items.filter((item) => item.id !== id));
    setMessage("نشست پایان یافت.");
  }
  if (loadError)
    return (
      <>
        <Typography>دریافت اطلاعات ممکن نشد.</Typography>
        <Button onClick={load}>تلاش دوباره</Button>
      </>
    );
  if (!profile) return <Typography role="status">در حال بارگذاری…</Typography>;
  return (
    <>
      <Typography component="h1" variant="h5">
        حساب مدیر
      </Typography>
      {message && (
        <Alert role="status" severity="info">
          {message}
        </Alert>
      )}
      <Box
        component="form"
        onSubmit={save}
        sx={{ display: "grid", gap: 2, maxWidth: 540, my: 2 }}
      >
        <TextField
          label="نام و نام خانوادگی"
          value={profile.name}
          onChange={(event) =>
            setProfile({ ...profile, name: event.target.value })
          }
          required
        />
        <TextField
          label="نام کاربری"
          value={profile.username}
          onChange={(event) =>
            setProfile({ ...profile, username: event.target.value })
          }
          required
        />
        <TextField
          label="شماره همراه"
          value={profile.mobile}
          onChange={(event) =>
            setProfile({ ...profile, mobile: event.target.value })
          }
        />
        <Box>
          <Button
            type="submit"
            variant="contained"
            size="small"
            startIcon={<SaveOutlinedIcon />}
            disabled={busy}
          >
            ذخیره تغییرات
          </Button>
        </Box>
      </Box>
      <Typography component="h2" variant="h6">
        نشست‌های فعال
      </Typography>
      {sessions.length === 0 ? (
        <Typography>نشست فعالی وجود ندارد.</Typography>
      ) : (
        sessions.map((item) => (
          <Box
            key={item.id}
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
              py: 1,
            }}
          >
            <Typography>
              {item.current ? "نشست فعلی" : "نشست دیگر"} — ایجاد:{" "}
              {formatTehranJalali(item.createdAt)} — انقضا:{" "}
              {formatTehranJalali(item.expiresAt)}
            </Typography>
            <Button
              size="small"
              startIcon={<LogoutOutlinedIcon />}
              onClick={() => revoke(item.id)}
              disabled={busy}
            >
              {item.current ? "خروج از این نشست" : "پایان نشست"}
            </Button>
          </Box>
        ))
      )}
    </>
  );
}
