"use client";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AlertProps, ChipProps, TextFieldProps } from "@mui/material";
import { useId } from "react";

export function FormField(props: TextFieldProps) {
  return <TextField {...props} />;
}
export function DataCard({ children }: { children: React.ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 2, md: 3 }, borderRadius: "16px" }}
    >
      {children}
    </Paper>
  );
}
export function Status({
  label,
  color = "default",
}: {
  label: string;
  color?: ChipProps["color"];
}) {
  return <Chip label={label} color={color} size="small" />;
}
export function Feedback({
  children,
  severity = "info",
}: {
  children: React.ReactNode;
  severity?: AlertProps["severity"];
}) {
  return <Alert severity={severity}>{children}</Alert>;
}
export function IsolatedText({
  children,
  direction = "auto",
}: {
  children: React.ReactNode;
  direction?: "auto" | "ltr" | "rtl";
}) {
  return <bdi dir={direction}>{children}</bdi>;
}
export function PageState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Box component="section" sx={{ textAlign: "center", py: 4 }}>
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
export function LoadingState({
  label = "در حال بارگذاری…",
}: {
  label?: string;
}) {
  return (
    <Stack
      role="status"
      aria-live="polite"

      spacing={2}
      sx={{ py: 4, alignItems: "center" }}
    >
      <CircularProgress aria-hidden="true" size={28} />
      <Typography>{label}</Typography>
    </Stack>
  );
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageState
      title="دریافت اطلاعات ممکن نشد"
      description="لطفاً دوباره تلاش کنید."
      action={
        <Button variant="outlined" onClick={onRetry}>
          تلاش دوباره
        </Button>
      }
    />
  );
}
export function AccessibleDialog({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle
        id={titleId}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        {title}
        <IconButton aria-label="بستن" onClick={onClose}>
          <CloseIcon aria-hidden="true" />
        </IconButton>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

export function ScrollableDataRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      role="region"
      aria-label={label}
      tabIndex={0}
      sx={{ overflowX: "auto", maxWidth: "100%" }}
    >
      {children}
    </Box>
  );
}
export function EmptyState({
  description = "هنوز موردی برای نمایش وجود ندارد.",
}: {
  description?: string;
}) {
  return <PageState title="موردی وجود ندارد" description={description} />;
}
export function NoResultsState() {
  return (
    <PageState
      title="نتیجه‌ای پیدا نشد"
      description="عبارت یا فیلترها را تغییر دهید."
    />
  );
}
export function PermissionState() {
  return (
    <PageState
      title="دسترسی امکان‌پذیر نیست"
      description="برای مشاهده این بخش دسترسی لازم را ندارید."
    />
  );
}
