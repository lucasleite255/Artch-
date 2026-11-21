import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Category } from '../types/catalog';
import {
  matchesCategory,
  resolveCategoryCoverImage,
} from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import {
  CATEGORY_LIMITS,
  buildCategorySlug,
  isValidMediaUrl,
} from '../lib/productValidation';
import { uploadMediaFile } from '../lib/mediaUpload';
import { SiteAssetPicker } from './SiteAssetPicker';

interface AdminCategoriesManagerProps {
  onFeedback: (msg: { type: 'success' | 'error'; text: string } | null) => void;
  onNavigate: (path: string) => void;
}

const DEFAULT_CATEGORY_COVERS: Array<{ label: string; url: string }> = [
  { label: 'Editorial Feminino', url: '/assets/categories/feminino-artche.png' },
  { label: 'Editorial Masculino', url: '/assets/categories/masculino-artche.png' },
  { label: 'Editorial Infantil', url: '/assets/categories/infantil-artche.png' },
];

export const AdminCategoriesManager: React.FC<AdminCategoriesManagerProps> = ({
  onFeedback,
  onNavigate,
}) => {
  const {
    products,
    categories,
    homeCategories,
    customCategorySlugs,
    isAdmin,
    saveCategory,
    reorderCategories,
    deleteCategory,
  } = useCatalog();

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showOnHome, setShowOnHome] = useState(true);
  const [sortOrder, setSortOrder] = useState<number>(8);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [dragOverSlug, setDragOverSlug] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [editorNotice, setEditorNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [brokenPreviewUrl, setBrokenPreviewUrl] = useState<string | null>(null);
  const [brokenCardUrls, setBrokenCardUrls] = useState<Record<string, boolean>>({});

  void DEFAULT_CATEGORY_COVERS;

  const previewSlug = editingCategory?.slug || (name.trim() ? buildCategorySlug(name) : 'nova-categoria');
  const previewCover = useMemo(() => {
    if (coverImage.trim()) return coverImage.trim();
    if (editingCategory) {
      return resolveCategoryCoverImage(
        { ...editingCategory, coverImage: '' },
        products,
        categories
      );
    }
    return '/assets/categories/feminino-artche.png';
  }, [coverImage, editingCategory, products, categories]);

  const openCreateCategory = () => {
    onFeedback(null);
    setEditorNotice(null);
    setBrokenPreviewUrl(null);
    const maxOrder = categories.reduce((acc, c) => Math.max(acc, c.sortOrder ?? 0), 0);
    setEditingCategory(null);
    setName('');
    setDescription('');
    setCoverImage('');
    setUrlInput('');
    setUrlError(null);
    setShowOnHome(true);
    setSortOrder(Math.min(CATEGORY_LIMITS.sortOrderMax, maxOrder + 1));
    setPickerOpen(false);
    setEditorOpen(true);
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openEditCategory = (cat: Category) => {
    onFeedback(null);
    setEditorNotice(null);
    setBrokenPreviewUrl(null);
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    const initialCover = cat.coverImage || '';
    setCoverImage(initialCover);
    setUrlInput(initialCover);
    setUrlError(null);
    setShowOnHome(cat.showOnHome !== false);
    setSortOrder(cat.sortOrder ?? 10);
    setPickerOpen(false);
    setEditorOpen(true);
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingCategory(null);
    setPickerOpen(false);
    setUrlError(null);
    setEditorNotice(null);
    setBrokenPreviewUrl(null);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setUrlError('Selecione um arquivo de imagem (JPG, PNG, WebP ou AVIF).');
      return;
    }
    setUploading(true);
    setUrlError(null);
    setEditorNotice(null);
    onFeedback(null);
    try {
      const uploaded = await uploadMediaFile(file, file.name);
      setCoverImage(uploaded.url);
      setUrlInput(uploaded.url);
      setBrokenPreviewUrl(null);
      const notice = {
        type: 'success' as const,
        text: 'Foto enviada! Agora clique em “Salvar categoria” abaixo para publicar na Home.',
      };
      setEditorNotice(notice);
      onFeedback(notice);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar foto.';
      setUrlError(msg);
      setEditorNotice({ type: 'error', text: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setCoverImage('');
      setUrlError(null);
      setBrokenPreviewUrl(null);
      return;
    }
    if (!isValidMediaUrl(trimmed)) {
      setUrlError('Informe uma URL válida começando com https://, /uploads/ ou /assets/.');
      return;
    }
    setCoverImage(trimmed);
    setUrlError(null);
    setBrokenPreviewUrl(null);
    setEditorNotice({
      type: 'success',
      text: 'Prévia atualizada. Clique em “Salvar categoria” para aplicar na Home.',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    onFeedback(null);
    setEditorNotice(null);

    const trimmedUrlInput = urlInput.trim();
    if (trimmedUrlInput && !isValidMediaUrl(trimmedUrlInput)) {
      const msg = 'Informe uma URL válida começando com https://, /uploads/ ou /assets/.';
      setUrlError(msg);
      setEditorNotice({ type: 'error', text: msg });
      return;
    }

    setSaving(true);
    try {
      const slugToUse = editingCategory?.slug || buildCategorySlug(name);
      if (!editingCategory && categories.some((c) => c.slug === slugToUse)) {
        throw new Error(`Já existe uma categoria com o endereço /categoria/${slugToUse}/. Use outro nome.`);
      }

      const pendingCover = trimmedUrlInput || coverImage.trim();

      const saved = await saveCategory({
        slug: slugToUse,
        name,
        description,
        tag: editingCategory?.tag || `/${slugToUse}/`,
        coverImage: pendingCover,
        showOnHome,
        sortOrder,
        isBuiltIn: editingCategory?.isBuiltIn === true,
      });

      onFeedback({
        type: 'success',
        text: editingCategory
          ? `Categoria “${saved.name}” atualizada com sucesso na vitrine.`
          : `Categoria “${saved.name}” criada! Agora ela também aparece para selecionar nos produtos e no carrossel da Home.`,
      });
      closeEditor();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar categoria.';
      setEditorNotice({ type: 'error', text: msg });
      onFeedback({
        type: 'error',
        text: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggleHome = async (cat: Category) => {
    setBusySlug(cat.slug);
    onFeedback(null);
    const nextShow = cat.showOnHome === false;
    try {
      await saveCategory({
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        tag: cat.tag,
        coverImage: cat.coverImage || '',
        showOnHome: nextShow,
        sortOrder: cat.sortOrder ?? 10,
        isBuiltIn: cat.isBuiltIn === true,
      });
      onFeedback({
        type: 'success',
        text: nextShow
          ? `“${cat.name}” agora aparece nos destaques de categorias da Home.`
          : `“${cat.name}” foi ocultada do carrossel da Home (continua disponível no catálogo).`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao atualizar exibição na Home.',
      });
    } finally {
      setBusySlug(null);
    }
  };

  const handleDropCategory = async (targetSlug: string) => {
    if (!isAdmin || reordering || !draggingSlug || draggingSlug === targetSlug) {
      setDraggingSlug(null);
      setDragOverSlug(null);
      return;
    }

    const fromIndex = categories.findIndex((c) => c.slug === draggingSlug);
    const toIndex = categories.findIndex((c) => c.slug === targetSlug);
    setDraggingSlug(null);
    setDragOverSlug(null);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...categories];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setReordering(true);
    onFeedback(null);
    try {
      await reorderCategories(next);
      onFeedback({
        type: 'success',
        text: `Categoria “${moved.name}” movida para a posição #${toIndex + 1}.`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao reordenar categorias.',
      });
    } finally {
      setReordering(false);
    }
  };

  const handleShiftOrder = async (cat: Category, delta: -1 | 1) => {
    const idx = categories.findIndex((c) => c.slug === cat.slug);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= categories.length) return;
    setBusySlug(cat.slug);
    onFeedback(null);
    try {
      const next = [...categories];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      await reorderCategories(next);
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao reordenar categorias.',
      });
    } finally {
      setBusySlug(null);
    }
  };

  const handleDeleteOrReset = async (cat: Category) => {
    setBusySlug(cat.slug);
    onFeedback(null);
    try {
      await deleteCategory(cat);
      if (editingCategory?.slug === cat.slug) {
        closeEditor();
      }
      setConfirmDeleteSlug(null);
      onFeedback({
        type: 'success',
        text: cat.isBuiltIn
          ? `Configuração padrão da categoria “${cat.name}” restaurada.`
          : `Categoria “${cat.name}” excluída.`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao remover categoria.',
      });
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <section
      aria-label="Gestão de categorias e fotos de destaque"
      className="border border-[#DCE2E5] bg-white p-5 md:p-7 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DCE2E5] pb-5">
        <div>
          <h2 className="font-serif-display text-[28px] text-[#152F40] leading-tight">
            Categorias dos produtos e destaques da Home
          </h2>
          <p className="text-xs text-[#566773] mt-1 max-w-[700px]">
            Adicione novas categorias de produtos, escolha a foto de capa (4:5) e defina se ela aparece no carrossel “O inverno tem o seu estilo.” da Home. Toda categoria criada aqui fica disponível ao cadastrar peças, nos filtros do catálogo e no menu principal.
          </p>
          <p className="text-[11px] text-[#152F40] mt-1.5 tabular-nums">
            {homeCategories.length} {homeCategories.length === 1 ? 'categoria visível na Home' : 'categorias visíveis na Home'} · {categories.length} no catálogo
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => (editorOpen && !editingCategory ? closeEditor() : openCreateCategory())}
            className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors shrink-0"
          >
            {editorOpen && !editingCategory ? (
              <>
                <X className="w-4 h-4" />
                <span>Fechar formulário</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Adicionar categoria</span>
              </>
            )}
          </button>
        )}
      </div>

      {isAdmin && editorOpen && (
        <div
          ref={editorRef}
          className="border border-[#152F40] bg-[#F5F6F5] p-5 md:p-7 space-y-5"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#DCE2E5] pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#566773]">
                {editingCategory
                  ? `Editando categoria · /categoria/${editingCategory.slug}/`
                  : 'Nova categoria no catálogo'}
              </p>
              <h3 className="font-serif-display text-[26px] text-[#152F40] leading-tight mt-0.5">
                {editingCategory
                  ? `Alterar foto e dados de “${editingCategory.name}”`
                  : 'Criar nova categoria e foto de destaque'}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              aria-label="Fechar editor de categoria"
              className="p-2 text-[#566773] hover:text-[#152F40]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr] gap-8 items-start"
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="cat-name" className="text-xs font-medium text-[#152F40]">
                      Nome da categoria *
                    </label>
                    <span className="text-[11px] text-[#566773] tabular-nums">
                      {name.length}/{CATEGORY_LIMITS.nameMax}
                    </span>
                  </div>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    maxLength={CATEGORY_LIMITS.nameMax}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Neve e Esqui, Malhas de Tricô…"
                    className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-[13px] text-[#152F40] focus:outline-none focus:border-[#152F40]"
                  />
                  <span className="block text-[11px] text-[#566773] mt-1">
                    Endereço na vitrine: /categoria/{previewSlug}/
                  </span>
                </div>

                <div>
                  <label htmlFor="cat-order" className="block text-xs font-medium text-[#152F40] mb-1.5">
                    Ordem
                  </label>
                  <input
                    id="cat-order"
                    type="number"
                    min={CATEGORY_LIMITS.sortOrderMin}
                    max={CATEGORY_LIMITS.sortOrderMax}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                    className="w-full border border-[#DCE2E5] bg-white px-3 py-2.5 text-[13px] text-[#152F40] tabular-nums focus:outline-none focus:border-[#152F40]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="cat-desc" className="text-xs font-medium text-[#152F40]">
                    Descrição curta
                  </label>
                  <span className="text-[11px] text-[#566773] tabular-nums">
                    {description.length}/{CATEGORY_LIMITS.descriptionMax}
                  </span>
                </div>
                <input
                  id="cat-desc"
                  type="text"
                  maxLength={CATEGORY_LIMITS.descriptionMax}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Peças impermeáveis e isolantes pensadas para a neve."
                  className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                />
              </div>

              <div className="bg-white border border-[#DCE2E5] px-4 py-3.5">
                <label className="inline-flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnHome}
                    onChange={(e) => setShowOnHome(e.target.checked)}
                    className="mt-0.5 accent-[#152F40]"
                  />
                  <span>
                    <span className="block text-xs font-medium text-[#152F40]">
                      Exibir no carrossel “O inverno tem o seu estilo.” da Home
                    </span>
                    <span className="block text-[11px] text-[#566773] mt-0.5">
                      Quando marcado, esta categoria aparece nos destaques de estilo da página inicial.
                    </span>
                  </span>
                </label>
              </div>

              {/* Cover image selector */}
              <div className="bg-white border border-[#DCE2E5] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-medium text-[#152F40]">
                      Foto do destaque da categoria (4:5)
                    </span>
                    <span className="text-[11px] text-[#566773]">
                      Envie do dispositivo, escolha uma peça da loja ou informe uma URL.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleUploadPhoto(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploading ? 'Enviando…' : 'Enviar do dispositivo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPickerOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#152F40] text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>{pickerOpen ? 'Ocultar acervo' : 'Escolher da vitrine'}</span>
                    </button>

                    {coverImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setCoverImage('');
                          setUrlInput('');
                          setUrlError(null);
                          setBrokenPreviewUrl(null);
                          setEditorNotice({
                            type: 'success',
                            text: 'Capa automática restaurada. Clique em “Salvar categoria” para confirmar.',
                          });
                        }}
                        className="px-3 py-2 border border-[#DCE2E5] text-xs text-[#566773] hover:text-[#152F40] transition-colors"
                      >
                        Usar automática
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={CATEGORY_LIMITS.coverImageMax}
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setUrlError(null);
                      setBrokenPreviewUrl(null);
                    }}
                    placeholder="https://..., /uploads/... ou /assets/..."
                    aria-label="URL da foto de destaque da categoria"
                    className="flex-1 border border-[#DCE2E5] bg-[#F5F6F5]/40 px-3 py-2 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-4 py-2 border border-[#152F40] text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors shrink-0"
                  >
                    Aplicar URL
                  </button>
                </div>
                {urlError && (
                  <p className="text-[11px] text-[#152F40] underline underline-offset-2">
                    {urlError}
                  </p>
                )}

                {pickerOpen && (
                  <SiteAssetPicker
                    selectedUrls={coverImage ? [coverImage] : []}
                    aspectRatio="4/5"
                    columnsClass="grid-cols-3 sm:grid-cols-6"
                    hintText="Selecione qualquer foto do acervo do site:"
                    onSelect={(url) => {
                      setCoverImage(url);
                      setUrlInput(url);
                      setUrlError(null);
                      setBrokenPreviewUrl(null);
                      setEditorNotice({
                        type: 'success',
                        text: 'Foto selecionada do acervo. Clique em “Salvar categoria” para publicar na Home.',
                      });
                    }}
                  />
                )}
              </div>

              {editorNotice && (
                <div
                  role="status"
                  className={`border px-4 py-3 text-xs ${
                    editorNotice.type === 'error'
                      ? 'border-[#152F40] bg-white text-[#152F40] font-medium'
                      : 'border-[#DCE2E5] bg-[#D0E5F2]/40 text-[#152F40]'
                  }`}
                >
                  {editorNotice.text}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Salvando…' : editingCategory ? 'Salvar categoria' : 'Criar categoria'}
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

            {/* Live 4:5 Preview Card */}
            <div className="bg-white border border-[#DCE2E5] p-4 max-w-[280px] space-y-2.5">
              <span className="block text-[11px] uppercase tracking-[0.08em] text-[#566773]">
                Prévia na Home (4:5)
              </span>
              <div className="relative w-full aspect-[4/5] overflow-hidden bg-[#F5F6F5] border border-[#DCE2E5]">
                <img
                  src={
                    brokenPreviewUrl === previewCover && editingCategory
                      ? resolveCategoryCoverImage(
                          { ...editingCategory, coverImage: '' },
                          products,
                          categories
                        )
                      : previewCover
                  }
                  alt={name || 'Prévia'}
                  onError={() => setBrokenPreviewUrl(previewCover)}
                  className="w-full h-full object-cover object-[center_20%]"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0E2636]/80 to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute bottom-4 inset-x-4 z-10 text-white flex items-center justify-between gap-2 font-serif-display text-[24px] leading-tight">
                  <span className="truncate">{name.trim() || 'Nova categoria'}</span>
                  <ArrowUpRight className="w-5 h-5 shrink-0" strokeWidth={1.6} />
                </div>
              </div>
              {brokenPreviewUrl === previewCover && (
                <p className="text-[11px] text-[#152F40] bg-[#D0E5F2]/40 border border-[#DCE2E5] px-2.5 py-2 leading-relaxed">
                  A foto anterior ({previewCover}) não está mais disponível no servidor. Escolha uma foto de <strong>Escolher da vitrine</strong> (permanente) ou clique em <strong>Usar automática</strong> e salve.
                </p>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map((cat, idx) => {
          const effectiveCover = resolveCategoryCoverImage(cat, products, categories);
          const count = products.filter((p) => matchesCategory(p, cat.slug, categories)).length;
          const hasOverride = customCategorySlugs.has(cat.slug);
          const isHome = cat.showOnHome !== false;
          const isBusy = busySlug === cat.slug;
          const isConfirming = confirmDeleteSlug === cat.slug;

          const isDragging = draggingSlug === cat.slug;
          const isDropTarget = dragOverSlug === cat.slug && draggingSlug !== cat.slug;

          return (
            <article
              key={cat.slug}
              draggable={isAdmin && !reordering}
              onDragStart={(e) => {
                if (!isAdmin || reordering) return;
                setDraggingSlug(cat.slug);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', cat.slug);
              }}
              onDragOver={(e) => {
                if (!isAdmin || reordering || !draggingSlug) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverSlug !== cat.slug) setDragOverSlug(cat.slug);
              }}
              onDragLeave={() => {
                if (dragOverSlug === cat.slug) setDragOverSlug(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleDropCategory(cat.slug);
              }}
              onDragEnd={() => {
                setDraggingSlug(null);
                setDragOverSlug(null);
              }}
              className={`border bg-white p-4 flex gap-4 items-start transition-all ${
                isAdmin ? 'cursor-grab active:cursor-grabbing' : ''
              } ${
                isDragging
                  ? 'opacity-45 border-[#152F40]'
                  : isDropTarget
                    ? 'border-2 border-[#152F40] bg-[#D0E5F2]/25'
                    : 'border-[#DCE2E5] hover:border-[#152F40]'
              }`}
            >
              <a
                href={`/categoria/${cat.slug}/`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(`/categoria/${cat.slug}/`);
                }}
                aria-label={`Ver categoria ${cat.name}`}
                className="relative w-24 aspect-[4/5] shrink-0 bg-[#F5F6F5] border border-[#DCE2E5] overflow-hidden"
              >
                <img
                  src={
                    brokenCardUrls[effectiveCover]
                      ? resolveCategoryCoverImage({ ...cat, coverImage: '' }, products, categories)
                      : effectiveCover
                  }
                  alt={cat.name}
                  onError={() =>
                    setBrokenCardUrls((prev) =>
                      prev[effectiveCover] ? prev : { ...prev, [effectiveCover]: true }
                    )
                  }
                  className="w-full h-full object-cover object-[center_20%]"
                />
              </a>

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isAdmin && (
                        <GripVertical
                          className="w-3.5 h-3.5 text-[#566773] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <h3 className="font-medium text-sm text-[#152F40] truncate">{cat.name}</h3>
                    </div>
                    <span className="text-[11px] text-[#566773] tabular-nums shrink-0">
                      #{idx + 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#566773] tabular-nums mt-0.5">
                    {count} {count === 1 ? 'peça' : 'peças'} · /categoria/{cat.slug}/
                  </p>
                  <p className="text-[11px] text-[#152F40] mt-1 font-medium">
                    {isHome ? 'Exibida no carrossel da Home' : 'Somente no catálogo'}
                  </p>
                  {brokenCardUrls[effectiveCover] && (
                    <p className="text-[11px] text-[#152F40] bg-[#D0E5F2]/40 border border-[#DCE2E5] px-2 py-1 mt-1">
                      Foto salva indisponível — clique em “Foto / Editar” para escolher outra.
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openEditCategory(cat)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#152F40] text-[11px] font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Foto / Editar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleQuickToggleHome(cat)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 border text-[11px] font-medium transition-colors ${
                        isHome
                          ? 'bg-[#152F40] text-white border-[#152F40] hover:bg-[#2E5267]'
                          : 'bg-white text-[#152F40] border-[#DCE2E5] hover:border-[#152F40]'
                      }`}
                    >
                      <Star className={`w-3 h-3 ${isHome ? 'fill-white' : ''}`} />
                      <span>{isHome ? 'Na Home' : 'Destacar'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || idx === 0}
                      onClick={() => void handleShiftOrder(cat, -1)}
                      aria-label={`Mover ${cat.name} antes`}
                      className="p-1.5 border border-[#DCE2E5] text-[#152F40] disabled:opacity-40 hover:border-[#152F40]"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || idx === categories.length - 1}
                      onClick={() => void handleShiftOrder(cat, 1)}
                      aria-label={`Mover ${cat.name} depois`}
                      className="p-1.5 border border-[#DCE2E5] text-[#152F40] disabled:opacity-40 hover:border-[#152F40]"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    {!cat.isBuiltIn ? (
                      isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteOrReset(cat)}
                            className="px-2.5 py-1.5 bg-[#152F40] text-white text-[11px]"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmDeleteSlug(null)}
                            className="px-2 py-1.5 border border-[#DCE2E5] text-[11px] text-[#566773]"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSlug(cat.slug)}
                          aria-label={`Excluir categoria ${cat.name}`}
                          className="p-1.5 border border-[#DCE2E5] text-[#566773] hover:text-[#152F40] hover:border-[#152F40]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    ) : (
                      hasOverride && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDeleteOrReset(cat)}
                          title="Restaurar foto e configuração originais"
                          aria-label={`Restaurar padrão de ${cat.name}`}
                          className="p-1.5 border border-[#DCE2E5] text-[#566773] hover:text-[#152F40] hover:border-[#152F40]"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
