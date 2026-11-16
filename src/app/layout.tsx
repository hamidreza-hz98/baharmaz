import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppThemeProvider } from "@/theme/provider";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const vazirmatn = localFont({
  src: "../theme/fonts/vazirmatn-persian-variable.woff2",
  variable: "--font-vazirmatn",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  title: "بهارمز",
  description: "فروشگاه آنلاین بهارمز",
  applicationName: "بهارمز",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/brand/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
