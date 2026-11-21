import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppRoute, BagItem, Product } from './types/catalog';
import { PRODUCTS } from './data/catalog';
import { CatalogProvider, useCatalog } from './context/CatalogContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { CatalogPage } from './components/CatalogPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { PrivacyPage } from './components/PrivacyPage';
import { SuitcaseDrawer } from './components/SuitcaseDrawer';

const BAG_STORAGE_KEY = 'artche_minha_mala_v1';

function parseLocation(loc: { pathname: string; search: string; hash: string }): AppRoute {
  const segments = loc.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(loc.search);

  if (segments.length === 0) {
    return { view: 'home', hash: loc.hash || undefined };
  }
  if (segments[0] === 'catalogo') {
    return {
      view: 'catalog',
      search: params.get('q') || '',
      brand: params.get('marca') || '',
      perfil: params.get('perfil') || '',
      sort: params.get('ordem') || '',
      page: Math.max(1, Number(params.get('pagina')) || 1),
    };
  }
  if (segments[0] === 'categoria' && segments[1]) {
    return {
      view: 'catalog',
      categorySlug: segments[1],
      search: params.get('q') || '',
      brand: params.get('marca') || '',
      perfil: params.get('perfil') || '',
      sort: params.get('ordem') || '',
      page: Math.max(1, Number(params.get('pagina')) || 1),
    };
  }
  if (segments[0] === 'produto' && segments[1]) {
    return { view: 'product', productId: segments[1] };
  }
  if (segments[0] === 'admin' || segments[0] === 'painel') {
    if (segments[1] === 'login') {
      return { view: 'admin-login', redirectTo: params.get('redirect') || undefined };
    }
    return { view: 'admin', editProductId: params.get('editar') || undefined };
  }
  if (segments[0] === 'privacidade') {
    return { view: 'privacy' };
  }
  return { view: 'not-found' };
}

function loadInitialBag(): BagItem[] {
  try {
    const raw = localStorage.getItem(BAG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ id: string; variant: string; addedAt: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const product = PRODUCTS.find((p) => p.id === entry.id);
        if (!product) return null;
        return { product, variant: entry.variant || '', addedAt: entry.addedAt || Date.now() };
      })
      .filter((x): x is BagItem => Boolean(x));
  } catch {
    return [];
  }
}

