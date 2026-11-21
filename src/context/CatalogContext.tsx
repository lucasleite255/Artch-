import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Category, HeroSlide, Product, RemovedProductRecord } from '../types/catalog';
import {
  CATEGORIES as BASE_CATEGORIES,
  DEFAULT_HERO_SLIDES,
  HOME_FEATURED_LIMIT,
  PRODUCTS as BASE_PRODUCTS,
  getHomeFeaturedProducts,
} from '../data/catalog';
import {
  OperationType,
  auth,
  db,
  firebaseProjectId,
  firestoreDatabaseId,
  handleFirestoreError,
  refreshCurrentUser,
  sendPasswordReset,
  sendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
} from '../lib/firebase';
import {
  CategoryDraftInput,
  HeroSlideDraftInput,
  ProductDraftInput,
  validateCategoryDraft,
  validateHeroSlideDraft,
  validateProductDraft,
} from '../lib/productValidation';

const BOOTSTRAPPED_ADMIN_EMAILS = new Set([
  'lucasleite255@gmail.com',
  'artchesul@gmail.com',
]);
const BASE_PRODUCT_IDS = new Set(BASE_PRODUCTS.map((p) => p.id));
const BASE_CATEGORY_SLUGS = new Set(BASE_CATEGORIES.map((c) => c.slug));
const BASE_HERO_SLIDE_IDS = new Set(DEFAULT_HERO_SLIDES.map((s) => s.id));

interface CatalogContextValue {
  products: Product[];
  categories: Category[];
  homeCategories: Category[];
  customCategorySlugs: Set<string>;
  baseCategorySlugs: Set<string>;
  heroSlides: HeroSlide[];
  activeHeroSlides: HeroSlide[];
  customHeroSlideIds: Set<string>;
  baseHeroSlideIds: Set<string>;
  homeFeaturedProducts: Product[];
  homeFeaturedIds: Set<string>;
  customProductIds: Set<string>;
  baseProductIds: Set<string>;
  removedBaseProducts: RemovedProductRecord[];
  loading: boolean;
  syncError: string | null;
  quotaUpgradeUrl: string | null;
  user: User | null;
  emailVerified: boolean;
  authReady: boolean;
  isAdmin: boolean;
  checkingAdmin: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  addProduct: (draft: ProductDraftInput) => Promise<Product>;
  updateProduct: (originalProduct: Product, draft: ProductDraftInput) => Promise<Product>;
  toggleFeaturedOnHome: (product: Product, featured: boolean) => Promise<void>;
  reorderHomeFeaturedProducts: (orderedProducts: Product[]) => Promise<void>;
  removeProduct: (product: Product) => Promise<void>;
  restoreBaseProduct: (productId: string) => Promise<void>;
  permanentlyDeleteRemovedProducts: (productIds: string[]) => Promise<void>;
  saveCategory: (draft: CategoryDraftInput) => Promise<Category>;
  reorderCategories: (orderedCategories: Category[]) => Promise<void>;
  deleteCategory: (category: Category) => Promise<void>;
  saveHeroSlide: (draft: HeroSlideDraftInput) => Promise<HeroSlide>;
  reorderHeroSlides: (orderedSlides: HeroSlide[]) => Promise<void>;
  deleteHeroSlide: (slide: HeroSlide) => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [firestoreCategories, setFirestoreCategories] = useState<Category[]>([]);
  const [firestoreHeroSlides, setFirestoreHeroSlides] = useState<HeroSlide[]>([]);
  const [removedRecords, setRemovedRecords] = useState<RemovedProductRecord[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [removedLoaded, setRemovedLoaded] = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [heroSlidesLoaded, setHeroSlidesLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [quotaUpgradeUrl, setQuotaUpgradeUrl] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const parseQuotaOrError = useCallback((err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Quota exceeded')) {
      if (msg.includes('Free daily read units')) {
        setQuotaUpgradeUrl(
          `https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/${firestoreDatabaseId}/data?openUpgradeDialog=true`
        );
      }
      return 'Cota diária do banco de dados excedida. A cota gratuita é redefinida no próximo dia.';
    }
    return 'Não foi possível sincronizar os produtos com o banco de dados no momento.';
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setEmailVerified(currentUser?.emailVerified === true);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || emailVerified) return;

    const checkVerificationOnReturn = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const refreshed = await refreshCurrentUser();
        if (refreshed?.emailVerified) {
          setEmailVerified(true);
        }
      } catch {
        // Ignore transient network errors when checking verification on tab focus
      }
    };

