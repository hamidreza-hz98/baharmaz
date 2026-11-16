import { OrderManagementDetail, OrderManagementList } from "@/admin/orders";
export default function Page() {
  return (
    <>
      <OrderManagementList />
      <OrderManagementDetail code="TEST-1" />
    </>
  );
}
