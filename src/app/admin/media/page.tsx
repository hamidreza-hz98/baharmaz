import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { redirect } from "next/navigation";
import { Button, Box, Typography } from "@mui/material";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { MediaLibrary } from "@/admin/media/media-library";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "رسانه‌ها | مدیریت بهارمز",
  robots: { index: false, follow: false },
};
export default async function MediaPage() {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  return (
    <AdminShell links={adminLinks} currentPath="/admin/media">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Typography component="h1" variant="h5">
          کتابخانه رسانه
        </Typography>
        <Button
          startIcon={<CloudUploadOutlinedIcon />}
          size="small"
          href="/admin/media/upload"
          variant="contained"
        >
          بارگذاری رسانه
        </Button>
      </Box>
      <MediaLibrary />
    </AdminShell>
  );
}
