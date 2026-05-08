const { VendorCampaign, Product } = require('../models');
const {
  normalizeVendorCampaignPayload,
  getVendorCampaignLifecycle,
} = require('../utils/vendorCampaigns');

const serializeCampaign = (campaign) => {
  const record = campaign.toJSON ? campaign.toJSON() : campaign;
  return {
    ...record,
    lifecycle: getVendorCampaignLifecycle(record),
  };
};

const validateCampaignPayload = async (payload, vendorId, campaignId = null) => {
  if (!payload.name) {
    const error = new Error('Campaign name is required');
    error.statusCode = 400;
    throw error;
  }

  if (!['catalog_sale', 'buy_x_get_y'].includes(payload.campaign_type)) {
    const error = new Error('Invalid campaign type');
    error.statusCode = 400;
    throw error;
  }

  if (!['all_products', 'category', 'product'].includes(payload.target_scope)) {
    const error = new Error('Invalid target scope');
    error.statusCode = 400;
    throw error;
  }

  if (payload.campaign_type === 'catalog_sale') {
    if (!Number.isFinite(Number(payload.discount_percentage)) || Number(payload.discount_percentage) <= 0 || Number(payload.discount_percentage) > 90) {
      const error = new Error('Discount percentage must be between 1 and 90');
      error.statusCode = 400;
      throw error;
    }
  }

  if (payload.campaign_type === 'buy_x_get_y') {
    if (!Number.isInteger(payload.buy_quantity) || payload.buy_quantity < 1) {
      const error = new Error('Buy quantity must be at least 1');
      error.statusCode = 400;
      throw error;
    }
    if (!Number.isInteger(payload.free_quantity) || payload.free_quantity < 1) {
      const error = new Error('Free quantity must be at least 1');
      error.statusCode = 400;
      throw error;
    }
  }

  if (payload.target_scope === 'category' && !payload.target_category) {
    const error = new Error('Choose a target category');
    error.statusCode = 400;
    throw error;
  }

  if (payload.target_scope === 'product') {
    if (!payload.target_product_id) {
      const error = new Error('Choose a target product');
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findOne({
      where: {
        id: payload.target_product_id,
        vendor_id: vendorId,
      },
      attributes: ['id'],
    });

    if (!product) {
      const error = new Error('Target product not found for this vendor');
      error.statusCode = 404;
      throw error;
    }
  }

  if (payload.starts_at && payload.expires_at && new Date(payload.expires_at) <= new Date(payload.starts_at)) {
    const error = new Error('Expiry must be after the start date');
    error.statusCode = 400;
    throw error;
  }

  const overlapWhere = {
    vendor_id: vendorId,
    name: payload.name,
  };

  const existing = await VendorCampaign.findOne({ where: overlapWhere });
  if (existing && Number(existing.id) !== Number(campaignId)) {
    const error = new Error('A campaign with this name already exists');
    error.statusCode = 400;
    throw error;
  }
};

const getVendorCampaigns = async (req, res, next) => {
  try {
    const campaigns = await VendorCampaign.findAll({
      where: { vendor_id: req.user.id },
      include: [{ model: Product, as: 'targetProduct', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, campaigns: campaigns.map(serializeCampaign) });
  } catch (error) {
    next(error);
  }
};

const createVendorCampaign = async (req, res, next) => {
  try {
    const payload = normalizeVendorCampaignPayload(req.body);
    payload.vendor_id = req.user.id;
    await validateCampaignPayload(payload, req.user.id);

    const campaign = await VendorCampaign.create(payload);
    const created = await VendorCampaign.findByPk(campaign.id, {
      include: [{ model: Product, as: 'targetProduct', attributes: ['id', 'name'] }],
    });
    res.status(201).json({
      success: true,
      message: 'Campaign created',
      campaign: serializeCampaign(created),
    });
  } catch (error) {
    next(error);
  }
};

const updateVendorCampaign = async (req, res, next) => {
  try {
    const campaign = await VendorCampaign.findOne({
      where: {
        id: req.params.id,
        vendor_id: req.user.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const payload = normalizeVendorCampaignPayload(req.body);
    payload.vendor_id = req.user.id;
    await validateCampaignPayload(payload, req.user.id, campaign.id);

    await campaign.update(payload);
    const updated = await VendorCampaign.findByPk(campaign.id, {
      include: [{ model: Product, as: 'targetProduct', attributes: ['id', 'name'] }],
    });
    res.json({
      success: true,
      message: 'Campaign updated',
      campaign: serializeCampaign(updated),
    });
  } catch (error) {
    next(error);
  }
};

const toggleVendorCampaignStatus = async (req, res, next) => {
  try {
    const campaign = await VendorCampaign.findOne({
      where: {
        id: req.params.id,
        vendor_id: req.user.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    await campaign.update({ is_active: !campaign.is_active });
    const updated = await VendorCampaign.findByPk(campaign.id, {
      include: [{ model: Product, as: 'targetProduct', attributes: ['id', 'name'] }],
    });
    res.json({
      success: true,
      message: `Campaign ${campaign.is_active ? 'activated' : 'paused'}`,
      campaign: serializeCampaign(updated),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVendorCampaigns,
  createVendorCampaign,
  updateVendorCampaign,
  toggleVendorCampaignStatus,
};
