export type ProductItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  description: string;
  gallery: string[];
  categoryId: string;
  ingredientIds: string[];
  priceRials: number;
  discountPriceRials: number | null;
  promoted: boolean;
  available: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  category?: {
    id?: string;
    name: string;
    imageId?: string | null;
    iconId?: string | null;
    archived: boolean;
  } | null;
  ingredients?: {
    id: string;
    name: string;
    iconId?: string | null;
    archived: boolean;
  }[];
  seo: { title: string; description: string };
};
export type ProductPage = {
  items: ProductItem[];
  total: number;
  page: number;
  limit: number;
  counts: {
    all: number;
    available: number;
    unavailable: number;
    promoted: number;
  };
};
