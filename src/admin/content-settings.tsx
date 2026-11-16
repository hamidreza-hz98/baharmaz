"use client";
import { useEffect, useRef, useState } from "react";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { MediaPicker } from "@/admin/media/media-picker";
import type {
  ContentSection,
  SiteContentSettings,
} from "@/shared/content";

const sectionTitles: Record<ContentSection, string> = {
  homepage: "تنظیمات صفحه اصلی",
  contact: "تنظیمات تماس",
  faq: "پرسش‌های متداول",
  terms: "قوانین و شرایط",
  about: "درباره ما",
};
const emptySiteContent: SiteContentSettings = {
  homepage: {
    banners: [],
    slogans: [],
    aboutTitle: "",
    aboutText: "",
    aboutImageId: null,
  },
  contact: { phones: [], socials: [], address: "", mapUrl: "" },
  faq: { title: "", description: "", items: [] },
  terms: { title: "", description: "", items: [] },
  about: { title: "", body: "", imageId: null },
};
const newId = () => crypto.randomUUID();
function move<T>(items: T[], index: number, direction: number) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
}
function ListControls({
  index,
  length,
  label,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  label: string;
  onMove: (d: number) => void;
  onRemove: () => void;
}) {
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  return (
    <div className="content-controls">
      <Button
        type="button"
        ref={up}
        disabled={index === 0}
        onClick={() => {
          onMove(-1);
          if (index === 1) requestAnimationFrame(() => down.current?.focus());
        }}
        aria-label={`انتقال ${label} به بالا`}
      >
        بالا
      </Button>
      <Button
        type="button"
        ref={down}
        disabled={index === length - 1}
        onClick={() => {
          onMove(1);
          if (index === length - 2)
            requestAnimationFrame(() => up.current?.focus());
        }}
        aria-label={`انتقال ${label} به پایین`}
      >
        پایین
      </Button>
      <Button type="button" onClick={onRemove} aria-label={`حذف ${label}`}>
        حذف
      </Button>
    </div>
  );
}
type Target =
  { section: "banner"; id: string } | { section: "home-about" | "about" };
