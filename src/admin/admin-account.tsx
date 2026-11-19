"use client";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
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
    <div className="admin-account-page">
      <div className="admin-account-heading">
        <span>
          <AccountCircleOutlinedIcon aria-hidden="true" />
        </span>
        <div>
          <Typography component="h1" variant="h5">
            حساب مدیر
          </Typography>
          <p>مدیریت اطلاعات حساب و نشست‌های فعال</p>
        </div>
      </div>
      {message && (
        <Alert role="status" severity="info">
          {message}
        </Alert>
      )}
      <section className="admin-account-card">
        <div className="admin-account-section-heading">
          <span>
            <PersonOutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>اطلاعات حساب</h2>
            <p>مشخصات مدیر فروشگاه را بررسی و ویرایش کنید.</p>
          </div>
        </div>
        <Box component="form" onSubmit={save} className="admin-account-form">
          <TextField
            label="نام و نام خانوادگی"
            value={profile.name}
            onChange={(event) =>
              setProfile({ ...profile, name: event.target.value })
            }
            required
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlinedIcon aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="نام کاربری"
            value={profile.username}
            onChange={(event) =>
              setProfile({ ...profile, username: event.target.value })
            }
            required
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeOutlinedIcon aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="شماره همراه"
            value={profile.mobile}
            onChange={(event) =>
              setProfile({ ...profile, mobile: event.target.value })
            }
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneOutlinedIcon aria-hidden="true" />
                  </InputAdornment>
                ),
              },
              htmlInput: { inputMode: "tel" },
            }}
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
      </section>
      <section className="admin-account-card">
        <div className="admin-account-section-heading">
          <span>
            <DevicesOutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>نشست‌های فعال</h2>
            <p>نشست‌های حساب مدیر را مشاهده و مدیریت کنید.</p>
          </div>
        </div>
        {sessions.length === 0 ? (
          <Typography className="admin-session-empty">
            نشست فعالی وجود ندارد.
          </Typography>
        ) : (
          sessions.map((item) => (
            <Box key={item.id} className="admin-session-card">
              <div className="admin-session-details">
                <div className="admin-session-title">
                  <DevicesOutlinedIcon aria-hidden="true" />
                  <strong>{item.current ? "نشست فعلی" : "نشست دیگر"}</strong>
                  {item.current && <span>فعال</span>}
                </div>
                <div className="admin-session-dates">
                  <span>
                    <EventOutlinedIcon aria-hidden="true" /> ایجاد:{" "}
                    {formatTehranJalali(item.createdAt)}
                  </span>
                  <span>
                    <ScheduleOutlinedIcon aria-hidden="true" /> انقضا:{" "}
                    {formatTehranJalali(item.expiresAt)}
                  </span>
                </div>
              </div>
              <Button
                className="admin-session-end"
                variant="outlined"
                color="error"
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
      </section>
    </div>
  );
}
