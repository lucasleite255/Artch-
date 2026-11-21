export const PRODUCT_LIMITS = {
  idMin: 2,
  idMax: 64,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  nameMin: 2,
  nameMax: 140,
  brandMax: 80,
  categoriesMin: 1,
  categoriesMax: 8,
  categoryTagMax: 64,
  imagesMin: 1,
  imagesMax: 6,
  imageUrlMax: 1000,
  imageUrlPattern: /^(\/assets\/|\/uploads\/|https:\/\/).+$/,
  variantsMin: 1,
  variantsMax: 12,
  variantMax: 120,
  catalogSourceMax: 64,
  featuredOrderMin: 0,
  featuredOrderMax: 1000,
} as const;

export const CATEGORY_TAG_OPTIONS = [
  { label: 'Feminino', tag: '/feminino/' },
  { label: 'Masculino', tag: '/masculino/' },
  { label: 'Infantil', tag: '/infantil/' },
  { label: 'Térmicos', tag: '/Malhas Térmicas/' },
  { label: 'Casacos e jaquetas', tag: '/Casacos e Jaquetas/' },
  { label: 'Calçados', tag: '/Calçados/' },
  { label: 'Acessórios', tag: '/Acessórios/' },
  { label: 'SALE', tag: '/sale/' },
] as const;

export const PRESET_BRANDS = [
  'Seleção Artchê',
  'The North Face',
  'Columbia',
  'Solo',
  'Kailash',
  'Ambicione',
] as const;

export const PRESET_PRODUCT_IMAGES = [
  {
    label: 'Casaco feminino creme',
    url: '/assets/catalogo-artche/artche-0001-01.jpg',
  },
  {
    label: 'Casaco creme · ângulo 2',
    url: '/assets/catalogo-artche/artche-0001-02.jpg',
  },
  {
    label: 'Casaco creme · ângulo 3',
    url: '/assets/catalogo-artche/artche-0001-03.jpg',
  },
  {
    label: 'Jaqueta masculina verde',
    url: '/assets/catalogo-artche/artche-0026-01.jpg',
  },
  {
    label: 'Jaqueta masculina · ângulo 2',
    url: '/assets/catalogo-artche/artche-0026-02.jpg',
  },
  {
    label: 'Blusa térmica feminina',
    url: '/assets/catalogo-artche/artche-0049-01.jpg',
  },
  {
    label: 'Casaco rosa feminino',
    url: '/assets/catalogo-artche/artche-0165-01.jpg',
  },
  {
    label: 'Casaco vermelho feminino',
    url: '/assets/catalogo-artche/artche-0166-01.jpg',
  },
  {
    label: 'Bota de inverno',
    url: '/assets/catalogo-artche/artche-0092-01.jpg',
  },
  {
    label: 'Gorro de inverno marrom',
    url: '/assets/catalogo-artche/artche-0169-01.jpg',
  },
  {
    label: 'Cachecol azul-marinho',
    url: '/assets/catalogo-artche/artche-0170-01.jpg',
  },
  {
    label: 'Blusa azul meio zíper',
    url: '/assets/black-friday/bf-01.jpg',
  },
] as const;

export interface ProductDraftInput {
  id?: string;
  name: string;
  brand: string;
  categories: string[];
  cover: string;
  extraImages?: string[];
  videoUrl?: string;
  coverType?: 'image' | 'video';
  featuredOnHome?: boolean;
  featuredOrder?: number;
  variants: string[];
  catalogSource?: string;
}

export interface ValidatedProductPayload {
  id: string;
  name: string;
  brand: string;
  categories: string[];
  images: string[];
  cover: string;
  videoUrl: string;
  coverType: 'image' | 'video';
  featuredOnHome: boolean;
  featuredOrder?: number;
  variants: string[];
  catalogSource: string;
  status: 'active';
}

export function isValidMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.length >= 1 &&
    trimmed.length <= PRODUCT_LIMITS.imageUrlMax &&
    PRODUCT_LIMITS.imageUrlPattern.test(trimmed)
  );
}

export const isValidImageUrl = isValidMediaUrl;

export function buildProductSlugId(name: string): string {
  const baseSlug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);

  const suffix = Date.now().toString(36).slice(-5);
  const candidate = `artche-${baseSlug || 'peca'}-${suffix}`.slice(0, PRODUCT_LIMITS.idMax);
  return PRODUCT_LIMITS.idPattern.test(candidate) ? candidate : `artche-peca-${suffix}`;
}

