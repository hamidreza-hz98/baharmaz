import { formatMoney } from "@/shared/locale";

export function PriceBreakdown({
  subtotalRials,
  discountRials,
  itemsTotalRials,
  shippingRials,
  totalRials,
  shippingPending = "در انتظار انتخاب نشانی",
}: {
  subtotalRials: number;
  discountRials: number;
  itemsTotalRials: number;
  shippingRials: number | null;
  totalRials: number | null;
  shippingPending?: string;
}) {
  return (
    <>
      <div>
        <span>جمع کالاها</span>
        <strong>{formatMoney(subtotalRials)}</strong>
      </div>
      <div className="price-discount">
        <span>تخفیف</span>
        <strong>{formatMoney(discountRials)}</strong>
      </div>
      <div className={shippingRials === null ? undefined : "price-shipping"}>
        <span>هزینه ارسال</span>
        <strong>
          {shippingRials === null
            ? shippingPending
            : formatMoney(shippingRials)}
        </strong>
      </div>
      <div className="price-total">
        <span>مبلغ نهایی</span>
        <strong>
          {formatMoney(totalRials ?? itemsTotalRials + (shippingRials ?? 0))}
        </strong>
      </div>
      {shippingRials === null && (
        <p className="price-pending-note">
          مبلغ نمایش‌داده‌شده بدون هزینه ارسال است؛ هزینه ارسال پس از انتخاب
          نشانی و زمان تحویل اضافه می‌شود.
        </p>
      )}
    </>
  );
}
