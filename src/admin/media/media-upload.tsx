"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";

function UploadPreview({ file }: { file: File }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    if (
      !file.type.startsWith("image/") ||
      !limits[file.type] ||
      file.size > limits[file.type] ||
      file.size === 0
    )
      return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSource(reader.result);
    };
    reader.readAsDataURL(file);
    return () => {
      reader.onload = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);
  return (
    <Box
      sx={{
        width: 64,
        height: 64,
        flexShrink: 0,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "#f4e9e1",
        display: "grid",
        placeItems: "center",
      }}
    >
      {source ? (
        <Box
          component="img"
          src={source}
          alt={`پیش‌نمایش ${file.name}`}
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : file.type.startsWith("video/") ? (
        <MovieOutlinedIcon aria-label="ویدئو" />
      ) : (
        <ImageNotSupportedOutlinedIcon aria-label="تصویر در دسترس نیست" />
      )}
    </Box>
  );
}

type UploadStatus =
  "ready" | "uploading" | "processing" | "complete" | "failed" | "cancelled";
type Entry = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number | null;
  error?: string;
};
const limits: Record<string, number> = {
  "image/jpeg": 10 * 1024 * 1024,
  "image/png": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "video/mp4": 25 * 1024 * 1024,
};
export function MediaUpload({
  onUploaded,
  allowedKind = "all",
}: {
  onUploaded?: () => void;
  allowedKind?: "all" | "image" | "video";
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      xhrRef.current?.abort();
      xhrRef.current = null;
    };
  }, []);
  function add(files: FileList | File[]) {
    const selected = Array.from(files);
    setEntries((current) => {
      const available = Math.max(0, 10 - current.length);
      const added = selected.slice(0, available).map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "ready" as const,
        progress: null,
      }));
      return [...current, ...added];
    });
    setNotice("حداکثر ۱۰ فایل در صف نگه داشته می‌شود.");
  }
  function update(id: string, data: Partial<Entry>) {
    if (mounted.current)
      setEntries((current) =>
        current.map((item) => (item.id === id ? { ...item, ...data } : item)),
      );
  }
  function start(entry: Entry) {
    if (xhrRef.current) return;
    const limit = limits[entry.file.type];
    if (
      !limit ||
      (allowedKind !== "all" &&
        !entry.file.type.startsWith(`${allowedKind}/`)) ||
      entry.file.size === 0 ||
      entry.file.size > limit
    ) {
      update(entry.id, {
        status: "failed",
        error: "نوع یا اندازه فایل مجاز نیست.",
      });
      return;
    }
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    setActive(true);
    update(entry.id, { status: "uploading", progress: null, error: undefined });
    let settled = false;
    function done(status: UploadStatus, error?: string) {
      if (settled) return;
      settled = true;
      xhrRef.current = null;
      if (mounted.current) setActive(false);
      update(entry.id, { status, error });
      if (status === "complete" && mounted.current) onUploaded?.();
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        update(entry.id, {
          progress: Math.min(
            100,
            Math.round((event.loaded * 100) / event.total),
          ),
        });
    };
    xhr.upload.onload = () =>
      update(entry.id, { status: "processing", progress: 100 });
    xhr.onload = () => {
      if (xhr.status === 201) {
        try {
          const result = JSON.parse(xhr.responseText);
          if (result?.media?.id) {
            done("complete");
            return;
          }
        } catch {
          /* malformed response */
        }
      }
      let error = "بارگذاری انجام نشد. دوباره تلاش کنید.";
      try {
        const result = JSON.parse(xhr.responseText);
        if (typeof result.error === "string") error = result.error;
      } catch {
        /* generic error */
      }
      if (xhr.status >= 500 || xhr.status === 201)
        error +=
          " ممکن است فایل ذخیره شده باشد؛ پیش از تلاش دوباره کتابخانه را بررسی کنید.";
      done("failed", error);
    };
    xhr.onerror = () =>
      done(
        "failed",
        "ارتباط قطع شد؛ ممکن است فایل ذخیره شده باشد. پیش از تلاش دوباره کتابخانه را بررسی کنید.",
      );
    xhr.onabort = () =>
      done(
        "cancelled",
        "بارگذاری لغو شد؛ اگر پردازش آغاز شده باشد، ممکن است فایل ذخیره شده باشد.",
      );
    try {
      xhr.open("POST", "/api/admin/media");
      xhr.setRequestHeader("Content-Type", entry.file.type);
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(entry.file.name));
      xhr.send(entry.file);
    } catch {
      done("failed", "آماده‌سازی بارگذاری ممکن نشد.");
    }
  }
  return (
    <Box className="media-upload-content">
      <Box
        className="media-upload-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          add(event.dataTransfer.files);
        }}
        sx={{
          border: "2px dashed",
          borderColor: "primary.main",
          borderRadius: 2,
          p: 3,
          textAlign: "center",
        }}
      >
        <span className="media-upload-drop-icon">
          <CloudUploadOutlinedIcon aria-hidden="true" />
        </span>
        <Typography className="media-upload-drop-title">
          فایل‌ها را اینجا رها کنید یا از دستگاه انتخاب کنید.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {allowedKind === "image"
            ? "تصویر JPEG، PNG یا WebP تا ۱۰ مگابایت."
            : allowedKind === "video"
              ? "ویدئوی MP4 تا ۲۵ مگابایت."
              : "تصویر JPEG، PNG یا WebP تا ۱۰ مگابایت؛ ویدئوی MP4 تا ۲۵ مگابایت."}
        </Typography>
        <input
          ref={input}
          type="file"
          multiple
          accept={
            allowedKind === "image"
              ? "image/jpeg,image/png,image/webp"
              : allowedKind === "video"
                ? "video/mp4"
                : "image/jpeg,image/png,image/webp,video/mp4"
          }
          hidden
          onChange={(event) => {
            if (event.target.files) add(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          onClick={() => input.current?.click()}
          variant="contained"
          startIcon={<AddPhotoAlternateOutlinedIcon />}
          sx={{ mt: 1 }}
        >
          انتخاب فایل
        </Button>
      </Box>
      {notice && (
        <Typography role="status" variant="body2" sx={{ mt: 1 }}>
          {notice}
        </Typography>
      )}
      {entries.length === 0 ? (
        <div className="media-upload-empty">
          <UploadFileOutlinedIcon aria-hidden="true" />
          <div>
            <strong>فایلی در صف بارگذاری نیست</strong>
            <Typography variant="body2">
              فایل‌های انتخاب‌شده اینجا نمایش داده می‌شوند.
            </Typography>
          </div>
        </div>
      ) : (
        <Box
          component="ul"
          className="media-upload-list"
          sx={{ listStyle: "none", p: 0 }}
        >
          {entries.map((entry) => (
            <Box
              component="li"
              key={entry.id}
              className={`media-upload-item is-${entry.status}`}
              sx={{ borderBottom: "1px solid", borderColor: "divider", py: 2 }}
            >
              <UploadPreview file={entry.file} />
              <Typography component="strong" sx={{ overflowWrap: "anywhere" }}>
                <bdi>{entry.file.name}</bdi>
              </Typography>
              <Typography variant="body2">
                {new Intl.NumberFormat("fa-IR").format(
                  Math.ceil(entry.file.size / 1024),
                )}{" "}
                کیلوبایت
              </Typography>
              {(entry.status === "uploading" ||
                entry.status === "processing") && (
                <>
                  <LinearProgress
                    variant={
                      entry.progress === null ? "indeterminate" : "determinate"
                    }
                    value={entry.progress ?? undefined}
                    aria-label={`پیشرفت ${entry.file.name}`}
                  />
                  <Typography role="status">
                    {entry.status === "processing"
                      ? "دریافت فایل کامل شد؛ در حال پردازش…"
                      : entry.progress === null
                        ? "در حال ارسال…"
                        : `در حال ارسال ${new Intl.NumberFormat("fa-IR").format(entry.progress)}٪`}
                  </Typography>
                </>
              )}
              {entry.status === "complete" && (
                <Typography role="status" className="media-upload-success">
                  <CheckCircleOutlineOutlinedIcon aria-hidden="true" />
                  بارگذاری و ذخیره انجام شد.
                </Typography>
              )}
              {entry.error && (
                <Alert severity={entry.status === "failed" ? "error" : "info"}>
                  {entry.error}
                </Alert>
              )}
              {(entry.status === "ready" ||
                entry.status === "failed" ||
                entry.status === "cancelled") && (
                <Button
                  startIcon={<CloudUploadOutlinedIcon />}
                  aria-label={`${entry.status === "ready" ? "بارگذاری" : "تلاش دوباره"} ${entry.file.name}`}
                  disabled={active}
                  onClick={() => start(entry)}
                >
                  {entry.status === "ready" ? "بارگذاری" : "تلاش دوباره"}
                </Button>
              )}
              {entry.status === "uploading" || entry.status === "processing" ? (
                <Button
                  aria-label={`لغو ${entry.file.name}`}
                  onClick={() => xhrRef.current?.abort()}
                >
                  لغو
                </Button>
              ) : (
                <Button
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  aria-label={`حذف ${entry.file.name} از صف`}
                  disabled={active}
                  onClick={() =>
                    setEntries((current) =>
                      current.filter((item) => item.id !== entry.id),
                    )
                  }
                >
                  حذف از صف
                </Button>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
