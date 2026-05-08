import React, { useMemo, useState } from 'react';

const initialForm = {
  name: '',
  description: '',
  campaign_type: 'catalog_sale',
  target_scope: 'all_products',
  target_category: '',
  target_product_id: '',
  discount_percentage: 15,
  buy_quantity: 2,
  free_quantity: 1,
  starts_at: '',
  expires_at: '',
  is_active: true,
};

const toDatetimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const normalizeForForm = (campaign) => ({
  name: campaign.name || '',
  description: campaign.description || '',
  campaign_type: campaign.campaign_type || 'catalog_sale',
  target_scope: campaign.target_scope || 'all_products',
  target_category: campaign.target_category || '',
  target_product_id: campaign.target_product_id ?? '',
  discount_percentage: campaign.discount_percentage ?? 15,
  buy_quantity: campaign.buy_quantity ?? 2,
  free_quantity: campaign.free_quantity ?? 1,
  starts_at: toDatetimeLocal(campaign.starts_at),
  expires_at: toDatetimeLocal(campaign.expires_at),
  is_active: campaign.is_active ?? true,
});

const lifecycleTone = {
  active: 'healthy',
  scheduled: 'warning',
  expired: 'critical',
  inactive: 'inactive',
};

const formatCampaignHeadline = (campaign) => {
  if (campaign.campaign_type === 'buy_x_get_y') {
    return `Buy ${campaign.buy_quantity} Get ${campaign.free_quantity}`;
  }

  return `${Number(campaign.discount_percentage || 0)}% off`;
};

const formatCampaignTarget = (campaign) => {
  if (campaign.target_scope === 'all_products') return 'Entire storefront';
  if (campaign.target_scope === 'category') return campaign.target_category || 'Category';
  return campaign.targetProduct?.name || `Product #${campaign.target_product_id}`;
};

const VendorCampaignManager = ({
  campaigns,
  products,
  onCreate,
  onUpdate,
  onToggleStatus,
}) => {
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const activeCount = campaigns.filter((campaign) => campaign.lifecycle === 'active').length;
  const scheduledCount = campaigns.filter((campaign) => campaign.lifecycle === 'scheduled').length;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onCreate(form);
      }
      setForm(initialForm);
      setEditingId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (campaign) => {
    setEditingId(campaign.id);
    setForm(normalizeForForm(campaign));
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  return (
    <section className="campaign-manager-grid">
      <div className="campaign-manager-main">
        <div className="campaign-summary-grid">
          <div className="card campaign-summary-card">
            <span>Total campaigns</span>
            <strong>{campaigns.length}</strong>
          </div>
          <div className="card campaign-summary-card success">
            <span>Live now</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="card campaign-summary-card warning">
            <span>Scheduled</span>
            <strong>{scheduledCount}</strong>
          </div>
          <div className="card campaign-summary-card info">
            <span>Buy X Get Y</span>
            <strong>{campaigns.filter((campaign) => campaign.campaign_type === 'buy_x_get_y').length}</strong>
          </div>
        </div>

        <div className="card campaign-list-card">
          <div className="analytics-card-header">
            <div>
              <h3>Campaigns</h3>
              <p>Run store-wide festival sales, category discounts, or buy X get Y offers.</p>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <div className="analytics-empty">No campaigns yet. Create your first promotion below.</div>
          ) : (
            <div className="campaign-list">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="campaign-row">
                  <div className="campaign-row-main">
                    <div className="campaign-row-head">
                      <strong>{campaign.name}</strong>
                      <span className={`badge badge-${lifecycleTone[campaign.lifecycle] || 'warning'}`}>{campaign.lifecycle}</span>
                    </div>
                    <div className="campaign-row-meta">
                      <span>{formatCampaignHeadline(campaign)}</span>
                      <span>{formatCampaignTarget(campaign)}</span>
                      <span>{campaign.starts_at ? `Starts ${new Date(campaign.starts_at).toLocaleDateString()}` : 'Starts now'}</span>
                      <span>{campaign.expires_at ? `Ends ${new Date(campaign.expires_at).toLocaleDateString()}` : 'No expiry'}</span>
                    </div>
                    {campaign.description && <p>{campaign.description}</p>}
                  </div>
                  <div className="action-btns">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleEdit(campaign)}>Edit</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => onToggleStatus(campaign.id)}>
                      {campaign.is_active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="card campaign-form-panel">
        <div className="analytics-card-header">
          <div>
            <h3>{editingId ? `Edit Campaign #${editingId}` : 'Create Campaign'}</h3>
            <p>Customers get these discounts automatically in cart when the campaign is active.</p>
          </div>
        </div>

        <form className="coupon-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Campaign Name</label>
            <input className="form-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows="2" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>

          <div className="coupon-form-grid">
            <div className="form-group">
              <label className="form-label">Campaign Type</label>
              <select className="form-input form-select" value={form.campaign_type} onChange={(event) => setForm((current) => ({ ...current, campaign_type: event.target.value }))}>
                <option value="catalog_sale">Percentage Sale</option>
                <option value="buy_x_get_y">Buy X Get Y</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target</label>
              <select className="form-input form-select" value={form.target_scope} onChange={(event) => setForm((current) => ({ ...current, target_scope: event.target.value }))}>
                <option value="all_products">Entire Store</option>
                <option value="category">Category</option>
                <option value="product">Single Product</option>
              </select>
            </div>

            {form.campaign_type === 'catalog_sale' ? (
              <div className="form-group">
                <label className="form-label">Discount Percentage</label>
                <input className="form-input" type="number" min="1" max="90" value={form.discount_percentage} onChange={(event) => setForm((current) => ({ ...current, discount_percentage: event.target.value }))} required />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Buy Quantity</label>
                  <input className="form-input" type="number" min="1" value={form.buy_quantity} onChange={(event) => setForm((current) => ({ ...current, buy_quantity: event.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Free Quantity</label>
                  <input className="form-input" type="number" min="1" value={form.free_quantity} onChange={(event) => setForm((current) => ({ ...current, free_quantity: event.target.value }))} required />
                </div>
              </>
            )}

            {form.target_scope === 'category' && (
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input form-select" value={form.target_category} onChange={(event) => setForm((current) => ({ ...current, target_category: event.target.value }))} required>
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
            )}

            {form.target_scope === 'product' && (
              <div className="form-group">
                <label className="form-label">Product</label>
                <select className="form-input form-select" value={form.target_product_id} onChange={(event) => setForm((current) => ({ ...current, target_product_id: event.target.value }))} required>
                  <option value="">Select product</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Starts At</label>
              <input className="form-input" type="datetime-local" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Expires At</label>
              <input className="form-input" type="datetime-local" value={form.expires_at} onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value }))} />
            </div>
          </div>

          <label className="coupon-checkbox">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
            <span>Campaign is active</span>
          </label>

          <div className="action-btns">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update Campaign' : 'Create Campaign'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={handleCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </aside>
    </section>
  );
};

export default VendorCampaignManager;