export function validateProductDraft(input: ProductDraftInput): {
  valid: boolean;
  errors: string[];
  payload?: ValidatedProductPayload;
} {
  const errors: string[] = [];

  const name = input.name.trim().slice(0, PRODUCT_LIMITS.nameMax);
  if (name.length < PRODUCT_LIMITS.nameMin) {
    errors.push(`Informe um título com pelo menos ${PRODUCT_LIMITS.nameMin} caracteres.`);
  }

  const id = (input.id?.trim() || buildProductSlugId(name)).slice(0, PRODUCT_LIMITS.idMax);
  if (id.length < PRODUCT_LIMITS.idMin || !PRODUCT_LIMITS.idPattern.test(id)) {
    errors.push('O identificador deve conter apenas letras, números, hífen ou sublinhado.');
  }

  const brand = input.brand.trim().slice(0, PRODUCT_LIMITS.brandMax);

  const categories = Array.from(
    new Set(
      input.categories
        .map((c) => c.trim().slice(0, PRODUCT_LIMITS.categoryTagMax))
        .filter(Boolean)
    )
  ).slice(0, PRODUCT_LIMITS.categoriesMax);

  if (categories.length < PRODUCT_LIMITS.categoriesMin) {
    errors.push('Selecione pelo menos uma categoria para a peça.');
  }

  const cover = input.cover.trim().slice(0, PRODUCT_LIMITS.imageUrlMax);
  if (!isValidMediaUrl(cover)) {
    errors.push('A foto principal deve ser enviada ou começar com https://, /uploads/ ou /assets/.');
  }

  const rawImages = [cover, ...(input.extraImages || [])]
    .map((url) => url.trim().slice(0, PRODUCT_LIMITS.imageUrlMax))
    .filter((url) => url.length > 0);

  const images = Array.from(new Set(rawImages)).slice(0, PRODUCT_LIMITS.imagesMax);
  for (const img of images) {
    if (!isValidMediaUrl(img)) {
      errors.push(`Foto inválida (${img}). Use envio do dispositivo ou URLs https://, /uploads/ ou /assets/.`);
      break;
    }
  }

  const videoUrl = (input.videoUrl || '').trim().slice(0, PRODUCT_LIMITS.imageUrlMax);
  if (videoUrl && !isValidMediaUrl(videoUrl)) {
    errors.push('O vídeo deve ser enviado pelo dispositivo ou usar uma URL https://, /uploads/ ou /assets/.');
  }

  const coverType: 'image' | 'video' =
    input.coverType === 'video' && videoUrl.length > 0 ? 'video' : 'image';

  if (input.coverType === 'video' && !videoUrl) {
    errors.push('Envie ou informe um vídeo antes de defini-lo como capa do produto.');
  }

  const cleanVariants = Array.from(
    new Set(
      input.variants
        .map((v) => v.trim().slice(0, PRODUCT_LIMITS.variantMax))
        .filter(Boolean)
    )
  ).slice(0, PRODUCT_LIMITS.variantsMax);

  const variants =
    cleanVariants.length > 0
      ? cleanVariants
      : ['Consulte tamanhos, cores e disponibilidade'];

  const catalogSource = (input.catalogSource?.trim() || 'admin-dashboard').slice(
    0,
    PRODUCT_LIMITS.catalogSourceMax
  );

  const featuredOnHome = input.featuredOnHome === true;
  const hasNumericOrder =
    typeof input.featuredOrder === 'number' && Number.isFinite(input.featuredOrder);
  const featuredOrder = hasNumericOrder
    ? Math.min(
        PRODUCT_LIMITS.featuredOrderMax,
        Math.max(PRODUCT_LIMITS.featuredOrderMin, Math.round(input.featuredOrder as number))
      )
    : undefined;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const payload: ValidatedProductPayload = {
    id,
    name,
    brand,
    categories,
    images,
    cover,
    videoUrl,
    coverType,
    featuredOnHome,
    variants,
    catalogSource,
    status: 'active',
  };

  if (featuredOrder !== undefined) {
    payload.featuredOrder = featuredOrder;
  }

  return {
    valid: true,
    errors: [],
    payload,
  };
}

