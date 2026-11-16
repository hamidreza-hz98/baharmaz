"use client";
import { useState } from "react";
import { Button } from "@mui/material";
import { AdminShell } from "@/admin/admin-shell";
import { Hero } from "@/storefront/content/hero";
import { Gallery } from "@/storefront/catalog/gallery";
import {
  AccessibleDialog,
  DataCard,
  ErrorState,
  Feedback,
  FormField,
  IsolatedText,
  LoadingState,
  PageState,
  Status,
} from "@/shared/ui/primitives";

export default function FoundationPreview() {
  const [open, setOpen] = useState(false);
  const [retried, setRetried] = useState(false);
  return (
    <>
      <main>
        <DataCard>
          <h1>نمونه اجزای رابط</h1>
          <FormField label="نام" helperText="نام خود را وارد کنید" />
          <p>
            کد سفارش: <IsolatedText direction="ltr">LS-0123</IsolatedText>
          </p>
          <Status label="در انتظار" />
          <Feedback severity="success">تغییرات ذخیره شد.</Feedback>
          <Button variant="contained" onClick={() => setOpen(true)}>
            باز کردن پنجره
          </Button>
          <AccessibleDialog
            open={open}
            title="ویرایش اطلاعات"
            onClose={() => setOpen(false)}
          >
            <FormField label="نام گیرنده" />
          </AccessibleDialog>
        </DataCard>
        <LoadingState />
        <PageState title="موردی پیدا نشد" />
        {retried ? (
          <p role="status">بازیابی شد</p>
        ) : (
          <ErrorState onRetry={() => setRetried(true)} />
        )}
      </main>
      <AdminShell
        links={[{ href: "/admin/orders", label: "سفارش‌ها" }]}
        currentPath="/admin/orders"
      >
        <h1>نمونه پوسته مدیریت</h1>
      </AdminShell>
      <Hero
        slogan="سلیقه ایرانی"
        banners={[
          {
            id: "hero",
            imageId: "111111111111111111111111",
            href: "/products",
            alt: "بنر خوراک",
          },
        ]}
      />
      <Gallery title="محصول نمونه" images={["111111111111111111111111"]} />
    </>
  );
}