export function ContentSettingsEditor({
  section,
}: {
  section: ContentSection;
}) {
  const [content, setContent] = useState<SiteContentSettings | null>(null);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [picker, setPicker] = useState<Target | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/content/${section}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: { revision: number; value: unknown }) => {
        setContent({
          ...emptySiteContent,
          [section]: data.value,
        } as SiteContentSettings);
        setRevision(data.revision);
        setDirty(false);
        setLoading(false);
        setError("");
        setConflict(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError("دریافت تنظیمات ممکن نشد.");
        }
      });
    return () => controller.abort();
  }, [refresh, section]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function edit(change: (draft: SiteContentSettings) => void) {
    setContent((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      change(next);
      return next;
    });
    setDirty(true);
    setMessage("");
  }
  function reload() {
    setConfirmReload(false);
    setLoading(true);
    setError("");
    setRefresh((n) => n + 1);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!content) return;
    setBusy(true);
    setError("");
    setMessage("");
    setConflict(false);
    try {
      const response = await fetch(`/api/admin/content/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, value: content[section] }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "ذخیره تنظیمات ممکن نشد.");
        setConflict(response.status === 409);
        return;
      }
      setContent({
        ...content,
        [section]: data.value,
      } as SiteContentSettings);
      setRevision(data.revision);
      setDirty(false);
      setMessage("تنظیمات ذخیره شد.");
    } catch {
      setError("ارتباط برقرار نشد. تغییرات شما حفظ شده است.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">در حال دریافت تنظیمات…</p>;
  if (!content)
    return (
      <div role="alert">
        {error || "دریافت تنظیمات ممکن نشد."}{" "}
        <Button onClick={reload}>تلاش دوباره</Button>
      </div>
    );
  const h = content.homepage,
    c = content.contact;
  return (
    <>
      <h1>{sectionTitles[section]}</h1>
      <p>تغییرات این بخش پس از ذخیره فقط در صفحه مربوطه اعمال می‌شوند.</p>
      {message && (
        <Alert severity="success" role="status">
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" role="alert">
          {error} تغییرات ذخیره‌نشده حفظ شده‌اند.{" "}
          {conflict && (
            <Button type="button" onClick={() => setConfirmReload(true)}>
              دریافت نسخه جدید
            </Button>
          )}
        </Alert>
      )}
      <form onSubmit={save} className="content-settings-form">
        {section === "homepage" && (
          <>
        <fieldset disabled={busy}>
          <legend>بنرهای صفحه اصلی</legend>
          <p>پیوند بنر باید مسیر داخلی فروشگاه باشد، مانند /products.</p>
          {h.banners.map((item, index) => (
            <div className="content-entry" key={item.id}>
              <h3>بنر {index + 1}</h3>
              <label>
                متن جایگزین بنر {index + 1}
                <input
                  maxLength={200}
                  value={item.alt}
                  onChange={(e) =>
                    edit((d) => {
                      d.homepage.banners[index].alt = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                پیوند بنر {index + 1}
                <input
                  dir="ltr"
                  maxLength={2048}
                  value={item.href}
                  onChange={(e) =>
                    edit((d) => {
                      d.homepage.banners[index].href = e.target.value;
                    })
                  }
                />
              </label>
              <p>
                {item.imageId
                  ? "تصویر انتخاب شده است."
                  : "تصویری انتخاب نشده است."}
              </p>
              <Button
                type="button"
                onClick={() => setPicker({ section: "banner", id: item.id })}
              >
                انتخاب تصویر بنر {index + 1}
              </Button>
              {item.imageId && (
                <Button
                  type="button"
                  onClick={() =>
                    edit((d) => {
                      d.homepage.banners[index].imageId = null;
                    })
                  }
                >
                  حذف تصویر بنر {index + 1}
                </Button>
              )}
              <ListControls
                index={index}
                length={h.banners.length}
                label={`بنر ${index + 1}`}
                onMove={(v) => edit((d) => move(d.homepage.banners, index, v))}
                onRemove={() =>
                  edit((d) => {
                    d.homepage.banners.splice(index, 1);
                  })
                }
              />
            </div>
          ))}
          <Button
            type="button"
            disabled={h.banners.length >= 30}
            onClick={() =>
              edit((d) => {
                d.homepage.banners.push({
                  id: newId(),
                  imageId: null,
                  href: "",
                  alt: "",
                });
              })
            }
          >
            افزودن بنر
          </Button>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>شعارها و معرفی صفحه اصلی</legend>
          {h.slogans.map((item, index) => (
            <div className="content-entry" key={item.id}>
              <label>
                شعار {index + 1}
                <input
                  maxLength={200}
                  value={item.text}
                  onChange={(e) =>
                    edit((d) => {
                      d.homepage.slogans[index].text = e.target.value;
                    })
                  }
                />
              </label>
              <ListControls
                index={index}
                length={h.slogans.length}
                label={`شعار ${index + 1}`}
                onMove={(v) => edit((d) => move(d.homepage.slogans, index, v))}
                onRemove={() =>
                  edit((d) => {
                    d.homepage.slogans.splice(index, 1);
                  })
                }
              />
            </div>
          ))}
          <Button
            type="button"
            disabled={h.slogans.length >= 30}
            onClick={() =>
              edit((d) => {
                d.homepage.slogans.push({ id: newId(), text: "" });
              })
            }
          >
            افزودن شعار
          </Button>
          <label>
            عنوان معرفی صفحه اصلی
            <input
              maxLength={160}
              value={h.aboutTitle}
              onChange={(e) =>
                edit((d) => {
                  d.homepage.aboutTitle = e.target.value;
                })
              }
            />
          </label>
          <label>
            متن معرفی صفحه اصلی
            <textarea
              maxLength={10000}
              value={h.aboutText}
              onChange={(e) =>
                edit((d) => {
                  d.homepage.aboutText = e.target.value;
                })
              }
            />
          </label>
          <p>
            {h.aboutImageId
              ? "تصویر معرفی انتخاب شده است."
              : "تصویر معرفی انتخاب نشده است."}
          </p>
          <Button
            type="button"
            onClick={() => setPicker({ section: "home-about" })}
          >
            انتخاب تصویر معرفی
          </Button>
          {h.aboutImageId && (
            <Button
              type="button"
              onClick={() =>
                edit((d) => {
                  d.homepage.aboutImageId = null;
                })
              }
            >
              حذف تصویر معرفی
            </Button>
          )}
        </fieldset>
          </>
        )}
        {section === "contact" && (
        <fieldset disabled={busy}>
          <legend>اطلاعات تماس</legend>
          {c.phones.map((item, index) => (
            <div className="content-entry" key={item.id}>
              <label>
                شماره تماس {index + 1}
                <input
                  type="tel"
                  dir="ltr"
                  maxLength={40}
                  value={item.value}
                  onChange={(e) =>
                    edit((d) => {
                      d.contact.phones[index].value = e.target.value;
                    })
                  }
                />
              </label>
              <ListControls
                index={index}
                length={c.phones.length}
                label={`شماره تماس ${index + 1}`}
                onMove={(v) => edit((d) => move(d.contact.phones, index, v))}
                onRemove={() =>
                  edit((d) => {
                    d.contact.phones.splice(index, 1);
                  })
                }
              />
            </div>
          ))}
          <Button
            type="button"
            disabled={c.phones.length >= 20}
            onClick={() =>
              edit((d) => {
                d.contact.phones.push({ id: newId(), value: "" });
              })
            }
          >
            افزودن شماره تماس
          </Button>
          {c.socials.map((item, index) => (
            <div className="content-entry" key={item.id}>
              <label>
                نام شبکه اجتماعی یا پیام‌رسان {index + 1}
                <input
                  maxLength={80}
                  value={item.label}
                  onChange={(e) =>
                    edit((d) => {
                      d.contact.socials[index].label = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                پیوند شبکه اجتماعی یا پیام‌رسان {index + 1}
                <input
                  type="url"
                  dir="ltr"
                  maxLength={2048}
                  value={item.url}
                  onChange={(e) =>
                    edit((d) => {
                      d.contact.socials[index].url = e.target.value;
                    })
                  }
                />
              </label>
              <ListControls
                index={index}
                length={c.socials.length}
                label={`شبکه اجتماعی ${index + 1}`}
                onMove={(v) => edit((d) => move(d.contact.socials, index, v))}
                onRemove={() =>
                  edit((d) => {
                    d.contact.socials.splice(index, 1);
                  })
                }
              />
            </div>
          ))}
          <Button
            type="button"
            disabled={c.socials.length >= 20}
            onClick={() =>
              edit((d) => {
                d.contact.socials.push({ id: newId(), label: "", url: "" });
              })
            }
          >
            افزودن شبکه اجتماعی یا پیام‌رسان
          </Button>
          <label>
            نشانی فروشگاه
            <textarea
              maxLength={1000}
              value={c.address}
              onChange={(e) =>
                edit((d) => {
                  d.contact.address = e.target.value;
                })
              }
            />
          </label>
          <label>
            پیوند نقشه
            <input
              type="url"
              dir="ltr"
              maxLength={2048}
              value={c.mapUrl}
              onChange={(e) =>
                edit((d) => {
                  d.contact.mapUrl = e.target.value;
                })
              }
            />
          </label>
          <p>پیوند شبکه‌ها و نقشه باید با https شروع شود.</p>
        </fieldset>
        )}
        {(section === "faq" || section === "terms" ? [section] : []).map((section) => {
          const label = section === "faq" ? "پرسش‌های متداول" : "قوانین";
          const group = content[section];
          return (
            <fieldset key={section} disabled={busy}>
              <legend>{label}</legend>
              <label>
                عنوان {label}
                <input
                  maxLength={160}
                  value={group.title}
                  onChange={(e) =>
                    edit((d) => {
                      d[section].title = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                توضیح {label}
                <textarea
                  maxLength={2000}
                  value={group.description}
                  onChange={(e) =>
                    edit((d) => {
                      d[section].description = e.target.value;
                    })
                  }
                />
              </label>
              {group.items.map((item, index) => (
                <div className="content-entry" key={item.id}>
                  <label>
                    عنوان مورد {index + 1} {label}
                    <input
                      maxLength={250}
                      value={item.title}
                      onChange={(e) =>
                        edit((d) => {
                          d[section].items[index].title = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    متن مورد {index + 1} {label}
                    <textarea
                      maxLength={10000}
                      value={item.body}
                      onChange={(e) =>
                        edit((d) => {
                          d[section].items[index].body = e.target.value;
                        })
                      }
                    />
                  </label>
                  <ListControls
                    index={index}
                    length={group.items.length}
                    label={`مورد ${index + 1} ${label}`}
                    onMove={(v) =>
                      edit((d) => move(d[section].items, index, v))
                    }
                    onRemove={() =>
                      edit((d) => {
                        d[section].items.splice(index, 1);
                      })
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                disabled={group.items.length >= 100}
                onClick={() =>
                  edit((d) => {
                    d[section].items.push({ id: newId(), title: "", body: "" });
                  })
                }
              >
                افزودن مورد {label}
              </Button>
            </fieldset>
          );
        })}
        {section === "about" && (
        <fieldset disabled={busy}>
          <legend>صفحه درباره ما</legend>
          <label>
            عنوان درباره ما
            <input
              maxLength={160}
              value={content.about.title}
              onChange={(e) =>
                edit((d) => {
                  d.about.title = e.target.value;
                })
              }
            />
          </label>
          <label>
            متن درباره ما
            <textarea
              maxLength={20000}
              value={content.about.body}
              onChange={(e) =>
                edit((d) => {
                  d.about.body = e.target.value;
                })
              }
            />
          </label>
          <p>
            {content.about.imageId
              ? "تصویر درباره ما انتخاب شده است."
              : "تصویر درباره ما انتخاب نشده است."}
          </p>
          <Button type="button" onClick={() => setPicker({ section: "about" })}>
            انتخاب تصویر درباره ما
          </Button>
          {content.about.imageId && (
            <Button
              type="button"
              onClick={() =>
                edit((d) => {
                  d.about.imageId = null;
                })
              }
            >
              حذف تصویر درباره ما
            </Button>
          )}
        </fieldset>
        )}
        <Button
          type="submit"
          variant="contained"
          size="small"
          startIcon={<SaveOutlinedIcon />}
          disabled={busy || !dirty}
        >
          {busy ? "در حال ذخیره…" : "ذخیره تنظیمات"}
        </Button>
        {dirty && <span role="status">تغییرات ذخیره نشده است.</span>}
      </form>
      <MediaPicker
        open={picker !== null}
        allowedKind="image"
        onClose={() => setPicker(null)}
        onSelect={(item) => {
          const target = picker;
          if (!target) return;
          edit((d) => {
            if (target.section === "banner") {
              const banner = d.homepage.banners.find((x) => x.id === target.id);
              if (banner) banner.imageId = item.id;
            } else if (target.section === "home-about")
              d.homepage.aboutImageId = item.id;
            else d.about.imageId = item.id;
          });
        }}
      />
      <Dialog
        open={confirmReload}
        onClose={() => setConfirmReload(false)}
        aria-labelledby="content-reload-title"
      >
        <DialogTitle id="content-reload-title">دریافت نسخه جدید</DialogTitle>
        <DialogContent>
          با دریافت نسخه جدید، تغییرات ذخیره‌نشده این صفحه حذف می‌شوند.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReload(false)}>انصراف</Button>
          <Button onClick={reload}>دریافت نسخه جدید</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
