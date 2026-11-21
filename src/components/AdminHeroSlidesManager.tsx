import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { HeroSlide } from '../types/catalog';
import { buildWhatsAppUrl } from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import {
  HERO_SLIDE_LIMITS,
  PRESET_CAMPAIGN_IMAGES,
  isValidMediaUrl,
  isValidNavLink,
} from '../lib/productValidation';
import { captureVideoPosterBlob, uploadMediaFile } from '../lib/mediaUpload';
import { HeroSlideMedia } from './CampaignVisual';
import { SiteAssetPicker } from './SiteAssetPicker';

interface AdminHeroSlidesManagerProps {
  onFeedback: (msg: { type: 'success' | 'error'; text: string } | null) => void;
  onNavigate: (path: string) => void;
}

export const AdminHeroSlidesManager: React.FC<AdminHeroSlidesManagerProps> = ({
  onFeedback,
  onNavigate,
}) => {
  const {
    heroSlides,
    activeHeroSlides,
    categories,
    customHeroSlideIds,
    baseHeroSlideIds,
    isAdmin,
    saveHeroSlide,
    reorderHeroSlides,
    deleteHeroSlide,
  } = useCatalog();

  const editorRef = useRef<HTMLDivElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Explore o catálogo');
  const [ctaPath, setCtaPath] = useState('/catalogo/');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [imageUrl, setImageUrl] = useState<string>(PRESET_CAMPAIGN_IMAGES[0].url);
  const [photoUrlInput, setPhotoUrlInput] = useState<string>(PRESET_CAMPAIGN_IMAGES[0].url);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busySlideId, setBusySlideId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const quickLinkOptions = useMemo(() => {
    const baseLinks = [
      { label: 'Todo o catálogo', path: '/catalogo/' },
      ...categories.slice(0, 6).map((c) => ({
        label: c.name,
        path: `/categoria/${c.slug}/`,
      })),
      { label: 'Nossa loja na Asa Sul', path: '/#loja' },
      { label: 'WhatsApp Artchê', path: buildWhatsAppUrl() },
    ];
    return baseLinks;
  }, [categories]);

  const previewSlide = useMemo<Pick<HeroSlide, 'title' | 'mediaType' | 'imageUrl' | 'videoUrl'>>(
    () => ({
      title: title.trim() || 'Título do slide',
      mediaType: mediaType === 'video' && videoUrl.trim() ? 'video' : 'image',
      imageUrl: imageUrl.trim() || PRESET_CAMPAIGN_IMAGES[0].url,
      videoUrl: videoUrl.trim(),
    }),
    [title, mediaType, imageUrl, videoUrl]
  );

  const openCreateSlide = () => {
    onFeedback(null);
    const maxOrder = heroSlides.reduce((acc, s) => Math.max(acc, s.sortOrder ?? 0), 0);
    setEditingSlide(null);
    setTitle('');
    setDescription('');
    setCtaLabel('Ver catálogo');
    setCtaPath('/catalogo/');
    setMediaType('image');
    setImageUrl(PRESET_CAMPAIGN_IMAGES[0].url);
    setPhotoUrlInput(PRESET_CAMPAIGN_IMAGES[0].url);
    setPhotoError(null);
    setVideoUrl('');
    setVideoUrlInput('');
    setVideoError(null);
    setVisible(true);
    setSortOrder(Math.min(HERO_SLIDE_LIMITS.sortOrderMax, maxOrder + 1));
    setPickerOpen(false);
    setEditorOpen(true);
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openEditSlide = (slide: HeroSlide) => {
    onFeedback(null);
    setEditingSlide(slide);
    setTitle(slide.title);
    setDescription(slide.description || '');
    setCtaLabel(slide.ctaLabel || 'Ver mais');
    setCtaPath(slide.ctaPath || '/catalogo/');
    setMediaType(slide.mediaType === 'video' && slide.videoUrl ? 'video' : 'image');
    setImageUrl(slide.imageUrl || '');
    setPhotoUrlInput(slide.imageUrl || '');
    setPhotoError(null);
    setVideoUrl(slide.videoUrl || '');
    setVideoUrlInput(slide.videoUrl || '');
    setVideoError(null);
    setVisible(slide.visible !== false);
    setSortOrder(slide.sortOrder ?? 1);
    setPickerOpen(false);
    setEditorOpen(true);
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingSlide(null);
    setPickerOpen(false);
    setPhotoError(null);
    setVideoError(null);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Selecione uma imagem JPG, PNG, WebP ou AVIF.');
      return;
    }

    setUploadingPhoto(true);
    setPhotoError(null);
    onFeedback(null);
    try {
      const uploaded = await uploadMediaFile(file, file.name);
      setImageUrl(uploaded.url);
      setPhotoUrlInput(uploaded.url);
      setMediaType('image');
      onFeedback({
        type: 'success',
        text: 'Foto enviada do dispositivo. Clique em “Salvar slide” para publicar na Home.',
      });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleApplyPhotoUrl = () => {
    const trimmed = photoUrlInput.trim();
    setPhotoError(null);
    if (!trimmed) {
      setImageUrl('');
      return;
    }
    if (!isValidMediaUrl(trimmed)) {
      setPhotoError('A foto deve começar com https://, /uploads/ ou /assets/.');
      return;
    }
    setImageUrl(trimmed);
    setMediaType('image');
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setVideoError('Selecione um vídeo MP4, WebM ou MOV.');
      return;
    }

    setUploadingVideo(true);
    setVideoError(null);
    onFeedback(null);
    try {
      const uploaded = await uploadMediaFile(file, file.name);
      setVideoUrl(uploaded.url);
      setVideoUrlInput(uploaded.url);
      setMediaType('video');

      if (!imageUrl.trim()) {
        const posterBlob = await captureVideoPosterBlob(file);
        if (posterBlob) {
          try {
            const posterUpload = await uploadMediaFile(posterBlob, 'slide-poster.jpg');
            setImageUrl(posterUpload.url);
            setPhotoUrlInput(posterUpload.url);
          } catch {
            // Optional poster capture fallback
          }
        }
      }

      onFeedback({
        type: 'success',
        text: 'Vídeo enviado do dispositivo e selecionado como mídia do slide. Clique em “Salvar slide”.',
      });
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Não foi possível enviar o vídeo.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleApplyVideoUrl = () => {
    const trimmed = videoUrlInput.trim();
    setVideoError(null);
    if (!trimmed) {
      setVideoUrl('');
      setMediaType('image');
      return;
    }
    if (!isValidMediaUrl(trimmed)) {
      setVideoError('O vídeo deve começar com https://, /uploads/ ou /assets/.');
      return;
    }
    setVideoUrl(trimmed);
    setMediaType('video');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    onFeedback(null);

    const effectivePhoto =
      imageUrl.trim() || (isValidMediaUrl(photoUrlInput.trim()) ? photoUrlInput.trim() : '');
    const effectiveVideo =
      videoUrl.trim() || (isValidMediaUrl(videoUrlInput.trim()) ? videoUrlInput.trim() : '');

    if (!isValidNavLink(ctaPath)) {
      onFeedback({
        type: 'error',
        text: 'Informe um link válido para o botão (começando com / ou https://).',
      });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveHeroSlide({
        id: editingSlide?.id,
        title,
        description,
        ctaLabel,
        ctaPath,
        mediaType,
        imageUrl: effectivePhoto,
        videoUrl: effectiveVideo,
        visible,
        sortOrder,
        isBuiltIn: editingSlide ? baseHeroSlideIds.has(editingSlide.id) : false,
      });

      closeEditor();
      onFeedback({
        type: 'success',
        text: `Slide “${saved.title}” salvo com sucesso e atualizado na página inicial.`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível salvar o slide.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisible = async (slide: HeroSlide) => {
    const nextVisible = slide.visible === false;
    if (!nextVisible && activeHeroSlides.length <= 1 && slide.visible !== false) {
      onFeedback({
        type: 'error',
        text: 'Mantenha pelo menos 1 slide visível na página inicial.',
      });
      return;
    }

    setBusySlideId(slide.id);
    onFeedback(null);
    try {
      await saveHeroSlide({
        id: slide.id,
        title: slide.title,
        description: slide.description || '',
        ctaLabel: slide.ctaLabel || 'Ver catálogo',
        ctaPath: slide.ctaPath || '/catalogo/',
        mediaType: slide.mediaType === 'video' && slide.videoUrl ? 'video' : 'image',
        imageUrl: slide.imageUrl || '',
        videoUrl: slide.videoUrl || '',
        visible: nextVisible,
        sortOrder: slide.sortOrder ?? 1,
        isBuiltIn: baseHeroSlideIds.has(slide.id),
      });
      onFeedback({
        type: 'success',
        text: nextVisible
          ? `Slide “${slide.title}” exibido na página inicial.`
          : `Slide “${slide.title}” ocultado da página inicial.`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao atualizar exibição do slide.',
      });
    } finally {
      setBusySlideId(null);
    }
  };

  const commitOrder = async (nextList: HeroSlide[]) => {
    setReordering(true);
    onFeedback(null);
    try {
      await reorderHeroSlides(nextList);
      onFeedback({
        type: 'success',
        text: 'Ordem dos slides atualizada na página inicial.',
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível salvar a ordem dos slides.',
      });
    } finally {
      setReordering(false);
    }
  };

  const handleMoveSlide = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= heroSlides.length) return;
    const next = [...heroSlides];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await commitOrder(next);
  };

  const handleDropSlide = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = heroSlides.findIndex((s) => s.id === draggingId);
    const toIndex = heroSlides.findIndex((s) => s.id === targetId);
    setDraggingId(null);
    setDragOverId(null);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const next = [...heroSlides];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await commitOrder(next);
  };

  const handleConfirmDelete = async (slide: HeroSlide) => {
    setBusySlideId(slide.id);
    onFeedback(null);
    try {
      await deleteHeroSlide(slide);
      if (editingSlide?.id === slide.id) {
        closeEditor();
      }
      setConfirmDeleteId(null);
      onFeedback({
        type: 'success',
        text: baseHeroSlideIds.has(slide.id)
          ? `Slide “${slide.title}” restaurado para a versão padrão original.`
          : `Slide “${slide.title}” removido da página inicial.`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao remover ou restaurar o slide.',
      });
    } finally {
      setBusySlideId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Toolbar */}
      <section className="border border-[#DCE2E5] bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#566773] tabular-nums">
            Slides principais da Home · {activeHeroSlides.length} ativos · {heroSlides.length} no
            total
          </p>
          <h2 className="font-serif-display text-[28px] text-[#152F40] leading-tight mt-1">
            Gerenciar banners e ordem dos slides
          </h2>
          <p className="text-xs text-[#566773] mt-1 max-w-[680px]">
            Edite foto ou vídeo, título, texto de apoio, texto e link do botão de cada slide — ou
            arraste para definir a ordem de exibição na página inicial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={openCreateSlide}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Novo slide</span>
            </button>
          )}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] border border-[#152F40] bg-white text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors"
          >
            <span>Ver na Home</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Slide Create / Edit Form */}
      {isAdmin && editorOpen && (
        <section
          ref={editorRef}
          aria-label={editingSlide ? `Editar slide ${editingSlide.title}` : 'Criar novo slide'}
          className="border border-[#152F40] bg-[#F5F6F5] p-6 md:p-8"
        >
          <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-[#DCE2E5]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[#566773]">
                {editingSlide
                  ? `Editando slide · Ordem #${editingSlide.sortOrder ?? 1}`
                  : 'Novo slide da página inicial'}
              </p>
              <h3 className="font-serif-display text-[26px] text-[#152F40] leading-tight mt-0.5">
                {editingSlide ? editingSlide.title : 'Adicionar slide na Home'}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              aria-label="Fechar editor de slide"
              className="p-2 text-[#566773] hover:text-[#152F40]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => void handleSave(e)}
            className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.95fr] gap-8 items-start"
          >
            <div className="space-y-5">
              {/* Headline */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="slide-title" className="text-xs font-medium text-[#152F40]">
                    Título principal do slide *
                  </label>
                  <span className="text-[11px] text-[#566773] tabular-nums">
                    {title.length}/{HERO_SLIDE_LIMITS.titleMax}
                  </span>
                </div>
                <input
                  id="slide-title"
                  type="text"
                  required
                  maxLength={HERO_SLIDE_LIMITS.titleMax}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Seu próximo inverno começa aqui."
                  className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-[13px] text-[#152F40] focus:outline-none focus:border-[#152F40]"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="slide-desc" className="text-xs font-medium text-[#152F40]">
                    Texto / subtítulo (opcional)
                  </label>
                  <span className="text-[11px] text-[#566773] tabular-nums">
                    {description.length}/{HERO_SLIDE_LIMITS.descriptionMax}
                  </span>
                </div>
                <textarea
                  id="slide-desc"
                  rows={2}
                  maxLength={HERO_SLIDE_LIMITS.descriptionMax}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Peças para viver o frio com conforto. Uma escolha cuidadosa para cada destino."
                  className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                />
              </div>

              {/* CTA Label + Link */}
              <div className="bg-white border border-[#DCE2E5] p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="slide-cta-label" className="text-xs font-medium text-[#152F40]">
                        Texto do botão *
                      </label>
                      <span className="text-[11px] text-[#566773] tabular-nums">
                        {ctaLabel.length}/{HERO_SLIDE_LIMITS.ctaLabelMax}
                      </span>
                    </div>
                    <input
                      id="slide-cta-label"
                      type="text"
                      required
                      maxLength={HERO_SLIDE_LIMITS.ctaLabelMax}
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      placeholder="Ex.: Explore o catálogo"
                      className="w-full border border-[#DCE2E5] bg-white px-3 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="slide-cta-path"
                      className="block text-xs font-medium text-[#152F40] mb-1.5"
                    >
                      Link do botão * (rota interna ou https://)
                    </label>
                    <input
                      id="slide-cta-path"
                      type="text"
                      required
                      maxLength={HERO_SLIDE_LIMITS.ctaPathMax}
                      value={ctaPath}
                      onChange={(e) => setCtaPath(e.target.value)}
                      placeholder="/catalogo/ ou https://..."
                      className="w-full border border-[#DCE2E5] bg-white px-3 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-[#566773] mb-2">
                    Atalhos rápidos para o link do botão:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {quickLinkOptions.map((opt) => {
                      const active = ctaPath === opt.path;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setCtaPath(opt.path)}
                          className={`px-3 py-1.5 text-[11px] border transition-colors ${
                            active
                              ? 'bg-[#152F40] text-white border-[#152F40]'
                              : 'bg-[#F5F6F5] text-[#152F40] border-[#DCE2E5] hover:border-[#152F40]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Media Type Selector & Upload */}
              <div className="bg-white border border-[#DCE2E5] p-4 space-y-4">
                <div>
                  <span className="block text-xs font-medium text-[#152F40] mb-2">
                    Mídia principal do slide *
                  </span>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-xs text-[#152F40] cursor-pointer">
                      <input
                        type="radio"
                        name="slide-media-type"
                        checked={mediaType === 'image'}
                        onChange={() => setMediaType('image')}
                        className="accent-[#152F40]"
                      />
                      <span>Usar foto no slide</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-[#152F40] cursor-pointer">
                      <input
                        type="radio"
                        name="slide-media-type"
                        checked={mediaType === 'video'}
                        onChange={() => setMediaType('video')}
                        className="accent-[#152F40]"
                      />
                      <span>Usar vídeo no slide</span>
                    </label>
                  </div>
                </div>

                {/* Photo Upload / URL / Picker */}
                <div className="border-t border-[#DCE2E5] pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-medium text-[#152F40]">
                        {mediaType === 'video' ? 'Foto de capa do vídeo (opcional)' : 'Foto do slide *'}
                      </span>
                      <span className="text-[11px] text-[#566773]">
                        Envie uma foto do dispositivo, cole a URL ou escolha do acervo.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={photoFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        onChange={(e) => void handleUploadPhoto(e)}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={uploadingPhoto}
                        onClick={() => photoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#152F40] text-white text-[11px] font-medium hover:bg-[#2E5267] disabled:opacity-50 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingPhoto ? 'Enviando foto…' : 'Enviar foto'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPickerOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#152F40] text-[#152F40] text-[11px] font-medium hover:bg-[#152F40] hover:text-white transition-colors"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>{pickerOpen ? 'Ocultar acervo' : 'Escolher do acervo'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={photoUrlInput}
                      onChange={(e) => {
                        setPhotoUrlInput(e.target.value);
                        setPhotoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyPhotoUrl();
                        }
                      }}
                      placeholder="https://..., /uploads/... ou /assets/..."
                      className="flex-1 border border-[#DCE2E5] bg-[#F5F6F5]/40 px-3 py-2 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPhotoUrl}
                      className="inline-flex items-center justify-center px-4 py-2 border border-[#152F40] text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors shrink-0"
                    >
                      Aplicar foto
                    </button>
                  </div>
                  {photoError && <p className="text-[11px] text-[#152F40] underline">{photoError}</p>}

                  {pickerOpen && (
                    <SiteAssetPicker
                      selectedUrls={imageUrl && mediaType === 'image' ? [imageUrl] : []}
                      aspectRatio="4/3"
                      columnsClass="grid-cols-2 sm:grid-cols-4"
                      hintText="Clique em qualquer foto do acervo da Artchê para usar neste slide:"
                      onSelect={(url) => {
                        setImageUrl(url);
                        setPhotoUrlInput(url);
                        setMediaType('image');
                        setPhotoError(null);
                      }}
                    />
                  )}
                </div>

                {/* Video Upload / URL */}
                <div className="border-t border-[#DCE2E5] pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-medium text-[#152F40]">
                        Vídeo do slide {mediaType === 'video' ? '*' : '(opcional)'}
                      </span>
                      <span className="text-[11px] text-[#566773]">
                        MP4, WebM ou MOV (até 25 MB). Salvo permanentemente e reproduzido sem som.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(e) => void handleUploadVideo(e)}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={uploadingVideo}
                        onClick={() => videoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#152F40] text-white text-[11px] font-medium hover:bg-[#2E5267] disabled:opacity-50 transition-colors"
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>{uploadingVideo ? 'Enviando vídeo…' : 'Enviar vídeo'}</span>
                      </button>
                      {videoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setVideoUrl('');
                            setVideoUrlInput('');
                            setMediaType('image');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-2 border border-[#DCE2E5] text-[11px] text-[#566773] hover:text-[#152F40] hover:border-[#152F40] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover vídeo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={videoUrlInput}
                      onChange={(e) => {
                        setVideoUrlInput(e.target.value);
                        setVideoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyVideoUrl();
                        }
                      }}
                      placeholder="https://..., /uploads/... ou /assets/video.mp4"
                      className="flex-1 border border-[#DCE2E5] bg-[#F5F6F5]/40 px-3 py-2 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyVideoUrl}
                      className="inline-flex items-center justify-center px-4 py-2 border border-[#152F40] text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors shrink-0"
                    >
                      Aplicar vídeo
                    </button>
                  </div>
                  {videoError && <p className="text-[11px] text-[#152F40] underline">{videoError}</p>}
                </div>
              </div>

              {/* Visibility + Order */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4 bg-white border border-[#DCE2E5] p-4 items-center">
                <label className="inline-flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => setVisible(e.target.checked)}
                    className="mt-0.5 accent-[#152F40]"
                  />
                  <span>
                    <span className="block text-xs font-medium text-[#152F40]">
                      Exibir este slide no carrossel da Home
                    </span>
                    <span className="block text-[11px] text-[#566773] mt-0.5">
                      Desmarque se quiser ocultar temporariamente sem perder a configuração.
                    </span>
                  </span>
                </label>

                <div>
                  <label
                    htmlFor="slide-order"
                    className="block text-[11px] font-medium text-[#152F40] mb-1"
                  >
                    Ordem de exibição
                  </label>
                  <input
                    id="slide-order"
                    type="number"
                    min={0}
                    max={HERO_SLIDE_LIMITS.sortOrderMax}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                    className="w-full border border-[#DCE2E5] bg-white px-3 py-2 text-xs text-[#152F40] tabular-nums focus:outline-none focus:border-[#152F40]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving || uploadingPhoto || uploadingVideo}
                  className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Salvando slide…' : 'Salvar slide'}</span>
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

            {/* Live Mobile + Desktop Preview */}
            <div className="bg-white border border-[#DCE2E5] p-5 md:sticky md:top-6 space-y-5">
              <div>
                <span className="block text-[11px] uppercase tracking-[0.08em] text-[#566773] mb-3">
                  Pré-visualização no celular (Mobile)
                </span>
                <div className="border border-[#DCE2E5] overflow-hidden bg-[#152F40] max-w-[320px] mx-auto">
                  <div className="relative w-full aspect-[4/3] bg-[#152F40] overflow-hidden">
                    <HeroSlideMedia slide={previewSlide} isActive />
                  </div>
                  <div className="p-4 text-white bg-[#152F40]">
                    <p className="font-serif-display text-[22px] leading-tight">
                      {title.trim() || 'Título do slide'}
                    </p>
                    {description.trim() && (
                      <p className="text-[11px] text-[#E6EFF4] mt-2 leading-relaxed line-clamp-2">
                        {description.trim()}
                      </p>
                    )}
                    <div className="mt-3 inline-flex items-center gap-3 px-3.5 py-2 bg-white text-[#152F40] text-[11px] font-medium">
                      <span>{ctaLabel.trim() || 'Explorar'}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#DCE2E5] pt-4 text-[11px] text-[#566773] space-y-1">
                <p>
                  <strong className="font-medium text-[#152F40]">Mídia:</strong>{' '}
                  {previewSlide.mediaType === 'video' ? 'Vídeo em loop sem som' : 'Foto'}
                </p>
                <p className="truncate">
                  <strong className="font-medium text-[#152F40]">Link do botão:</strong>{' '}
                  {ctaPath || '/catalogo/'}
                </p>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Draggable Slides List */}
      <section className="border border-[#DCE2E5] bg-white">
        <div className="px-5 py-4 border-b border-[#DCE2E5] bg-[#F5F6F5] flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#152F40]">
            Ordem dos slides na página inicial ({heroSlides.length})
          </p>
          <span className="text-[11px] text-[#566773]">
            {reordering
              ? 'Salvando nova ordem…'
              : 'Arraste pelo ícone ou use as setas ↑ ↓ para reorganizar'}
          </span>
        </div>

        <div className="divide-y divide-[#DCE2E5]">
          {heroSlides.map((slide, index) => {
            const isBuiltIn = baseHeroSlideIds.has(slide.id);
            const hasDbOverride = customHeroSlideIds.has(slide.id);
            const isVisible = slide.visible !== false;
            const isBusy = busySlideId === slide.id;
            const isConfirmingDelete = confirmDeleteId === slide.id;
            const isDragging = draggingId === slide.id;
            const isDragOver = dragOverId === slide.id && draggingId !== slide.id;

            return (
              <div
                key={slide.id}
                draggable={isAdmin && !reordering}
                onDragStart={(e) => {
                  setDraggingId(slide.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', slide.id);
                }}
                onDragOver={(e) => {
                  if (!draggingId || draggingId === slide.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverId(slide.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === slide.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDropSlide(slide.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                className={`p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                  isDragging
                    ? 'opacity-45 bg-[#F5F6F5]'
                    : isDragOver
                      ? 'bg-[#D0E5F2]/30 ring-2 ring-inset ring-[#152F40]'
                      : 'hover:bg-[#F5F6F5]/50'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  {isAdmin && (
                    <span
                      className="text-[#566773] cursor-grab active:cursor-grabbing py-1 shrink-0"
                      title="Arrastar para reordenar"
                      aria-hidden="true"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                  )}

                  <span className="w-7 text-xs font-medium text-[#152F40] tabular-nums shrink-0">
                    #{index + 1}
                  </span>

                  <div className="relative w-24 aspect-[4/3] shrink-0 bg-[#152F40] border border-[#DCE2E5] overflow-hidden">
                    <HeroSlideMedia slide={slide} isActive />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <strong className="font-medium text-[#152F40]">{slide.title}</strong>
                      <span className="text-[#566773]">·</span>
                      <span className="text-[11px] text-[#566773]">
                        {slide.mediaType === 'video' ? 'Vídeo' : 'Foto'}
                      </span>
                      <span className="text-[#566773]">·</span>
                      <span className="text-[11px] text-[#152F40]">
                        {isVisible ? 'Visível na Home' : 'Oculto'}
                      </span>
                    </div>
                    {slide.description && (
                      <p className="text-[11px] text-[#566773] line-clamp-1">{slide.description}</p>
                    )}
                    <p className="text-[11px] text-[#566773] truncate">
                      Botão: <span className="text-[#152F40] font-medium">{slide.ctaLabel}</span>{' '}
                      <span aria-hidden="true">→</span> {slide.ctaPath}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={reordering || index === 0}
                      onClick={() => void handleMoveSlide(index, -1)}
                      aria-label={`Mover ${slide.title} para cima`}
                      title="Subir na ordem"
                      className="w-8 h-8 border border-[#DCE2E5] grid place-items-center text-[#152F40] hover:border-[#152F40] disabled:opacity-40 transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={reordering || index === heroSlides.length - 1}
                      onClick={() => void handleMoveSlide(index, 1)}
                      aria-label={`Mover ${slide.title} para baixo`}
                      title="Descer na ordem"
                      className="w-8 h-8 border border-[#DCE2E5] grid place-items-center text-[#152F40] hover:border-[#152F40] disabled:opacity-40 transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleToggleVisible(slide)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DCE2E5] text-xs text-[#152F40] hover:border-[#152F40] disabled:opacity-50 transition-colors"
                    >
                      {isVisible ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Ocultar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Exibir</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditSlide(slide)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#152F40] text-xs text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {hasDbOverride &&
                      (isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleConfirmDelete(slide)}
                            className="px-3 py-1.5 bg-[#152F40] text-white text-xs hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                          >
                            {isBusy ? 'Processando…' : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 border border-[#DCE2E5] text-xs text-[#566773] hover:text-[#152F40]"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(slide.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DCE2E5] text-xs text-[#152F40] hover:border-[#152F40] transition-colors"
                        >
                          {isBuiltIn ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar padrão</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remover</span>
                            </>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
