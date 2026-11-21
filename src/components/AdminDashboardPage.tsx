import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Film,
  ImagePlus,
  LayoutGrid,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Product } from '../types/catalog';
import {
  HOME_FEATURED_LIMIT,
  formatProductCategoryLabel,
  isProductOnSale,
  matchesCategory,
  normalizeText,
} from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import {
  CATEGORY_LIMITS,
  PRESET_BRANDS,
  PRODUCT_LIMITS,
  buildCategorySlug,
  isValidMediaUrl,
  validateProductDraft,
} from '../lib/productValidation';
import { captureVideoPosterBlob, uploadMediaFile } from '../lib/mediaUpload';
import { GarmentVisual } from './GarmentVisual';
import { AdminCategoriesManager } from './AdminCategoriesManager';
import { AdminFeaturedHighlightsManager } from './AdminFeaturedHighlightsManager';
import { AdminHeroSlidesManager } from './AdminHeroSlidesManager';
import { SiteAssetPicker } from './SiteAssetPicker';

interface AdminDashboardPageProps {
  editProductId?: string;
  onNavigate: (path: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  editProductId,
  onNavigate,
}) => {
  const {
    products,
    categories,
    homeCategories,
    heroSlides,
    activeHeroSlides,
    homeFeaturedIds,
    customProductIds,
    baseProductIds,
    removedBaseProducts,
    loading,
    syncError,
    quotaUpgradeUrl,
    user,
    authReady,
    isAdmin,
    checkingAdmin,
    logout,
    addProduct,
    updateProduct,
    saveCategory,
    toggleFeaturedOnHome,
    removeProduct,
    restoreBaseProduct,
    permanentlyDeleteRemovedProducts,
  } = useCatalog();

  const editorRef = useRef<HTMLElement>(null);
  const inventoryRef = useRef<HTMLElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const handledEditParamRef = useRef<string | null>(null);

  const [workspaceView, setWorkspaceView] = useState<
    'products' | 'featured' | 'categories' | 'slides'
  >('products');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'removed'>('active');

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'featured' | 'db' | 'base'>('all');

  const [name, setName] = useState('');
  const [brandMode, setBrandMode] = useState<string>('Seleção Artchê');
  const [customBrand, setCustomBrand] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['/feminino/']);
  const [quickCatOpen, setQuickCatOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatShowHome, setQuickCatShowHome] = useState(false);
  const [quickCatBusy, setQuickCatBusy] = useState(false);
  const [quickCatError, setQuickCatError] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoInputError, setPhotoInputError] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoInputError, setVideoInputError] = useState<string | null>(null);
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);
  const [coverType, setCoverType] = useState<'image' | 'video'>('image');
  const [featuredOnHome, setFeaturedOnHome] = useState(true);

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [variantsText, setVariantsText] = useState('Consulte tamanhos, cores e disponibilidade');

  const [submitting, setSubmitting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [selectedRemovedIds, setSelectedRemovedIds] = useState<Set<string>>(() => new Set());
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const [confirmBulkPurge, setConfirmBulkPurge] = useState<'selected' | 'all' | null>(null);
  const [purgingRemoved, setPurgingRemoved] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [busyFeaturedId, setBusyFeaturedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const effectiveBrand = brandMode === '__custom__' ? customBrand : brandMode;

  const parsedVariants = useMemo(
    () =>
      variantsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [variantsText]
  );

  const previewProduct: Product = useMemo(() => {
    return {
      id: editingProduct?.id || 'preview',
      name: name.trim() || 'Título da peça',
      brand: effectiveBrand.trim() || 'Seleção Artchê',
      categories: selectedCategories.length > 0 ? selectedCategories : ['/feminino/'],
      images: galleryImages,
      cover: galleryImages[0] || '',
      videoUrl: videoUrl.trim() || undefined,
      coverType: coverType === 'video' && videoUrl.trim() ? 'video' : 'image',
      featuredOnHome,
      variants:
        parsedVariants.length > 0
          ? parsedVariants
          : ['Consulte tamanhos, cores e disponibilidade'],
      catalogSource: editingProduct?.catalogSource || 'admin-dashboard',
    };
  }, [
    editingProduct,
    name,
    effectiveBrand,
    selectedCategories,
    galleryImages,
    videoUrl,
    coverType,
    featuredOnHome,
    parsedVariants,
  ]);

  const categoryTagOptions = useMemo(
    () =>
      categories.map((c) => ({
        label: c.name,
        tag: c.tag,
        slug: c.slug,
      })),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const q = normalizeText(searchTerm);
    return products.filter((p) => {
      if (categoryFilter && !matchesCategory(p, categoryFilter, categories)) return false;
      if (sourceFilter === 'featured' && !homeFeaturedIds.has(p.id)) return false;
      if (sourceFilter === 'db' && !customProductIds.has(p.id)) return false;
      if (sourceFilter === 'base' && customProductIds.has(p.id)) return false;
      if (!q) return true;
      return (
        normalizeText(p.name).includes(q) ||
        normalizeText(p.brand).includes(q) ||
        normalizeText(p.id).includes(q)
      );
    });
  }, [products, categories, categoryFilter, sourceFilter, searchTerm, customProductIds, homeFeaturedIds]);

  const dbNewCount = useMemo(
    () => Array.from(customProductIds).filter((id) => !baseProductIds.has(id)).length,
    [customProductIds, baseProductIds]
  );

  useEffect(() => {
    setVideoPreviewFailed(false);
  }, [videoUrl]);

  useEffect(() => {
    const validIds = new Set(removedBaseProducts.map((item) => item.id));
    setSelectedRemovedIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [removedBaseProducts]);

  const allRemovedSelected =
    removedBaseProducts.length > 0 &&
    removedBaseProducts.every((item) => selectedRemovedIds.has(item.id));
  const selectedRemovedCount = selectedRemovedIds.size;

  const toggleSelectRemoved = (productId: string) => {
    setConfirmBulkPurge(null);
    setSelectedRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAllRemoved = () => {
    setConfirmBulkPurge(null);
    if (allRemovedSelected) {
      setSelectedRemovedIds(new Set());
    } else {
      setSelectedRemovedIds(new Set(removedBaseProducts.map((item) => item.id)));
    }
  };

  const resetFormToCreate = () => {
    setEditingProduct(null);
    setName('');
    setBrandMode('Seleção Artchê');
    setCustomBrand('');
    setSelectedCategories(['/feminino/']);
    setQuickCatOpen(false);
    setQuickCatName('');
    setQuickCatShowHome(false);
    setQuickCatError(null);
    setGalleryImages([]);
    setPhotoUrlInput('');
    setPhotoInputError(null);
    setAssetPickerOpen(false);
    setVideoUrl('');
    setVideoUrlInput('');
    setVideoInputError(null);
    setCoverType('image');
    setFeaturedOnHome(true);
    setVariantsText('Consulte tamanhos, cores e disponibilidade');
  };

  const openCreateForm = () => {
    setFeedback(null);
    resetFormToCreate();
    setFormOpen(true);
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openEditForm = (product: Product) => {
    setFeedback(null);
    setEditingProduct(product);
    setName(product.name);

    const matchedBrand = PRESET_BRANDS.find(
      (b) => normalizeText(b) === normalizeText(product.brand)
    );
    if (matchedBrand) {
      setBrandMode(matchedBrand);
      setCustomBrand('');
    } else if (!product.brand) {
      setBrandMode('Seleção Artchê');
      setCustomBrand('');
    } else {
      setBrandMode('__custom__');
      setCustomBrand(product.brand);
    }

    const normalizedProductCats = product.categories.map((c) =>
      normalizeText(c).replace(/^\/+|\/+$/g, '')
    );
    const matchedTags = categoryTagOptions
      .filter((opt) => {
        const optTag = normalizeText(opt.tag).replace(/^\/+|\/+$/g, '');
        const optSlug = normalizeText(opt.slug);
        const optLabel = normalizeText(opt.label);
        return normalizedProductCats.some(
          (pc) => pc === optTag || pc === optSlug || pc === optLabel
        );
      })
      .map((opt) => opt.tag);
    setSelectedCategories(
      matchedTags.length > 0
        ? matchedTags
        : product.categories.length > 0
          ? product.categories
          : ['/feminino/']
    );
    setQuickCatOpen(false);
    setQuickCatName('');
    setQuickCatError(null);

    const orderedImgs = Array.from(
      new Set([product.cover, ...product.images].filter((u): u is string => Boolean(u)))
    ).slice(0, PRODUCT_LIMITS.imagesMax);
    setGalleryImages(orderedImgs);
    setPhotoUrlInput('');
    setPhotoInputError(null);
    setAssetPickerOpen(false);

    const existingVideo = product.videoUrl || '';
    setVideoUrl(existingVideo);
    setVideoUrlInput(existingVideo);
    setVideoInputError(null);
    setCoverType(product.coverType === 'video' && existingVideo ? 'video' : 'image');
    setFeaturedOnHome(homeFeaturedIds.has(product.id));

    setVariantsText(
      product.variants.length > 0
        ? product.variants.join('\n')
        : 'Consulte tamanhos, cores e disponibilidade'
    );

    setWorkspaceView('products');
    setActiveTab('active');
    setFormOpen(true);
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    if (!editProductId) {
      handledEditParamRef.current = null;
      return;
    }
    if (!isAdmin || handledEditParamRef.current === editProductId) {
      return;
    }
    const target = products.find((p) => p.id === editProductId);
    if (target) {
      handledEditParamRef.current = editProductId;
      openEditForm(target);
    }
  });

  const closeEditor = () => {
    resetFormToCreate();
    setFormOpen(false);
    if (editProductId) {
      onNavigate('/admin/');
    }
  };

  const handleToggleCategory = (tag: string) => {
    setSelectedCategories((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleQuickCreateCategory = async () => {
    const trimmed = quickCatName.trim();
    setQuickCatError(null);
    if (trimmed.length < CATEGORY_LIMITS.nameMin) {
      setQuickCatError(`Informe um nome com pelo menos ${CATEGORY_LIMITS.nameMin} caracteres.`);
      return;
    }

    const candidateSlug = buildCategorySlug(trimmed);
    const existingBySlugOrName = categories.find(
      (c) => c.slug === candidateSlug || normalizeText(c.name) === normalizeText(trimmed)
    );
    if (existingBySlugOrName) {
      setSelectedCategories((prev) =>
        prev.includes(existingBySlugOrName.tag) ? prev : [...prev, existingBySlugOrName.tag]
      );
      setQuickCatOpen(false);
      setQuickCatName('');
      setFeedback({
        type: 'success',
        text: `A categoria “${existingBySlugOrName.name}” já existia e foi marcada nesta peça.`,
      });
      return;
    }

    setQuickCatBusy(true);
    try {
      const maxOrder = categories.reduce((acc, c) => Math.max(acc, c.sortOrder ?? 0), 0);
      const saved = await saveCategory({
        slug: candidateSlug,
        name: trimmed,
        description: `Peças da categoria ${trimmed} disponíveis na Artchê.`,
        tag: `/${candidateSlug}/`,
        coverImage: galleryImages[0] || '',
        showOnHome: quickCatShowHome,
        sortOrder: Math.min(CATEGORY_LIMITS.sortOrderMax, maxOrder + 1),
        isBuiltIn: false,
      });
      setSelectedCategories((prev) => (prev.includes(saved.tag) ? prev : [...prev, saved.tag]));
      setQuickCatOpen(false);
      setQuickCatName('');
      setQuickCatShowHome(false);
      setFeedback({
        type: 'success',
        text: `Categoria “${saved.name}” criada e selecionada! Ela já aparece no catálogo e na aba Categorias dos produtos.`,
      });
    } catch (err) {
      setQuickCatError(err instanceof Error ? err.message : 'Não foi possível criar a categoria.');
    } finally {
      setQuickCatBusy(false);
    }
  };

  const appendPhotoUrls = (urls: string[]) => {
    setGalleryImages((prev) =>
      Array.from(new Set([...prev, ...urls])).slice(0, PRODUCT_LIMITS.imagesMax)
    );
  };

  const handleInsertPhotoUrl = (rawUrl: string) => {
    const url = rawUrl.trim();
    setPhotoInputError(null);

    if (!url) {
      setPhotoInputError('Informe a URL da foto (https://..., /uploads/... ou /assets/...).');
      return;
    }
    if (!isValidMediaUrl(url)) {
      setPhotoInputError(
        'A foto deve começar com https://, /uploads/ ou /assets/ (máx. 1000 caracteres).'
      );
      return;
    }
    if (galleryImages.includes(url)) {
      setPhotoInputError('Esta foto já está na galeria da peça.');
      return;
    }
    if (galleryImages.length >= PRODUCT_LIMITS.imagesMax) {
      setPhotoInputError(`Limite de ${PRODUCT_LIMITS.imagesMax} fotos por peça atingido.`);
      return;
    }

    appendPhotoUrls([url]);
    setPhotoUrlInput('');
  };

  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setPhotoInputError(null);
    const availableSlots = PRODUCT_LIMITS.imagesMax - galleryImages.length;

    if (availableSlots <= 0) {
      setPhotoInputError(`Limite de ${PRODUCT_LIMITS.imagesMax} fotos por peça atingido.`);
      e.target.value = '';
      return;
    }

    const files = Array.from(fileList).slice(0, availableSlots);
    setUploadingPhotos(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const res = await uploadMediaFile(file);
        uploadedUrls.push(res.url);
      }
      if (uploadedUrls.length > 0) {
        appendPhotoUrls(uploadedUrls);
      }
    } catch (err) {
      setPhotoInputError(
        err instanceof Error ? err.message : 'Não foi possível enviar as fotos do dispositivo.'
      );
    } finally {
      setUploadingPhotos(false);
      e.target.value = '';
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoInputError(null);
    setUploadingVideo(true);

    try {
      const res = await uploadMediaFile(file);
      setVideoUrl(res.url);
      setVideoUrlInput(res.url);

      if (galleryImages.length === 0) {
        const posterBlob = await captureVideoPosterBlob(file);
        if (posterBlob) {
          try {
            const posterUpload = await uploadMediaFile(posterBlob, 'poster.jpg');
            appendPhotoUrls([posterUpload.url]);
          } catch {
            // Keep default poster if poster upload fails
          }
        }
      }
    } catch (err) {
      setVideoInputError(
        err instanceof Error ? err.message : 'Não foi possível enviar o vídeo do dispositivo.'
      );
    } finally {
      setUploadingVideo(false);
      e.target.value = '';
    }
  };

  const handleApplyVideoUrl = () => {
    const trimmed = videoUrlInput.trim();
    setVideoInputError(null);

    if (!trimmed) {
      setVideoUrl('');
      setCoverType('image');
      return;
    }
    if (!isValidMediaUrl(trimmed)) {
      setVideoInputError(
        'O vídeo deve ser enviado ou usar URL https://, /uploads/ ou /assets/.'
      );
      return;
    }
    setVideoUrl(trimmed);
  };

  const handleRemoveVideo = () => {
    setVideoUrl('');
    setVideoUrlInput('');
    setVideoInputError(null);
    setCoverType('image');
  };

  const handleMovePhoto = (index: number, direction: -1 | 1) => {
    setGalleryImages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleSetAsCover = (index: number) => {
    setCoverType('image');
    if (index === 0) return;
    setGalleryImages((prev) => {
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      return [chosen, ...next];
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoInputError(null);
    setGalleryImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    try {
      await logout();
      setFormOpen(false);
      setEditingProduct(null);
      setConfirmRemoveId(null);
      onNavigate('/admin/login/');
    } finally {
      setAuthBusy(false);
    }
  };

  const formatWriteError = (err: unknown, fallback: string): string => {
    const raw = err instanceof Error ? err.message : String(err || '');
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as {
          error?: string;
          authInfo?: { email?: string | null; emailVerified?: boolean | null };
        };
        const msg = parsed.error || '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          if (parsed.authInfo && parsed.authInfo.emailVerified === false) {
            return `Seu e-mail (${parsed.authInfo.email || 'atual'}) ainda não está verificado no Firebase. Confirme o link enviado ao seu e-mail (ou entre com o Google) e tente novamente.`;
          }
          return `Permissão recusada pelo banco de dados para ${parsed.authInfo?.email || 'esta conta'}. Verifique se o e-mail está confirmado e se as regras do Firestore estão atualizadas.`;
        }
        if (msg) return msg;
      } catch {
        // Fall back to raw message
      }
    }
    return raw || fallback;
  };

  const handleQuickToggleFeatured = async (product: Product) => {
    const nextValue = !homeFeaturedIds.has(product.id);
    setBusyFeaturedId(product.id);
    setFeedback(null);
    try {
      await toggleFeaturedOnHome(product, nextValue);
      setFeedback({
        type: 'success',
        text: nextValue
          ? `Peça “${product.name}” marcada nos destaques da página inicial.`
          : `Peça “${product.name}” removida dos destaques da página inicial.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: formatWriteError(err, 'Erro ao atualizar destaque da página inicial.'),
      });
    } finally {
      setBusyFeaturedId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cover = galleryImages[0] || '';
    const extraImages = galleryImages.slice(1);
    const trimmedVideoInput = videoUrlInput.trim();
    const effectiveVideoUrl =
      videoUrl.trim() || (isValidMediaUrl(trimmedVideoInput) ? trimmedVideoInput : '');
    const activeCoverType: 'image' | 'video' =
      coverType === 'video' && effectiveVideoUrl ? 'video' : 'image';

    const validation = validateProductDraft({
      id: editingProduct?.id,
      name,
      brand: effectiveBrand,
      categories: selectedCategories,
      cover,
      extraImages,
      videoUrl: effectiveVideoUrl,
      coverType: activeCoverType,
      featuredOnHome,
      variants: parsedVariants,
      catalogSource: editingProduct?.catalogSource || 'admin-dashboard',
    });

    if (!validation.valid) {
      setFeedback({
        type: 'error',
        text: validation.errors[0] || 'Verifique os campos antes de salvar.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        const updated = await updateProduct(editingProduct, {
          id: editingProduct.id,
          name,
          brand: effectiveBrand,
          categories: selectedCategories,
          cover,
          extraImages,
          videoUrl: effectiveVideoUrl,
          coverType: activeCoverType,
          featuredOnHome,
          variants: parsedVariants,
          catalogSource: editingProduct.catalogSource || 'admin-dashboard',
        });
        resetFormToCreate();
        setFormOpen(false);
        setActiveTab('active');
        if (editProductId) {
          onNavigate('/admin/');
        }
        setFeedback({
          type: 'success',
          text: `Peça “${updated.name}” atualizada com sucesso no banco de dados (ref. ${updated.id}).`,
        });
      } else {
        const created = await addProduct({
          id: validation.payload?.id,
          name,
          brand: effectiveBrand,
          categories: selectedCategories,
          cover,
          extraImages,
          videoUrl: effectiveVideoUrl,
          coverType: activeCoverType,
          featuredOnHome,
          variants: parsedVariants,
        });
        resetFormToCreate();
        setFormOpen(false);
        setActiveTab('active');
        setFeedback({
          type: 'success',
          text: `Peça “${created.name}” adicionada ao banco de dados (ref. ${created.id}).`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: formatWriteError(err, 'Erro ao salvar as alterações no banco de dados.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRemove = async (product: Product) => {
    setBusyRowId(product.id);
    setFeedback(null);
    try {
      await removeProduct(product);
      if (editingProduct?.id === product.id) {
        closeEditor();
      }
      setConfirmRemoveId(null);
      setFeedback({
        type: 'success',
        text: baseProductIds.has(product.id)
          ? `Peça “${product.name}” removida do catálogo público. Você pode restaurá-la na aba “Peças removidas”.`
          : `Peça “${product.name}” removida permanentemente do banco de dados.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: formatWriteError(err, 'Erro ao remover o produto.'),
      });
    } finally {
      setBusyRowId(null);
    }
  };

  const handleRestore = async (productId: string, productName: string) => {
    setBusyRowId(productId);
    setFeedback(null);
    try {
      await restoreBaseProduct(productId);
      setConfirmPurgeId((cur) => (cur === productId ? null : cur));
      setConfirmBulkPurge(null);
      setFeedback({
        type: 'success',
        text: `Peça “${productName}” restaurada no catálogo.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: formatWriteError(err, 'Erro ao restaurar a peça.'),
      });
    } finally {
      setBusyRowId(null);
    }
  };

  const handlePurgeRemoved = async (productIds: string[], singleName?: string) => {
    if (productIds.length === 0) return;
    setPurgingRemoved(true);
    if (productIds.length === 1) {
      setBusyRowId(productIds[0]);
    }
    setFeedback(null);
    try {
      await permanentlyDeleteRemovedProducts(productIds);
      setConfirmPurgeId(null);
      setConfirmBulkPurge(null);
      setSelectedRemovedIds((prev) => {
        const next = new Set(prev);
        for (const id of productIds) {
          next.delete(id);
        }
        return next;
      });
      setFeedback({
        type: 'success',
        text:
          productIds.length === 1
            ? `Peça${singleName ? ` “${singleName}”` : ''} apagada definitivamente da lista de removidas.`
            : `${productIds.length} peças removidas foram apagadas definitivamente da lista.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: formatWriteError(err, 'Erro ao apagar peças da lista de removidas.'),
      });
    } finally {
      setPurgingRemoved(false);
      setBusyRowId(null);
    }
  };

  if (!authReady || checkingAdmin || !isAdmin) {
    return null;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-6 text-[11px] text-[#566773]">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="underline underline-offset-4 hover:text-[#152F40]"
        >
          Início
        </a>
        <span aria-hidden="true"> / </span>
        <span>Painel de Produtos</span>
      </div>

      {/* Header Band */}
      <section className="bg-[#F5F6F5] border-y border-[#DCE2E5] py-8 md:py-9">
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#566773]">
              Gestão de Catálogo · Banco de Dados em Tempo Real
            </p>
            <h1 className="font-serif-display text-[38px] md:text-[48px] text-[#152F40] mt-1 leading-[1.06]">
              Painel de Produtos
            </h1>
            <p className="text-[13px] text-[#566773] mt-2.5 max-w-[660px]">
              Cadastre novas peças, envie fotos e vídeos do dispositivo, edite qualquer produto e
              escolha quais peças aparecem nos 16 destaques da página inicial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceView('products');
                    if (formOpen && !editingProduct) {
                      closeEditor();
                    } else {
                      openCreateForm();
                    }
                  }}
                  className="inline-flex items-center gap-2.5 px-5 py-3 min-h-[44px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors"
                >
                  {formOpen && !editingProduct ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>Fechar formulário</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Adicionar produto</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setWorkspaceView((v) => (v === 'featured' ? 'products' : 'featured'))
                  }
                  className={`inline-flex items-center gap-2 px-5 py-3 min-h-[44px] border text-xs font-medium transition-colors ${
                    workspaceView === 'featured'
                      ? 'bg-[#152F40] text-white border-[#152F40]'
                      : 'border-[#152F40] bg-white text-[#152F40] hover:bg-[#152F40] hover:text-white'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span>
                    {workspaceView === 'featured'
                      ? 'Voltar aos produtos'
                      : 'Organizar destaques'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setWorkspaceView((v) => (v === 'categories' ? 'products' : 'categories'))
                  }
                  className={`inline-flex items-center gap-2 px-5 py-3 min-h-[44px] border text-xs font-medium transition-colors whitespace-nowrap ${
                    workspaceView === 'categories'
                      ? 'bg-[#152F40] text-white border-[#152F40]'
                      : 'border-[#152F40] bg-white text-[#152F40] hover:bg-[#152F40] hover:text-white'
                  }`}
                >
                  <span>
                    {workspaceView === 'categories'
                      ? 'Voltar aos produtos'
                      : 'Categorias dos produtos'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setWorkspaceView((v) => (v === 'slides' ? 'products' : 'slides'))
                  }
                  className={`inline-flex items-center gap-2 px-5 py-3 min-h-[44px] border text-xs font-medium transition-colors whitespace-nowrap ${
                    workspaceView === 'slides'
                      ? 'bg-[#152F40] text-white border-[#152F40]'
                      : 'border-[#152F40] bg-white text-[#152F40] hover:bg-[#152F40] hover:text-white'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  <span>
                    {workspaceView === 'slides' ? 'Voltar aos produtos' : 'Slides da Home'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceView('products');
                    setFormOpen(false);
                    setEditingProduct(null);
                    setActiveTab('active');
                    setSearchTerm('');
                    setCategoryFilter('');
                    setSourceFilter('all');
                    requestAnimationFrame(() => {
                      inventoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] border border-[#152F40] bg-white text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors whitespace-nowrap"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Ver todos os produtos</span>
                </button>
              </>
            )}

            <a
              href="/catalogo/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/catalogo/');
              }}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] border border-[#152F40] bg-white text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors"
            >
              <span>Ver vitrine</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-8 md:py-10 space-y-8">
        {/* Sync / Quota Error Banner */}
        {syncError && (
          <div
            role="alert"
            className="border border-[#152F40] bg-[#F5F6F5] px-5 py-4 text-xs text-[#152F40] flex flex-wrap items-center justify-between gap-3"
          >
            <span>{syncError}</span>
            {quotaUpgradeUrl && (
              <a
                href={quotaUpgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 font-medium hover:text-[#476E84]"
              >
                Abrir console do Firestore ↗
              </a>
            )}
          </div>
        )}

        {/* Operation Feedback Banner */}
        {feedback && (
          <div
            role="status"
            className={`px-5 py-4 text-xs flex items-center justify-between gap-4 border ${
              feedback.type === 'success'
                ? 'bg-[#D0E5F2]/40 border-[#9CC1D9] text-[#152F40]'
                : 'bg-[#F5F6F5] border-[#152F40] text-[#152F40]'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Fechar aviso"
              className="p-1 text-[#566773] hover:text-[#152F40]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Auth Status Bar */}
        <section
          aria-label="Sessão administrativa"
          className="border border-[#DCE2E5] bg-white px-5 py-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-[#152F40]">
              <span className="font-medium">Sessão administrativa ativa</span>
              <span aria-hidden="true" className="mx-2 text-[#566773]">
                ·
              </span>
              <span className="text-[#566773]">{user?.email}</span>
            </div>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[38px] border border-[#DCE2E5] text-xs text-[#152F40] hover:border-[#152F40] transition-colors shrink-0 self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </section>

        {/* KPI Metric Strip */}
        <section aria-label="Resumo do catálogo" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-[#DCE2E5] bg-white p-5">
            <span className="block text-[11px] uppercase tracking-[0.08em] text-[#566773]">
              Peças ativas na vitrine
            </span>
            <strong className="block font-serif-display text-[34px] text-[#152F40] mt-2 leading-none tabular-nums">
              {products.length.toLocaleString('pt-BR')}
            </strong>
          </div>
          <div className="border border-[#DCE2E5] bg-white p-5">
            <span className="block text-[11px] uppercase tracking-[0.08em] text-[#566773]">
              Destaques na Home
            </span>
            <strong className="block font-serif-display text-[34px] text-[#152F40] mt-2 leading-none tabular-nums">
              {homeFeaturedIds.size}/{HOME_FEATURED_LIMIT}
            </strong>
          </div>
          <div className="border border-[#DCE2E5] bg-white p-5">
            <span className="block text-[11px] uppercase tracking-[0.08em] text-[#566773]">
              Categorias na Home
            </span>
            <strong className="block font-serif-display text-[34px] text-[#152F40] mt-2 leading-none tabular-nums">
              {homeCategories.length}/{categories.length}
            </strong>
          </div>
          <div className="border border-[#DCE2E5] bg-white p-5">
            <span className="block text-[11px] uppercase tracking-[0.08em] text-[#566773]">
              Novas no banco
            </span>
            <strong className="block font-serif-display text-[34px] text-[#152F40] mt-2 leading-none tabular-nums">
              {dbNewCount.toLocaleString('pt-BR')}
            </strong>
          </div>
        </section>

        {/* Workspace Mode Switch */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#DCE2E5]">
          <button
            type="button"
            onClick={() => setWorkspaceView('products')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              workspaceView === 'products'
                ? 'border-[#152F40] text-[#152F40]'
                : 'border-transparent text-[#566773] hover:text-[#152F40]'
            }`}
          >
            Produtos (<span className="tabular-nums">{products.length}</span>)
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('featured')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              workspaceView === 'featured'
                ? 'border-[#152F40] text-[#152F40]'
                : 'border-transparent text-[#566773] hover:text-[#152F40]'
            }`}
          >
            Organizar destaques (<span className="tabular-nums">{homeFeaturedIds.size}/{HOME_FEATURED_LIMIT}</span>)
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('categories')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              workspaceView === 'categories'
                ? 'border-[#152F40] text-[#152F40]'
                : 'border-transparent text-[#566773] hover:text-[#152F40]'
            }`}
          >
            Categorias dos produtos (<span className="tabular-nums">{categories.length}</span>)
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('slides')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              workspaceView === 'slides'
                ? 'border-[#152F40] text-[#152F40]'
                : 'border-transparent text-[#566773] hover:text-[#152F40]'
            }`}
          >
            Slides da Home (
            <span className="tabular-nums">
              {activeHeroSlides.length}/{heroSlides.length}
            </span>
            )
          </button>
        </div>

        {workspaceView === 'featured' ? (
          <AdminFeaturedHighlightsManager
            onFeedback={setFeedback}
            onEditProduct={openEditForm}
            onNavigate={onNavigate}
          />
        ) : workspaceView === 'categories' ? (
          <AdminCategoriesManager onFeedback={setFeedback} onNavigate={onNavigate} />
        ) : workspaceView === 'slides' ? (
          <AdminHeroSlidesManager onFeedback={setFeedback} onNavigate={onNavigate} />
        ) : (
          <>
        {/* Create / Edit Product Form */}
        {isAdmin && formOpen && (
          <section
            ref={editorRef}
            aria-label={editingProduct ? 'Editar peça' : 'Cadastrar nova peça'}
            className="border border-[#152F40] bg-[#F5F6F5] p-6 md:p-8"
          >
            <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-[#DCE2E5]">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#566773] tabular-nums">
                  {editingProduct
                    ? `Editando peça · Ref. ${editingProduct.id}`
                    : 'Novo item no banco de dados'}
                </p>
                <h2 className="font-serif-display text-[28px] text-[#152F40] leading-tight mt-0.5">
                  {editingProduct
                    ? 'Editar título, fotos, vídeo e destaque'
                    : 'Cadastrar nova peça'}
                </h2>
                <p className="text-xs text-[#566773] mt-1">
                  As alterações são gravadas no Firestore e atualizadas na vitrine imediatamente.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Fechar editor"
                className="p-2 text-[#566773] hover:text-[#152F40]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 lg:grid-cols-[1.55fr_0.85fr] gap-8 items-start"
            >
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="prod-name" className="text-xs font-medium text-[#152F40]">
                      Título da peça *
                    </label>
                    <span className="text-[11px] text-[#566773] tabular-nums">
                      {name.length}/{PRODUCT_LIMITS.nameMax}
                    </span>
                  </div>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    maxLength={PRODUCT_LIMITS.nameMax}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Casaco acolchoado impermeável azul-marinho"
                    className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-[13px] text-[#152F40] focus:outline-none focus:border-[#152F40]"
                  />
                </div>

                {/* Home Highlight Checkbox */}
                <div className="bg-white border border-[#DCE2E5] px-4 py-3.5">
                  <label className="inline-flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featuredOnHome}
                      onChange={(e) => setFeaturedOnHome(e.target.checked)}
                      className="mt-0.5 accent-[#152F40]"
                    />
                    <span>
                      <span className="block text-xs font-medium text-[#152F40]">
                        Destacar em “Nossos destaques” na página inicial (até {HOME_FEATURED_LIMIT}{' '}
                        peças)
                      </span>
                      <span className="block text-[11px] text-[#566773] mt-0.5">
                        Peças destacadas aparecem na seção principal da Home. Desmarque se quiser
                        exibir esta peça apenas no catálogo e categorias.
                      </span>
                    </span>
                  </label>
                </div>

                {/* Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="prod-brand"
                      className="block text-xs font-medium text-[#152F40] mb-1.5"
                    >
                      Marca
                    </label>
                    <select
                      id="prod-brand"
                      value={brandMode}
                      onChange={(e) => setBrandMode(e.target.value)}
                      className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                    >
                      {PRESET_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                      <option value="__custom__">Outra marca…</option>
                    </select>
                  </div>

                  {brandMode === '__custom__' && (
                    <div>
                      <label
                        htmlFor="prod-custom-brand"
                        className="block text-xs font-medium text-[#152F40] mb-1.5"
                      >
                        Nome da marca
                      </label>
                      <input
                        id="prod-custom-brand"
                        type="text"
                        maxLength={PRODUCT_LIMITS.brandMax}
                        value={customBrand}
                        onChange={(e) => setCustomBrand(e.target.value)}
                        placeholder="Digite a marca"
                        className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                      />
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="block text-xs font-medium text-[#152F40]">
                      Categorias * (selecione ao menos 1)
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickCatOpen((v) => !v);
                          setQuickCatError(null);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#152F40] bg-white text-[11px] font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{quickCatOpen ? 'Fechar nova categoria' : 'Nova categoria'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkspaceView('categories')}
                        className="text-[11px] underline underline-offset-4 text-[#566773] hover:text-[#152F40]"
                      >
                        Gerenciar categorias
                      </button>
                    </div>
                  </div>

                  {quickCatOpen && (
                    <div className="mb-3 border border-[#152F40] bg-white p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          maxLength={CATEGORY_LIMITS.nameMax}
                          value={quickCatName}
                          onChange={(e) => {
                            setQuickCatName(e.target.value);
                            setQuickCatError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleQuickCreateCategory();
                            }
                          }}
                          placeholder="Nome da nova categoria (ex.: Neve e Esqui, Tricôs…)"
                          aria-label="Nome da nova categoria de produto"
                          className="flex-1 border border-[#DCE2E5] bg-[#F5F6F5]/40 px-3 py-2 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={quickCatBusy}
                            onClick={() => void handleQuickCreateCategory()}
                            className="px-4 py-2 bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] disabled:opacity-60 transition-colors whitespace-nowrap"
                          >
                            {quickCatBusy ? 'Criando…' : 'Criar e selecionar'}
                          </button>
                          <button
                            type="button"
                            disabled={quickCatBusy}
                            onClick={() => {
                              setQuickCatOpen(false);
                              setQuickCatError(null);
                            }}
                            className="px-3 py-2 border border-[#DCE2E5] text-xs text-[#566773] hover:text-[#152F40] transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-[11px] text-[#566773] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={quickCatShowHome}
                          onChange={(e) => setQuickCatShowHome(e.target.checked)}
                          className="accent-[#152F40]"
                        />
                        <span>Exibir também no carrossel de estilos da Home (você pode ajustar a foto depois)</span>
                      </label>
                      {quickCatError && (
                        <p role="alert" className="text-[11px] text-[#152F40] font-medium">
                          {quickCatError}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-white border border-[#DCE2E5] p-3.5">
                    {categoryTagOptions.map((opt) => {
                      const checked = selectedCategories.includes(opt.tag);
                      return (
                        <label
                          key={opt.tag}
                          className="inline-flex items-center gap-2 text-xs text-[#152F40] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleCategory(opt.tag)}
                            className="accent-[#152F40]"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Photos Upload & Gallery Manager */}
                <div className="bg-white border border-[#DCE2E5] p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="block text-xs font-medium text-[#152F40]">
                        Fotos da peça * (
                        <span className="tabular-nums">{galleryImages.length}</span>/
                        <span className="tabular-nums">{PRODUCT_LIMITS.imagesMax}</span>)
                      </span>
                      <span className="text-[11px] text-[#566773]">
                        Envie do seu dispositivo, informe uma URL ou escolha do acervo.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={photoFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        multiple
                        onChange={(e) => void handlePhotoFileUpload(e)}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={
                          uploadingPhotos || galleryImages.length >= PRODUCT_LIMITS.imagesMax
                        }
                        onClick={() => photoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#152F40] text-white text-[11px] font-medium hover:bg-[#2E5267] disabled:opacity-50 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingPhotos ? 'Enviando fotos…' : 'Enviar fotos do dispositivo'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAssetPickerOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#152F40] text-[11px] font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>{assetPickerOpen ? 'Ocultar acervo' : 'Acervo Artchê'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Current Photo Strip */}
                  {galleryImages.length === 0 ? (
                    <div className="border border-dashed border-[#DCE2E5] bg-[#F5F6F5]/60 px-4 py-8 text-center">
                      <p className="text-xs font-medium text-[#152F40]">
                        Nenhuma foto adicionada ainda
                      </p>
                      <p className="text-[11px] text-[#566773] mt-1">
                        Envie fotos do dispositivo, informe uma URL abaixo ou escolha no Acervo Artchê.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {galleryImages.map((imgUrl, index) => {
                        const isImageCover = index === 0 && coverType === 'image';
                        return (
                          <div
                            key={imgUrl}
                            className={`border bg-[#F5F6F5] p-2 flex flex-col gap-2 ${
                              isImageCover ? 'border-[#152F40]' : 'border-[#DCE2E5]'
                            }`}
                          >
                          <div className="relative w-full aspect-[4/5] bg-[#F5F6F5] border border-[#DCE2E5] overflow-hidden">
                            <img
                              src={imgUrl}
                              alt={`Foto ${index + 1}`}
                              className={`w-full h-full object-cover ${
                                imgUrl.startsWith('https://') ||
                                imgUrl.startsWith('/uploads/') ||
                                imgUrl.includes('/black-friday/')
                                  ? 'object-[center_18%]'
                                  : 'object-center'
                              }`}
                            />
                            {index === 0 && (
                              <span className="absolute top-1.5 left-1.5 bg-[#152F40] text-white text-[10px] px-2 py-0.5 font-medium">
                                {coverType === 'video' ? 'Poster' : 'Capa'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMovePhoto(index, -1)}
                                aria-label="Mover foto para esquerda"
                                className="p-1 border border-[#DCE2E5] bg-white text-[#152F40] disabled:opacity-40 hover:border-[#152F40]"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={index === galleryImages.length - 1}
                                onClick={() => handleMovePhoto(index, 1)}
                                aria-label="Mover foto para direita"
                                className="p-1 border border-[#DCE2E5] bg-white text-[#152F40] disabled:opacity-40 hover:border-[#152F40]"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              {(index !== 0 || coverType === 'video') && (
                                <button
                                  type="button"
                                  onClick={() => handleSetAsCover(index)}
                                  title="Definir esta foto como capa"
                                  aria-label="Definir como capa"
                                  className="inline-flex items-center gap-1 px-2 py-1 border border-[#DCE2E5] bg-white text-[10px] text-[#152F40] hover:border-[#152F40]"
                                >
                                  <Star className="w-3 h-3" />
                                  <span>Capa</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(index)}
                                aria-label={`Remover foto ${index + 1}`}
                                className="p-1 border border-[#DCE2E5] bg-white text-[#566773] hover:text-[#152F40] hover:border-[#152F40]"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}

                  {/* Insert Photo by URL */}
                  <div>
                    <label
                      htmlFor="insert-photo-url"
                      className="block text-[11px] font-medium text-[#152F40] mb-1.5"
                    >
                      Ou inserir foto por URL (https://..., /uploads/... ou /assets/...)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="insert-photo-url"
                        type="text"
                        maxLength={PRODUCT_LIMITS.imageUrlMax}
                        value={photoUrlInput}
                        onChange={(e) => {
                          setPhotoUrlInput(e.target.value);
                          setPhotoInputError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleInsertPhotoUrl(photoUrlInput);
                          }
                        }}
                        placeholder="https://exemplo.com/foto.jpg"
                        className="flex-1 border border-[#DCE2E5] bg-[#F5F6F5]/40 px-3 py-2 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                      />
                      <button
                        type="button"
                        disabled={galleryImages.length >= PRODUCT_LIMITS.imagesMax}
                        onClick={() => handleInsertPhotoUrl(photoUrlInput)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[#152F40] text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white disabled:opacity-50 transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Inserir URL</span>
                      </button>
                    </div>
                    {photoInputError && (
                      <p className="text-[11px] text-[#152F40] mt-1.5 underline underline-offset-2">
                        {photoInputError}
                      </p>
                    )}
                  </div>

                  {/* Visual Asset Picker */}
                  {assetPickerOpen && (
                    <SiteAssetPicker
                      selectedUrls={galleryImages}
                      disableSelected
                      aspectRatio="4/5"
                      columnsClass="grid-cols-3 sm:grid-cols-6"
                      hintText="Clique em uma foto do acervo da Artchê para adicionar à galeria:"
                      onSelect={(url) => handleInsertPhotoUrl(url)}
                    />
                  )}
                </div>

                {/* Product Video Upload & Cover Option */}
                <div className="bg-white border border-[#DCE2E5] p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="block text-xs font-medium text-[#152F40]">
                        Vídeo do produto (opcional)
                      </span>
                      <span className="text-[11px] text-[#566773]">
                        MP4, WebM ou MOV (até 25 MB). Salvo permanentemente e reproduzido como capa
                        na vitrine.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(e) => void handleVideoFileUpload(e)}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={uploadingVideo}
                        onClick={() => videoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#152F40] text-white text-[11px] font-medium hover:bg-[#2E5267] disabled:opacity-50 transition-colors"
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>
                          {uploadingVideo ? 'Enviando vídeo…' : 'Enviar vídeo do dispositivo'}
                        </span>
                      </button>
                      {videoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveVideo}
                          className="inline-flex items-center gap-1 px-3 py-2 border border-[#DCE2E5] text-[11px] text-[#566773] hover:text-[#152F40] hover:border-[#152F40] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover vídeo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {videoUrl && (
                    <div className="space-y-3 border border-[#DCE2E5] bg-[#F5F6F5] p-3">
                      <div className="w-full max-h-[260px] bg-[#0E2636] overflow-hidden">
                        <video
                          key={videoUrl}
                          src={videoUrl}
                          controls
                          muted
                          playsInline
                          onLoadedData={() => setVideoPreviewFailed(false)}
                          onError={() => setVideoPreviewFailed(true)}
                          className="w-full max-h-[260px] object-contain mx-auto"
                        />
                      </div>
                      {videoPreviewFailed && (
                        <p
                          role="alert"
                          className="text-[11px] text-[#8B2635] bg-white border border-[#8B2635]/40 px-3 py-2 leading-relaxed"
                        >
                          Este vídeo antigo não está mais disponível no servidor. Clique em “Enviar
                          vídeo do dispositivo” acima e salve a peça para gravá-lo de forma
                          permanente.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <label className="inline-flex items-center gap-2 text-xs text-[#152F40] cursor-pointer">
                          <input
                            type="radio"
                            name="product-cover-type"
                            checked={coverType === 'image'}
                            onChange={() => setCoverType('image')}
                            className="accent-[#152F40]"
                          />
                          <span>Usar foto principal como capa</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#152F40] cursor-pointer">
                          <input
                            type="radio"
                            name="product-cover-type"
                            checked={coverType === 'video'}
                            onChange={() => setCoverType('video')}
                            className="accent-[#152F40]"
                          />
                          <span>Usar vídeo como capa do produto</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="insert-video-url"
                      className="block text-[11px] font-medium text-[#152F40] mb-1.5"
                    >
                      Ou informar URL de vídeo (https://..., /uploads/... ou /assets/...)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="insert-video-url"
                        type="text"
                        maxLength={PRODUCT_LIMITS.imageUrlMax}
                        value={videoUrlInput}
                        onChange={(e) => {
                          setVideoUrlInput(e.target.value);
                          setVideoInputError(null);
                        }}
                        onBlur={() => {
                          const trimmed = videoUrlInput.trim();
                          if (trimmed && isValidMediaUrl(trimmed)) {
                            setVideoUrl(trimmed);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyVideoUrl();
                          }
                        }}
                        placeholder="https://exemplo.com/video-produto.mp4"
                        className="flex-1 border border-[#DCE2E5] bg-[#F5F6F5]/40 px-3 py-2 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyVideoUrl}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[#152F40] text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors shrink-0"
                      >
                        <span>Aplicar vídeo</span>
                      </button>
                    </div>
                    {videoInputError && (
                      <p className="text-[11px] text-[#152F40] mt-1.5 underline underline-offset-2">
                        {videoInputError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Variants */}
                <div>
                  <label
                    htmlFor="prod-variants"
                    className="block text-xs font-medium text-[#152F40] mb-1.5"
                  >
                    Opções para consulta (separadas por vírgula ou linha)
                  </label>
                  <textarea
                    id="prod-variants"
                    rows={3}
                    value={variantsText}
                    onChange={(e) => setVariantsText(e.target.value)}
                    placeholder="Preto P/M/G, Azul-marinho M/G"
                    className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                  />
                </div>

                {/* Submit / Cancel */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting || uploadingPhotos || uploadingVideo}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Salvando no banco…'
                        : editingProduct
                          ? 'Salvar alterações'
                          : 'Salvar produto no catálogo'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="px-5 py-3 min-h-[44px] border border-[#DCE2E5] bg-white text-xs text-[#566773] hover:text-[#152F40] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Live Storefront Preview */}
              <div className="bg-white border border-[#DCE2E5] p-5 md:sticky md:top-6">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[#566773]">
                    Pré-visualização na vitrine
                  </span>
                  <span className="text-[11px] text-[#566773] tabular-nums">
                    {previewProduct.coverType === 'video' ? 'Capa: vídeo' : 'Capa: foto'}
                    {' · '}
                    {previewProduct.images.length}{' '}
                    {previewProduct.images.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </div>
                <div className="relative w-full aspect-[4/5] bg-[#F5F6F5] border border-[#DCE2E5] overflow-hidden mb-3">
                  <GarmentVisual product={previewProduct} />
                  {isProductOnSale(previewProduct, categories) && (
                    <span className="absolute top-2.5 right-2.5 z-10 bg-[#8B2635] text-white px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase leading-none pointer-events-none">
                      SALE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#566773] truncate">
                  {previewProduct.brand || 'Seleção Artchê'}
                </p>
                <h3 className="text-[14px] font-medium text-[#152F40] mt-1 leading-snug">
                  {previewProduct.name}
                </h3>
                <p className="text-[11px] text-[#566773] mt-1">
                  {formatProductCategoryLabel(previewProduct, categories)}
                </p>
                <p className="text-[11px] text-[#152F40] mt-2 font-medium">
                  {featuredOnHome ? 'Destaque na página inicial' : 'Somente catálogo'}
                </p>
              </div>
            </form>
          </section>
        )}

        {/* Inventory Tabs & Table */}
        <section
          ref={inventoryRef}
          aria-label="Lista de produtos do catálogo"
          className="border border-[#DCE2E5] bg-white"
        >
          <div className="border-b border-[#DCE2E5] px-5 pt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`pb-3.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'active'
                    ? 'border-[#152F40] text-[#152F40]'
                    : 'border-transparent text-[#566773] hover:text-[#152F40]'
                }`}
              >
                Catálogo ativo (<span className="tabular-nums">{products.length}</span>)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('removed')}
                className={`pb-3.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'removed'
                    ? 'border-[#152F40] text-[#152F40]'
                    : 'border-transparent text-[#566773] hover:text-[#152F40]'
                }`}
              >
                Peças removidas (<span className="tabular-nums">{removedBaseProducts.length}</span>)
              </button>
            </div>
          </div>

          {activeTab === 'active' ? (
            <>
              {/* Filter Toolbar */}
              <div className="p-4 border-b border-[#DCE2E5] bg-[#F5F6F5]/60 grid grid-cols-1 md:grid-cols-[1fr_210px_240px] gap-3">
                <div className="relative flex items-center bg-white border border-[#DCE2E5] focus-within:border-[#152F40]">
                  <Search className="w-4 h-4 text-[#566773] ml-3 shrink-0" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por título, marca ou referência…"
                    className="w-full px-3 py-2.5 text-xs text-[#152F40] bg-transparent focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Filtrar por categoria"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-[#DCE2E5] bg-white px-3 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por exibição ou origem"
                  value={sourceFilter}
                  onChange={(e) =>
                    setSourceFilter(e.target.value as 'all' | 'featured' | 'db' | 'base')
                  }
                  className="border border-[#DCE2E5] bg-white px-3 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                >
                  <option value="all">Todas as peças</option>
                  <option value="featured">
                    Nos destaques da Home ({homeFeaturedIds.size})
                  </option>
                  <option value="db">No banco (novas e editadas)</option>
                  <option value="base">Catálogo base original</option>
                </select>
              </div>

              {loading && products.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#566773]">
                  Carregando catálogo sincronizado…
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-[#152F40]">Nenhum produto encontrado.</p>
                  <p className="text-xs text-[#566773] mt-1">
                    Ajuste os filtros ou cadastre uma nova peça no catálogo.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#DCE2E5] bg-[#F5F6F5] text-[11px] uppercase tracking-[0.06em] text-[#566773]">
                        <th className="py-3 px-4 font-medium">Peça</th>
                        <th className="py-3 px-4 font-medium">Categorias</th>
                        <th className="py-3 px-4 font-medium">Home</th>
                        <th className="py-3 px-4 font-medium">Mídia</th>
                        <th className="py-3 px-4 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE2E5] text-xs">
                      {filteredProducts.map((product) => {
                        const isDbDoc = customProductIds.has(product.id);
                        const isBase = baseProductIds.has(product.id);
                        const originLabel = isDbDoc
                          ? isBase
                            ? 'Editada no banco'
                            : 'Nova no banco'
                          : 'Catálogo base';
                        const isConfirming = confirmRemoveId === product.id;
                        const isBusy = busyRowId === product.id;
                        const isFeatured = homeFeaturedIds.has(product.id);
                        const photoTotal = Math.max(product.images.length, product.cover ? 1 : 0);

                        return (
                          <tr key={product.id} className="hover:bg-[#F5F6F5]/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3 min-w-[230px]">
                                <div className="w-12 aspect-[4/5] shrink-0 bg-[#F5F6F5] border border-[#DCE2E5] overflow-hidden">
                                  <GarmentVisual product={product} />
                                </div>
                                <div className="min-w-0">
                                  <span className="block font-medium text-[#152F40] line-clamp-2">
                                    {product.name}
                                  </span>
                                  <span className="block text-[11px] text-[#566773] tabular-nums mt-0.5">
                                    {product.brand || 'Seleção Artchê'} · {originLabel} · Ref.{' '}
                                    {product.id}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[#566773] min-w-[150px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isProductOnSale(product, categories) && (
                                  <span className="inline-block bg-[#8B2635] text-white px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase leading-none">
                                    SALE
                                  </span>
                                )}
                                <span>{formatProductCategoryLabel(product, categories)}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {isAdmin ? (
                                <button
                                  type="button"
                                  disabled={busyFeaturedId === product.id}
                                  onClick={() => void handleQuickToggleFeatured(product)}
                                  aria-label={
                                    isFeatured
                                      ? `Remover ${product.name} dos destaques da Home`
                                      : `Destacar ${product.name} na Home`
                                  }
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[11px] font-medium transition-colors ${
                                    isFeatured
                                      ? 'bg-[#152F40] text-white border-[#152F40] hover:bg-[#2E5267]'
                                      : 'bg-white text-[#566773] border-[#DCE2E5] hover:border-[#152F40] hover:text-[#152F40]'
                                  }`}
                                >
                                  <Star
                                    className={`w-3 h-3 ${isFeatured ? 'fill-white' : ''}`}
                                  />
                                  <span>
                                    {busyFeaturedId === product.id
                                      ? 'Salvando…'
                                      : isFeatured
                                        ? 'No destaque'
                                        : 'Destacar'}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#566773]">
                                  {isFeatured ? 'No destaque' : 'Catálogo'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#566773] tabular-nums whitespace-nowrap">
                              {photoTotal} {photoTotal === 1 ? 'foto' : 'fotos'}
                              {product.videoUrl
                                ? product.coverType === 'video'
                                  ? ' · Capa: vídeo'
                                  : ' · Com vídeo'
                                : ''}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2">
                                <a
                                  href={`/produto/${product.id}/`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    onNavigate(`/produto/${product.id}/`);
                                  }}
                                  className="px-3 py-1.5 border border-[#DCE2E5] text-[#152F40] hover:border-[#152F40] transition-colors"
                                >
                                  Ver
                                </a>

                                {isAdmin && !isConfirming && (
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(product)}
                                    aria-label={`Editar ${product.name}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#152F40] text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                )}

                                {isAdmin &&
                                  (isConfirming ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => void handleConfirmRemove(product)}
                                        className="px-3 py-1.5 bg-[#152F40] text-white hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                                      >
                                        {isBusy ? 'Removendo…' : 'Confirmar'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => setConfirmRemoveId(null)}
                                        className="px-2.5 py-1.5 border border-[#DCE2E5] text-[#566773] hover:text-[#152F40] transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmRemoveId(product.id)}
                                      aria-label={`Remover ${product.name}`}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DCE2E5] text-[#152F40] hover:border-[#152F40] hover:bg-[#F5F6F5] transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Remover</span>
                                    </button>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div>
              {removedBaseProducts.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-[#152F40]">
                    Nenhuma peça na lista de removidas.
                  </p>
                  <p className="text-xs text-[#566773] mt-1">
                    Quando uma peça do catálogo base for removida, ela aparecerá aqui para
                    restauração ou exclusão definitiva.
                  </p>
                </div>
              ) : (
                <>
                  {isAdmin && (
                    <div className="px-4 py-3 border-b border-[#DCE2E5] bg-[#F5F6F5]/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#152F40]">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium">
                          <input
                            type="checkbox"
                            checked={allRemovedSelected}
                            disabled={purgingRemoved}
                            onChange={toggleSelectAllRemoved}
                            className="accent-[#152F40] w-4 h-4 cursor-pointer"
                          />
                          <span>
                            {allRemovedSelected
                              ? 'Desmarcar todas'
                              : `Selecionar todas (${removedBaseProducts.length})`}
                          </span>
                        </label>

                        {selectedRemovedCount > 0 && (
                          <div className="flex items-center gap-2 text-[#566773]">
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums font-medium text-[#152F40]">
                              {selectedRemovedCount}{' '}
                              {selectedRemovedCount === 1 ? 'selecionada' : 'selecionadas'}
                            </span>
                            <button
                              type="button"
                              disabled={purgingRemoved}
                              onClick={() => {
                                setSelectedRemovedIds(new Set());
                                setConfirmBulkPurge(null);
                              }}
                              className="underline underline-offset-4 hover:text-[#152F40] disabled:opacity-50"
                            >
                              Limpar seleção
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {confirmBulkPurge === 'selected' ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[#152F40] font-medium">
                              Apagar {selectedRemovedCount}{' '}
                              {selectedRemovedCount === 1
                                ? 'peça selecionada'
                                : 'peças selecionadas'}
                              ?
                            </span>
                            <button
                              type="button"
                              disabled={purgingRemoved}
                              onClick={() =>
                                void handlePurgeRemoved(Array.from(selectedRemovedIds))
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8B2635] text-white font-medium hover:bg-[#701D2A] disabled:opacity-60 transition-colors"
                            >
                              {purgingRemoved ? 'Apagando…' : 'Confirmar exclusão'}
                            </button>
                            <button
                              type="button"
                              disabled={purgingRemoved}
                              onClick={() => setConfirmBulkPurge(null)}
                              className="px-2.5 py-1.5 border border-[#DCE2E5] bg-white text-[#566773] hover:text-[#152F40] transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : confirmBulkPurge === 'all' ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[#152F40] font-medium">
                              Apagar todas as {removedBaseProducts.length} peças removidas
                              definitivamente?
                            </span>
                            <button
                              type="button"
                              disabled={purgingRemoved}
                              onClick={() =>
                                void handlePurgeRemoved(
                                  removedBaseProducts.map((item) => item.id)
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8B2635] text-white font-medium hover:bg-[#701D2A] disabled:opacity-60 transition-colors"
                            >
                              {purgingRemoved ? 'Apagando todas…' : 'Confirmar apagar todas'}
                            </button>
                            <button
                              type="button"
                              disabled={purgingRemoved}
                              onClick={() => setConfirmBulkPurge(null)}
                              className="px-2.5 py-1.5 border border-[#DCE2E5] bg-white text-[#566773] hover:text-[#152F40] transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            {selectedRemovedCount > 0 && (
                              <button
                                type="button"
                                disabled={purgingRemoved}
                                onClick={() => {
                                  setConfirmPurgeId(null);
                                  setConfirmBulkPurge('selected');
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#8B2635] bg-white text-xs font-medium text-[#8B2635] hover:bg-[#8B2635] hover:text-white disabled:opacity-60 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir selecionadas ({selectedRemovedCount})</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={purgingRemoved}
                              onClick={() => {
                                setConfirmPurgeId(null);
                                setConfirmBulkPurge('all');
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#152F40] bg-white text-xs font-medium text-[#152F40] hover:bg-[#8B2635] hover:border-[#8B2635] hover:text-white disabled:opacity-60 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Apagar todas ({removedBaseProducts.length})</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#DCE2E5] bg-[#F5F6F5] text-[11px] uppercase tracking-[0.06em] text-[#566773]">
                          {isAdmin && (
                            <th className="py-3 pl-4 pr-2 w-10">
                              <input
                                type="checkbox"
                                checked={allRemovedSelected}
                                disabled={purgingRemoved}
                                onChange={toggleSelectAllRemoved}
                                aria-label="Selecionar todas as peças removidas"
                                className="accent-[#152F40] w-4 h-4 cursor-pointer"
                              />
                            </th>
                          )}
                          <th className="py-3 px-4 font-medium">Peça removida</th>
                          <th className="py-3 px-4 font-medium">Ref.</th>
                          <th className="py-3 px-4 font-medium text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE2E5] text-xs">
                        {removedBaseProducts.map((item) => {
                          const isChecked = selectedRemovedIds.has(item.id);
                          const isConfirmingPurge = confirmPurgeId === item.id;
                          const isRowBusy = busyRowId === item.id || purgingRemoved;

                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                isChecked ? 'bg-[#D0E5F2]/25' : 'hover:bg-[#F5F6F5]/50'
                              }`}
                            >
                              {isAdmin && (
                                <td className="py-3 pl-4 pr-2 w-10">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={purgingRemoved}
                                    onChange={() => toggleSelectRemoved(item.id)}
                                    aria-label={`Selecionar ${item.name}`}
                                    className="accent-[#152F40] w-4 h-4 cursor-pointer"
                                  />
                                </td>
                              )}
                              <td className="py-3 px-4 font-medium text-[#152F40]">{item.name}</td>
                              <td className="py-3 px-4 text-[#566773] tabular-nums">{item.id}</td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                {isAdmin && (
                                  <div className="inline-flex items-center justify-end gap-2">
                                    {!isConfirmingPurge && (
                                      <button
                                        type="button"
                                        disabled={isRowBusy}
                                        onClick={() => void handleRestore(item.id, item.name)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#152F40] text-[#152F40] hover:bg-[#152F40] hover:text-white disabled:opacity-60 transition-colors"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>
                                          {busyRowId === item.id ? 'Restaurando…' : 'Restaurar peça'}
                                        </span>
                                      </button>
                                    )}

                                    {isConfirmingPurge ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={isRowBusy}
                                          onClick={() =>
                                            void handlePurgeRemoved([item.id], item.name)
                                          }
                                          className="px-3 py-1.5 bg-[#8B2635] text-white hover:bg-[#701D2A] disabled:opacity-60 transition-colors"
                                        >
                                          {busyRowId === item.id ? 'Excluindo…' : 'Confirmar'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isRowBusy}
                                          onClick={() => setConfirmPurgeId(null)}
                                          className="px-2.5 py-1.5 border border-[#DCE2E5] text-[#566773] hover:text-[#152F40] transition-colors"
                                        >
                                          Cancelar
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={isRowBusy}
                                        onClick={() => {
                                          setConfirmBulkPurge(null);
                                          setConfirmPurgeId(item.id);
                                        }}
                                        aria-label={`Excluir ${item.name} definitivamente`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DCE2E5] text-[#8B2635] hover:border-[#8B2635] hover:bg-[#8B2635] hover:text-white disabled:opacity-60 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Excluir</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
          </>
        )}
      </div>
    </div>
  );
};
