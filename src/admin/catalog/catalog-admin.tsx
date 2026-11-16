"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import SortOutlinedIcon from "@mui/icons-material/SortOutlined";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { AdminThumbnail } from "@/admin/media/admin-thumbnail";
import { MediaPicker } from "@/admin/media/media-picker";
import type { MediaItem } from "@/shared/media";

type Kind = "categories" | "ingredients";
type Item = {
  id: string;
  name: string;
  slug?: string;
  excerpt?: string;
  imageId?: string | null;
  iconId?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  seo?: { title: string; description: string };
};
type Page = {
  items: Item[];
  page: number;
  limit: number;
  total: number;
  revision?: number;
};
type Order = {
  items: {
    id: string;
    name: string;
    imageId?: string | null;
    iconId?: string | null;
    parentId?: string | null;
  }[];
  revision: number;
};
export function CatalogAdmin({ kind }: { kind: Kind }) {
  const category = kind === "categories";
  const title = category ? "دسته‌بندی‌ها" : "مواد اولیه";
  const singular = category ? "دسته‌بندی" : "ماده اولیه";
  const api = `/api/admin/catalog/${kind}`;
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [parentId, setParentId] = useState("");
  const [parents, setParents] = useState<Order["items"] | null>(null);
  const [parentsError, setParentsError] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [picker, setPicker] = useState<"image" | "icon" | null>(null);
  const [formError, setFormError] = useState("");
  const [archive, setArchive] = useState<Item | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderError, setOrderError] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  function reload() {
    setLoading(true);
    setError("");
    setVersion((value) => value + 1);
  }
  function changeSearch(value: string, nextPage: number) {
    setLoading(true);
    setError("");
    setQuery(value);
    setPage(nextPage);
    if (value === query && nextPage === page) setVersion((n) => n + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, page: String(page) });
    fetch(`${api}?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: Page) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("دریافت اطلاعات ممکن نشد.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [api, query, page, version]);
  async function post(body: object) {
    setBusy(true);
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return response.ok
        ? { ok: true, data }
        : { ok: false, message: data.error || "درخواست انجام نشد." };
    } catch {
      return { ok: false, message: "ارتباط برقرار نشد. دوباره تلاش کنید." };
    } finally {
      setBusy(false);
    }
  }
  async function loadParents() {
    setParents(null);
    setParentsError(false);
    try {
      const response = await fetch(`${api}?order=all`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: Order = await response.json();
      setParents(data.items);
    } catch {
      setParentsError(true);
    }
  }
  function openEditor(item: Item | null, newParent = "") {
    setEditing(item);
    setName(item?.name ?? "");
    setExcerpt(item?.excerpt ?? "");
    setParentId(item?.parentId ?? newParent);
    if (category) void loadParents();
    setImage(item?.imageId ?? null);
    setIcon(item?.iconId ?? null);
    setFormError("");
    setEditor(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!category && !icon) {
      setFormError("برای ماده اولیه آیکون انتخاب کنید.");
      return;
    }
    const result = await post({
      action: editing ? "update" : "create",
      ...(editing ? { id: editing.id } : {}),
      name,
      ...(category
        ? { excerpt, imageId: image, parentId: parentId || null }
        : {}),
      iconId: icon,
    });
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setEditor(false);
    reload();
  }
  async function confirmArchive() {
    if (!archive) return;
    const response = await post({ action: "archive", id: archive.id });
    if (!response.ok) {
      setError(response.message);
      setArchive(null);
      return;
    }
    setArchive(null);
    if (page > 1 && result?.items.length === 1) {
      changeSearch(query, page - 1);
    } else reload();
  }
  async function fetchOrder() {
    try {
      const response = await fetch(`${api}?order=all`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setOrder(await response.json());
      setOrderError("");
    } catch {
      setOrderError("دریافت ترتیب ممکن نشد.");
    }
  }
  async function openOrder() {
    setOrder(null);
    setOrderError("");
    setOrderOpen(true);
    await fetchOrder();
  }
  async function move(
    id: string,
    target: string,
    placement: "before" | "after",
  ) {
    if (!order || id === target || busy) return;
    const source = order.items.find((item) => item.id === id);
    const destination = order.items.find((item) => item.id === target);
    if (
      !source ||
      !destination ||
      (source.parentId ?? null) !== (destination.parentId ?? null)
    )
      return;
    const result = await post({
      action: "move",
      id,
      target,
      placement,
      revision: order.revision,
    });
    if (!result.ok) {
      setOrderError(result.message);
      return;
    }
    await fetchOrder();
    reload();
  }
  function picked(item: MediaItem) {
    if (picker === "image") setImage(item.id);
    else if (picker === "icon") setIcon(item.id);
  }
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Typography component="h1" variant="h5">
          {title}
        </Typography>
        <Box>
          <Button
            onClick={() => openEditor(null)}
            variant="contained"
            size="small"
            startIcon={<AddOutlinedIcon />}
          >
            افزودن {singular}
          </Button>
          {category && (
            <Button
              onClick={openOrder}
              size="small"
              startIcon={<SortOutlinedIcon />}
            >
              ترتیب صفحه اصلی
            </Button>
          )}
        </Box>
      </Box>
      <Box
        component="form"
        className="catalog-search-controls"
        onSubmit={(event) => {
          event.preventDefault();
          changeSearch(draft, 1);
        }}
        sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}
      >
        <TextField
          size="small"
          label={`جست‌وجوی ${singular}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 80 } }}
          sx={{ maxWidth: 360 }}
        />
        <Button
          type="submit"
          variant="outlined"
          size="small"
          startIcon={<SearchOutlinedIcon />}
        >
          جست‌وجو
        </Button>
        <Button
          onClick={() => {
            setDraft("");
            changeSearch("", 1);
          }}
          size="small"
        >
          پاک‌کردن
        </Button>
      </Box>
      {error && (
        <Alert
          severity="error"
          action={<Button onClick={reload}>تلاش دوباره</Button>}
        >
          {error}
        </Alert>
      )}
      {loading ? (
        <Typography role="status">در حال دریافت اطلاعات…</Typography>
      ) : !result?.items.length ? (
        <Typography>
          {query ? "نتیجه‌ای پیدا نشد." : `هنوز ${singular} ثبت نشده است.`}
        </Typography>
      ) : (
        <>
          <Box component="ul" sx={{ listStyle: "none", p: 0 }}>
            {result.items.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                  flexWrap: "wrap",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  py: 1,
                  ...(item.parentId && {
                    marginInlineStart: { xs: 3, sm: 7, md: 10 },
                    paddingInline: { xs: 1, sm: 2 },
                    my: 0.75,
                    border: "1px solid",
                    borderInlineStart: "4px solid",
                    borderColor: "primary.main",
                    borderRadius: 1.5,
                    bgcolor: "action.hover",
                  }),
                }}
              >
                <AdminThumbnail
                  id={item.imageId ?? item.iconId}
                  name={item.name}
                />
                <Box sx={{ flex: 1, minWidth: 140 }}>
                  {item.parentId && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        display: "inline-block",
                        color: "primary.main",
                        fontWeight: 700,
                        marginInlineEnd: 1,
                      }}
                    >
                      زیردسته
                    </Typography>
                  )}
                  <Typography component="strong">{item.name}</Typography>
                  {item.parentName && (
                    <Typography variant="body2">
                      دسته اصلی: {item.parentName}
                    </Typography>
                  )}
                  {item.slug && (
                    <Typography variant="body2">
                      نامک: <bdi dir="auto">{item.slug}</bdi>
                    </Typography>
                  )}
                  {item.excerpt && (
                    <Typography variant="body2">{item.excerpt}</Typography>
                  )}
                </Box>
                {category && !item.parentId && (
                  <Button
                    aria-label={`افزودن زیردسته به ${item.name}`}
                    onClick={() => openEditor(null, item.id)}
                  >
                    افزودن زیردسته
                  </Button>
                )}
                <Button
                  aria-label={`ویرایش ${item.name}`}
                  onClick={() => openEditor(item)}
                >
                  ویرایش
                </Button>
                <Button
                  aria-label={`بایگانی ${item.name}`}
                  onClick={() => setArchive(item)}
                >
                  بایگانی
                </Button>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button
              disabled={page <= 1}
              onClick={() => changeSearch(query, page - 1)}
            >
              صفحه قبل
            </Button>
            <Typography>
              صفحه {new Intl.NumberFormat("fa-IR").format(page)}
            </Typography>
            <Button
              disabled={page * result.limit >= result.total}
              onClick={() => changeSearch(query, page + 1)}
            >
              صفحه بعد
            </Button>
          </Box>
        </>
      )}
      <Dialog
        open={editor}
        onClose={() => {
          if (!busy) setEditor(false);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="catalog-editor-title"
      >
        <DialogTitle id="catalog-editor-title">
          {editing ? `ویرایش ${singular}` : `افزودن ${singular}`}
        </DialogTitle>
        <Box component="form" onSubmit={save}>
          <DialogContent sx={{ display: "grid", gap: 2 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label={`نام ${singular}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              slotProps={{ htmlInput: { maxLength: category ? 120 : 80 } }}
            />
            {category && (
              <>
                {parentsError && (
                  <Alert
                    severity="error"
                    action={<Button onClick={loadParents}>تلاش دوباره</Button>}
                  >
                    دریافت دسته‌های اصلی ممکن نشد.
                  </Alert>
                )}
                <TextField
                  select
                  label="دسته اصلی"
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                  disabled={!parents}
                  helperText="برای دسته اصلی، گزینه بدون دسته اصلی را انتخاب کنید. تنها یک سطح زیردسته پشتیبانی می‌شود."
                >
                  <MenuItem value="">بدون دسته اصلی</MenuItem>
                  {(parents ?? [])
                    .filter((item) => !item.parentId && item.id !== editing?.id)
                    .map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                </TextField>
              </>
            )}
            {category && (
              <TextField
                label="توضیح کوتاه"
                multiline
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 300 } }}
              />
            )}
            {category && (
              <Box>
                <Button type="button" onClick={() => setPicker("image")}>
                  انتخاب تصویر
                </Button>
                <Typography variant="body2">
                  {image ? "تصویر انتخاب شد" : "تصویری انتخاب نشده است"}
                </Typography>
                {image && (
                  <Image
                    unoptimized
                    src={`/api/admin/media/${image}`}
                    width={80}
                    height={80}
                    alt="تصویر انتخاب‌شده"
                    style={{ objectFit: "contain" }}
                  />
                )}
                {image && (
                  <Button onClick={() => setImage(null)}>
                    حذف تصویر انتخابی
                  </Button>
                )}
              </Box>
            )}
            <Box>
              <Button type="button" onClick={() => setPicker("icon")}>
                انتخاب آیکون
              </Button>
              <Typography variant="body2">
                {icon ? "آیکون انتخاب شد" : "آیکونی انتخاب نشده است"}
              </Typography>
              {icon && (
                <Image
                  unoptimized
                  src={`/api/admin/media/${icon}`}
                  width={64}
                  height={64}
                  alt="آیکون انتخاب‌شده"
                  style={{ objectFit: "contain" }}
                />
              )}
              {icon && category && (
                <Button onClick={() => setIcon(null)}>حذف آیکون انتخابی</Button>
              )}
            </Box>
            {category && (
              <Typography variant="body2" color="text.secondary">
                نامک و اطلاعات جست‌وجو خودکار ساخته می‌شوند؛ نامک پس از ایجاد
                ثابت می‌ماند.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditor(false)} disabled={busy}>
              انصراف
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={busy || (category && !parents)}
            >
              ذخیره
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <MediaPicker
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        allowedKind="image"
        onSelect={picked}
      />
      <Dialog
        open={Boolean(archive)}
        onClose={() => setArchive(null)}
        aria-labelledby="archive-title"
      >
        <DialogTitle id="archive-title">بایگانی {singular}</DialogTitle>
        <DialogContent>
          {archive && (
            <AdminThumbnail
              id={archive.imageId ?? archive.iconId}
              name={archive.name}
            />
          )}
          <Typography>
            «{archive?.name}» از فهرست فعال حذف می‌شود، اما برای حفظ ارجاعات
            تاریخی در پایگاه داده باقی می‌ماند.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchive(null)} disabled={busy}>
            انصراف
          </Button>
          <Button onClick={confirmArchive} disabled={busy} color="error">
            بایگانی
          </Button>
        </DialogActions>
      </Dialog>
      {category && (
        <Dialog
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          aria-labelledby="order-title"
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle id="order-title">ترتیب نمایش صفحه اصلی</DialogTitle>
          <DialogContent>
            <Typography>
              دسته‌های اصلی و زیردسته‌های هر دسته جداگانه مرتب می‌شوند. برای
              جابه‌جایی، ردیف را بکشید یا از دکمه‌های بالا و پایین استفاده کنید.
              تغییرات بلافاصله ذخیره می‌شوند.
            </Typography>
            {orderError && (
              <Alert
                severity="error"
                action={<Button onClick={fetchOrder}>تازه‌سازی</Button>}
              >
                {orderError}
              </Alert>
            )}
            {!order ? (
              <Typography role="status">
                {orderError ? "" : "در حال دریافت ترتیب…"}
              </Typography>
            ) : order.items.length === 0 ? (
              <Typography>دسته‌بندی فعالی وجود ندارد.</Typography>
            ) : (
              <Box component="ol" sx={{ p: 0, listStyle: "none" }}>
                {order.items
                  .filter((item) => !item.parentId)
                  .map((parent, parentIndex, parents) => {
                    const children = order.items.filter(
                      (item) => item.parentId === parent.id,
                    );
                    const row = (
                      item: Order["items"][number],
                      siblings: Order["items"],
                      index: number,
                    ) => (
                      <Box
                        component="div"
                        draggable={!busy}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDragged(item.id);
                          event.dataTransfer.setData("text/plain", item.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDragged(null)}
                        onDragOver={(event) => {
                          const source = order.items.find(
                            (entry) => entry.id === dragged,
                          );
                          if (
                            source &&
                            (source.parentId ?? null) ===
                              (item.parentId ?? null)
                          )
                            event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const id =
                            event.dataTransfer.getData("text/plain") || dragged;
                          const bounds =
                            event.currentTarget.getBoundingClientRect();
                          if (id)
                            void move(
                              id,
                              item.id,
                              event.clientY < bounds.top + bounds.height / 2
                                ? "before"
                                : "after",
                            );
                          setDragged(null);
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1,
                          cursor: "grab",
                          minWidth: 0,
                        }}
                      >
                        <AdminThumbnail
                          id={item.imageId ?? item.iconId}
                          name={item.name}
                        />
                        <Typography
                          sx={{
                            flex: 1,
                            overflowWrap: "anywhere",
                            fontWeight: item.parentId ? 400 : 700,
                          }}
                        >
                          {item.name}
                        </Typography>
                        <Button
                          aria-label={`انتقال ${item.name} به بالا`}
                          disabled={busy || index === 0}
                          onClick={() =>
                            move(item.id, siblings[index - 1].id, "before")
                          }
                        >
                          بالا
                        </Button>
                        <Button
                          aria-label={`انتقال ${item.name} به پایین`}
                          disabled={busy || index === siblings.length - 1}
                          onClick={() =>
                            move(item.id, siblings[index + 1].id, "after")
                          }
                        >
                          پایین
                        </Button>
                      </Box>
                    );
                    return (
                      <Box
                        component="li"
                        key={parent.id}
                        sx={{
                          border: "2px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          my: 1.5,
                          overflow: "hidden",
                        }}
                      >
                        {row(parent, parents, parentIndex)}
                        {children.length > 0 && (
                          <Box
                            sx={{
                              borderTop: "2px solid",
                              borderColor: "divider",
                              bgcolor: "action.hover",
                              p: 1,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                fontWeight: 700,
                                marginInlineStart: 2,
                              }}
                            >
                              زیردسته‌های {parent.name}
                            </Typography>
                            <Box
                              component="ol"
                              aria-label={`زیردسته‌های ${parent.name}`}
                              sx={{
                                listStyle: "none",
                                margin: 0,
                                padding: 0,
                                marginInlineStart: 2,
                                borderInlineStart: "3px solid",
                                borderColor: "primary.main",
                              }}
                            >
                              {children.map((child, index) => (
                                <Box
                                  component="li"
                                  key={child.id}
                                  sx={{
                                    borderBottom:
                                      index < children.length - 1
                                        ? "1px solid"
                                        : 0,
                                    borderColor: "divider",
                                  }}
                                >
                                  {row(child, children, index)}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOrderOpen(false)}>بستن</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
