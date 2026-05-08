const { Product, User, Review, Order, OrderItem } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { resolveProductImage, removeLocalUpload } = require('../utils/productImage');
const { attachVariantSummary, normalizeVariants, parseVariants, serializeVariants, getVariantStockTotal } = require('../utils/productVariants');
const { hasTableColumn, getProductAttributes } = require('../utils/schemaSupport');
const { recordRestockEvent, getVendorRestockHistory } = require('../utils/restockHistory');

const normalizeSearchText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenizeSearchText = (value = '') => normalizeSearchText(value)
  .split(' ')
  .map((token) => token.trim())
  .filter(Boolean);

const levenshteinDistance = (a = '', b = '') => {
  const left = String(a);
  const right = String(b);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
};

const buildSearchHaystacks = (product) => {
  const primary = normalizeSearchText([
    product.name,
    product.brand,
    product.category,
  ].filter(Boolean).join(' '));

  const nameOnly = normalizeSearchText(product.name);
  const extended = normalizeSearchText([
    product.name,
    product.brand,
    product.category,
    product.description,
    product.vendor?.name,
  ].filter(Boolean).join(' '));

  return {
    primary,
    nameOnly,
    extended,
    tokens: [...new Set(tokenizeSearchText(extended))],
    primaryTokens: [...new Set(tokenizeSearchText(primary))],
  };
};

const getSearchScore = (product, rawQuery) => {
  const query = normalizeSearchText(rawQuery);
  if (!query) return { score: 0, matches: [] };

  const queryTokens = tokenizeSearchText(query);
  const haystacks = buildSearchHaystacks(product);
  let score = 0;
  const matches = [];
  let matchedTokenCount = 0;
  let strictTokenCount = 0;

  if (haystacks.primary === query) {
    score += 220;
    matches.push('Exact match');
  } else if (haystacks.primary.startsWith(query)) {
    score += 180;
    matches.push('Starts with query');
  } else if (haystacks.extended.includes(query)) {
    score += 140;
    matches.push('Contains query');
  }

  queryTokens.forEach((token) => {
    if (haystacks.tokens.includes(token)) {
      score += 40;
      matchedTokenCount += 1;
      strictTokenCount += 1;
      return;
    }

    const prefixHit = haystacks.tokens.find((candidate) => candidate.startsWith(token) || token.startsWith(candidate));
    if (prefixHit) {
      score += 26;
      matchedTokenCount += 1;
      if (haystacks.primaryTokens.includes(prefixHit)) strictTokenCount += 1;
      return;
    }

    if (token.length >= 3) {
      const typoHit = haystacks.tokens.find((candidate) => Math.abs(candidate.length - token.length) <= 2 && levenshteinDistance(candidate, token) <= 2);
      if (typoHit) {
        score += 18;
        matchedTokenCount += 1;
        if (haystacks.primaryTokens.includes(typoHit)) strictTokenCount += 1;
        matches.push(`Close to "${token}"`);
      }
    }
  });

  const requiredMatches = queryTokens.length > 1 ? queryTokens.length : 1;
  if (matchedTokenCount < requiredMatches) {
    return { score: 0, matches: [] };
  }

  const hasPrimaryIntentMatch = queryTokens.some((token) => (
    haystacks.nameOnly.includes(token)
    || haystacks.primaryTokens.includes(token)
    || haystacks.primaryTokens.some((candidate) => candidate.startsWith(token) || token.startsWith(candidate))
    || (token.length >= 3 && haystacks.primaryTokens.some((candidate) => Math.abs(candidate.length - token.length) <= 2 && levenshteinDistance(candidate, token) <= 2))
  ));

  if (!hasPrimaryIntentMatch || strictTokenCount === 0) {
    return { score: 0, matches: [] };
  }

  if (queryTokens.length > 1 && queryTokens.every((token) => haystacks.extended.includes(token))) {
    score += 35;
  }

  return {
    score,
    matches: [...new Set(matches)],
  };
};