export const CATEGORY_LIMITS = {
  idMin: 2,
  idMax: 64,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  nameMin: 2,
  nameMax: 60,
  descriptionMax: 240,
  tagMin: 3,
  tagMax: 64,
  coverImageMax: 1000,
  sortOrderMin: 0,
  sortOrderMax: 1000,
} as const;

export interface CategoryDraftInput {
  slug?: string;
  name: string;
  description: string;
  tag?: string;
  coverImage?: string;
  showOnHome: boolean;
  sortOrder: number;
  isBuiltIn: boolean;
}

export interface ValidatedCategoryPayload {
  id: string;
  slug: string;
  name: string;
  description: string;
  tag: string;
  coverImage: string;
  showOnHome: boolean;
  sortOrder: number;
  isBuiltIn: boolean;
  status: 'active';
}

export function buildCategorySlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  if (base.length >= CATEGORY_LIMITS.idMin && CATEGORY_LIMITS.idPattern.test(base)) {
    return base;
  }
  return `categoria-${Date.now().toString(36).slice(-5)}`;
}

export function formatCategoryTag(rawTag: string, fallbackNameOrSlug: string): string {
  const cleaned = rawTag.trim().replace(/^\/+|\/+$/g, '');
  const base = cleaned || fallbackNameOrSlug.trim().replace(/^\/+|\/+$/g, '');
  const wrapped = `/${base}/`.slice(0, CATEGORY_LIMITS.tagMax);
  return wrapped.length >= CATEGORY_LIMITS.tagMin ? wrapped : '/categoria/';
}

export function validateCategoryDraft(input: CategoryDraftInput): {
  valid: boolean;
  errors: string[];
  payload?: ValidatedCategoryPayload;
} {
  const errors: string[] = [];

  const name = input.name.trim().slice(0, CATEGORY_LIMITS.nameMax);
  if (name.length < CATEGORY_LIMITS.nameMin) {
    errors.push(`Informe um nome de categoria com pelo menos ${CATEGORY_LIMITS.nameMin} caracteres.`);
  }

  const slug = (input.slug?.trim().toLowerCase() || buildCategorySlug(name)).slice(
    0,
    CATEGORY_LIMITS.idMax
  );
  if (slug.length < CATEGORY_LIMITS.idMin || !CATEGORY_LIMITS.idPattern.test(slug)) {
    errors.push('O slug da categoria deve conter apenas letras, números, hífen ou sublinhado.');
  }

  const description = input.description.trim().slice(0, CATEGORY_LIMITS.descriptionMax);
  const tag = formatCategoryTag(input.tag || '', name || slug);

  const coverImage = (input.coverImage || '').trim().slice(0, CATEGORY_LIMITS.coverImageMax);
  if (coverImage && !isValidMediaUrl(coverImage)) {
    errors.push(
      'A foto do destaque da categoria deve ser enviada ou usar URL https://, /uploads/ ou /assets/.'
    );
  }

  const numericOrder = Math.round(Number(input.sortOrder));
  const sortOrder = Number.isFinite(numericOrder)
    ? Math.min(CATEGORY_LIMITS.sortOrderMax, Math.max(CATEGORY_LIMITS.sortOrderMin, numericOrder))
    : 10;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    payload: {
      id: slug,
      slug,
      name,
      description,
      tag,
      coverImage,
      showOnHome: input.showOnHome === true,
      sortOrder,
      isBuiltIn: input.isBuiltIn === true,
      status: 'active',
    },
  };
}

export const HERO_SLIDE_LIMITS = {
  idMin: 2,
  idMax: 64,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  titleMin: 2,
  titleMax: 100,
  descriptionMax: 240,
  ctaLabelMin: 1,
  ctaLabelMax: 60,
  ctaPathMax: 1000,
  ctaPathPattern: /^(\/|https:\/\/).*$/,
  sortOrderMin: 0,
  sortOrderMax: 1000,
} as const;

export const PRESET_CAMPAIGN_IMAGES = [
  { label: 'Campanha Inverno Casal', url: '/assets/campaign/inverno-casal.png' },
  { label: 'Campanha Moda Inverno', url: '/assets/campaign/moda-inverno.png' },
  { label: 'Campanha Mala de Inverno', url: '/assets/campaign/mala-inverno.png' },
  { label: 'Fachada Loja Asa Sul', url: '/assets/campaign/loja-restaurada.png' },
] as const;

