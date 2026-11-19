import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/identity/guards";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { SandboxPaymentResult } from "@/storefront/payment/sandbox-payment-result";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "نتیجه پرداخت آزمایشی | بهارمز",
  robots: { index: false, follow: false },
};
export default async function SandboxPaymentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  try {
    await requirePrincipal("customer");
  } catch {
    redirect("/");
  }
  const { code } = await params;
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content">
        <SandboxPaymentResult code={code} />
      </main>
    </StorefrontShell>
  );
}
