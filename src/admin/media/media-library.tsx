"use client";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ClearOutlinedIcon from "@mui/icons-material/ClearOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { useEffect, useId, useState } from "react";
import Image from "next/image";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { formatTehranJalali } from "@/shared/locale";
import type { MediaItem, MediaKind, MediaPage } from "@/shared/media";

type PendingDelete = { entries: MediaItem[] };
type DeleteResponse = {
  deletedIds: string[];
  blocked: { id: string; reason: "in-use" | "not-found" }[];
  error?: string;
};

function SafeMediaImage({
  item,
  detail = false,
}: {
  item: MediaItem;
  detail?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <Typography role="status">پیش‌نمایش تصویر ممکن نیست.</Typography>;
  return (
    <Image
      unoptimized
      src={`/api/admin/media/${item.id}`}
      alt={detail ? `پیش‌نمایش ${item.filename}` : ""}
      fill
      sizes={detail ? "600px" : "(max-width: 900px) 50vw, 25vw"}
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

export function MediaLibrary({
  allowedKind = "all",
  onChoose,
  refresh = 0,
}: {
  allowedKind?: "all" | MediaKind;
  onChoose?: (item: MediaItem) => void;
  refresh?: number;
}) {
  const [kind, setKind] = useState<"all" | MediaKind>(allowedKind);
  const effectiveKind = allowedKind === "all" ? kind : allowedKind;
  const id = useId();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MediaPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [details, setDetails] = useState<MediaItem | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [copyText, setCopyText] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteNotice, setDeleteNotice] = useState<{
    severity: "success" | "warning";
    text: string;
  } | null>(null);
  function reload() {
    setLoading(true);
    setFailed(false);
    setSelected([]);
    setVersion((n) => n + 1);
  }
  function changeFilter(
    nextKind: "all" | MediaKind,
    nextQuery: string,
    nextPage: number,
  ) {
    setLoading(true);
    setFailed(false);
    setSelected([]);
    setDeleteNotice(null);
    setKind(nextKind);
    setQuery(nextQuery);
    setPage(nextPage);
    if (nextKind === kind && nextQuery === query && nextPage === page)
      setVersion((n) => n + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      kind: effectiveKind,
      q: query,
      page: String(page),
    });
    fetch(`/api/admin/media?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: MediaPage) => {
        setResult(data);
        setLoading(false);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [effectiveKind, query, page, version, refresh]);
  async function copyNames(names: string[]) {
    const text = names.join("\n");
    setCopyText(text);
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(text);
      setCopyMessage("نام فایل‌ها کپی شد.");
    } catch {
      setCopyMessage("کپی خودکار ممکن نشد؛ نام‌ها را از کادر زیر کپی کنید.");
    }
  }
  function requestDelete(entries: MediaItem[]) {
    setDeleteError("");
    setDeleteNotice(null);
    setPendingDelete({ entries });
  }
  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const ids = pendingDelete.entries.map((entry) => entry.id);
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(
        ids.length === 1
          ? `/api/admin/media/${encodeURIComponent(ids[0])}`
          : "/api/admin/media",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ids.length === 1 ? {} : { ids }),
        },
      );
      const result = (await response.json()) as DeleteResponse;
      if (!response.ok) {
        setDeleteError(result.error || "حذف رسانه ممکن نشد.");
        return;
      }

      const deletedIds = result.deletedIds ?? [];
      const blocked = result.blocked ?? [];
      const blockedNames = (
        reason: DeleteResponse["blocked"][number]["reason"],
      ) =>
        blocked
          .filter((entry) => entry.reason === reason)
          .map(
            (entry) =>
              pendingDelete.entries.find((media) => media.id === entry.id)
                ?.filename ?? entry.id.slice(-6),
          );
      const messages: string[] = [];
      if (deletedIds.length)
        messages.push(
          `${new Intl.NumberFormat("fa-IR").format(deletedIds.length)} رسانه حذف شد.`,
        );
      const inUse = blockedNames("in-use");
      if (inUse.length)
        messages.push(
          `${inUse.join("، ")} به اطلاعات دیگر متصل است و حذف نشد.`,
        );
      const missing = blockedNames("not-found");
      if (missing.length)
        messages.push(`${missing.join("، ")} دیگر در کتابخانه موجود نیست.`);
      setDeleteNotice({
        severity: blocked.length ? "warning" : "success",
        text: messages.join(" ") || "رسانه‌ای حذف نشد.",
      });
      setPendingDelete(null);
      setSelected([]);
      if (deletedIds.length) {
        if (page > 1 && items.length <= deletedIds.length)
          changeFilter(kind, query, page - 1);
        else reload();
      }
    } catch {
      setDeleteError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setDeleting(false);
    }
  }
  const items = result?.items ?? [];
  const allSelected =
    items.length > 0 && items.every((item) => selected.includes(item.id));
  return (
    <Box className="media-library">
      <div className="media-library-filters">
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            changeFilter(kind, draft, 1);
          }}
          sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}
        >
          <TextField
            label="جست‌وجوی نام فایل"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            slotProps={{
              htmlInput: { maxLength: 80 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
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
            size="small"
            startIcon={<ClearOutlinedIcon />}
            onClick={() => {
              setDraft("");
              changeFilter(allowedKind, "", 1);
            }}
          >
            پاک‌کردن
          </Button>
        </Box>
        {allowedKind === "all" && (
          <FormControl size="small" sx={{ minWidth: 160, mb: 2 }}>
            <InputLabel id={`${id}-kind`}>نوع رسانه</InputLabel>
            <Select
              labelId={`${id}-kind`}
              label="نوع رسانه"
              value={kind}
              onChange={(event) =>
                changeFilter(event.target.value as "all" | MediaKind, query, 1)
              }
            >
              <MenuItem value="all">همه</MenuItem>
              <MenuItem value="image">تصویر</MenuItem>
              <MenuItem value="video">ویدئو</MenuItem>
            </Select>
          </FormControl>
        )}
      </div>
      {!onChoose && (
        <Alert severity="info" sx={{ mb: 2 }}>
          رسانه‌های مرتبط با محصولات، دسته‌بندی‌ها، مواد اولیه، سفارش‌ها یا
          محتوای سایت هنگام حذف محافظت می‌شوند.
        </Alert>
      )}
      {deleteNotice && !onChoose && (
        <Alert severity={deleteNotice.severity} sx={{ mb: 2 }}>
          {deleteNotice.text}
        </Alert>
      )}
      {loading ? (
        <Typography role="status">در حال دریافت رسانه‌ها…</Typography>
      ) : failed ? (
        <Alert
          severity="error"
          action={<Button onClick={reload}>تلاش دوباره</Button>}
        >
          دریافت رسانه‌ها ممکن نشد.
        </Alert>
      ) : items.length === 0 ? (
        <Typography>
          {query || effectiveKind !== "all"
            ? "رسانه‌ای با این فیلتر پیدا نشد."
            : "هنوز رسانه‌ای بارگذاری نشده است."}
        </Typography>
      ) : (
        <>
          {!onChoose && (
            <Box
              className="media-selection-bar"
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                flexWrap: "wrap",
                mb: 1,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? items.map((item) => item.id)
                          : [],
                      )
                    }
                  />
                }
                label="انتخاب همه این صفحه"
              />
              <Typography role="status">
                {new Intl.NumberFormat("fa-IR").format(selected.length)}{" "}
                انتخاب‌شده
              </Typography>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteOutlineIcon />}
                disabled={!selected.length}
                aria-label="حذف انتخاب‌شده‌ها"
                onClick={() =>
                  requestDelete(
                    items.filter((item) => selected.includes(item.id)),
                  )
                }
              >
                حذف انتخاب‌شده‌ها (
                {new Intl.NumberFormat("fa-IR").format(selected.length)})
              </Button>
              <Button
                disabled={!selected.length}
                startIcon={<ContentCopyOutlinedIcon />}
                onClick={() =>
                  void copyNames(
                    items
                      .filter((item) => selected.includes(item.id))
                      .map((item) => item.filename),
                  )
                }
              >
                کپی نام انتخاب‌شده‌ها
              </Button>
              <Button
                disabled={!selected.length}
                startIcon={<ClearOutlinedIcon />}
                onClick={() => setSelected([])}
              >
                پاک‌کردن انتخاب
              </Button>
            </Box>
          )}
          <Box
            className="media-grid"
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2,minmax(0,1fr))",
                md: "repeat(4,minmax(0,1fr))",
              },
              gap: 2,
            }}
          >
            {items.map((item) => (
              <Box
                key={item.id}
                component="article"
                className={`media-asset-card${selected.includes(item.id) ? " is-selected" : ""}`}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  minWidth: 0,
                  backgroundColor: "background.paper",
                }}
              >
                <Box
                  className="media-asset-preview"
                  sx={{
                    position: "relative",
                    aspectRatio: "4 / 3",
                    backgroundColor: "#f4e9e1",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                  }}
                >
                  {item.kind === "image" ? (
                    <SafeMediaImage item={item} />
                  ) : (
                    <MovieOutlinedIcon
                      aria-label="ویدئو"
                      sx={{ fontSize: 48 }}
                    />
                  )}
                </Box>
                <Box className="media-asset-body" sx={{ p: 1 }}>
                  <Button
                    onClick={() => {
                      setVideoError(false);
                      setDetails(item);
                    }}
                    sx={{
                      overflowWrap: "anywhere",
                      textAlign: "start",
                      maxWidth: "100%",
                    }}
                  >
                    <bdi>{item.filename}</bdi>
                  </Button>
                  <Typography variant="body2">
                    {item.kind === "image" ? (
                      <ImageOutlinedIcon aria-hidden="true" />
                    ) : (
                      <MovieOutlinedIcon aria-hidden="true" />
                    )}{" "}
                    {item.kind === "image" ? "تصویر" : "ویدئو"} ·{" "}
                    {new Intl.NumberFormat("fa-IR").format(
                      Math.ceil(item.length / 1024),
                    )}{" "}
                    کیلوبایت
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                  >
                    بارگذاری: {formatTehranJalali(item.uploadedAt)} · شناسه:{" "}
                    <bdi>{item.id.slice(-6)}</bdi>
                  </Typography>
                  {!onChoose && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        flexWrap: "wrap",
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            slotProps={{
                              input: {
                                "aria-label": `انتخاب ${item.filename}`,
                              },
                            }}
                            checked={selected.includes(item.id)}
                            onChange={(event) =>
                              setSelected((ids) =>
                                event.target.checked
                                  ? [...ids, item.id]
                                  : ids.filter((id) => id !== item.id),
                              )
                            }
                          />
                        }
                        label="انتخاب"
                      />
                      <Button
                        color="error"
                        size="small"
                        startIcon={<DeleteOutlineIcon />}
                        aria-label={`حذف ${item.filename}`}
                        onClick={() => requestDelete([item])}
                      >
                        حذف
                      </Button>
                    </Box>
                  )}
                  {onChoose && (
                    <Button
                      disabled={
                        effectiveKind !== "all" && item.kind !== effectiveKind
                      }
                      onClick={() => onChoose(item)}
                      aria-label={`انتخاب ${item.filename}، بارگذاری ${formatTehranJalali(item.uploadedAt)}، شناسه ${item.id.slice(-6)}`}
                    >
                      انتخاب رسانه
                    </Button>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
            <Button
              disabled={page <= 1}
              onClick={() => changeFilter(kind, query, page - 1)}
            >
              صفحه قبل
            </Button>
            <Typography>
              صفحه {new Intl.NumberFormat("fa-IR").format(page)}
            </Typography>
            <Button
              disabled={page * (result?.limit ?? 24) >= (result?.total ?? 0)}
              onClick={() => changeFilter(kind, query, page + 1)}
            >
              صفحه بعد
            </Button>
          </Box>
        </>
      )}
      {copyMessage && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {copyMessage}
          <TextField
            label="نام فایل‌ها"
            multiline
            value={copyText}
            slotProps={{ htmlInput: { readOnly: true } }}
          />
        </Alert>
      )}
      <Dialog
        open={Boolean(details)}
        onClose={() => setDetails(null)}
        aria-labelledby={`${id}-detail`}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id={`${id}-detail`}>جزئیات رسانه</DialogTitle>
        <DialogContent>
          {details && (
            <>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                نام: <bdi>{details.filename}</bdi>
              </Typography>
              <Typography>
                نوع: <bdi dir="ltr">{details.contentType}</bdi>
              </Typography>
              <Typography>
                اندازه: {new Intl.NumberFormat("fa-IR").format(details.length)}{" "}
                بایت
              </Typography>
              <Typography>
                ابعاد:{" "}
                <bdi dir="ltr">
                  {details.width} × {details.height}
                </bdi>
              </Typography>
              <Typography>
                زمان بارگذاری: {formatTehranJalali(details.uploadedAt)}
              </Typography>
              <Box
                sx={{
                  position: "relative",
                  height: 260,
                  mt: 2,
                  backgroundColor: "#f4e9e1",
                }}
              >
                {details.kind === "image" ? (
                  <SafeMediaImage key={details.id} item={details} detail />
                ) : videoError ? (
                  <Typography>پیش‌نمایش ویدئو ممکن نیست.</Typography>
                ) : (
                  <video
                    controls
                    preload="metadata"
                    onError={() => setVideoError(true)}
                    style={{ width: "100%", height: "100%" }}
                    src={`/api/admin/media/${details.id}`}
                  />
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {details && onChoose && (
            <Button
              disabled={
                effectiveKind !== "all" && details.kind !== effectiveKind
              }
              onClick={() => {
                onChoose(details);
                setDetails(null);
              }}
            >
              انتخاب رسانه
            </Button>
          )}
          {details && !onChoose && (
            <>
              <Button
                onClick={() => {
                  void copyNames([details.filename]);
                  setDetails(null);
                }}
              >
                کپی نام
              </Button>
              <Button
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => {
                  const item = details;
                  setDetails(null);
                  requestDelete([item]);
                }}
              >
                حذف رسانه
              </Button>
            </>
          )}
          <Button onClick={() => setDetails(null)}>بستن</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) {
            setPendingDelete(null);
            setDeleteError("");
          }
        }}
        aria-labelledby={`${id}-delete-title`}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id={`${id}-delete-title`}>
          {pendingDelete?.entries.length === 1 ? "حذف رسانه" : "حذف رسانه‌ها"}
        </DialogTitle>
        <DialogContent dividers>
          {deleteError && (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            {pendingDelete?.entries.length === 1
              ? "این فایل از کتابخانه حذف شود؟"
              : `حذف ${new Intl.NumberFormat("fa-IR").format(pendingDelete?.entries.length ?? 0)} فایل انتخاب‌شده از کتابخانه؟`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            رسانه‌های استفاده‌شده در محصولات، دسته‌بندی‌ها، مواد اولیه، سفارش‌ها
            یا محتوای سایت حذف نمی‌شوند.
          </Typography>
          {pendingDelete && (
            <Box
              component="ul"
              sx={{
                my: 1,
                pl: 2,
                maxHeight: 180,
                overflowY: "auto",
                overflowWrap: "anywhere",
              }}
            >
              {pendingDelete.entries.map((entry) => (
                <li key={entry.id}>
                  <bdi>{entry.filename}</bdi>
                </li>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={deleting}
            onClick={() => {
              setPendingDelete(null);
              setDeleteError("");
            }}
          >
            انصراف
          </Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? "در حال حذف…" : "تأیید حذف"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
