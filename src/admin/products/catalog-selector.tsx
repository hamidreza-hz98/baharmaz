"use client";
import { useEffect, useId, useState } from "react";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import SpaOutlinedIcon from "@mui/icons-material/SpaOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Checkbox,
  Radio,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { AdminThumbnail } from "@/admin/media/admin-thumbnail";
import { MediaPicker } from "@/admin/media/media-picker";
type Entry = {
  id: string;
  name: string;
  parentName?: string | null;
  imageId?: string | null;
  iconId?: string | null;
};
export function CatalogSelector({
  kind,
  selected,
  onChange,
}: {
  kind: "categories" | "ingredients";
  selected: Entry[];
  onChange: (entries: Entry[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [parentId, setParentId] = useState("");
  const [parents, setParents] = useState<
    (Entry & { parentId?: string | null })[] | null
  >(null);
  const [parentsError, setParentsError] = useState(false);
  const [imageId, setImageId] = useState<string | null>(null);
  const [iconId, setIconId] = useState<string | null>(null);
  const [picker, setPicker] = useState<"image" | "icon" | null>(null);
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogId = useId();
  const singular = kind === "categories" ? "دسته‌بندی" : "ماده اولیه";
  async function loadParents() {
    setParents(null);
    setParentsError(false);
    try {
      const response = await fetch("/api/admin/catalog/categories?order=all", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setParents((await response.json()).items);
    } catch {
      setParentsError(true);
    }
  }
  function openCreate() {
    setName("");
    setExcerpt("");
    setParentId("");
    setImageId(null);
    setIconId(null);
    setCreateError("");
    setCreating(true);
    if (kind === "categories") void loadParents();
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    if (kind === "ingredients" && !iconId) {
      setCreateError("برای ماده اولیه آیکون انتخاب کنید.");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      const response = await fetch(`/api/admin/catalog/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          iconId,
          ...(kind === "categories"
            ? { excerpt, imageId, parentId: parentId || null }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.item?.id) {
        setCreateError(data.error || "ذخیره ممکن نشد.");
        return;
      }
      onChange(kind === "categories" ? [data.item] : [...selected, data.item]);
      setCreating(false);
      setDraft("");
      change("", 1);
    } catch {
      setCreateError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  }
  function change(nextQuery: string, nextPage: number) {
    setLoading(true);
    setError(false);
    setQuery(nextQuery);
    setPage(nextPage);
    if (query === nextQuery && page === nextPage) setVersion((x) => x + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, page: String(page) });
    fetch(`/api/admin/catalog/${kind}?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [kind, page, query, version]);
  return (
    <Box
      component="fieldset"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        minWidth: 0,
      }}
    >
      <Typography component="legend">
        {kind === "categories" ? "انتخاب دسته‌بندی" : "انتخاب مواد اولیه"}
      </Typography>
      <div className="selector-heading">
        <div>
          <strong>
            {kind === "categories" ? "دسته‌بندی محصول" : "مواد اولیه محصول"}
          </strong>
          <p>
            {kind === "categories"
              ? "یک دسته برای محصول انتخاب کنید."
              : "مواد اولیه مرتبط را انتخاب کنید."}
          </p>
        </div>
        <Button
          type="button"
          variant="outlined"
          size="small"
          startIcon={<AddOutlinedIcon />}
          onClick={openCreate}
        >
          افزودن جدید
        </Button>
      </div>
      <Typography variant="body2">
        انتخاب‌شده: {selected.length ? "" : "هیچ‌کدام"}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, my: 1 }}>
        {selected.map((entry) => (
          <Box
            key={entry.id}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <AdminThumbnail
              id={entry.imageId ?? entry.iconId}
              name={entry.name}
              size={36}
            />
            <Typography variant="body2">{entry.name}</Typography>
          </Box>
        ))}
      </Box>
      <Box
        className="catalog-search-controls"
        sx={{ display: "flex", gap: 1, flexWrap: "wrap", my: 1 }}
      >
        <TextField
          size="small"
          label={`جست‌وجوی ${singular}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 80 } }}
          sx={{ maxWidth: 300 }}
        />
        <Button
          type="button"
          size="small"
          startIcon={<SearchOutlinedIcon />}
          onClick={() => change(draft, 1)}
        >
          جست‌وجو
        </Button>
        <Button
          type="button"
          size="small"
          onClick={() => {
            setDraft("");
            change("", 1);
          }}
        >
          پاک‌کردن
        </Button>
      </Box>
      {loading ? (
        <Typography role="status">در حال دریافت…</Typography>
      ) : error ? (
        <Alert
          severity="error"
          action={
            <Button onClick={() => change(query, page)}>تلاش دوباره</Button>
          }
        >
          دریافت موارد ممکن نشد.
        </Alert>
      ) : items.length ? (
        <Box
          role="group"
          aria-label={kind === "categories" ? "دسته‌بندی‌ها" : "مواد اولیه"}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
              xl: "repeat(5, minmax(0, 1fr))",
            },
            gap: 1,
          }}
        >
          {items.map((item) => {
            const checked = selected.some((entry) => entry.id === item.id);
            return (
              <FormControlLabel
                key={item.id}
                sx={{
                  width: "100%",
                  minWidth: 0,
                  minHeight: 64,
                  m: 0,
                  p: 0.75,
                  border: "1px solid",
                  borderColor: checked ? "primary.main" : "divider",
                  borderRadius: 1.5,
                  bgcolor: checked ? "action.selected" : "background.paper",
                  transition:
                    "border-color 140ms ease, background-color 140ms ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: checked ? "action.selected" : "action.hover",
                  },
                  "& .MuiFormControlLabel-label": {
                    flex: 1,
                    minWidth: 0,
                  },
                  "& .MuiRadio-root, & .MuiCheckbox-root": { p: 0.5 },
                }}
                control={
                  kind === "categories" ? (
                    <Radio
                      name="product-category"
                      checked={checked}
                      onChange={() => onChange([item])}
                    />
                  ) : (
                    <Checkbox
                      checked={checked}
                      onChange={(event) => {
                        onChange(
                          event.target.checked
                            ? [...selected, item]
                            : selected.filter((entry) => entry.id !== item.id),
                        );
                      }}
                    />
                  )
                }
                label={
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      minWidth: 0,
                      width: "100%",
                    }}
                  >
                    <AdminThumbnail
                      id={item.imageId ?? item.iconId}
                      name={item.name}
                      size={48}
                    />
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {item.parentName
                        ? `${item.parentName} / ${item.name}`
                        : item.name}
                    </Typography>
                  </Box>
                }
              />
            );
          })}
        </Box>
      ) : (
        <Typography>موردی پیدا نشد.</Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => change(query, page - 1)}
        >
          صفحه قبل
        </Button>
        <Typography>
          صفحه {new Intl.NumberFormat("fa-IR").format(page)}
        </Typography>
        <Button
          type="button"
          disabled={loading || page * 24 >= total}
          onClick={() => change(query, page + 1)}
        >
          صفحه بعد
        </Button>
      </Box>
      <Dialog
        open={creating}
        onClose={saving ? undefined : () => setCreating(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby={dialogId}
      >
        <DialogTitle id={dialogId}>
          <span className="selector-dialog-heading">
            <span>
              {kind === "categories" ? (
                <CategoryOutlinedIcon aria-hidden="true" />
              ) : (
                <SpaOutlinedIcon aria-hidden="true" />
              )}
            </span>
            <span>
              افزودن {singular}
              <small>پس از ذخیره، به محصول انتخاب می‌شود.</small>
            </span>
          </span>
        </DialogTitle>
        <Box component="form" onSubmit={create}>
          <DialogContent className="selector-create-fields">
            {createError && (
              <Alert severity="error" role="alert">
                {createError}
              </Alert>
            )}
            <TextField
              label={`نام ${singular}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              disabled={saving}
              slotProps={{
                htmlInput: { maxLength: kind === "categories" ? 120 : 80 },
              }}
            />
            {kind === "categories" && (
              <>
                {parentsError && (
                  <Alert
                    severity="error"
                    action={
                      <Button type="button" onClick={() => void loadParents()}>
                        تلاش دوباره
                      </Button>
                    }
                  >
                    دریافت دسته‌های اصلی ممکن نشد.
                  </Alert>
                )}
                <TextField
                  select
                  label="دسته اصلی"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  disabled={saving || !parents}
                  helperText="برای دسته اصلی، گزینه بدون دسته اصلی را انتخاب کنید."
                >
                  <MenuItem value="">بدون دسته اصلی</MenuItem>
                  {(parents ?? [])
                    .filter((p) => !p.parentId)
                    .map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  label="توضیح کوتاه"
                  multiline
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  disabled={saving}
                  slotProps={{ htmlInput: { maxLength: 300 } }}
                />
                <div className="selector-media-row">
                  <AdminThumbnail
                    id={imageId}
                    name="تصویر دسته‌بندی"
                    size={56}
                  />
                  <div>
                    <strong>تصویر دسته‌بندی</strong>
                    <p>
                      {imageId
                        ? "تصویر انتخاب شده است."
                        : "انتخاب تصویر اختیاری است."}
                    </p>
                    <Button
                      type="button"
                      size="small"
                      startIcon={<AddPhotoAlternateOutlinedIcon />}
                      onClick={() => setPicker("image")}
                      disabled={saving}
                    >
                      انتخاب تصویر
                    </Button>
                    {imageId && (
                      <Button
                        type="button"
                        size="small"
                        onClick={() => setImageId(null)}
                        disabled={saving}
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="selector-media-row">
              <AdminThumbnail id={iconId} name="آیکون" size={56} />
              <div>
                <strong>آیکون {singular}</strong>
                <p>
                  {iconId
                    ? "آیکون انتخاب شده است."
                    : kind === "ingredients"
                      ? "انتخاب آیکون الزامی است."
                      : "انتخاب آیکون اختیاری است."}
                </p>
                <Button
                  type="button"
                  size="small"
                  startIcon={<AddPhotoAlternateOutlinedIcon />}
                  onClick={() => setPicker("icon")}
                  disabled={saving}
                >
                  انتخاب آیکون
                </Button>
                {iconId && (
                  <Button
                    type="button"
                    size="small"
                    onClick={() => setIconId(null)}
                    disabled={saving}
                  >
                    حذف
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button
              type="button"
              onClick={() => setCreating(false)}
              disabled={saving}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || (kind === "categories" && !parents)}
            >
              {saving ? "در حال ذخیره…" : `ذخیره ${singular}`}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <MediaPicker
        open={picker !== null}
        allowedKind="image"
        onClose={() => setPicker(null)}
        onSelect={(item) => {
          if (picker === "image") setImageId(item.id);
          else if (picker === "icon") setIconId(item.id);
        }}
      />
    </Box>
  );
}
