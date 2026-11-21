export interface Product {
  id: string;
  name: string;
  brand: string;
  categories: string[];
  images: string[];
  cover?: string;
  videoUrl?: string;
  coverType?: 'image' | 'video';
  featuredOnHome?: boolean;
  featuredOrder?: number;
  variants: string[];
  blackFriday?: boolean;
  catalogSource?: string;
  modelReplacement?: boolean;
  status?: 'active' | 'removed';
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}

export interface RemovedProductRecord {
  id: string;
  name: string;
  status: 'removed' | 'purged';
  removedAt?: unknown;
  removedBy: string;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  tag: string;
  coverImage?: string;
  showOnHome?: boolean;
  sortOrder?: number;
  isBuiltIn?: boolean;
  source?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}

export interface HeroSlide {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
  mediaType: 'image' | 'video';
  imageUrl: string;
  videoUrl?: string;
  visible?: boolean;
  sortOrder?: number;
  isBuiltIn?: boolean;
  status?: 'active';
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}

export interface BagItem {
  product: Product;
  variant: string;
  addedAt: number;
}

export type AppRoute =
  | { view: 'home'; hash?: string }
  | { view: 'catalog'; categorySlug?: string; search: string; brand: string; perfil: string; sort: string; page: number }
  | { view: 'product'; productId: string }
  | { view: 'admin-login'; redirectTo?: string }
  | { view: 'admin'; editProductId?: string }
  | { view: 'privacy' }
  | { view: 'not-found' };
