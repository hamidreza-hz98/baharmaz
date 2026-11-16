import { CustomerAccount } from "@/storefront/account/customer-account";
import { AdminAccount } from "@/admin/admin-account";
import { AccountShell } from "@/storefront/account/account-shell";
export default function AccountPreview() {
  return (
    <main style={{ maxWidth: 800, margin: "auto", padding: 16 }}>
      <AccountShell>
        <CustomerAccount />
      </AccountShell>
      <AdminAccount />
    </main>
  );
}
