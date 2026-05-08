const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const normalizeVendorCampaignPayload = (payload = {}) => {
  const normalized = { ...payload };

  ['name', 'description', 'target_category'].forEach((field) => {
    if (normalized[field] !== undefined) {
      const trimmed = String(normalized[field] || '').trim();
      normalized[field] = trimmed || null;
    }
  });

  ['starts_at', 'expires_at'].forEach((field) => {
    if (normalized[field] === '') normalized[field] = null;
  });

  ['target_product_id', 'buy_quantity', 'free_quantity'].forEach((field) => {
    if (normalized[field] === '' || normalized[field] === undefined) {
      normalized[field] = null;
    } else {
      normalized[field] = toInteger(normalized[field], null);
    }
  });

  if (normalized.discount_percentage === '' || normalized.discount_percentage === undefined) {
    normalized.discount_percentage = null;
  } else {
    normalized.discount_percentage = toNumber(normalized.discount_percentage, null);
  }

  if (normalized.target_scope !== 'category') {
    normalized.target_category = null;
  }

  if (normalized.target_scope !== 'product') {
    normalized.target_product_id = null;
  }

  if (normalized.campaign_type !== 'catalog_sale') {
    normalized.discount_percentage = null;
  }

  if (normalized.campaign_type !== 'buy_x_get_y') {
    normalized.buy_quantity = null;
    normalized.free_quantity = null;
  }

  return normalized;
};

const getVendorCampaignLifecycle = (campaign, now = new Date()) => {
  if (!campaign.is_active) return 'inactive';
  if (campaign.starts_at && now < new Date(campaign.starts_at)) return 'scheduled';
  if (campaign.expires_at && now > new Date(campaign.expires_at)) return 'expired';
  return 'active';
};

const getItemProductId = (item) => Number(item.product_id || item.id || item.product?.id || 0) || null;
const getItemQuantity = (item) => Math.max(toInteger(item.quantity, 0), 0);
const getItemPrice = (item, product) => {
  const direct = toNumber(item.price, NaN);
  if (Number.isFinite(direct)) return direct;
  return toNumber(product?.price, 0);
};

const matchesTarget = (campaign, product) => {
  if (!product || Number(product.vendor_id) !== Number(campaign.vendor_id)) return false;

  if (campaign.target_scope === 'all_products') return true;
  if (campaign.target_scope === 'category') {
    return String(product.category || '').trim().toLowerCase() === String(campaign.target_category || '').trim().toLowerCase();
  }
  if (campaign.target_scope === 'product') {
    return Number(product.id) === Number(campaign.target_product_id);
  }
  return false;
};

const buildCampaignLabel = (campaign, product) => {
  if (campaign.campaign_type === 'buy_x_get_y') {
    return `Buy ${campaign.buy_quantity} Get ${campaign.free_quantity}`;
  }

  if (campaign.target_scope === 'all_products') {
    return `${toNumber(campaign.discount_percentage, 0)}% festival sale`;
  }

  if (campaign.target_scope === 'category') {
    return `${toNumber(campaign.discount_percentage, 0)}% off ${campaign.target_category || 'category'}`;
  }

  return `${toNumber(campaign.discount_percentage, 0)}% off ${product?.name || 'product'}`;
};

const evaluateCampaignDiscount = ({ campaign, item, product }) => {
  const quantity = getItemQuantity(item);
  const unitPrice = getItemPrice(item, product);

  if (quantity <= 0 || unitPrice <= 0) return 0;

  if (campaign.campaign_type === 'catalog_sale') {
    return Number(((unitPrice * quantity) * (toNumber(campaign.discount_percentage, 0) / 100)).toFixed(2));
  }

  if (campaign.campaign_type === 'buy_x_get_y') {
    const bundleSize = Math.max(toInteger(campaign.buy_quantity, 0) + toInteger(campaign.free_quantity, 0), 0);
    if (bundleSize <= 0) return 0;
    const freeUnits = Math.floor(quantity / bundleSize) * Math.max(toInteger(campaign.free_quantity, 0), 0);
    return Number((freeUnits * unitPrice).toFixed(2));
  }

  return 0;
};

const evaluateCampaignPricing = ({ items = [], products = [], campaigns = [] }) => {
  const now = new Date();
  const activeCampaigns = campaigns.filter((campaign) => getVendorCampaignLifecycle(campaign, now) === 'active');
  const productMap = new Map(products.map((product) => [Number(product.id), product]));
  const lineAdjustments = [];
  const chosenCampaignMap = new Map();
  let subtotal = 0;
  let discountAmount = 0;

  items.forEach((item, index) => {
    const product = productMap.get(getItemProductId(item));
    const quantity = getItemQuantity(item);
    const unitPrice = getItemPrice(item, product);
    const lineSubtotal = Number((unitPrice * quantity).toFixed(2));
    subtotal += lineSubtotal;

    if (!product) {
      lineAdjustments.push({
        lineIndex: index,
        product_id: getItemProductId(item),
        product_name: item.name || 'Product',
        lineSubtotal,
        discountAmount: 0,
        campaign: null,
      });
      return;
    }

    const matchingCampaigns = activeCampaigns.filter((campaign) => matchesTarget(campaign, product));
    let bestCampaign = null;
    let bestDiscount = 0;

    matchingCampaigns.forEach((campaign) => {
      const currentDiscount = evaluateCampaignDiscount({ campaign, item, product });
      if (currentDiscount > bestDiscount) {
        bestDiscount = currentDiscount;
        bestCampaign = campaign;
      }
    });

    discountAmount += bestDiscount;
    if (bestCampaign) {
      chosenCampaignMap.set(bestCampaign.id, bestCampaign);
    }

    lineAdjustments.push({
      lineIndex: index,
      product_id: Number(product.id),
      product_name: product.name,
      lineSubtotal,
      discountAmount: Number(bestDiscount.toFixed(2)),
      campaign: bestCampaign ? {
        id: bestCampaign.id,
        name: bestCampaign.name,
        label: buildCampaignLabel(bestCampaign, product),
        campaign_type: bestCampaign.campaign_type,
      } : null,
    });
  });

  const appliedCampaigns = Array.from(chosenCampaignMap.values()).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    campaign_type: campaign.campaign_type,
    target_scope: campaign.target_scope,
    label: buildCampaignLabel(campaign),
  }));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    finalTotal: Number((subtotal - discountAmount).toFixed(2)),
    appliedCampaigns,
    lineAdjustments,
  };
};

module.exports = {
  normalizeVendorCampaignPayload,
  getVendorCampaignLifecycle,
  evaluateCampaignPricing,
};
