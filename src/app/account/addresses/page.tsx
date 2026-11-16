import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/identity/guards";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { AddressBook } from "@/storefront/addresses/address-book";
import { AccountShell } from "@/storefront/account/account-shell";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "نشانی‌های من | بهارمز",
  robots: { index: false, follow: false },
};
export default async function AddressesPage() {
  try {
    await requirePrincipal("customer");
  } catch {
    redirect("/");
  }
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content" tabIndex={-1}>
        <AccountShell>
          <AddressBook />
        </AccountShell>
      </main>
    </StorefrontShell>
  );
}
