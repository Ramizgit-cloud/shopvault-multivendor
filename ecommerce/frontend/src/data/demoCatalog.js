const demoProducts = [
  {
    id: 9001,
    name: 'Aether Wireless Headphones',
    description: 'Noise-cancelling over-ear headphones with warm sound and 30-hour battery life.',
    price: 7999,
    stock: 14,
    category: 'Electronics',
    brand: 'Aether',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
    vendor_id: 201,
    isActive: true,
    discount: 18,
    avgRating: '4.6',
    reviewCount: 128,
    totalSold: 312,
    createdAt: '2026-04-28T10:30:00.000Z',
    updatedAt: '2026-04-28T10:30:00.000Z',
    vendor: { id: 201, name: 'Northwind Audio' },
  },
  {
    id: 9002,
    name: 'Loom Linen Shirt',
    description: 'Breathable linen shirt tailored for hot-weather comfort.',
    price: 2299,
    stock: 22,
    category: 'Fashion',
    brand: 'Loom',
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80',
    vendor_id: 202,
    isActive: true,
    discount: 12,
    avgRating: '4.3',
    reviewCount: 74,
    totalSold: 188,
    createdAt: '2026-04-26T09:00:00.000Z',
    updatedAt: '2026-04-26T09:00:00.000Z',
    vendor: { id: 202, name: 'Thread House' },
  },
  {
    id: 9003,
    name: 'Stoneware Brew Mug',
    description: 'Hand-finished ceramic mug made for tea, coffee, and slow mornings.',
    price: 899,
    stock: 31,
    category: 'Home',
    brand: 'Kiln & Co',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?auto=format&fit=crop&w=900&q=80',
    vendor_id: 203,
    isActive: true,
    discount: 0,
    avgRating: '4.8',
    reviewCount: 53,
    totalSold: 141,
    createdAt: '2026-04-22T12:15:00.000Z',
    updatedAt: '2026-04-22T12:15:00.000Z',
    vendor: { id: 203, name: 'Clayroom Studio' },
  },
  {
    id: 9004,
    name: 'TrailFlex Running Shoes',
    description: 'Lightweight running shoes with cushioned support for daily training.',
    price: 4599,
    stock: 9,
    category: 'Sports',
    brand: 'TrailFlex',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    vendor_id: 204,
    isActive: true,
    discount: 20,
    avgRating: '4.5',
    reviewCount: 96,
    totalSold: 244,
    createdAt: '2026-04-25T15:10:00.000Z',
    updatedAt: '2026-04-25T15:10:00.000Z',
    vendor: { id: 204, name: 'Stride Lab' },
  },
  {
    id: 9005,
    name: 'GlowBerry Skin Serum',
    description: 'Vitamin-rich brightening serum with a lightweight, non-sticky finish.',
    price: 1499,
    stock: 17,
    category: 'Beauty',
    brand: 'GlowBerry',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80',
    vendor_id: 205,
    isActive: true,
    discount: 15,
    avgRating: '4.4',
    reviewCount: 67,
    totalSold: 159,
    createdAt: '2026-04-20T07:45:00.000Z',
    updatedAt: '2026-04-20T07:45:00.000Z',
    vendor: { id: 205, name: 'Bloom Rituals' },
  },
  {
    id: 9006,
    name: 'Orbit Desk Lamp',
    description: 'Minimal metal desk lamp with warm dimmable light and USB-C power.',
    price: 2799,
    stock: 0,
    category: 'Home',
    brand: 'Orbit',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    vendor_id: 206,
    isActive: true,
    discount: 10,
    avgRating: '4.1',
    reviewCount: 39,
    totalSold: 92,
    createdAt: '2026-04-18T18:20:00.000Z',
    updatedAt: '2026-04-18T18:20:00.000Z',
    vendor: { id: 206, name: 'Atelier Grid' },
  },
  {
    id: 9007,
    name: 'Canvas Everyday Backpack',
    description: 'Structured everyday backpack with laptop sleeve and hidden bottle pocket.',
    price: 3199,
    stock: 11,
    category: 'Accessories',
    brand: 'Northline',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80',
    vendor_id: 207,
    isActive: true,
    discount: 8,
    avgRating: '4.7',
    reviewCount: 84,
    totalSold: 201,
    createdAt: '2026-04-24T11:50:00.000Z',
    updatedAt: '2026-04-24T11:50:00.000Z',
    vendor: { id: 207, name: 'Carry Theory' },
  },
  {
    id: 9008,
    name: 'Harvest Crunch Granola',
    description: 'Small-batch almond granola with dates, seeds, and wildflower honey.',
    price: 549,
    stock: 40,
    category: 'Grocery',
    brand: 'Harvest Crunch',
    image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80',
    vendor_id: 208,
    isActive: true,
    discount: 5,
    avgRating: '4.2',
    reviewCount: 27,
    totalSold: 118,
    createdAt: '2026-04-19T06:25:00.000Z',
    updatedAt: '2026-04-19T06:25:00.000Z',
    vendor: { id: 208, name: 'Morning Basket' },
  },
];

