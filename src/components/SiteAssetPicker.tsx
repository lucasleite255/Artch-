import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { normalizeText } from '../data/catalog';
import { PRESET_CAMPAIGN_IMAGES, PRESET_PRODUCT_IMAGES } from '../lib/productValidation';
import { SiteMediaAsset, listSiteMediaLibrary } from '../lib/mediaUpload';

export interface SiteAssetChoice {
  url: string;
  label: string;
  folder: 'uploads' | 'catalogo' | 'campaign' | 'categories' | 'black-friday' | 'outros';
  searchText: string;
}

interface SiteAssetPickerProps {
  selectedUrls: string[];
  onSelect: (url: string) => void;
  disableSelected?: boolean;
  aspectRatio?: '4/5' | '4/3';
  columnsClass?: string;
  hintText?: string;
}

const INITIAL_BATCH = 36;
const LOAD_STEP = 48;

const FOLDER_LABELS: Array<{
  key: 'all' | SiteAssetChoice['folder'];
  label: string;
}> = [
  { key: 'all', label: 'Todas' },
  { key: 'uploads', label: 'Enviadas' },
  { key: 'catalogo', label: 'Catálogo' },
  { key: 'campaign', label: 'Campanhas e Hero' },
  { key: 'categories', label: 'Categorias' },
  { key: 'black-friday', label: 'Black Friday' },
  { key: 'outros', label: 'Outras' },
];

function classifyFolder(url: string, serverFolder?: string): SiteAssetChoice['folder'] {
  if (serverFolder === 'uploads' || url.startsWith('/uploads/')) return 'uploads';
  if (serverFolder === 'catalogo-artche' || url.includes('/catalogo-artche/')) return 'catalogo';
  if (
    serverFolder === 'campaign' ||
    url.includes('/campaign/') ||
    /\/hero-/.test(url)
  ) {
    return 'campaign';
  }
  if (
    serverFolder === 'categories' ||
    url.includes('/categories/') ||
    /\/(feminino|masculino|categoria-masculino-artche)\.png$/i.test(url)
  ) {
    return 'categories';
  }
  if (serverFolder === 'black-friday' || url.includes('/black-friday/')) return 'black-friday';
  if (url.startsWith('/assets/')) return 'outros';
  return 'outros';
}

function humanizeFilename(url: string): string {
  const raw = url.split('/').pop()?.split('?')[0] || url;
  return raw.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
}

