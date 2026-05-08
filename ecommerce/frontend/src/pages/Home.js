import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useRecentlyViewed } from '../context/RecentlyViewedContext';
import { productAPI } from '../services/api';
import { getDemoCatalogMeta, getDemoProductSuggestions, getDemoProducts } from '../data/demoCatalog';
import './Home.css';

const PRODUCT_CACHE_KEY = 'shopvault_product_cache';
const SEARCH_HISTORY_KEY = 'shopvault_recent_searches';
const PRODUCT_ENDPOINT_FALLBACKS = [
  'http://localhost:5001/api/products',
  'http://127.0.0.1:5001/api/products',
];

const sortOptions = [
  { value: 'relevance', label: 'Best Match' },
  { value: 'latest', label: 'Latest' },
  { value: 'popularity', label: 'Most Popular' },
  { value: 'discount_desc', label: 'Biggest Discount' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

const ratingOptions = [
  { value: '', label: 'Any Rating' },
  { value: '4', label: '4+ & up' },
  { value: '3', label: '3+ & up' },
];

const discountOptions = [
  { value: '', label: 'Any Discount' },
  { value: '10', label: '10%+' },
  { value: '25', label: '25%+' },
  { value: '40', label: '40%+' },
];

const availabilityOptions = [
  { value: 'all', label: 'All Stock' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

const defaultFilters = {
  search: '',
  category: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  minDiscount: '',
  sort: 'latest',
  availability: 'all',
  discountOnly: false,
  page: 1,
};

const CountdownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2" />
    <path d="M9 3h6" />
  </svg>
);

const HeroStatIcon = ({ type }) => {
  if (type === 'products') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M7 8h10M7 12h6M7 16h8" />
      </svg>
    );
  }

  if (type === 'categories') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h7v13H4zM13 4h7v7h-7zM13 13h7v7h-7z" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 4 7v5c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10V7l-8-4Z" />
      <path d="m9.5 12 1.8 1.8 3.7-4.1" />
    </svg>
  );
};

const VendorStarRating = ({ rating }) => (
  <div className="vendor-stars" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <svg
        key={star}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={star <= Math.round(Number(rating || 0)) ? '#FF6B2B' : 'none'}
        stroke={star <= Math.round(Number(rating || 0)) ? '#FF6B2B' : '#d1d5db'}
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="m12 3.6 2.57 5.2 5.74.84-4.15 4.04.98 5.71L12 16.7l-5.14 2.69.98-5.71L3.69 9.64l5.74-.84L12 3.6Z" />
      </svg>
    ))}
    <span>{rating}</span>
  </div>
);

const CategoryGlyph = ({ category }) => {
  const key = String(category || '').toLowerCase();

  if (key === 'electronics') {
    return <path d="M7 7h10v10H7zM9 3h6M9 21h6" />;
  }
  if (key === 'fashion') {
    return <path d="M9 5 7 8l-3 2 3 3v6h10v-6l3-3-3-2-2-3-3 2-3-2Z" />;
  }
  if (key === 'home') {
    return <path d="m4 11 8-6 8 6v8H4zM9 19v-5h6v5" />;
  }
  if (key === 'sports') {
    return <path d="M6 6c4 1 8 5 12 12M18 6c-4 1-8 5-12 12" />;
  }
  if (key === 'beauty') {
    return <path d="M9 4h6l1 4-4 12h-2L6 8z" />;
  }
  if (key === 'accessories') {
    return <path d="M8 11a4 4 0 1 1 8 0v7H8zM10 11V9a2 2 0 1 1 4 0v2" />;
  }
  if (key === 'grocery') {
    return <path d="M6 7h13l-1.2 8H8zM6 7 5 4H3M9 19a1 1 0 1 0 0 .01M16 19a1 1 0 1 0 0 .01" />;
  }

  return <path d="M6 6h12v12H6z" />;
};