const sortProducts = (products, sort) => {
  const sorters = {
    relevance: (a, b) => {
      const searchDiff = Number(b.searchScore || 0) - Number(a.searchScore || 0);
      if (searchDiff !== 0) return searchDiff;
      const ratingDiff = Number(b.avgRating || 0) - Number(a.avgRating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.totalSold || 0) - Number(a.totalSold || 0);
    },
    latest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    popularity: (a, b) => {
      const soldDiff = Number(b.totalSold || 0) - Number(a.totalSold || 0);
      if (soldDiff !== 0) return soldDiff;
      const ratingDiff = Number(b.avgRating || 0) - Number(a.avgRating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
    },
    rating: (a, b) => {
      const ratingDiff = Number(b.avgRating || 0) - Number(a.avgRating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
    },
    discount_desc: (a, b) => Number(b.discount || 0) - Number(a.discount || 0),
    price_asc: (a, b) => Number(a.effectivePrice || a.price || 0) - Number(b.effectivePrice || b.price || 0),
    price_desc: (a, b) => Number(b.effectivePrice || b.price || 0) - Number(a.effectivePrice || a.price || 0),
  };

  return [...products].sort(sorters[sort] || sorters.latest);
};

// GET /api/products - Public
const getAllProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      minRating,
      minDiscount,
      sort = 'latest',
      inStock,
      availability,
      discountOnly,
      page = 1,
      limit = 12,
    } = req.query;
    const where = { isActive: true };
    const productAttributes = await getProductAttributes();
    const supportsBrand = productAttributes.includes('brand');
    const supportsTemporaryAvailability = productAttributes.includes('isTemporarilyUnavailable');

    if (category) where.category = category;
    if (supportsBrand && brand) where.brand = brand;

    // Filter out temporarily unavailable products by default
    if (supportsTemporaryAvailability && availability !== 'temporarily_unavailable') {
      where.isTemporarilyUnavailable = false;
    }

    if (availability === 'out_of_stock') {
      where.stock = 0;
    } else if (availability === 'in_stock' || String(inStock) === 'true') {
      where.stock = { [Op.gt]: 0 };
    }
    if (String(discountOnly) === 'true') {
      where.discount = { [Op.gt]: 0 };
    }
    if (minDiscount) {
      where.discount = where.discount || {};
      where.discount[Op.gte] = parseFloat(minDiscount);
    }
    if (minPrice || maxPrice) {
      where.price = where.price || {};
      if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
    }

    const rows = await Product.findAll({
      attributes: productAttributes,
      where,
      include: [
        { model: User, as: 'vendor', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    const productIds = rows.map((product) => product.id);
    const reviews = productIds.length
      ? await Review.findAll({
        where: { product_id: { [Op.in]: productIds } },
        attributes: ['product_id', 'rating'],
      })
      : [];
    const orderCounts = productIds.length
      ? await OrderItem.findAll({
        where: { product_id: { [Op.in]: productIds } },
        attributes: [
          'product_id',
          [sequelize.fn('SUM', sequelize.col('quantity')), 'unitsSold'],
        ],
        group: ['product_id'],
        raw: true,
      })
      : [];

    const ratingsByProduct = reviews.reduce((acc, review) => {
      const key = review.product_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(review.rating);
      return acc;
    }, {});
    const unitsSoldByProduct = orderCounts.reduce((acc, item) => {
      acc[item.product_id] = Number(item.unitsSold || 0);
      return acc;
    }, {});

    let products = rows.map((p) => {
      const prod = attachVariantSummary(p.toJSON());
      const ratings = ratingsByProduct[prod.id] || [];
      const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
      prod.avgRating = avgRating.toFixed(1);
      prod.reviewCount = ratings.length;
      prod.totalSold = unitsSoldByProduct[prod.id] || 0;
      prod.effectivePrice = prod.discount > 0
        ? Number(parseFloat(prod.price) * (1 - parseFloat(prod.discount || 0) / 100))
        : Number(parseFloat(prod.price));
      return prod;
    });

    if (search) {
      products = products
        .map((product) => {
          const searchMeta = getSearchScore(product, search);
          return {
            ...product,
            searchScore: searchMeta.score,
            searchMatches: searchMeta.matches,
          };
        })
        .filter((product) => product.searchScore > 0);
    }

    if (minRating) {
      products = products.filter((product) => Number(product.avgRating || 0) >= Number(minRating));
    }

    const effectiveSort = search && sort === 'latest' ? 'relevance' : sort;
    products = sortProducts(products, effectiveSort);

    const total = products.length;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;
    products = products.slice(offset, offset + parsedLimit);

    res.json({
      success: true,
      products,
      total,
      page: parsedPage,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/search-suggestions
const getProductSearchSuggestions = async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 8, 1), 12);

    if (!query) {
      return res.json({ success: true, suggestions: [] });
    }

    const productAttributes = await getProductAttributes();
    const rows = await Product.findAll({
      attributes: productAttributes,
      where: { isActive: true },
      include: [{ model: User, as: 'vendor', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    const products = rows
      .map((record) => attachVariantSummary(record.toJSON()))
      .map((product) => {
        const scoreMeta = getSearchScore(product, query);
        return {
          ...product,
          searchScore: scoreMeta.score,
        };
      })
      .filter((product) => product.searchScore > 0)
      .sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0))
      .slice(0, limit);

    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))]
      .slice(0, 3)
      .map((label) => ({ type: 'category', value: label, label }));
    const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))]
      .slice(0, 3)
      .map((label) => ({ type: 'brand', value: label, label }));
    const productSuggestions = products.map((product) => ({
      type: 'product',
      value: product.name,
      label: product.name,
      meta: [product.brand, product.category].filter(Boolean).join(' · '),
      productId: product.id,
    }));

    const suggestions = [...productSuggestions, ...categories, ...brands].slice(0, limit);
    res.json({ success: true, suggestions });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id - Public
const getProductById = async (req, res, next) => {
  try {
    const productAttributes = await getProductAttributes();
    const product = await Product.findOne({
      attributes: productAttributes,
      where: { id: req.params.id, isActive: true },
      include: [
        { model: User, as: 'vendor', attributes: ['id', 'name', 'email'] },
        {
          model: Review,
          as: 'reviews',
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
        },
      ],
    });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const prod = attachVariantSummary(product.toJSON());
    const deliveredOrders = await OrderItem.findAll({
      where: { product_id: prod.id },
      include: [{
        model: Order,
        as: 'order',
        where: { status: 'delivered' },
        attributes: ['user_id'],
      }],
      attributes: ['product_id'],
    });
    const verifiedReviewerIds = new Set(deliveredOrders.map((item) => Number(item.order?.user_id)).filter(Boolean));

    prod.reviews = prod.reviews.map((review) => ({
      ...review,
      verifiedPurchase: verifiedReviewerIds.has(Number(review.user_id)),
    }));
    const ratings = prod.reviews.map((r) => r.rating);
    prod.avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
    prod.reviewCount = ratings.length;

    res.json({ success: true, product: prod });
  } catch (error) {
    next(error);
  }
};

// POST /api/products - Vendor
const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category, brand, image, discount, variants } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const resolvedImage = await resolveProductImage(image, req);
    const supportsVariants = await hasTableColumn('products', 'variants');

    const normalizedVariants = normalizeVariants(variants);
    const resolvedStock = normalizedVariants.length > 0 ? getVariantStockTotal(normalizedVariants) : stock;
    const productPayload = {
      name,
      description,
      price,
      stock: resolvedStock,
      category,
      brand: brand || null,
      image: resolvedImage,
      discount,
      vendor_id: req.user.id,
      isTemporarilyUnavailable: false,
    };

    if (supportsVariants) {
      productPayload.variants = normalizedVariants.length > 0 ? serializeVariants(normalizedVariants) : null;
    }

    const product = await Product.create(productPayload);
    await recordRestockEvent({
      vendorId: req.user.id,
      productId: product.id,
      productName: name,
      previousStock: 0,
      nextStock: resolvedStock,
      changeType: 'initial_stock',
      source: 'create',
      previousVariants: [],
      nextVariants: normalizedVariants,
    });

    res.status(201).json({ success: true, message: 'Product created', product: attachVariantSummary(product.toJSON()) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/products/:id - Vendor (own) or Admin
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      attributes: await getProductAttributes(),
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (req.user.role === 'vendor' && product.vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this product' });
    }

    const { name, description, price, stock, category, brand, image, discount, isActive, isTemporarilyUnavailable, variants } = req.body;
    const resolvedImage = await resolveProductImage(image, req, product.image);
    const supportsVariants = await hasTableColumn('products', 'variants');
    const previousVariants = supportsVariants ? parseVariants(product.variants) : [];
    const previousStock = Number(product.stock || 0);
    const normalizedVariants = normalizeVariants(variants);
    const resolvedStock = normalizedVariants.length > 0 ? getVariantStockTotal(normalizedVariants) : stock;
    const productPayload = {
      name,
      description,
      price,
      stock: resolvedStock,
      category,
      brand: brand || null,
      image: resolvedImage,
      discount,
      isActive,
      isTemporarilyUnavailable,
    };

    if (supportsVariants) {
      productPayload.variants = normalizedVariants.length > 0 ? serializeVariants(normalizedVariants) : null;
    }

    await product.update(productPayload);
    await recordRestockEvent({
      vendorId: product.vendor_id,
      productId: product.id,
      productName: name || product.name,
      previousStock,
      nextStock: resolvedStock,
      changeType: Number(resolvedStock) > previousStock ? 'restock' : 'stock_adjustment',
      source: 'update',
      previousVariants,
      nextVariants: normalizedVariants,
    });

    res.json({ success: true, message: 'Product updated', product: attachVariantSummary(product.toJSON()) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id/temporarily-unavailable - Vendor (own) or Admin
const toggleTemporarilyUnavailable = async (req, res, next) => {
  try {
    const productAttributes = await getProductAttributes();
    if (!productAttributes.includes('isTemporarilyUnavailable')) {
      return res.status(400).json({ success: false, message: 'Temporary availability is not enabled for products' });
    }

    const product = await Product.findByPk(req.params.id, {
      attributes: productAttributes,
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (req.user.role === 'vendor' && product.vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this product' });
    }

    const requestedState = req.body?.isTemporarilyUnavailable;
    const nextState = typeof requestedState === 'boolean'
      ? requestedState
      : !Boolean(product.isTemporarilyUnavailable);

    await product.update({ isTemporarilyUnavailable: nextState });
    res.json({
      success: true,
      message: nextState ? 'Product marked temporarily unavailable' : 'Product marked available',
      product: attachVariantSummary(product.toJSON()),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id - Vendor (own) or Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      attributes: await getProductAttributes(),
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (req.user.role === 'vendor' && product.vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await removeLocalUpload(product.image);
    await product.update({ isActive: false });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/vendor/my-products - Vendor
const getVendorProducts = async (req, res, next) => {
  try {
    const productAttributes = await getProductAttributes();
    const products = await Product.findAll({
      attributes: productAttributes,
      where: { vendor_id: req.user.id },
      include: [{ model: Review, as: 'reviews', attributes: ['rating'] }],
      order: [['createdAt', 'DESC']],
    });

    const result = products.map((p) => {
      const prod = attachVariantSummary(p.toJSON());
      const ratings = prod.reviews.map((r) => r.rating);
      prod.avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
      prod.reviewCount = ratings.length;
      delete prod.reviews;
      return prod;
    });

    res.json({ success: true, products: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/vendor/restock-history - Vendor
const getVendorRestockHistoryFeed = async (req, res, next) => {
  try {
    const history = await getVendorRestockHistory(req.user.id);
    res.json({ success: true, history });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: { isActive: true, category: { [Op.ne]: null } },
    });
    res.json({ success: true, categories: categories.map((c) => c.category) });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/brands
const getBrands = async (req, res, next) => {
  try {
    if (!(await hasTableColumn('products', 'brand'))) {
      return res.json({ success: true, brands: [] });
    }

    const brands = await Product.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand')), 'brand']],
      where: { isActive: true, brand: { [Op.ne]: null } },
      order: [['brand', 'ASC']],
    });
    res.json({
      success: true,
      brands: brands.map((item) => item.brand).filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  getVendorRestockHistoryFeed,
  getCategories,
  getBrands,
  getProductSearchSuggestions,
  toggleTemporarilyUnavailable,
};
