"use client";
import { useState } from "react";
import { Button, Typography } from "@mui/material";
import { MediaLibrary } from "@/admin/media/media-library";
import { MediaUpload } from "@/admin/media/media-upload";
import { MediaPicker } from "@/admin/media/media-picker";
export default function MediaPreview() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  return (
    <main style={{ maxWidth: 1000, margin: "auto", padding: 16 }}>
      <Typography component="h1" variant="h5">
        نمونه رسانه
      </Typography>
      <MediaLibrary />
      <Typography component="h2" variant="h6">
        صف بارگذاری
      </Typography>
      <MediaUpload />
      <Button onClick={() => setOpen(true)}>باز کردن انتخابگر تصویر</Button>
      <Typography role="status">{choice}</Typography>
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        allowedKind="image"
        onSelect={(item) => setChoice(item.filename)}
      />
    </main>
  );
}