const getRemainingTime = (targetDate) => {
  const diff = Math.max(targetDate.getTime() - Date.now(), 0);
  const days = Math.floor(diff / 86400000);
  const totalHours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return {
    days: String(days).padStart(2, '0'),
    hours: String(totalHours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
};

const Home = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const catalogRef = useRef(null);
  const searchBoxRef = useRef(null);
  const toastRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const suggestionDebounceRef = useRef(null);
  const dealTargetRef = useRef(new Date(Date.now() + 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 60 * 7));
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter(Boolean).slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const [dealCountdown, setDealCountdown] = useState(getRemainingTime(dealTargetRef.current));
  const { recentlyViewed, clearRecentlyViewed } = useRecentlyViewed();

  useEffect(() => {
    const timer = setInterval(() => {
      setDealCountdown(getRemainingTime(dealTargetRef.current));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search') || '';
    setSearchInput((current) => (current === urlSearch ? current : urlSearch));
    setFilters((current) => (current.search === urlSearch ? current : { ...current, search: urlSearch, page: 1 }));
  }, [location.search]);

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.category ||
    filters.brand ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minRating ||
    filters.minDiscount ||
    filters.sort !== 'latest' ||
    filters.availability !== 'all' ||
    filters.discountOnly
  );

  const buildProductParams = useCallback(() => {
    const params = {
      page: String(filters.page),
      limit: '12',
      sort: filters.search && filters.sort === 'latest' ? 'relevance' : filters.sort,
    };

    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.brand) params.brand = filters.brand;
    if (filters.minPrice) params.minPrice = filters.minPrice;
    if (filters.maxPrice) params.maxPrice = filters.maxPrice;
    if (filters.minRating) params.minRating = filters.minRating;
    if (filters.minDiscount) params.minDiscount = filters.minDiscount;
    if (filters.availability !== 'all') params.availability = filters.availability;
    if (filters.discountOnly) params.discountOnly = 'true';

    return params;
  }, [filters]);

  const pushSearchToUrl = useCallback((value) => {
    const params = new URLSearchParams(location.search);
    if (value) params.set('search', value);
    else params.delete('search');
    navigate(`/${params.toString() ? `?${params.toString()}` : ''}`, { replace: filters.page === 1 });
  }, [filters.page, location.search, navigate]);

  const loadProductsViaFallback = async (params) => {
    const query = new URLSearchParams(params).toString();

    for (const endpoint of PRODUCT_ENDPOINT_FALLBACKS) {
      try {
        const response = await fetch(`${endpoint}?${query}`);
        if (!response.ok) continue;
        const data = await response.json();
        if (data?.success && Array.isArray(data.products)) return data;
      } catch (_error) {
        // Try next endpoint.
      }
    }

    throw new Error('All product endpoints failed');
  };

  const showOfflineToast = useCallback((message) => {
    if (toastRef.current) toast.dismiss(toastRef.current);
    toastRef.current = toast.info(message, {
      autoClose: 4500,
      closeButton: true,
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const params = buildProductParams();
      let data;

      try {
        const response = await productAPI.getAll(params);
        data = response.data;
      } catch (_primaryError) {
        data = await loadProductsViaFallback(params);
      }

      setProducts(data.products);
      setPagination({ total: data.total, totalPages: data.totalPages });
      localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({
        products: data.products,
        total: data.total,
        totalPages: data.totalPages,
        savedAt: Date.now(),
      }));
    } catch {
      const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.products)) {
            setProducts(parsed.products);
            setPagination({ total: parsed.total || parsed.products.length, totalPages: parsed.totalPages || 1 });
            showOfflineToast('Live products could not be refreshed. Showing the last available product list.');
            setLoading(false);
            return;
          }
        } catch (_cacheError) {
          // Ignore cache parsing issues.
        }
      }

      const fallbackData = getDemoProducts(buildProductParams());
      setProducts(fallbackData.products);
      setPagination({ total: fallbackData.total, totalPages: fallbackData.totalPages });
      showOfflineToast('Backend is offline. Showing the demo catalog until the product service is available again.');
    } finally {
      setLoading(false);
    }
  }, [buildProductParams, showOfflineToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      setFilters((current) => (
        current.search === searchInput
          ? current
          : { ...current, search: searchInput, page: 1 }
      ));
      pushSearchToUrl(searchInput.trim());
    }, 220);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [pushSearchToUrl, searchInput]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!searchBoxRef.current?.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    const trimmedQuery = searchInput.trim();
    if (!searchOpen) return undefined;

    if (trimmedQuery.length < 2) {
      setSearchSuggestions([]);
      setSearchLoading(false);
      return undefined;
    }

    suggestionDebounceRef.current = setTimeout(() => {
      setSearchLoading(true);
      productAPI.getSearchSuggestions(trimmedQuery)
        .then((response) => setSearchSuggestions(response.data.suggestions || []))
        .catch(() => setSearchSuggestions(getDemoProductSuggestions(trimmedQuery)))
        .finally(() => setSearchLoading(false));
    }, 180);

    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, [searchInput, searchOpen]);

  useEffect(() => {
    productAPI.getCategories()
      .then((response) => setCategories(response.data.categories))
      .catch(() => setCategories(getDemoCatalogMeta().categories));
    productAPI.getBrands()
      .then((response) => setBrands(response.data.brands || []))
      .catch(() => setBrands(getDemoCatalogMeta().brands));
  }, []);

  const persistRecentSearch = useCallback((value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;

    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 6);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const applySearchValue = useCallback((value, options = {}) => {
    const normalized = String(value || '').trim();
    const preserveScopedFilters = options.preserveScopedFilters === true;
    setSearchInput(normalized);
    setFilters((current) => ({
      ...current,
      search: normalized,
      category: normalized && !preserveScopedFilters ? '' : current.category,
      brand: normalized && !preserveScopedFilters ? '' : current.brand,
      sort: normalized ? 'relevance' : current.sort,
      page: 1,
    }));
    persistRecentSearch(normalized);
    pushSearchToUrl(normalized);
    setSearchOpen(false);
  }, [persistRecentSearch, pushSearchToUrl]);

  const handleSuggestionSelect = useCallback((suggestion) => {
    if (suggestion.type === 'brand') {
      setFilters((current) => ({ ...current, brand: suggestion.value, search: '', page: 1 }));
      setSearchInput('');
      pushSearchToUrl('');
      setSearchOpen(false);
      return;
    }

    if (suggestion.type === 'category') {
      setFilters((current) => ({ ...current, category: suggestion.value, search: '', page: 1 }));
      setSearchInput('');
      pushSearchToUrl('');
      setSearchOpen(false);
      return;
    }

    applySearchValue(suggestion.value, { preserveScopedFilters: true });
  }, [applySearchValue, pushSearchToUrl]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    applySearchValue(searchInput);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setSearchInput('');
    setSearchSuggestions([]);
    setSearchOpen(false);
    pushSearchToUrl('');
  };

  const featuredProducts = useMemo(() => products.slice(0, 6), [products]);
  const heroShowcaseProducts = useMemo(() => products.slice(0, 3), [products]);
  const dealProduct = useMemo(() => {
    const discounted = [...products].sort((left, right) => Number(right.discount || 0) - Number(left.discount || 0));
    return discounted[0] || null;
  }, [products]);
  const dealPricing = useMemo(() => {
    if (!dealProduct) return null;
    const original = Number.parseFloat(dealProduct.price || 0);
    const discount = Number.parseFloat(dealProduct.discount || 0);
    const current = discount > 0 ? original * (1 - discount / 100) : original;
    return {
      original: original.toFixed(2),
      current: current.toFixed(2),
      savings: (original - current).toFixed(2),
    };
  }, [dealProduct]);

  const topVendors = useMemo(() => {
    const vendorMap = new Map();
    products.forEach((product) => {
      const id = product.vendor?.id || product.vendor_id || product.id;
      if (!vendorMap.has(id)) {
        vendorMap.set(id, {
          id,
          name: product.vendor?.name || 'Featured Vendor',
          productCount: 0,
          ratingTotal: 0,
          reviewCount: 0,
          categories: new Set(),
          image: product.image || '',
        });
      }

      const current = vendorMap.get(id);
      current.productCount += 1;
      current.ratingTotal += Number(product.avgRating || 0);
      current.reviewCount += 1;
      if (product.category) current.categories.add(product.category);
    });

    return [...vendorMap.values()]
      .map((vendor) => ({
        ...vendor,
        averageRating: vendor.reviewCount ? (vendor.ratingTotal / vendor.reviewCount).toFixed(1) : '4.5',
        categories: [...vendor.categories].slice(0, 2),
      }))
      .sort((left, right) => right.productCount - left.productCount)
      .slice(0, 4);
  }, [products]);

  const heroStats = [
    { value: `${pagination.total}+`, label: 'Products', type: 'products' },
    { value: `${categories.length}`, label: 'Categories', type: 'categories' },
    { value: '100%', label: 'Secure', type: 'secure' },
  ];

  const handleDealAddToCart = () => {
    if (!dealProduct) return;
    if (!user) {
      toast.info('Please log in to add this deal to your cart');
      return;
    }
    if (user.role !== 'customer') {
      toast.info('Only customers can add products to cart');
      return;
    }
    if (Number(dealProduct.stock || 0) <= 0) {
      toast.error('This deal is currently out of stock');
      return;
    }
    addToCart(dealProduct);
    toast.success(`${dealProduct.name} added to cart`);
  };

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-pattern" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
        <div className="container hero-inner">
          <div className="hero-text">
            <span className="hero-eyebrow">Trending Now</span>
            <h1 className="hero-title">Bold products.<br />Trusted sellers.</h1>
            <p className="hero-desc">
              Discover standout products from independent vendors, explore curated deals, and move from inspiration to checkout in one polished shopping flow.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-accent btn-lg hero-cta"
                onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Shop Now
              </button>
              <button
                type="button"
                className="hero-link"
                onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Browse vendors
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-orb hero-orb-large" />
            <div className="hero-orb hero-orb-small" />
            <div className="hero-collage" aria-hidden="true">
              {heroShowcaseProducts.map((product, index) => (
                <div key={`hero-${product.id}`} className={`hero-collage-card hero-collage-card-${index + 1}`}>
                  {product.image ? (
                    <img src={product.image} alt="" />
                  ) : (
                    <div className="hero-collage-fallback">{product.name}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="hero-stats">
              {heroStats.map((item) => (
                <div key={item.label} className="hero-stat card">
                  <span className="hero-stat-icon"><HeroStatIcon type={item.type} /></span>
                  <strong className="stat-num">{item.value}</strong>
                  <span className="stat-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="filters-bar">
        <div className="container filters-inner">
          <form className="search-form" onSubmit={handleSearchSubmit} ref={searchBoxRef}>
            <div className="search-box">
              <span className={`search-leading-icon ${searchOpen ? 'active' : ''}`} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                className="form-input search-input"
                placeholder="Search products, brands, or categories..."
                value={searchInput}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSearchOpen(true);
                }}
              />
              {searchInput && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchInput('');
                    setSearchSuggestions([]);
                    setSearchOpen(true);
                  }}
                >
                  x
                </button>
              )}
              {(searchOpen && (searchInput.trim().length >= 2 || recentSearches.length > 0)) && (
                <div className="search-popover card">
                  <div className="search-popover-header">
                    <strong>{searchInput.trim().length >= 2 ? 'Suggestions' : 'Recent searches'}</strong>
                    {searchInput.trim().length < 2 && recentSearches.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          localStorage.removeItem(SEARCH_HISTORY_KEY);
                          setRecentSearches([]);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {searchLoading ? (
                    <div className="search-state">Looking for matches...</div>
                  ) : searchInput.trim().length >= 2 ? (
                    searchSuggestions.length > 0 ? (
                      <div className="search-suggestion-list">
                        {searchSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.type}-${suggestion.value}-${suggestion.productId || 'generic'}`}
                            type="button"
                            className="search-suggestion-item"
                            onClick={() => handleSuggestionSelect(suggestion)}
                          >
                            <div>
                              <strong>{suggestion.label}</strong>
                              {suggestion.meta && <span>{suggestion.meta}</span>}
                            </div>
                            <small>{suggestion.type}</small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="search-state">No direct matches. Try a shorter phrase or different spelling.</div>
                    )
                  ) : (
                    <div className="search-suggestion-list">
                      {recentSearches.map((item) => (
                        <button key={item} type="button" className="search-suggestion-item" onClick={() => applySearchValue(item)}>
                          <div>
                            <strong>{item}</strong>
                            <span>Recent search</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary search-submit-btn">Search</button>
          </form>

          <div className="filter-controls">
            <select className="form-input form-select filter-select" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value, page: 1 }))}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="form-input form-select filter-select" value={filters.brand} onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value, page: 1 }))}>
              <option value="">All Brands</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
            <select className="form-input form-select filter-select" value={filters.minRating} onChange={(event) => setFilters((current) => ({ ...current, minRating: event.target.value, page: 1 }))}>
              {ratingOptions.map((option) => <option key={option.value || 'rating-any'} value={option.value}>{option.label}</option>)}
            </select>
            <select className="form-input form-select filter-select" value={filters.minDiscount} onChange={(event) => setFilters((current) => ({ ...current, minDiscount: event.target.value, page: 1 }))}>
              {discountOptions.map((option) => <option key={option.value || 'discount-any'} value={option.value}>{option.label}</option>)}
            </select>
            <select className="form-input form-select filter-select" value={filters.availability} onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value, page: 1 }))}>
              {availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input className="form-input filter-price" type="number" placeholder="Min price" value={filters.minPrice} onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value, page: 1 }))} />
            <input className="form-input filter-price" type="number" placeholder="Max price" value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value, page: 1 }))} />
            <button type="button" className={`toggle-chip ${filters.discountOnly ? 'active' : ''}`} onClick={() => setFilters((current) => ({ ...current, discountOnly: !current.discountOnly, page: 1 }))}>On Sale</button>
            {hasActiveFilters && <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>Clear</button>}
          </div>

          <div className="category-chip-row">
            <button type="button" className={`category-chip ${filters.category === '' ? 'active' : ''}`} onClick={() => setFilters((current) => ({ ...current, category: '', page: 1 }))}>
              <span className="category-chip-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </span>
              <span>All</span>
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`category-chip ${filters.category === category ? 'active' : ''}`}
                onClick={() => setFilters((current) => ({ ...current, category, search: '', page: 1 }))}
              >
                <span className="category-chip-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <CategoryGlyph category={category} />
                  </svg>
                </span>
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container page-content" ref={catalogRef}>
        {dealProduct && (
          <section className="highlight-section deal-section card">
            <div className="section-copy">
              <span className="section-kicker">Deal of the Day</span>
              <h2>{dealProduct.name}</h2>
              <p>Limited-time pricing on one of today&apos;s strongest picks. Lock it in before the countdown ends.</p>
              <div className="deal-price-row">
                <div className="deal-price-block">
                  <strong className="deal-price-current">₹{dealPricing?.current}</strong>
                  <span className="deal-price-original">₹{dealPricing?.original}</span>
                </div>
                <span className="deal-savings">Save ₹{dealPricing?.savings}</span>
              </div>
              <div className="deal-meta-row">
                <span className="deal-meta-pill">{dealProduct.category || 'Featured pick'}</span>
                <span className="deal-meta-pill">{dealProduct.vendor?.name || 'Top vendor'}</span>
                <span className="deal-meta-pill">{Number(dealProduct.stock || 0) > 0 ? `${dealProduct.stock} in stock` : 'Out of stock'}</span>
              </div>
              <div className="countdown-row">
                <div className="countdown-card"><CountdownIcon /><strong>{dealCountdown.days}</strong><span>Days</span></div>
                <div className="countdown-card"><CountdownIcon /><strong>{dealCountdown.hours}</strong><span>Hours</span></div>
                <div className="countdown-card"><CountdownIcon /><strong>{dealCountdown.minutes}</strong><span>Minutes</span></div>
                <div className="countdown-card"><CountdownIcon /><strong>{dealCountdown.seconds}</strong><span>Seconds</span></div>
              </div>
              <div className="deal-actions">
                <button
                  type="button"
                  className="btn btn-accent btn-lg"
                  onClick={handleDealAddToCart}
                  disabled={Number(dealProduct.stock || 0) <= 0}
                >
                  Add to Cart
                </button>
                <span className="deal-helper">Offer ends when the timer hits zero.</span>
              </div>
            </div>
            <div className="deal-media">
              <img src={dealProduct.image} alt={dealProduct.name} />
              <span className="deal-badge">{dealProduct.discount}% OFF</span>
            </div>
          </section>
        )}

        {featuredProducts.length > 0 && (
          <section className="highlight-section">
            <div className="products-header">
              <div>
                <h2 className="products-title">Featured Products</h2>
              <p className="products-subtitle">A quick pass through the products shoppers are opening first.</p>
              </div>
              <button type="button" className="view-all-link" onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View All</button>
            </div>
            <div className="featured-row">
              {featuredProducts.map((product) => (
                <div key={`featured-${product.id}`} className="featured-item">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </section>
        )}

        {topVendors.length > 0 && (
          <section className="highlight-section">
            <div className="products-header">
              <div>
                <h2 className="products-title">Top Vendors</h2>
                <p className="products-subtitle">Shops with strong product depth, steady ratings, and repeat attention.</p>
              </div>
            </div>
            <div className="vendor-grid">
              {topVendors.map((vendor) => (
                <article key={vendor.id} className="vendor-card card card-hover">
                  <div className="vendor-visual">
                    {vendor.image ? (
                      <img src={vendor.image} alt={vendor.name} className="vendor-cover-image" />
                    ) : (
                      <div className="vendor-cover-fallback" />
                    )}
                    <div className="vendor-avatar">{vendor.name.slice(0, 1).toUpperCase()}</div>
                  </div>
                  <h3>{vendor.name}</h3>
                  <p>{vendor.productCount} active products</p>
                  <VendorStarRating rating={vendor.averageRating} />
                  <div className="vendor-meta">
                    <span>{vendor.averageRating} avg rating</span>
                    <span>{vendor.categories.join(' · ') || 'Multi-category'}</span>
                  </div>
                  <Link to={`/vendors/${vendor.id}`} className="btn btn-outline btn-sm vendor-store-btn">Follow</Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {recentlyViewed.length > 0 && !filters.search.trim() && (
          <section className="recently-viewed-section">
            <div className="products-header">
              <div>
                <h2 className="products-title">Recently Viewed</h2>
                <p className="products-subtitle">Jump back into products you checked out recently.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearRecentlyViewed}>Clear</button>
            </div>
            <div className="recently-viewed-row">
              {recentlyViewed.slice(0, 4).map((product) => <ProductCard key={`recent-${product.id}`} product={product} />)}
            </div>
          </section>
        )}

        <div className="products-header">
          <div>
            <h2 className="products-title">{filters.search ? `Results for "${filters.search}"` : 'All Products'}</h2>
            <p className="products-subtitle">
              {filters.category
                ? `${filters.category} picks${filters.brand ? ` · ${filters.brand}` : ''}`
                : filters.brand
                  ? `${filters.brand} picks`
                  : 'Fresh finds from independent sellers'}
            </p>
          </div>
          <span className="products-count">{pagination.total} items</span>
        </div>

        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton-card" />)}
          </div>
        ) : loadError ? (
          <div className="empty-state">
            <div className="empty-state-icon">!</div>
            <h3>Products are temporarily unavailable</h3>
            <p>{loadError}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={fetchProducts}>Retry</button>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">S</div>
            <h3>No products found</h3>
            <p>Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="grid-products">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-outline btn-sm" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Prev</button>
            <span className="page-info">Page {filters.page} of {pagination.totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={filters.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
          </div>
        )}

        <section className="newsletter-section card">
          <div>
            <span className="section-kicker">Newsletter</span>
            <h2>Stay close to new drops and limited offers</h2>
            <p>Get curated updates from top vendors and weekly marketplace highlights.</p>
          </div>
          <form className="newsletter-form" onSubmit={(event) => {
            event.preventDefault();
            toast.success('Thanks for subscribing to ShopVault updates.');
            event.currentTarget.reset();
          }}>
            <input className="form-input" type="email" placeholder="Enter your email" required />
            <button type="submit" className="btn btn-accent">Subscribe</button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Home;
