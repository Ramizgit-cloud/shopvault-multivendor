import React, { useMemo, useState } from 'react';

const initialForm = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
  min_order_amount: 0,
  max_discount: '',
  usage_limit: '',
  usage_limit_per_user: '',
  starts_at: '',
  expires_at: '',
  is_active: true,
  vendor_id: '',
};

const formatMoney = (value) => `Rs ${Number.parseFloat(value || 0).toFixed(2)}`;

const toDatetimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const normalizeForForm = (coupon) => ({
  code: coupon.code || '',
  description: coupon.description || '',
  discount_type: coupon.discount_type || 'percentage',
  discount_value: coupon.discount_value ?? 10,
  min_order_amount: coupon.min_order_amount ?? 0,
  max_discount: coupon.max_discount ?? '',
  usage_limit: coupon.usage_limit ?? '',
  usage_limit_per_user: coupon.usage_limit_per_user ?? '',
  starts_at: toDatetimeLocal(coupon.starts_at),
  expires_at: toDatetimeLocal(coupon.expires_at),
  is_active: coupon.is_active ?? true,
  vendor_id: coupon.vendor_id ?? '',
});

const CouponManagement = ({
  coupons,
  analytics,
  vendors,
  onCreate,
  onUpdate,
  onToggleStatus,
}) => {
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const summary = analytics?.summary || {};
  const topCoupons = analytics?.topCoupons || [];
  const vendorBreakdown = analytics?.vendorBreakdown || [];
  const recentRedemptions = analytics?.recentRedemptions || [];

  const formTitle = editingId ? `Edit Coupon #${editingId}` : 'Create Coupon';
  const sortedVendors = useMemo(
    () => [...vendors].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [vendors],
  );

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

  const handleEdit = (coupon) => {
    setEditingId(coupon.id);
    setForm(normalizeForForm(coupon));
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  return (
    <div className="coupon-admin-layout">
      <div className="coupon-admin-main">
        <div className="coupon-summary-grid">
          <div className="card coupon-summary-card">
            <span>Total coupons</span>
            <strong>{summary.totalCoupons || 0}</strong>
          </div>
          <div className="card coupon-summary-card success">
            <span>Active coupons</span>
            <strong>{summary.activeCoupons || 0}</strong>
          </div>
          <div className="card coupon-summary-card warning">
            <span>Expiring soon</span>
            <strong>{summary.statusBuckets?.expiringSoon || 0}</strong>
          </div>
          <div className="card coupon-summary-card info">
            <span>Vendor coupons</span>
            <strong>{summary.statusBuckets?.vendorScoped || 0}</strong>
          </div>
          <div className="card coupon-summary-card">
            <span>Total redemptions</span>
            <strong>{summary.totalRedemptions || 0}</strong>
          </div>
          <div className="card coupon-summary-card success">
            <span>Discount given</span>
            <strong>{formatMoney(summary.totalDiscountGiven || 0)}</strong>
          </div>
        </div>

        <div className="products-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Coupon</th>
                <th>Scope</th>
                <th>Discount</th>
                <th>Limits</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <div className="review-admin-cell">
                      <strong>{coupon.code}</strong>
                      <div className="table-muted">{coupon.description || 'No description'}</div>
                    </div>
                  </td>
                  <td>
                    <div className="review-admin-cell">
                      <strong>{coupon.status?.scope === 'vendor' ? 'Vendor specific' : 'Platform-wide'}</strong>
                      <div className="table-muted">{coupon.vendor?.name || 'All vendors'}</div>
                    </div>
                  </td>
                  <td>
                    <div className="review-admin-cell">
                      <strong>
                        {coupon.discount_type === 'percentage'
                          ? `${Number(coupon.discount_value)}% off`
                          : formatMoney(coupon.discount_value)}
                      </strong>
                      <div className="table-muted">
                        Min {formatMoney(coupon.min_order_amount)}{coupon.max_discount ? ` · Max ${formatMoney(coupon.max_discount)}` : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="review-admin-cell">
                      <strong>{coupon.used_count}/{coupon.usage_limit ?? '∞'}</strong>
                      <div className="table-muted">Per user: {coupon.usage_limit_per_user ?? '∞'}</div>
                    </div>
                  </td>
                  <td>
                    <div className="review-admin-cell">
                      <strong>{coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : 'No expiry'}</strong>
                      <div className="table-muted">
                        {coupon.starts_at ? `Starts ${new Date(coupon.starts_at).toLocaleDateString()}` : 'Available immediately'}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="table-risk-stack">
                      <span className={`badge badge-${
                        coupon.status?.lifecycle === 'active'
                          ? 'healthy'
                          : coupon.status?.lifecycle === 'expired' || coupon.status?.lifecycle === 'used_up'
                            ? 'critical'
                            : 'warning'
                      }`}
                      >
                        {coupon.status?.lifecycle || 'unknown'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-outline btn-sm" onClick={() => handleEdit(coupon)}>Edit</button>
                      <button className="btn btn-primary btn-sm" onClick={() => onToggleStatus(coupon.id)}>
                        {coupon.is_active ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="coupon-report-grid">
          <div className="card analytics-card">
            <div className="analytics-card-header">
              <div>
                <h2 className="panel-header-title">Top Coupons</h2>
                <p className="panel-subtitle">Highest redemption and discount impact.</p>
              </div>
            </div>
            <div className="monthly-list">
              {topCoupons.length === 0 ? (
                <div className="table-muted">No coupon usage yet.</div>
              ) : topCoupons.map((coupon) => (
                <div key={coupon.id} className="monthly-row">
                  <div>
                    <div className="monthly-month">{coupon.code}</div>
                    <div className="monthly-orders">{coupon.used_count} uses · Avg discount {formatMoney(coupon.avg_discount)}</div>
                  </div>
                  <div className="monthly-revenue">{formatMoney(coupon.total_discount)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card analytics-card">
            <div className="analytics-card-header">
              <div>
                <h2 className="panel-header-title">Vendor Breakdown</h2>
                <p className="panel-subtitle">How vendor-specific coupon programs are performing.</p>
              </div>
            </div>
            <div className="monthly-list">
              {vendorBreakdown.length === 0 ? (
                <div className="table-muted">No vendor-specific coupons yet.</div>
              ) : vendorBreakdown.map((vendor) => (
                <div key={vendor.vendor_id} className="monthly-row">
                  <div>
                    <div className="monthly-month">{vendor.vendor_name}</div>
                    <div className="monthly-orders">{vendor.coupon_count} coupons</div>
                  </div>
                  <div className="monthly-revenue">{vendor.used_count} uses</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card analytics-card coupon-report-full">
            <div className="analytics-card-header">
              <div>
                <h2 className="panel-header-title">Recent Redemptions</h2>
                <p className="panel-subtitle">Latest coupon applications and consumption state.</p>
              </div>
            </div>
            <div className="monthly-list">
              {recentRedemptions.length === 0 ? (
                <div className="table-muted">No redemptions recorded yet.</div>
              ) : recentRedemptions.map((redemption) => (
                <div key={redemption.id} className="monthly-row">
                  <div>
                    <div className="monthly-month">{redemption.coupon_code}</div>
                    <div className="monthly-orders">
                      {redemption.vendor?.name || 'Platform-wide'} · {redemption.is_consumed ? 'Consumed' : 'Reserved'}
                    </div>
                  </div>
                  <div className="monthly-revenue">{formatMoney(redemption.discount_amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="card coupon-form-panel">
        <div className="analytics-card-header">
          <div>
            <h2 className="panel-header-title">{formTitle}</h2>
            <p className="panel-subtitle">Manage usage limits, scope, expiry, and discount rules.</p>
          </div>
        </div>

        <form className="coupon-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Code</label>
            <input className="form-input" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows="2" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <div className="coupon-form-grid">
            <div className="form-group">
              <label className="form-label">Discount Type</label>
              <select className="form-input form-select" value={form.discount_type} onChange={(event) => setForm((current) => ({ ...current, discount_type: event.target.value }))}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Discount Value</label>
              <input className="form-input" type="number" min="0" value={form.discount_value} onChange={(event) => setForm((current) => ({ ...current, discount_value: event.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Order</label>
              <input className="form-input" type="number" min="0" value={form.min_order_amount} onChange={(event) => setForm((current) => ({ ...current, min_order_amount: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Discount</label>
              <input className="form-input" type="number" min="0" value={form.max_discount} onChange={(event) => setForm((current) => ({ ...current, max_discount: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Usage Limit</label>
              <input className="form-input" type="number" min="1" value={form.usage_limit} onChange={(event) => setForm((current) => ({ ...current, usage_limit: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Per-user Limit</label>
              <input className="form-input" type="number" min="1" value={form.usage_limit_per_user} onChange={(event) => setForm((current) => ({ ...current, usage_limit_per_user: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Starts At</label>
              <input className="form-input" type="datetime-local" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Expires At</label>
              <input className="form-input" type="datetime-local" value={form.expires_at} onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Coupon Scope</label>
            <select className="form-input form-select" value={form.vendor_id} onChange={(event) => setForm((current) => ({ ...current, vendor_id: event.target.value }))}>
              <option value="">Platform-wide</option>
              {sortedVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </div>

          <label className="coupon-checkbox">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />
            <span>Coupon is active</span>
          </label>

          <div className="action-btns">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={handleCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
};

export default CouponManagement;
