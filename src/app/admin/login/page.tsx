import { AdminLogin } from "@/admin/admin-login";
export const metadata = {
  title: "ورود مدیریت | بهارمز",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminLogin />;
}
