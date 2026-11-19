import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
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
      <div className="media-upload-page">
        <Box className="media-upload-heading">
          <div className="media-upload-heading-title">
            <span>
              <CloudUploadOutlinedIcon aria-hidden="true" />
            </span>
            <div>
              <Typography component="h1" variant="h5">
                بارگذاری رسانه
              </Typography>
              <p>افزودن تصویر و ویدئو به کتابخانه رسانه</p>
            </div>
          </div>
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            size="small"
            href="/admin/media"
          >
            بازگشت به کتابخانه
          </Button>
        </Box>
        <div className="media-upload-panel">
          <MediaUpload />
        </div>
      </div>
    </AdminShell>
  );
}