function AppContent() {
  const { products, categories, loading, authReady, checkingAdmin, isAdmin } = useCatalog();
  const [urlState, setUrlState] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }));
  const [bag, setBag] = useState<BagItem[]>(loadInitialBag);
  const [bagOpen, setBagOpen] = useState(false);

  const route = useMemo(() => parseLocation(urlState), [urlState]);

  useEffect(() => {
    if (loading) return;
    setBag((prev) => {
      const liveById = new Map(products.map((p) => [p.id, p]));
      let changed = false;
      const next: BagItem[] = [];
      for (const item of prev) {
        const live = liveById.get(item.product.id);
        if (!live) {
          changed = true;
          continue;
        }
        if (live !== item.product) {
          changed = true;
          next.push({ ...item, product: live });
        } else {
          next.push(item);
        }
      }
      return changed ? next : prev;
    });
  }, [products, loading]);

  useEffect(() => {
    try {
      const compact = bag.map((item) => ({
        id: item.product.id,
        variant: item.variant,
        addedAt: item.addedAt,
      }));
      localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Ignore storage quota issues
    }
  }, [bag]);

  useEffect(() => {
    const onPopState = () => {
      setUrlState({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (route.view === 'home') {
      document.title = 'Artchê | Seu próximo inverno começa aqui';
    } else if (route.view === 'catalog') {
      const cat = categories.find((c) => c.slug === route.categorySlug);
      const title = route.search
        ? `Busca por “${route.search}”`
        : cat?.name || 'Todo o catálogo';
      document.title = `${title} | Artchê`;
    } else if (route.view === 'product') {
      const product = products.find((p) => p.id === route.productId);
      document.title = product ? `${product.name} | Artchê` : 'Peça não encontrada | Artchê';
    } else if (route.view === 'admin-login') {
      document.title = 'Acesso Administrativo | Artchê';
    } else if (route.view === 'admin') {
      document.title = 'Painel de Produtos | Artchê';
    } else if (route.view === 'privacy') {
      document.title = 'Privacidade | Artchê';
    } else {
      document.title = 'Página não encontrada | Artchê';
    }
  }, [route, products, categories]);

  useEffect(() => {
    if (route.view === 'admin' && authReady && !checkingAdmin && !isAdmin) {
      const target =
        urlState.pathname + urlState.search !== '/admin/' &&
        urlState.pathname + urlState.search !== '/painel/'
          ? `/admin/login/?redirect=${encodeURIComponent(urlState.pathname + urlState.search)}`
          : '/admin/login/';
      window.history.replaceState({}, '', target);
      const nextUrl = new URL(target, window.location.origin);
      setUrlState({
        pathname: nextUrl.pathname,
        search: nextUrl.search,
        hash: nextUrl.hash,
      });
    }
  }, [route.view, authReady, checkingAdmin, isAdmin, urlState.pathname, urlState.search]);

  useEffect(() => {
    if (route.view === 'home' && route.hash) {
      const targetId = route.hash.replace('#', '');
      requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [route]);

  const navigate = useCallback((path: string) => {
    const nextUrl = new URL(path, window.location.origin);
    window.history.pushState({}, '', nextUrl.pathname + nextUrl.search + nextUrl.hash);
    setUrlState({
      pathname: nextUrl.pathname,
      search: nextUrl.search,
      hash: nextUrl.hash,
    });
    if (!nextUrl.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleSearchSubmit = useCallback(
    (query: string) => {
      if (query) {
        navigate(`/catalogo/?q=${encodeURIComponent(query)}`);
      } else {
        navigate('/catalogo/');
      }
    },
    [navigate]
  );

  const handleUpdateCatalogParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(urlState.search);
      let resetPage = false;
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'pagina') resetPage = true;
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      if (resetPage) params.delete('pagina');
      const qs = params.toString();
      navigate(`${urlState.pathname}${qs ? `?${qs}` : ''}`);
    },
    [navigate, urlState.pathname, urlState.search]
  );

  const handleToggleBag = useCallback((product: Product, variant = '') => {
    setBag((prev) => {
      const exists = prev.some((item) => item.product.id === product.id);
      if (exists) {
        return prev.filter((item) => item.product.id !== product.id);
      }
      return [...prev, { product, variant, addedAt: Date.now() }];
    });
  }, []);

  const handleRemoveBagItem = useCallback((productId: string) => {
    setBag((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const handleClearBag = useCallback(() => {
    setBag([]);
  }, []);

  const bagIds = useMemo(() => new Set(bag.map((item) => item.product.id)), [bag]);

  if (route.view === 'admin-login') {
    return <AdminLoginPage redirectTo={route.redirectTo} onNavigate={navigate} />;
  }

  if (route.view === 'admin' && (!authReady || checkingAdmin || !isAdmin)) {
    return (
      <div className="min-h-screen bg-[#F5F6F5] flex items-center justify-center px-5">
        <div className="border border-[#DCE2E5] bg-white px-6 py-5 text-xs text-[#566773]">
          Verificando acesso administrativo…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#152F40]">
      <Header
        currentPath={urlState.pathname}
        searchQuery={route.view === 'catalog' ? route.search : ''}
        bagCount={bag.length}
        onNavigate={navigate}
        onSearchSubmit={handleSearchSubmit}
        onOpenBag={() => setBagOpen(true)}
      />

      <main id="main" className="flex-1">
        {route.view === 'home' && (
          <HomePage
            products={products}
            bagIds={bagIds}
            onNavigate={navigate}
            onSelectProduct={(id) => navigate(`/produto/${id}/`)}
            onToggleBag={(product) => handleToggleBag(product)}
          />
        )}

        {route.view === 'catalog' && (
          <CatalogPage
            products={products}
            categorySlug={route.categorySlug}
            search={route.search}
            brand={route.brand}
            perfil={route.perfil}
            sort={route.sort}
            page={route.page}
            bagIds={bagIds}
            onNavigate={navigate}
            onUpdateParams={handleUpdateCatalogParams}
            onSelectProduct={(id) => navigate(`/produto/${id}/`)}
            onToggleBag={(product) => handleToggleBag(product)}
          />
        )}

        {route.view === 'product' && (
          <ProductDetailPage
            products={products}
            productId={route.productId}
            bagIds={bagIds}
            onNavigate={navigate}
            onSelectProduct={(id) => navigate(`/produto/${id}/`)}
            onToggleBag={handleToggleBag}
          />
        )}

        {route.view === 'admin' && (
          <AdminDashboardPage
            editProductId={route.editProductId}
            onNavigate={navigate}
          />
        )}

        {route.view === 'privacy' && <PrivacyPage />}

        {route.view === 'not-found' && (
          <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-16">
            <h1 className="font-serif-display text-[42px] text-[#152F40]">
              Página não encontrada
            </h1>
            <p className="text-[13px] text-[#566773] mt-3 mb-6">
              Explore o catálogo da Artchê ou volte para a página inicial.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/');
                }}
                className="inline-flex items-center px-6 py-3 min-h-[46px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors"
              >
                Ir para o início
              </a>
              <a
                href="/catalogo/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/catalogo/');
                }}
                className="inline-flex items-center px-6 py-3 min-h-[46px] border border-[#152F40] text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors"
              >
                Explorar catálogo
              </a>
            </div>
          </div>
        )}
      </main>

      <Footer
        bagCount={bag.length}
        onNavigate={navigate}
        onOpenBag={() => setBagOpen(true)}
      />

      <SuitcaseDrawer
        open={bagOpen}
        items={bag}
        onClose={() => setBagOpen(false)}
        onRemoveItem={handleRemoveBagItem}
        onClearBag={handleClearBag}
        onSelectProduct={(id) => navigate(`/produto/${id}/`)}
      />
    </div>
  );
}

export default function App() {
  return (
    <CatalogProvider>
      <AppContent />
    </CatalogProvider>
  );
}
