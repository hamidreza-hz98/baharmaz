import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { redirect } from "next/navigation";
import { Button, Box, Typography } from "@mui/material";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { MediaUpload } from "@/admin/media/media-upload";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "بارگذاری رسانه | مدیریت بهارمز",
  robots: { index: false, follow: false },
};
export default async function MediaUploadPage() {
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
          بارگذاری رسانه
        </Typography>
        <Button startIcon={<ArrowBackIcon />} size="small" href="/admin/media">
          بازگشت به کتابخانه
        </Button>
      </Box>
      <MediaUpload />
    </AdminShell>
  );
}
