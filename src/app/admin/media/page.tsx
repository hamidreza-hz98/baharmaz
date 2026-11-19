import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import PermMediaOutlinedIcon from "@mui/icons-material/PermMediaOutlined";
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
      <div className="media-admin-page">
        <Box className="media-admin-heading">
          <div className="media-admin-heading-title">
            <span>
              <PermMediaOutlinedIcon aria-hidden="true" />
            </span>
            <div>
              <Typography component="h1" variant="h5">
                کتابخانه رسانه
              </Typography>
              <p>مدیریت تصاویر و ویدئوهای فروشگاه</p>
            </div>
          </div>
          <Button
            startIcon={<CloudUploadOutlinedIcon />}
            size="small"
            href="/admin/media/upload"
            variant="contained"
          >
            بارگذاری رسانه
          </Button>
        </Box>
        <div className="media-admin-panel">
          <div className="media-admin-panel-title">
            <span>
              <PermMediaOutlinedIcon aria-hidden="true" />
            </span>
            <div>
              <h2>فایل‌های رسانه</h2>
              <p>جست‌وجو، انتخاب و مدیریت فایل‌ها</p>
            </div>
          </div>
          <MediaLibrary />
        </div>
      </div>
    </AdminShell>
  );
}