const normalizeText = (value = '') => String(value || '').trim().toLowerCase();

const getEffectivePrice = (product) => {
  const price = Number(product.price || 0);
  const discount = Number(product.discount || 0);
  return discount > 0 ? price * (1 - discount / 100) : price;
};

const sortProducts = (products, sort) => {
  const sorted = [...products];

  sorted.sort((left, right) => {
    if (sort === 'price_asc') return getEffectivePrice(left) - getEffectivePrice(right);
    if (sort === 'price_desc') return getEffectivePrice(right) - getEffectivePrice(left);
    if (sort === 'discount_desc') return Number(right.discount || 0) - Number(left.discount || 0);
    if (sort === 'rating') return Number(right.avgRating || 0) - Number(left.avgRating || 0);
    if (sort === 'popularity' || sort === 'relevance') {
      const soldDiff = Number(right.totalSold || 0) - Number(left.totalSold || 0);
      if (soldDiff !== 0) return soldDiff;
      return Number(right.avgRating || 0) - Number(left.avgRating || 0);
    }

    return new Date(right.createdAt) - new Date(left.createdAt);
  });

  return sorted;
};

export const getDemoCatalogMeta = () => ({
  categories: [...new Set(demoProducts.map((product) => product.category).filter(Boolean))],
  brands: [...new Set(demoProducts.map((product) => product.brand).filter(Boolean))],
});

export const getDemoProductSuggestions = (query, limit = 8) => {
  const normalized = normalizeText(query);
  if (!normalized) return [];

  return demoProducts
    .filter((product) => [product.name, product.brand, product.category].some((value) => normalizeText(value).includes(normalized)))
    .slice(0, limit)
    .map((product) => ({
      type: 'product',
      value: product.name,
      label: product.name,
      meta: [product.brand, product.category].filter(Boolean).join(' · '),
      productId: product.id,
    }));
};

export const getDemoProducts = (params = {}) => {
  const page = Math.max(Number.parseInt(params.page, 10) || 1, 1);
  const limit = Math.max(Number.parseInt(params.limit, 10) || 12, 1);
  const normalizedSearch = normalizeText(params.search);
  const minPrice = params.minPrice === '' || params.minPrice == null ? null : Number(params.minPrice);
  const maxPrice = params.maxPrice === '' || params.maxPrice == null ? null : Number(params.maxPrice);
  const minRating = params.minRating === '' || params.minRating == null ? null : Number(params.minRating);
  const minDiscount = params.minDiscount === '' || params.minDiscount == null ? null : Number(params.minDiscount);

  let filtered = demoProducts.filter((product) => {
    if (params.category && product.category !== params.category) return false;
    if (params.brand && product.brand !== params.brand) return false;
    if (params.availability === 'in_stock' && Number(product.stock || 0) <= 0) return false;
    if (params.availability === 'out_of_stock' && Number(product.stock || 0) > 0) return false;
    if (String(params.discountOnly) === 'true' && Number(product.discount || 0) <= 0) return false;
    if (minDiscount != null && Number(product.discount || 0) < minDiscount) return false;
    if (minRating != null && Number(product.avgRating || 0) < minRating) return false;

    const effectivePrice = getEffectivePrice(product);
    if (minPrice != null && effectivePrice < minPrice) return false;
    if (maxPrice != null && effectivePrice > maxPrice) return false;

    if (normalizedSearch) {
      const haystack = normalizeText([
        product.name,
        product.brand,
        product.category,
        product.description,
        product.vendor?.name,
      ].filter(Boolean).join(' '));
      if (!haystack.includes(normalizedSearch)) return false;
    }

    return true;
  });

  filtered = sortProducts(filtered, params.sort);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    success: true,
    products: filtered.slice(start, start + limit),
    total,
    page,
    totalPages,
  };
};

export default demoProducts;
