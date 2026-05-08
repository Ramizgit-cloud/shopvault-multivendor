import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import VendorCampaignManager from '../components/VendorCampaignManager';
import { orderAPI, productAPI, vendorAPI } from '../services/api';
import './VendorDashboard.css';

const LOW_STOCK_THRESHOLD = 10;

const emptyProductForm = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: '',
  brand: '',
  image: '',
  discount: 0,
  variants: [],
};

const formatCurrency = (value) => `Rs ${parseFloat(value || 0).toFixed(2)}`;

const formatMonthLabel = (monthValue) => {
  if (!monthValue) return '';
  const [year, month] = String(monthValue).split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
};

const formatTrendDelta = (current, previous) => {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  if (previousValue === 0) return currentValue === 0 ? 'No change' : '+100% vs prev 30d';
  const percent = ((currentValue - previousValue) / previousValue) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(0)}% vs prev 30d`;
};

const VendorDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [restockHistory, setRestockHistory] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const isApprovedVendor = user?.role === 'vendor' ? Boolean(user.isApproved) : false;
  const isPendingVendor = user?.role === 'vendor' && !user?.isApproved;

  const monthlySales = earnings?.monthly || [];
  const bestSellers = earnings?.bestSellers || [];
  const payoutSummary = earnings?.payoutSummary || {};
  const payoutRecords = earnings?.payoutRecords || [];
  const conversionStats = earnings?.conversionStats || {};
  const inventoryHealth = earnings?.inventoryHealth || {};
  const recentTrend = earnings?.orderTrends?.last30Days || {};
  const statusBreakdown = earnings?.orderTrends?.statusBreakdown || [];
  const maxMonthlyEarnings = monthlySales.reduce((max, item) => Math.max(max, Number(item.earnings || 0)), 0);
  const settlementHistory = earnings?.settlementHistory || [];

  const lowStockProducts = products.filter((product) => product.isActive && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD);
  const outOfStockProducts = products.filter((product) => product.isActive && product.stock === 0);

  const returnOrders = useMemo(() => orders.filter((item) => item.order?.returnRequest?.status && item.order.returnRequest.status !== 'none'), [orders]);

  const fetchProducts = () => {
    if (!isApprovedVendor) return;
    setLoading(true);
    Promise.all([productAPI.getMyProducts(), productAPI.getRestockHistory(), vendorAPI.getCampaigns()])
      .then(([productResponse, historyResponse, campaignResponse]) => {
        setProducts(productResponse.data.products || []);
        setRestockHistory(historyResponse.data.history || []);
        setCampaigns(campaignResponse.data.campaigns || []);
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  };

  const fetchOrders = () => {
    if (!isApprovedVendor) return;
    setLoading(true);
    orderAPI.getVendorOrders()
      .then((response) => setOrders(response.data.orderItems || []))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  const fetchEarnings = () => {
    if (!isApprovedVendor) return;
    orderAPI.getVendorEarnings()
      .then((response) => setEarnings(response.data))
      .catch(() => {});
  };

  useEffect(() => {
    if (isPendingVendor) return;
    fetchProducts();
    fetchEarnings();
  }, [isPendingVendor]);

  useEffect(() => {
    if (tab === 'orders') fetchOrders();
  }, [tab]);

  const openForm = (product = null) => {
    if (product) {
      setEditProduct(product);
      setForm({
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        stock: product.stock || '',
        category: product.category || '',
        brand: product.brand || '',
        image: product.image || '',
        discount: product.discount || 0,
        variants: [],
      });
    } else {
      setEditProduct(null);
      setForm(emptyProductForm);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditProduct(null);
    setForm(emptyProductForm);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      if (editProduct) {
        await productAPI.update(editProduct.id, form);
        toast.success('Product updated');
      } else {
        await productAPI.create(form);
        toast.success('Product created');
      }
      closeForm();
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save product');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productAPI.delete(id);
      toast.success('Product deleted');
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleCreateCampaign = async (payload) => {
    try {
      await vendorAPI.createCampaign(payload);
      toast.success('Campaign created');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    }
  };

  const handleUpdateCampaign = async (id, payload) => {
    try {
      await vendorAPI.updateCampaign(id, payload);
      toast.success('Campaign updated');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update campaign');
    }
  };

  const handleToggleCampaignStatus = async (id) => {
    try {
      await vendorAPI.toggleCampaignStatus(id);
      toast.success('Campaign status updated');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update campaign status');
    }
  };

  const handleRequestPayout = async () => {
    setRequestingPayout(true);
    try {
      await orderAPI.requestVendorPayout();
      toast.success('Payout request created');
      fetchEarnings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create payout request');
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleOrderStatus = async (orderId, status) => {
    try {
      await orderAPI.updateStatus(orderId, status);
      toast.success('Status updated');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  if (isPendingVendor) {
    return (
      <div className="container page-content">
        <div className="card vendor-pending-card">
          <h1 className="page-title">Vendor account pending approval</h1>
          <p>Your vendor account is not approved yet. Once approved, you will be able to manage products, view orders, and access your earnings dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content vendor-dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1 className="page-title">Vendor Dashboard</h1>
        </div>
        {earnings && (
          <div className="earnings-summary">
            <div className="earning-stat">
              <span className="earning-num">{formatCurrency(earnings.earnings?.total_earnings)}</span>
              <span className="earning-label">Total Earnings</span>
            </div>
            <div className="earning-stat">
              <span className="earning-num">{earnings.earnings?.total_orders || 0}</span>
              <span className="earning-label">Orders</span>
            </div>
            <div className="earning-stat">
              <span className="earning-num">{earnings.earnings?.total_items_sold || 0}</span>
              <span className="earning-label">Items Sold</span>
            </div>
          </div>
        )}
      </div>

      {user?.id && (
        <Link to={`/vendors/${user.id}`} className="btn btn-outline btn-sm seller-storefront-action">
          View Storefront
        </Link>
      )}

      <div className="dash-tabs">
        <button className={`dash-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')} type="button">Products</button>
        <button className={`dash-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')} type="button">Orders</button>
      </div>

      {tab === 'products' ? (
        <div className="dash-panel">
          <div className="panel-header">
            <h2>My Products ({products.length})</h2>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openForm()}>
              + Add Product
            </button>
          </div>

          <VendorCampaignManager
            campaigns={campaigns}
            products={products}
            onCreate={handleCreateCampaign}
            onUpdate={handleUpdateCampaign}
            onToggleStatus={handleToggleCampaignStatus}
          />

          {showForm && (
            <form onSubmit={handleSave} className="product-form card">
              <h3>{editProduct ? 'Edit Product' : 'New Product'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (Rs) *</label>
                  <input className="form-input" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock</label>
                  <input className="form-input" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <input className="form-input" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
                </div>
                <div className="form-group image-mode-group">
                  <label className="form-label">Image URL</label>
                  <input className="form-input" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
                </div>
                <div className="form-group image-mode-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editProduct ? 'Update' : 'Create'}</button>
                <button type="button" className="btn btn-outline" onClick={closeForm}>Cancel</button>
              </div>
            </form>
          )}

          {earnings && (
            <div className="inventory-health-grid">
              <div className="inventory-health-card card">
                <span className="inventory-health-label">Active Products</span>
                <strong>{inventoryHealth.active_products || 0}</strong>
                <small>{inventoryHealth.total_stock_units || 0} units currently in stock</small>
              </div>
              <div className="inventory-health-card warning card">
                <span className="inventory-health-label">Low Stock Products</span>
                <strong>{inventoryHealth.low_stock_products || lowStockProducts.length}</strong>
                <small>Items at or below {LOW_STOCK_THRESHOLD} units</small>
              </div>
              <div className="inventory-health-card danger card">
                <span className="inventory-health-label">Out of Stock</span>
                <strong>{inventoryHealth.out_of_stock_products || outOfStockProducts.length}</strong>
                <small>Products unavailable for checkout</small>
              </div>
            </div>
          )}

          <div className="restock-history-card card">
            <div className="analytics-card-header">
              <div>
                <h3>Inventory History</h3>
                <p>Track stock updates from restocks, adjustments, and customer orders.</p>
              </div>
              <span className="analytics-chip">{restockHistory.length} events</span>
            </div>
            {restockHistory.length > 0 ? (
              <div className="restock-history-list">
                {restockHistory.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="restock-row">
                    <div>
                      <div className="restock-row-top">
                        <strong>{entry.product_name}</strong>
                        <span className="restock-type-pill adjustment">{entry.change_type}</span>
                      </div>
                      <span className="restock-row-meta">{entry.previous_stock} to {entry.next_stock}</span>
                    </div>
                    <div className={`restock-delta ${entry.delta >= 0 ? 'positive' : 'negative'}`}>{entry.delta >= 0 ? '+' : ''}{entry.delta}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="analytics-empty">Inventory movements will appear here after your first stock update or sale.</div>
            )}
          </div>

          {earnings && (
            <>
              <div className="payout-summary-grid">
                <div className="payout-card pending">
                  <span className="payout-label">Pending Payouts</span>
                  <strong>{formatCurrency(payoutSummary.pending_payouts)}</strong>
                  <small>{payoutSummary.pending_requests || 0} payout batches are awaiting settlement</small>
                </div>
                <div className="payout-card settled">
                  <span className="payout-label">Paid Out</span>
                  <strong>{formatCurrency(payoutSummary.paid_out)}</strong>
                  <small>{payoutSummary.settled_payouts || 0} payout batches have cleared</small>
                </div>
                <div className="payout-card awaiting">
                  <span className="payout-label">Awaiting Payment</span>
                  <strong>{formatCurrency(payoutSummary.awaiting_payment)}</strong>
                  <small>These orders are not paid yet by customers</small>
                </div>
              </div>

              <div className="settlement-history-card card">
                <div className="analytics-card-header">
                  <div>
                    <h3>Payout Manager</h3>
                    <p>Create payout requests for delivered paid orders and track each payout batch with dates.</p>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleRequestPayout} disabled={requestingPayout}>
                    {requestingPayout ? 'Requesting...' : 'Request Payout'}
                  </button>
                </div>
                <div className="payout-manager-grid">
                  <div className="payout-manager-card">
                    <span className="payout-label">Eligible Now</span>
                    <strong>{formatCurrency(payoutSummary.eligible_payout_amount)}</strong>
                    <small>{payoutSummary.eligible_order_count || 0} delivered paid orders are ready for payout</small>
                  </div>
                  <div className="payout-manager-card">
                    <span className="payout-label">Latest Schedule</span>
                    <strong>{payoutRecords[0]?.scheduled_for || 'Not scheduled'}</strong>
                    <small>Estimated payout date for your newest request</small>
                  </div>
                </div>
              </div>

              <div className="settlement-history-card card">
                <div className="analytics-card-header">
                  <div>
                    <h3>Payout Records</h3>
                    <p>Track payout batches, estimated payout dates, and settlement states.</p>
                  </div>
                  <span className="analytics-chip">{settlementHistory.length} entries</span>
                </div>
                <div className="analytics-empty">Payout batches will appear here after you request your first settlement.</div>
              </div>

              <div className="vendor-analytics-grid">
                <div className="vendor-analytics-card card">
                  <div className="analytics-card-header">
                    <div>
                      <h3>Conversion Stats</h3>
                      <p>Track payment, fulfillment, cancellation, and refund performance.</p>
                    </div>
                  </div>
                  <div className="conversion-grid">
                    <div className="conversion-stat"><span className="trend-label">Payment Conversion</span><strong>{conversionStats.payment_conversion_rate || '0.0'}%</strong><small>{conversionStats.paid_orders || 0} of {conversionStats.total_orders || 0} orders got paid</small></div>
                    <div className="conversion-stat"><span className="trend-label">Fulfillment Rate</span><strong>{conversionStats.fulfillment_rate || '0.0'}%</strong><small>{conversionStats.delivered_orders || 0} delivered orders</small></div>
                    <div className="conversion-stat"><span className="trend-label">Cancellation Rate</span><strong>{conversionStats.cancellation_rate || '0.0'}%</strong><small>{conversionStats.cancelled_orders || 0} cancelled orders</small></div>
                    <div className="conversion-stat"><span className="trend-label">Refund Rate</span><strong>{conversionStats.refund_rate || '0.0'}%</strong><small>{returnOrders.length} return cases</small></div>
                  </div>
                </div>

                <div className="vendor-analytics-card card">
                  <div className="analytics-card-header">
                    <div>
                      <h3>Monthly Sales</h3>
                      <p>Your paid-order revenue over the last 6 months.</p>
                    </div>
                    <span className="analytics-chip">{monthlySales.length} months</span>
                  </div>
                  {monthlySales.length > 0 ? (
                    <div className="mini-chart">
                      {monthlySales.slice().reverse().map((item) => (
                        <div key={item.month} className="mini-chart-item">
                          <div className="mini-chart-bar-wrap">
                            <div className="mini-chart-bar" style={{ height: `${Math.max(18, (Number(item.earnings || 0) / Math.max(maxMonthlyEarnings, 1)) * 100)}%` }} />
                          </div>
                          <strong>{formatCurrency(item.earnings)}</strong>
                          <span>{formatMonthLabel(item.month)}</span>
                          <small>{item.order_count} orders</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="analytics-empty">Paid sales will appear here once orders start closing.</div>
                  )}
                </div>

                <div className="vendor-analytics-card card">
                  <div className="analytics-card-header">
                    <div>
                      <h3>Best Sellers</h3>
                      <p>Your top-performing products by units sold.</p>
                    </div>
                    <span className="analytics-chip">Top 5</span>
                  </div>
                  {bestSellers.length > 0 ? (
                    <div className="best-seller-list">
                      {bestSellers.map((item, index) => (
                        <div key={item.id || item.name} className="best-seller-row">
                          <div className="best-seller-rank">#{index + 1}</div>
                          <div className="best-seller-main"><strong>{item.name}</strong><span>{item.units_sold || 0} units sold</span></div>
                          <div className="best-seller-revenue">{formatCurrency(item.revenue)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="analytics-empty">Your best-selling products will show up after the first paid orders.</div>
                  )}
                </div>

                <div className="vendor-analytics-card card">
                  <div className="analytics-card-header">
                    <div>
                      <h3>Order Trends</h3>
                      <p>A quick pulse on momentum and fulfillment.</p>
                    </div>
                  </div>
                  <div className="trend-cards">
                    <div className="trend-stat"><span className="trend-label">Orders Last 30d</span><strong>{recentTrend.orders_last_30 || 0}</strong><small>{formatTrendDelta(recentTrend.orders_last_30, recentTrend.orders_prev_30)}</small></div>
                    <div className="trend-stat"><span className="trend-label">Revenue Last 30d</span><strong>{formatCurrency(recentTrend.revenue_last_30)}</strong><small>{formatTrendDelta(recentTrend.revenue_last_30, recentTrend.revenue_prev_30)}</small></div>
                  </div>
                  <div className="status-trend-grid">
                    {statusBreakdown.length > 0 ? statusBreakdown.map((item) => (
                      <div key={item.status} className={`status-trend-pill ${item.status}`}>
                        <span>{item.status}</span>
                        <strong>{item.order_count}</strong>
                      </div>
                    )) : (
                      <div className="analytics-empty">Order status trends will populate after your first orders come in.</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {loading ? (
            <div className="spinner-wrapper"><div className="spinner" /></div>
          ) : (
            <div className="products-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>Price</th><th>Stock</th><th>Rating</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td><div className="product-cell"><div className="product-cell-img">{product.image ? <img src={product.image} alt={product.name} /> : 'P'}</div><div className="product-name-wrap"><span>{product.name}</span>{product.stock === 0 && <span className="stock-flag out">Out of stock</span>}{product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD && <span className="stock-flag low">Low stock</span>}</div></div></td>
                      <td>{formatCurrency(product.price)}</td>
                      <td><span className={product.stock === 0 ? 'out-stock' : product.stock <= LOW_STOCK_THRESHOLD ? 'low-stock' : 'in-stock'}>{product.stock}</span></td>
                      <td>{product.avgRating} ({product.reviewCount})</td>
                      <td><span className={`badge ${product.isActive ? 'badge-active' : 'badge-inactive'}`}>{product.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td><div className="action-btns"><button className="btn btn-outline btn-sm" onClick={() => openForm(product)}>Edit</button><button className="btn btn-danger btn-sm" onClick={() => handleDelete(product.id)}>Delete</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && <div className="empty-state"><div className="empty-state-icon">P</div><h3>No products yet</h3><p>Add your first product to start selling</p></div>}
            </div>
          )}
        </div>
      ) : (
        <div className="dash-panel">
          <div className="panel-header"><h2>Orders ({orders.length})</h2></div>
          {loading ? (
            <div className="spinner-wrapper"><div className="spinner" /></div>
          ) : (
            <div className="products-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Order</th><th>Product</th><th>Customer</th><th>Qty</th><th>Amount</th><th>Status</th><th>Update</th></tr>
                </thead>
                <tbody>
                  {orders.map((item) => (
                    <tr key={item.id}>
                      <td>#{item.order_id}</td>
                      <td>{item.product?.name}</td>
                      <td>{item.order?.customer?.name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(parseFloat(item.price) * item.quantity)}</td>
                      <td><span className={`badge badge-${item.order?.status}`}>{item.order?.status}</span></td>
                      <td>
                        <select className="form-input form-select status-select" value="" onChange={(event) => event.target.value && handleOrderStatus(item.order_id, event.target.value)}>
                          <option value="">Update status</option>
                          <option value="confirmed">Confirm</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancel</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <div className="empty-state"><div className="empty-state-icon">O</div><h3>No orders yet</h3></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorDashboard;