export interface HeroSlideDraftInput {
  id?: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
  mediaType: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  visible: boolean;
  sortOrder: number;
  isBuiltIn: boolean;
}

export interface ValidatedHeroSlidePayload {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
  mediaType: 'image' | 'video';
  imageUrl: string;
  videoUrl: string;
  visible: boolean;
  sortOrder: number;
  isBuiltIn: boolean;
  status: 'active';
}

export function isValidNavLink(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.length >= 1 &&
    trimmed.length <= HERO_SLIDE_LIMITS.ctaPathMax &&
    HERO_SLIDE_LIMITS.ctaPathPattern.test(trimmed)
  );
}

export function buildHeroSlideId(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  const suffix = Date.now().toString(36).slice(-5);
  const candidate = `slide-${base || 'banner'}-${suffix}`.slice(0, HERO_SLIDE_LIMITS.idMax);
  return HERO_SLIDE_LIMITS.idPattern.test(candidate) ? candidate : `slide-${suffix}`;
}

export function validateHeroSlideDraft(input: HeroSlideDraftInput): {
  valid: boolean;
  errors: string[];
  payload?: ValidatedHeroSlidePayload;
} {
  const errors: string[] = [];

  const title = input.title.trim().slice(0, HERO_SLIDE_LIMITS.titleMax);
  if (title.length < HERO_SLIDE_LIMITS.titleMin) {
    errors.push(`Informe um título com pelo menos ${HERO_SLIDE_LIMITS.titleMin} caracteres.`);
  }

  const id = (input.id?.trim() || buildHeroSlideId(title)).slice(0, HERO_SLIDE_LIMITS.idMax);
  if (id.length < HERO_SLIDE_LIMITS.idMin || !HERO_SLIDE_LIMITS.idPattern.test(id)) {
    errors.push('O identificador do slide deve conter apenas letras, números, hífen ou sublinhado.');
  }

  const description = input.description.trim().slice(0, HERO_SLIDE_LIMITS.descriptionMax);

  const ctaLabel = input.ctaLabel.trim().slice(0, HERO_SLIDE_LIMITS.ctaLabelMax);
  if (ctaLabel.length < HERO_SLIDE_LIMITS.ctaLabelMin) {
    errors.push('Informe o texto do botão do slide.');
  }

  const ctaPath = input.ctaPath.trim().slice(0, HERO_SLIDE_LIMITS.ctaPathMax);
  if (!isValidNavLink(ctaPath)) {
    errors.push(
      'O link do botão deve começar com / (ex.: /catalogo/ ou /categoria/feminino/) ou https://.'
    );
  }

  const imageUrl = (input.imageUrl || '').trim().slice(0, PRODUCT_LIMITS.imageUrlMax);
  if (imageUrl && !isValidMediaUrl(imageUrl)) {
    errors.push('A foto do slide deve ser enviada ou usar URL https://, /uploads/ ou /assets/.');
  }

  const videoUrl = (input.videoUrl || '').trim().slice(0, PRODUCT_LIMITS.imageUrlMax);
  if (videoUrl && !isValidMediaUrl(videoUrl)) {
    errors.push('O vídeo do slide deve ser enviado ou usar URL https://, /uploads/ ou /assets/.');
  }

  const mediaType: 'image' | 'video' = input.mediaType === 'video' ? 'video' : 'image';
  if (mediaType === 'image' && !isValidMediaUrl(imageUrl)) {
    errors.push('Envie ou informe uma foto para o slide.');
  }
  if (mediaType === 'video' && !isValidMediaUrl(videoUrl)) {
    errors.push('Envie ou informe um vídeo para o slide.');
  }

  const numericOrder = Math.round(Number(input.sortOrder));
  const sortOrder = Number.isFinite(numericOrder)
    ? Math.min(
        HERO_SLIDE_LIMITS.sortOrderMax,
        Math.max(HERO_SLIDE_LIMITS.sortOrderMin, numericOrder)
      )
    : 10;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    payload: {
      id,
      title,
      description,
      ctaLabel,
      ctaPath,
      mediaType,
      imageUrl,
      videoUrl,
      visible: input.visible !== false,
      sortOrder,
      isBuiltIn: input.isBuiltIn === true,
      status: 'active',
    },
  };
}


