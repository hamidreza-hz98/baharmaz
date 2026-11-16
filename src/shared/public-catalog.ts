export type PublicCard = {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  priceRials: number;
  discountPriceRials: number | null;
  available: boolean;
  promoted: boolean;
};