    window.addEventListener('focus', checkVerificationOnReturn);
    document.addEventListener('visibilitychange', checkVerificationOnReturn);
    return () => {
      window.removeEventListener('focus', checkVerificationOnReturn);
      document.removeEventListener('visibilitychange', checkVerificationOnReturn);
    };
  }, [user, emailVerified]);

  useEffect(() => {
    let active = true;
    async function verifyAdminDoc() {
      if (!authReady || !user || !emailVerified) {
        if (active) {
          setHasAdminDoc(false);
          setCheckingAdmin(false);
        }
        return;
      }
      if (user.email && BOOTSTRAPPED_ADMIN_EMAILS.has(user.email.toLowerCase())) {
        if (active) {
          setHasAdminDoc(true);
          setCheckingAdmin(false);
        }
        return;
      }

      setCheckingAdmin(true);
      const adminPath = `admins/${user.uid}`;
      try {
        const snap = await getDoc(doc(db, 'admins', user.uid));
        if (active) {
          setHasAdminDoc(snap.exists() && snap.data()?.role === 'admin');
        }
      } catch (err) {
        if (active) setHasAdminDoc(false);
        handleFirestoreError(err, OperationType.GET, adminPath);
      } finally {
        if (active) setCheckingAdmin(false);
      }
    }

    void verifyAdminDoc();
    return () => {
      active = false;
    };
  }, [authReady, user, emailVerified]);

  useEffect(() => {
    const productsQuery = query(
      collection(db, 'products'),
      where('status', '==', 'active')
    );

    const unsubProducts = onSnapshot(
      productsQuery,
      (snapshot) => {
        const items: Product[] = snapshot.docs.map((d) => {
          const data = d.data();
          const videoUrl =
            typeof data.videoUrl === 'string' && data.videoUrl.trim()
              ? data.videoUrl.trim()
              : undefined;
          const coverType =
            data.coverType === 'video' && videoUrl ? 'video' : 'image';
          const featuredOnHome =
            typeof data.featuredOnHome === 'boolean' ? data.featuredOnHome : undefined;
          const featuredOrder =
            typeof data.featuredOrder === 'number' && Number.isFinite(data.featuredOrder)
              ? data.featuredOrder
              : undefined;
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            name: String(data.name || ''),
            brand: String(data.brand || ''),
            categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
            images: Array.isArray(data.images) ? data.images.map(String) : [],
            cover: typeof data.cover === 'string' ? data.cover : undefined,
            videoUrl,
            coverType,
            featuredOnHome,
            featuredOrder,
            variants: Array.isArray(data.variants) ? data.variants.map(String) : [],
            catalogSource:
              typeof data.catalogSource === 'string' ? data.catalogSource : 'admin-dashboard',
            status: 'active',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
          };
        });

        items.sort((a, b) => {
          const aSec =
            a.createdAt && typeof (a.createdAt as { seconds?: number }).seconds === 'number'
              ? (a.createdAt as { seconds: number }).seconds
              : 0;
          const bSec =
            b.createdAt && typeof (b.createdAt as { seconds?: number }).seconds === 'number'
              ? (b.createdAt as { seconds: number }).seconds
              : 0;
          return bSec - aSec;
        });

        setFirestoreProducts(items);
        setProductsLoaded(true);
        setSyncError(null);
      },
      (err) => {
        setProductsLoaded(true);
        setSyncError(parseQuotaOrError(err));
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    );

    const removedQuery = query(
      collection(db, 'removedProducts'),
      where('status', 'in', ['removed', 'purged'])
    );

    const unsubRemoved = onSnapshot(
      removedQuery,
      (snapshot) => {
        const rows: RemovedProductRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            name: String(data.name || d.id),
            status: data.status === 'purged' ? 'purged' : 'removed',
            removedAt: data.removedAt,
            removedBy: String(data.removedBy || ''),
          };
        });
        setRemovedRecords(rows);
        setRemovedLoaded(true);
      },
      (err) => {
        setRemovedLoaded(true);
        setSyncError(parseQuotaOrError(err));
        handleFirestoreError(err, OperationType.LIST, 'removedProducts');
      }
    );

    const categoriesQuery = query(
      collection(db, 'categories'),
      where('status', '==', 'active')
    );

    const unsubCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const rows: Category[] = snapshot.docs.map((d) => {
          const data = d.data();
          const slug = typeof data.slug === 'string' ? data.slug : d.id;
          return {
            slug,
            name: String(data.name || slug),
            description: String(data.description || ''),
            tag: String(data.tag || `/${slug}/`),
            coverImage: typeof data.coverImage === 'string' ? data.coverImage : '',
            showOnHome: data.showOnHome !== false,
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 50,
            isBuiltIn: data.isBuiltIn === true || BASE_CATEGORY_SLUGS.has(slug),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
          };
        });
        setFirestoreCategories(rows);
        setCategoriesLoaded(true);
      },
      (err) => {
        setCategoriesLoaded(true);
        setSyncError(parseQuotaOrError(err));
        handleFirestoreError(err, OperationType.LIST, 'categories');
      }
    );

    const heroSlidesQuery = query(
      collection(db, 'heroSlides'),
      where('status', '==', 'active')
    );

    const unsubHeroSlides = onSnapshot(
      heroSlidesQuery,
      (snapshot) => {
        const rows: HeroSlide[] = snapshot.docs.map((d) => {
          const data = d.data();
          const id = typeof data.id === 'string' ? data.id : d.id;
          const videoUrl =
            typeof data.videoUrl === 'string' && data.videoUrl.trim()
              ? data.videoUrl.trim()
              : '';
          const imageUrl =
            typeof data.imageUrl === 'string' ? data.imageUrl.trim() : '';
          const mediaType: 'image' | 'video' =
            data.mediaType === 'video' && videoUrl ? 'video' : 'image';
          return {
            id,
            title: String(data.title || ''),
            description: String(data.description || ''),
            ctaLabel: String(data.ctaLabel || 'Ver mais'),
            ctaPath: String(data.ctaPath || '/catalogo/'),
            mediaType,
            imageUrl,
            videoUrl,
            visible: data.visible !== false,
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 50,
            isBuiltIn: data.isBuiltIn === true || BASE_HERO_SLIDE_IDS.has(id),
            status: 'active',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
          };
        });
        setFirestoreHeroSlides(rows);
        setHeroSlidesLoaded(true);
      },
      (err) => {
        setHeroSlidesLoaded(true);
        setSyncError(parseQuotaOrError(err));
        handleFirestoreError(err, OperationType.LIST, 'heroSlides');
      }
    );

    return () => {
      unsubProducts();
      unsubRemoved();
      unsubCategories();
      unsubHeroSlides();
    };
  }, [parseQuotaOrError]);

  const isAdmin = useMemo(() => {
    if (!user || !emailVerified) return false;
    return (
      (user.email ? BOOTSTRAPPED_ADMIN_EMAILS.has(user.email.toLowerCase()) : false) ||
      hasAdminDoc
    );
  }, [user, emailVerified, hasAdminDoc]);

  const customProductIds = useMemo(
    () => new Set(firestoreProducts.map((p) => p.id)),
    [firestoreProducts]
  );

  const customCategorySlugs = useMemo(
    () => new Set(firestoreCategories.map((c) => c.slug)),
    [firestoreCategories]
  );

  const customHeroSlideIds = useMemo(
    () => new Set(firestoreHeroSlides.map((s) => s.id)),
    [firestoreHeroSlides]
  );

  const removedIdsSet = useMemo(
    () => new Set(removedRecords.map((r) => r.id)),
    [removedRecords]
  );

  const visibleRemovedRecords = useMemo(
    () => removedRecords.filter((r) => r.status === 'removed'),
    [removedRecords]
  );

  const categories = useMemo(() => {
    const dbBySlug = new Map(firestoreCategories.map((c) => [c.slug, c]));
    const mergedBase = BASE_CATEGORIES.map((base) => {
      const override = dbBySlug.get(base.slug);
      if (!override) return base;
      return {
        ...base,
        ...override,
        isBuiltIn: true,
        tag: base.tag,
      };
    });
    const added = firestoreCategories.filter((c) => !BASE_CATEGORY_SLUGS.has(c.slug));
    return [...mergedBase, ...added].sort(
      (a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)
    );
  }, [firestoreCategories]);

  const homeCategories = useMemo(
    () => categories.filter((c) => c.showOnHome !== false),
    [categories]
  );

  const heroSlides = useMemo(() => {
    const dbById = new Map(firestoreHeroSlides.map((s) => [s.id, s]));
    const mergedBase = DEFAULT_HERO_SLIDES.map((base) => {
      const override = dbById.get(base.id);
      if (!override) return base;
      return {
        ...base,
        ...override,
        isBuiltIn: true,
      };
    });
    const added = firestoreHeroSlides.filter((s) => !BASE_HERO_SLIDE_IDS.has(s.id));
    return [...mergedBase, ...added].sort(
      (a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)
    );
  }, [firestoreHeroSlides]);

  const activeHeroSlides = useMemo(() => {
    const visible = heroSlides.filter((s) => s.visible !== false);
    return visible.length > 0 ? visible : heroSlides.slice(0, 1);
  }, [heroSlides]);

  const products = useMemo(() => {
    const dbById = new Map(firestoreProducts.map((p) => [p.id, p]));
    const newDbProducts = firestoreProducts.filter(
      (p) => !BASE_PRODUCT_IDS.has(p.id) && !removedIdsSet.has(p.id)
    );
    const mergedBase = BASE_PRODUCTS.filter((p) => !removedIdsSet.has(p.id)).map((base) => {
      const override = dbById.get(base.id);
      return override ? { ...base, ...override } : base;
    });
    return [...newDbProducts, ...mergedBase];
  }, [firestoreProducts, removedIdsSet]);

  const homeFeaturedProducts = useMemo(
    () => getHomeFeaturedProducts(products, HOME_FEATURED_LIMIT),
    [products]
  );

  const homeFeaturedIds = useMemo(
    () => new Set(homeFeaturedProducts.map((p) => p.id)),
    [homeFeaturedProducts]
  );

  const loginWithGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const loggedUser = await signInWithEmail(email, password);
    setEmailVerified(loggedUser.emailVerified === true);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    await sendVerificationEmail();
  }, []);

  const refreshVerification = useCallback(async (): Promise<boolean> => {
    const refreshed = await refreshCurrentUser();
    const verified = refreshed?.emailVerified === true;
    setEmailVerified(verified);
    return verified;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await sendPasswordReset(email);
  }, []);

  const logout = useCallback(async () => {
    await signOutUser();
  }, []);

  const addProduct = useCallback(
    async (draft: ProductDraftInput): Promise<Product> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para adicionar peças.');
      }
      const validation = validateProductDraft(draft);
      if (!validation.valid || !validation.payload) {
        throw new Error(validation.errors[0] || 'Dados do produto inválidos.');
      }

      const payload = validation.payload;
      const docPath = `products/${payload.id}`;
      try {
        await setDoc(doc(db, 'products', payload.id), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }

      return {
        ...payload,
        createdBy: user.uid,
      };
    },
    [user, isAdmin]
  );

  const updateProduct = useCallback(
    async (originalProduct: Product, draft: ProductDraftInput): Promise<Product> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para editar peças.');
      }

      const validation = validateProductDraft({
        ...draft,
        id: originalProduct.id,
        featuredOrder:
          typeof draft.featuredOrder === 'number'
            ? draft.featuredOrder
            : originalProduct.featuredOrder,
        catalogSource: originalProduct.catalogSource || 'admin-dashboard',
      });
      if (!validation.valid || !validation.payload) {
        throw new Error(validation.errors[0] || 'Dados do produto inválidos.');
      }

      const payload = validation.payload;
      const docPath = `products/${originalProduct.id}`;

      if (customProductIds.has(originalProduct.id)) {
        try {
          const updateFields: Record<string, unknown> = {
            name: payload.name,
            brand: payload.brand,
            categories: payload.categories,
            images: payload.images,
            cover: payload.cover,
            videoUrl: payload.videoUrl,
            coverType: payload.coverType,
            featuredOnHome: payload.featuredOnHome,
            variants: payload.variants,
            updatedAt: serverTimestamp(),
          };
          if (typeof payload.featuredOrder === 'number') {
            updateFields.featuredOrder = payload.featuredOrder;
          }
          await updateDoc(doc(db, 'products', originalProduct.id), updateFields);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
      } else {
        try {
          await setDoc(doc(db, 'products', originalProduct.id), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }
      }

      return {
        ...originalProduct,
        ...payload,
      };
    },
    [user, isAdmin, customProductIds]
  );

  const toggleFeaturedOnHome = useCallback(
    async (product: Product, featured: boolean): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para destacar peças.');
      }

      const nextOrder =
        featured && typeof product.featuredOrder !== 'number' ? 0 : product.featuredOrder;
      const docPath = `products/${product.id}`;
      if (customProductIds.has(product.id)) {
        try {
          const patch: Record<string, unknown> = {
            featuredOnHome: featured,
            updatedAt: serverTimestamp(),
          };
          if (typeof nextOrder === 'number') {
            patch.featuredOrder = nextOrder;
          }
          await updateDoc(doc(db, 'products', product.id), patch);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
        return;
      }

      const images =
        product.images.length > 0
          ? product.images
          : product.cover
            ? [product.cover]
            : [];
      const validation = validateProductDraft({
        id: product.id,
        name: product.name,
        brand: product.brand,
        categories: product.categories,
        cover: product.cover || images[0] || '/assets/catalogo-artche/artche-0001-01.jpg',
        extraImages: images.slice(1),
        videoUrl: product.videoUrl,
        coverType: product.coverType,
        featuredOnHome: featured,
        featuredOrder: typeof nextOrder === 'number' ? nextOrder : undefined,
        variants: product.variants,
        catalogSource: product.catalogSource || 'fotos-artche-2026-11-13',
      });

      if (!validation.valid || !validation.payload) {
        throw new Error(validation.errors[0] || 'Não foi possível atualizar o destaque.');
      }

      try {
        await setDoc(doc(db, 'products', product.id), {
          ...validation.payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }
    },
    [user, isAdmin, customProductIds]
  );

  const reorderHomeFeaturedProducts = useCallback(
    async (orderedProducts: Product[]): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error(
          'Faça login com uma conta administradora autorizada para organizar os destaques.'
        );
      }
      if (orderedProducts.length === 0) return;

      const batch = writeBatch(db);
      for (let index = 0; index < orderedProducts.length; index++) {
        const item = orderedProducts[index];
        const nextOrder = Math.min(1000, index + 1);
        const docRef = doc(db, 'products', item.id);

        if (customProductIds.has(item.id)) {
          batch.update(docRef, {
            featuredOnHome: true,
            featuredOrder: nextOrder,
            updatedAt: serverTimestamp(),
          });
        } else {
          const images =
            item.images.length > 0
              ? item.images
              : item.cover
                ? [item.cover]
                : [];
          const validation = validateProductDraft({
            id: item.id,
            name: item.name,
            brand: item.brand,
            categories: item.categories,
            cover: item.cover || images[0] || '/assets/catalogo-artche/artche-0001-01.jpg',
            extraImages: images.slice(1),
            videoUrl: item.videoUrl,
            coverType: item.coverType,
            featuredOnHome: true,
            featuredOrder: nextOrder,
            variants: item.variants,
            catalogSource: item.catalogSource || 'fotos-artche-2026-11-13',
          });
          if (!validation.valid || !validation.payload) {
            throw new Error(
              validation.errors[0] || `Não foi possível organizar a peça ${item.name}.`
            );
          }
          batch.set(docRef, {
            ...validation.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
          });
        }
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'products');
      }
    },
    [user, isAdmin, customProductIds]
  );

  const removeProduct = useCallback(
    async (product: Product): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para remover peças.');
      }

      const isDbDoc = customProductIds.has(product.id);
      const isBaseItem = BASE_PRODUCT_IDS.has(product.id);

      if (isDbDoc && isBaseItem) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'products', product.id));
        batch.set(doc(db, 'removedProducts', product.id), {
          id: product.id.slice(0, 64),
          name: product.name.slice(0, 140),
          status: 'removed',
          removedAt: serverTimestamp(),
          removedBy: user.uid,
        });
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
        }
        return;
      }

      if (isDbDoc) {
        const docPath = `products/${product.id}`;
        try {
          await deleteDoc(doc(db, 'products', product.id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, docPath);
        }
        return;
      }

      const docPath = `removedProducts/${product.id}`;
      try {
        await setDoc(doc(db, 'removedProducts', product.id), {
          id: product.id.slice(0, 64),
          name: product.name.slice(0, 140),
          status: 'removed',
          removedAt: serverTimestamp(),
          removedBy: user.uid,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }
    },
    [user, isAdmin, customProductIds]
  );

  const restoreBaseProduct = useCallback(
    async (productId: string): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para restaurar peças.');
      }
      const docPath = `removedProducts/${productId}`;
      try {
        await deleteDoc(doc(db, 'removedProducts', productId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, isAdmin]
  );

  const permanentlyDeleteRemovedProducts = useCallback(
    async (productIds: string[]): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error(
          'Faça login com uma conta administradora autorizada para excluir peças definitivamente.'
        );
      }
      const uniqueIds = Array.from(
        new Set(
          productIds
            .map((id) => id.trim())
            .filter((id) => /^[a-zA-Z0-9_-]{2,64}$/.test(id))
        )
      );
      if (uniqueIds.length === 0) return;

      for (let i = 0; i < uniqueIds.length; i += 400) {
        const chunk = uniqueIds.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const productId of chunk) {
          batch.update(doc(db, 'removedProducts', productId), {
            status: 'purged',
            removedAt: serverTimestamp(),
            removedBy: user.uid,
          });
        }
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `removedProducts/${chunk[0]}`);
        }
      }
    },
    [user, isAdmin]
  );

  const saveCategory = useCallback(
    async (draft: CategoryDraftInput): Promise<Category> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para gerenciar categorias.');
      }
      const validation = validateCategoryDraft({
        ...draft,
        isBuiltIn: draft.slug ? BASE_CATEGORY_SLUGS.has(draft.slug) : false,
      });
      if (!validation.valid || !validation.payload) {
        throw new Error(validation.errors[0] || 'Dados da categoria inválidos.');
      }

      const payload = validation.payload;
      const docPath = `categories/${payload.slug}`;
      if (customCategorySlugs.has(payload.slug)) {
        try {
          await updateDoc(doc(db, 'categories', payload.slug), {
            name: payload.name,
            description: payload.description,
            tag: payload.tag,
            coverImage: payload.coverImage,
            showOnHome: payload.showOnHome,
            sortOrder: payload.sortOrder,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
      } else {
        try {
          await setDoc(doc(db, 'categories', payload.slug), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }
      }

      return {
        slug: payload.slug,
        name: payload.name,
        description: payload.description,
        tag: payload.tag,
        coverImage: payload.coverImage,
        showOnHome: payload.showOnHome,
        sortOrder: payload.sortOrder,
        isBuiltIn: payload.isBuiltIn,
        createdBy: user.uid,
      };
    },
    [user, isAdmin, customCategorySlugs]
  );

  const reorderCategories = useCallback(
    async (orderedCategories: Category[]): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error(
          'Faça login com uma conta administradora autorizada para reordenar categorias.'
        );
      }
      if (orderedCategories.length === 0) return;

      const batch = writeBatch(db);
      for (let index = 0; index < orderedCategories.length; index++) {
        const cat = orderedCategories[index];
        const nextOrder = Math.min(1000, index + 1);
        const docRef = doc(db, 'categories', cat.slug);

        if (customCategorySlugs.has(cat.slug)) {
          batch.update(docRef, {
            sortOrder: nextOrder,
            updatedAt: serverTimestamp(),
          });
        } else {
          const validation = validateCategoryDraft({
            slug: cat.slug,
            name: cat.name,
            description: cat.description,
            tag: cat.tag,
            coverImage: cat.coverImage || '',
            showOnHome: cat.showOnHome !== false,
            sortOrder: nextOrder,
            isBuiltIn: BASE_CATEGORY_SLUGS.has(cat.slug),
          });
          if (!validation.valid || !validation.payload) {
            throw new Error(
              validation.errors[0] || `Não foi possível reordenar a categoria ${cat.name}.`
            );
          }
          batch.set(docRef, {
            ...validation.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
          });
        }
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'categories');
      }
    },
    [user, isAdmin, customCategorySlugs]
  );

  const deleteCategory = useCallback(
    async (category: Category): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para remover categorias.');
      }
      if (!customCategorySlugs.has(category.slug)) {
        return;
      }
      const docPath = `categories/${category.slug}`;
      try {
        await deleteDoc(doc(db, 'categories', category.slug));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, isAdmin, customCategorySlugs]
  );

  const saveHeroSlide = useCallback(
    async (draft: HeroSlideDraftInput): Promise<HeroSlide> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para ajustar os slides.');
      }
      const validation = validateHeroSlideDraft({
        ...draft,
        isBuiltIn: draft.id ? BASE_HERO_SLIDE_IDS.has(draft.id) : false,
      });
      if (!validation.valid || !validation.payload) {
        throw new Error(validation.errors[0] || 'Dados do slide inválidos.');
      }

      const payload = validation.payload;
      const docPath = `heroSlides/${payload.id}`;
      if (customHeroSlideIds.has(payload.id)) {
        try {
          await updateDoc(doc(db, 'heroSlides', payload.id), {
            title: payload.title,
            description: payload.description,
            ctaLabel: payload.ctaLabel,
            ctaPath: payload.ctaPath,
            mediaType: payload.mediaType,
            imageUrl: payload.imageUrl,
            videoUrl: payload.videoUrl,
            visible: payload.visible,
            sortOrder: payload.sortOrder,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
      } else {
        try {
          await setDoc(doc(db, 'heroSlides', payload.id), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }
      }

      return {
        ...payload,
        createdBy: user.uid,
      };
    },
    [user, isAdmin, customHeroSlideIds]
  );

  const reorderHeroSlides = useCallback(
    async (orderedSlides: HeroSlide[]): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error(
          'Faça login com uma conta administradora autorizada para reordenar os slides.'
        );
      }
      if (orderedSlides.length === 0) return;

      const batch = writeBatch(db);
      for (let index = 0; index < orderedSlides.length; index++) {
        const slide = orderedSlides[index];
        const nextOrder = Math.min(1000, index + 1);
        const docRef = doc(db, 'heroSlides', slide.id);

        if (customHeroSlideIds.has(slide.id)) {
          batch.update(docRef, {
            sortOrder: nextOrder,
            updatedAt: serverTimestamp(),
          });
        } else {
          const validation = validateHeroSlideDraft({
            id: slide.id,
            title: slide.title,
            description: slide.description,
            ctaLabel: slide.ctaLabel,
            ctaPath: slide.ctaPath,
            mediaType: slide.mediaType,
            imageUrl: slide.imageUrl,
            videoUrl: slide.videoUrl,
            visible: slide.visible !== false,
            sortOrder: nextOrder,
            isBuiltIn: BASE_HERO_SLIDE_IDS.has(slide.id),
          });
          if (!validation.valid || !validation.payload) {
            throw new Error(
              validation.errors[0] || `Não foi possível reordenar o slide ${slide.title}.`
            );
          }
          batch.set(docRef, {
            ...validation.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: user.uid,
          });
        }
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'heroSlides');
      }
    },
    [user, isAdmin, customHeroSlideIds]
  );

  const deleteHeroSlide = useCallback(
    async (slide: HeroSlide): Promise<void> => {
      if (!user || !isAdmin) {
        throw new Error('Faça login com uma conta administradora autorizada para remover slides.');
      }
      if (!customHeroSlideIds.has(slide.id)) {
        return;
      }
      const docPath = `heroSlides/${slide.id}`;
      try {
        await deleteDoc(doc(db, 'heroSlides', slide.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, isAdmin, customHeroSlideIds]
  );

  const value = useMemo<CatalogContextValue>(
    () => ({
      products,
      categories,
      homeCategories,
      customCategorySlugs,
      baseCategorySlugs: BASE_CATEGORY_SLUGS,
      heroSlides,
      activeHeroSlides,
      customHeroSlideIds,
      baseHeroSlideIds: BASE_HERO_SLIDE_IDS,
      homeFeaturedProducts,
      homeFeaturedIds,
      customProductIds,
      baseProductIds: BASE_PRODUCT_IDS,
      removedBaseProducts: visibleRemovedRecords,
      loading: !productsLoaded || !removedLoaded || !categoriesLoaded || !heroSlidesLoaded,
      syncError,
      quotaUpgradeUrl,
      user,
      emailVerified,
      authReady,
      isAdmin,
      checkingAdmin,
      loginWithGoogle,
      loginWithEmail,
      resendVerificationEmail,
      refreshVerification,
      requestPasswordReset,
      logout,
      addProduct,
      updateProduct,
      toggleFeaturedOnHome,
      reorderHomeFeaturedProducts,
      removeProduct,
      restoreBaseProduct,
      permanentlyDeleteRemovedProducts,
      saveCategory,
      reorderCategories,
      deleteCategory,
      saveHeroSlide,
      reorderHeroSlides,
      deleteHeroSlide,
    }),
    [
      products,
      categories,
      homeCategories,
      customCategorySlugs,
      heroSlides,
      activeHeroSlides,
      customHeroSlideIds,
      homeFeaturedProducts,
      homeFeaturedIds,
      customProductIds,
      visibleRemovedRecords,
      productsLoaded,
      removedLoaded,
      categoriesLoaded,
      heroSlidesLoaded,
      syncError,
      quotaUpgradeUrl,
      user,
      emailVerified,
      authReady,
      isAdmin,
      checkingAdmin,
      loginWithGoogle,
      loginWithEmail,
      resendVerificationEmail,
      refreshVerification,
      requestPasswordReset,
      logout,
      addProduct,
      updateProduct,
      toggleFeaturedOnHome,
      reorderHomeFeaturedProducts,
      removeProduct,
      restoreBaseProduct,
      permanentlyDeleteRemovedProducts,
      saveCategory,
      reorderCategories,
      deleteCategory,
      saveHeroSlide,
      reorderHeroSlides,
      deleteHeroSlide,
    ]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error('useCatalog deve ser utilizado dentro de CatalogProvider.');
  }
  return ctx;
}
