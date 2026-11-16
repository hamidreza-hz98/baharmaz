"use client";
import { useId, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import type { MediaItem, MediaKind } from "@/shared/media";
import { MediaLibrary } from "./media-library";
import { MediaUpload } from "./media-upload";

/** Reusable controlled picker; only reports a selected existing persisted media item. */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  allowedKind = "all",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  allowedKind?: "all" | MediaKind;
}) {
  const [tab, setTab] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      aria-labelledby={`${id}-title`}
    >
      <DialogTitle
        id={`${id}-title`}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        انتخاب رسانه<Button onClick={onClose}>بستن</Button>
      </DialogTitle>
      <DialogContent>
        <Tabs
          value={tab}
          onChange={(_event, value: number) => setTab(value)}
          aria-label="انتخاب یا بارگذاری رسانه"
        >
          <Tab
            label="کتابخانه"
            id={`${id}-tab-library`}
            aria-controls={`${id}-panel-library`}
          />
          <Tab
            label="بارگذاری فایل"
            id={`${id}-tab-upload`}
            aria-controls={`${id}-panel-upload`}
          />
        </Tabs>
        <Box
          role="tabpanel"
          id={`${id}-panel-library`}
          aria-labelledby={`${id}-tab-library`}
          hidden={tab !== 0}
          sx={{ pt: 2 }}
        >
          {tab === 0 && (
            <MediaLibrary
              allowedKind={allowedKind}
              refresh={refresh}
              onChoose={(item) => {
                onSelect(item);
                onClose();
              }}
            />
          )}
        </Box>
        <Box
          role="tabpanel"
          id={`${id}-panel-upload`}
          aria-labelledby={`${id}-tab-upload`}
          hidden={tab !== 1}
          sx={{ pt: 2 }}
        >
          {tab === 1 && (
            <MediaUpload
              allowedKind={allowedKind}
              onUploaded={() => setRefresh((value) => value + 1)}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
