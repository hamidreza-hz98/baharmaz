import Link from "next/link";
import type { PublicCard } from "@/shared/public-catalog";
import { formatMoney } from "@/shared/locale";
import { AddToCart } from "./add-to-cart";
import { CatalogImage } from "./catalog-image";
export function Price({ item }: { item: PublicCard }) {
  return (
    <div className="catalog-price">
      {item.discountPriceRials !== null && (
        <del>{formatMoney(item.priceRials)}</del>
      )}
      <strong>{formatMoney(item.discountPriceRials ?? item.priceRials)}</strong>
    </div>
  );
}
export function ProductCard({ item }: { item: PublicCard }) {
  const percent =
    item.discountPriceRials !== null
      ? Math.floor(
          Number(
            (BigInt(item.priceRials - item.discountPriceRials) * BigInt(100)) /
              BigInt(item.priceRials),
          ),
        )
      : 0;
  return (
    <article className="catalog-card">
      <Link
        href={`/products/${encodeURIComponent(item.slug)}`}
        className="catalog-card-link"
      >
        <div className="catalog-image">
          <CatalogImage id={item.image} />
        </div>
        <div className="catalog-badges">
          {item.promoted && <span>پیشنهاد ویژه</span>}
          {percent > 0 && (
            <span>{new Intl.NumberFormat("fa-IR").format(percent)}٪ تخفیف</span>
          )}
        </div>
        <h2>{item.title}</h2>
        <Price item={item} />
      </Link>
      <AddToCart id={item.id} available={item.available} />
    </article>
  );
}
