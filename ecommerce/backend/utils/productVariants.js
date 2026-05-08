const createVariantId = () => `variant_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStock = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const parseVariants = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeVariant = (variant) => {
  const attributes = {
    size: variant?.attributes?.size || variant?.size || '',
    color: variant?.attributes?.color || variant?.color || '',
    storage: variant?.attributes?.storage || variant?.storage || '',
  };

  Object.keys(attributes).forEach((key) => {
    attributes[key] = String(attributes[key] || '').trim();
  });

  const fallbackLabel = Object.values(attributes).filter(Boolean).join(' / ');
  const label = String(variant?.label || fallbackLabel || '').trim();

  if (!label) return null;

  return {
    id: String(variant?.id || createVariantId()),
    label,
    attributes,
    stock: toStock(variant?.stock),
    priceAdjustment: Number(toNumber(variant?.priceAdjustment, 0).toFixed(2)),
    image: String(variant?.image || '').trim(),
  };
};

const normalizeVariants = (value) => parseVariants(value)
  .map(normalizeVariant)
  .filter(Boolean);

const serializeVariants = (variants) => JSON.stringify(normalizeVariants(variants));

const getVariantStockTotal = (variants) => normalizeVariants(variants)
  .reduce((sum, variant) => sum + toStock(variant.stock), 0);

const attachVariantSummary = (product) => {
  const variants = normalizeVariants(product.variants);
  const totalVariantStock = getVariantStockTotal(variants);

  return {
    ...product,
    variants,
    hasVariants: variants.length > 0,
    stock: variants.length > 0 ? totalVariantStock : toStock(product.stock),
    variantCount: variants.length,
    minVariantPrice: variants.length > 0
      ? Math.min(...variants.map((variant) => toNumber(product.price) + toNumber(variant.priceAdjustment, 0)))
      : toNumber(product.price),
    maxVariantPrice: variants.length > 0
      ? Math.max(...variants.map((variant) => toNumber(product.price) + toNumber(variant.priceAdjustment, 0)))
      : toNumber(product.price),
  };
};

module.exports = {
  parseVariants,
  normalizeVariants,
  serializeVariants,
  getVariantStockTotal,
  attachVariantSummary,
};