export const SiteAssetPicker: React.FC<SiteAssetPickerProps> = ({
  selectedUrls,
  onSelect,
  disableSelected = false,
  aspectRatio = '4/5',
  columnsClass = 'grid-cols-3 sm:grid-cols-6',
  hintText = 'Clique em uma foto do acervo do site para selecionar:',
}) => {
  const { products, categories, heroSlides, isAdmin } = useCatalog();
  const [serverAssets, setServerAssets] = useState<SiteMediaAsset[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [query, setQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<'all' | SiteAssetChoice['folder']>('all');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_BATCH);

  useEffect(() => {
    let cancelled = false;
    if (!isAdmin) return;
    setLoadingLibrary(true);
    void listSiteMediaLibrary()
      .then((items) => {
        if (!cancelled) {
          setServerAssets(items.filter((item) => item.mediaType === 'image'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLibrary(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const allChoices = useMemo<SiteAssetChoice[]>(() => {
    const byUrl = new Map<string, SiteAssetChoice>();

    const register = (url: string, label: string, serverFolder?: string) => {
      const clean = (url || '').trim();
      if (!clean) return;
      const folder = classifyFolder(clean, serverFolder);
      const existing = byUrl.get(clean);
      if (existing) {
        if (label && !existing.searchText.includes(normalizeText(label))) {
          existing.searchText = `${existing.searchText} ${normalizeText(label)}`;
        }
        return;
      }
      byUrl.set(clean, {
        url: clean,
        label: label || humanizeFilename(clean),
        folder,
        searchText: normalizeText(`${label} ${clean} ${folder}`),
      });
    };

    // Priority 1: Admin uploads from server disk (newest first)
    for (const asset of serverAssets) {
      if (asset.folder === 'uploads') {
        register(asset.url, `Enviada · ${humanizeFilename(asset.filename)}`, 'uploads');
      }
    }

    // Priority 2: Preset campaign & editorial images
    for (const preset of PRESET_CAMPAIGN_IMAGES) {
      register(preset.url, preset.label);
    }
    for (const preset of PRESET_PRODUCT_IMAGES) {
      register(preset.url, preset.label);
    }

    // Priority 3: Hero slides & categories cover photos
    for (const slide of heroSlides) {
      if (slide.imageUrl) register(slide.imageUrl, `Banner · ${slide.title}`);
    }
    for (const cat of categories) {
      if (cat.coverImage) register(cat.coverImage, `Categoria · ${cat.name}`);
    }

    // Priority 4: Every product image from catalog + Firestore
    for (const product of products) {
      const urls = [product.cover, ...product.images].filter(
        (u): u is string => typeof u === 'string' && u.length > 0
      );
      urls.forEach((imgUrl, idx) => {
        const suffix = idx > 0 ? ` (foto ${idx + 1})` : '';
        register(imgUrl, `${product.name}${suffix}`);
      });
    }

    // Priority 5: Every remaining image file present in public/assets or dist/assets
    for (const asset of serverAssets) {
      register(asset.url, humanizeFilename(asset.filename), asset.folder);
    }

    return Array.from(byUrl.values());
  }, [serverAssets, heroSlides, categories, products]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allChoices.length };
    for (const item of allChoices) {
      counts[item.folder] = (counts[item.folder] || 0) + 1;
    }
    return counts;
  }, [allChoices]);

  const filteredChoices = useMemo(() => {
    const qNorm = normalizeText(query.trim());
    return allChoices.filter((choice) => {
      if (folderFilter !== 'all' && choice.folder !== folderFilter) return false;
      if (qNorm && !choice.searchText.includes(qNorm)) return false;
      return true;
    });
  }, [allChoices, folderFilter, query]);

  useEffect(() => {
    setVisibleLimit(INITIAL_BATCH);
  }, [folderFilter, query]);

  const visibleChoices = filteredChoices.slice(0, visibleLimit);
  const remaining = Math.max(0, filteredChoices.length - visibleChoices.length);
  const selectedSet = useMemo(() => new Set(selectedUrls), [selectedUrls]);

  return (
    <div className="border-t border-[#DCE2E5] pt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="block text-[11px] text-[#566773]">
          {hintText}{' '}
          <strong className="font-medium text-[#152F40] tabular-nums">
            ({filteredChoices.length} {filteredChoices.length === 1 ? 'foto' : 'fotos'}
            {loadingLibrary ? ' · carregando arquivos…' : ''})
          </strong>
        </span>
      </div>

      {/* Search + Folder Filter */}
      <div className="space-y-2">
        <div className="relative flex items-center bg-white border border-[#DCE2E5] focus-within:border-[#152F40]">
          <Search className="w-3.5 h-3.5 text-[#566773] ml-2.5 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar foto por nome da peça, código (ex.: artche-0049) ou pasta…"
            aria-label="Buscar foto no acervo do site"
            className="w-full px-2.5 py-2 text-xs text-[#152F40] bg-transparent focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FOLDER_LABELS.map((tab) => {
            const count = folderCounts[tab.key] || 0;
            if (tab.key !== 'all' && count === 0) return null;
            const active = folderFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFolderFilter(tab.key)}
                className={`px-2.5 py-1 text-[11px] border transition-colors tabular-nums ${
                  active
                    ? 'bg-[#152F40] text-white border-[#152F40]'
                    : 'bg-white text-[#152F40] border-[#DCE2E5] hover:border-[#152F40]'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filteredChoices.length === 0 ? (
        <div className="border border-[#DCE2E5] bg-[#F5F6F5] p-6 text-center text-xs text-[#566773]">
          Nenhuma foto encontrada com esse filtro no acervo.
        </div>
      ) : (
        <div className="border border-[#DCE2E5] bg-[#F5F6F5]/50 p-2.5 max-h-[380px] overflow-y-auto space-y-3">
          <div className={`grid ${columnsClass} gap-2`}>
            {visibleChoices.map((choice) => {
              const isSelected = selectedSet.has(choice.url);
              return (
                <button
                  key={choice.url}
                  type="button"
                  disabled={disableSelected && isSelected}
                  onClick={() => onSelect(choice.url)}
                  title={`${choice.label} — ${choice.url}`}
                  className={`border p-1.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[#152F40] bg-[#D0E5F2]/35'
                      : 'border-[#DCE2E5] bg-white hover:border-[#152F40]'
                  } ${disableSelected && isSelected ? 'opacity-75 cursor-default' : ''}`}
                >
                  <div
                    className={`w-full ${
                      aspectRatio === '4/3' ? 'aspect-[4/3]' : 'aspect-[4/5]'
                    } bg-[#F5F6F5] overflow-hidden mb-1`}
                  >
                    <img
                      src={choice.url}
                      alt={choice.label}
                      loading="lazy"
                      className="w-full h-full object-cover object-[center_20%]"
                    />
                  </div>
                  <span className="block text-[10px] text-[#152F40] truncate">
                    {isSelected
                      ? disableSelected
                        ? 'Adicionada'
                        : 'Selecionada'
                      : choice.label}
                  </span>
                </button>
              );
            })}
          </div>

          {remaining > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-1">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + LOAD_STEP)}
                className="px-4 py-2 border border-[#152F40] bg-white text-[#152F40] text-[11px] font-medium hover:bg-[#152F40] hover:text-white transition-colors tabular-nums"
              >
                Mostrar mais {Math.min(LOAD_STEP, remaining)} fotos ({remaining} restantes)
              </button>
              <button
                type="button"
                onClick={() => setVisibleLimit(filteredChoices.length)}
                className="px-3 py-2 border border-[#DCE2E5] bg-white text-[#566773] text-[11px] hover:border-[#152F40] hover:text-[#152F40] transition-colors tabular-nums"
              >
                Mostrar todas ({filteredChoices.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
