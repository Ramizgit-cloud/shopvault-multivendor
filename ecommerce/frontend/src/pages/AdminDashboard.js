import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Sidebar from '../components/admin/Sidebar';
import DashboardCards from '../components/admin/DashboardCards';
import UserTable from '../components/admin/UserTable';
import VendorTable from '../components/admin/VendorTable';
import ProductTable from '../components/admin/ProductTable';
import OrderTable from '../components/admin/OrderTable';
import PaymentTable from '../components/admin/PaymentTable';
import ReturnTable from '../components/admin/ReturnTable';
import ReviewTable from '../components/admin/ReviewTable';
import CouponManagement from '../components/admin/CouponManagement';
import SupportTicketCenter from '../components/SupportTicketCenter';
import { orderAPI } from '../services/api';
import { adminAPI } from '../services/api';
import './AdminDashboard.css';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'D' },
  { key: 'users', label: 'Users', icon: 'U' },
  { key: 'vendors', label: 'Vendors', icon: 'V' },
  { key: 'products', label: 'Products', icon: 'P' },
  { key: 'reviews', label: 'Reviews', icon: 'R' },
  { key: 'orders', label: 'Orders', icon: 'O' },
  { key: 'returns', label: 'Returns', icon: 'R' },
  { key: 'payments', label: 'Payments', icon: 'P' },
  { key: 'coupons', label: 'Coupons', icon: 'C' },
  { key: 'support', label: 'Support', icon: 'S' },
];

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [controls, setControls] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [yearlySales, setYearlySales] = useState([]);
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponAnalytics, setCouponAnalytics] = useState(null);
  const [inventoryAlerts, setInventoryAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const pendingUsersApprovalCount = users.filter((user) => user.role === 'vendor' && !user.isApproved).length;
  const pendingVendorApprovalCount = vendors.filter((vendor) => !vendor.isApproved).length;
  const returnOrders = useMemo(() => orders.filter((order) => order.returnRequest?.status && order.returnRequest.status !== 'none'), [orders]);
  const pendingReturns = returnOrders.filter((order) => order.returnRequest?.status === 'pending');
  const refundedReturns = returnOrders.filter((order) => order.returnRequest?.status === 'approved' && order.payment_status === 'refunded');
  const blockedUsers = users.filter((user) => !user.isActive);
  const riskyUsers = users.filter((user) => (user.riskSignals?.length || 0) > 0);
  const lowStockProducts = products.filter((product) => ['warning', 'critical'].includes(product.stockAlert?.level));
  const suspiciousOrders = orders.filter((order) => (order.suspiciousSignals?.length || 0) > 0);
  const manualReviewOrders = orders.filter((order) => order.manualReview?.flagged);

  const loadDashboard = async () => {
    const response = await adminAPI.getDashboard();
    setStats(response.data.stats);
    setControls(response.data.controls || null);
    setRecentOrders(response.data.recentOrders || []);
    setMonthlySales(response.data.monthlySales || []);
    setDailySales(response.data.dailySales || []);
    setYearlySales(response.data.yearlySales || []);
    setInventoryAlerts(response.data.inventoryAlerts || null);
  };

  const loadSection = async (sectionKey) => {
    setLoading(true);
    try {
      if (sectionKey === 'dashboard') {
        await loadDashboard();
      } else if (sectionKey === 'users') {
        const response = await adminAPI.getUsers();
        setUsers(response.data.users || []);
      } else if (sectionKey === 'vendors') {
        const response = await adminAPI.getVendors();
        setVendors(response.data.vendors || []);
      } else if (sectionKey === 'products') {
        const response = await adminAPI.getProducts();
        setProducts(response.data.products || []);
      } else if (sectionKey === 'orders') {
        const response = await adminAPI.getOrders();
        setOrders(response.data.orders || []);
      } else if (sectionKey === 'reviews') {
        const response = await adminAPI.getReviews();
        setReviews(response.data.reviews || []);
      } else if (sectionKey === 'payments') {
        const response = await adminAPI.getPayments();
        setPayments(response.data.payments || []);
      } else if (sectionKey === 'coupons') {
        const [couponResponse, vendorResponse] = await Promise.all([
          adminAPI.getCoupons(),
          adminAPI.getVendors(),
        ]);
        setCoupons(couponResponse.data.coupons || []);
        setCouponAnalytics(couponResponse.data.analytics || null);
        setVendors(vendorResponse.data.vendors || []);
      } else if (sectionKey === 'returns') {
        const response = await adminAPI.getOrders();
        setOrders(response.data.orders || []);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to load ${sectionKey}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSection(activeSection);
  }, [activeSection]);

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await adminAPI.deleteUser(id);
      setUsers((current) => current.filter((user) => user.id !== id));
      toast.success('User deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleBlockUser = async (id) => {
    try {
      await adminAPI.blockUser(id);
      setUsers((current) => current.map((user) => (
        user.id === id ? { ...user, isActive: !user.isActive } : user
      )));
      toast.success('User status updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleApproveVendor = async (id) => {
    try {
      await adminAPI.approveVendorDirect(id);
      setUsers((current) => current.map((user) => (
        user.id === id ? { ...user, isApproved: true } : user
      )));
      setVendors((current) => current.map((vendor) => (
        vendor.id === id ? { ...vendor, isApproved: true } : vendor
      )));
      toast.success('Vendor approved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve vendor');
    }
  };

  const handleBlockVendor = async (id) => {
    try {
      await adminAPI.blockVendor(id);
      setVendors((current) => current.map((vendor) => (
        vendor.id === id ? { ...vendor, isActive: !vendor.isActive } : vendor
      )));
      toast.success('Vendor status updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update vendor');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await adminAPI.deleteProductDirect(id);
      setProducts((current) => current.filter((product) => product.id !== id));
      toast.success('Product deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Remove this review from the marketplace?')) return;
    try {
      await adminAPI.deleteReview(id);
      setReviews((current) => current.filter((review) => review.id !== id));
      toast.success('Review removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove review');
    }
  };

  const refreshCoupons = async () => {
    const response = await adminAPI.getCoupons();
    setCoupons(response.data.coupons || []);
    setCouponAnalytics(response.data.analytics || null);
  };

  const handleCreateCoupon = async (payload) => {
    try {
      await adminAPI.createCoupon(payload);
      await refreshCoupons();
      toast.success('Coupon created');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create coupon');
    }
  };

  const handleUpdateCoupon = async (id, payload) => {
    try {
      await adminAPI.updateCoupon(id, payload);
      await refreshCoupons();
      toast.success('Coupon updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update coupon');
    }
  };

  const handleToggleCouponStatus = async (id) => {
    try {
      await adminAPI.toggleCouponStatus(id);
      await refreshCoupons();
      toast.success('Coupon status updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update coupon status');
    }
  };

  const handleReturnDecision = async (orderId, action) => {
    try {
      await orderAPI.resolveReturn(orderId, action);
      setOrders((current) => current.map((order) => (
        order.id === orderId
          ? {
            ...order,
            returnRequest: {
              ...order.returnRequest,
              status: action === 'approve' ? 'approved' : 'rejected',
            },
            payment_status: action === 'approve' && order.payment_status === 'paid' ? 'refunded' : order.payment_status,
          }
          : order
      )));
      toast.success(action === 'approve' ? 'Return approved' : 'Return rejected');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update return request');
    }
  };

  const handleToggleManualReview = async (order) => {
    const nextFlagged = !order.manualReview?.flagged;
    const reason = nextFlagged
      ? (window.prompt('Reason for manual review flag:', order.suspiciousSignals?.[0]?.message || '') || '').trim()
      : 'Admin cleared manual review';

    if (nextFlagged && !reason) {
      toast.error('Review reason is required');
      return;
    }

    try {
      const response = await adminAPI.setOrderReviewFlag(order.id, nextFlagged, reason);
      const updatedOrder = response.data.order;
      setOrders((current) => current.map((entry) => (
        entry.id === updatedOrder.id
          ? { ...entry, ...updatedOrder, suspiciousSignals: updatedOrder.suspiciousSignals?.length ? updatedOrder.suspiciousSignals : entry.suspiciousSignals }
          : entry
      )));
      toast.success(nextFlagged ? 'Order flagged for manual review' : 'Manual review cleared');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update review flag');
    }
  };

  const chartBars = useMemo(() => {
    const ordered = [...monthlySales].reverse();
    const maxRevenue = Math.max(...ordered.map((item) => parseFloat(item.revenue || 0)), 1);

    return ordered.map((item) => ({
      ...item,
      revenueValue: parseFloat(item.revenue || 0),
      barHeight: Math.max((parseFloat(item.revenue || 0) / maxRevenue) * 100, 8),
    }));
  }, [monthlySales]);

  const dailyChart = useMemo(() => {
    const ordered = [...dailySales];
    if (!ordered.length) return null;

    const values = ordered.map((item) => parseFloat(item.revenue || 0));
    const max = Math.max(...values, 1);
    const width = 100;
    const height = 100;
    const points = ordered.map((item, index) => {
      const x = ordered.length === 1 ? width / 2 : (index / (ordered.length - 1)) * width;
      const y = height - ((parseFloat(item.revenue || 0) / max) * height);
      return `${x},${y}`;
    }).join(' ');

    return {
      ordered,
      max,
      points,
    };
  }, [dailySales]);

  const yearlyBars = useMemo(() => {
    const ordered = [...yearlySales].reverse();
    const maxRevenue = Math.max(...ordered.map((item) => parseFloat(item.revenue || 0)), 1);

    return ordered.map((item) => ({
      ...item,
      revenueValue: parseFloat(item.revenue || 0),
      barHeight: Math.max((parseFloat(item.revenue || 0) / maxRevenue) * 100, 10),
    }));
  }, [yearlySales]);

  const getOrderStatusTone = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (['confirmed', 'delivered', 'paid', 'completed'].includes(normalized)) return 'confirmed';
    if (['cancelled', 'failed', 'rejected'].includes(normalized)) return 'critical';
    return 'pending';
  };

  const renderContent = () => {
    if (loading) {
      return <div className="spinner-wrapper"><div className="spinner" /></div>;
    }

    if (activeSection === 'dashboard') {
      return (
        <>
          {stats && <DashboardCards stats={stats} />}

          <div className="analytics-grid">
            {controls && (
              <div className="analytics-card card admin-controls-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="panel-header-title">Admin Controls Snapshot</h2>
                    <p className="panel-subtitle">Marketplace risk signals that need active supervision.</p>
                  </div>
                </div>

                <div className="control-metrics-grid">
                  <div className="control-metric-pill warning">
                    <strong>{controls.lowStockProducts}</strong>
                    <span>low-stock products</span>
                  </div>
                  <div className="control-metric-pill critical">
                    <strong>{controls.outOfStockProducts}</strong>
                    <span>out-of-stock products</span>
                  </div>
                  <div className="control-metric-pill neutral">
                    <strong>{controls.blockedUsers}</strong>
                    <span>blocked users</span>
                  </div>
                  <div className="control-metric-pill warning">
                    <strong>{controls.suspiciousOrders}</strong>
                    <span>suspicious orders</span>
                  </div>
                  <div className="control-metric-pill critical">
                    <strong>{controls.manualReviewOrders}</strong>
                    <span>manual review flags</span>
                  </div>
                  <div className="control-metric-pill neutral">
                    <strong>{controls.pendingVendorReviews}</strong>
                    <span>vendor approvals pending</span>
                  </div>
                </div>
              </div>
            )}

            {inventoryAlerts && inventoryAlerts.alerts?.length > 0 && (
              <div className="analytics-card card admin-inventory-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="panel-header-title">Priority Inventory Alerts</h2>
                    <p className="panel-subtitle">Products most at risk of stocking out across the marketplace.</p>
                  </div>
                </div>
                <div className="admin-inventory-summary">
                  <div className="control-metric-pill critical">
                    <strong>{inventoryAlerts.critical_count || 0}</strong>
                    <span>critical alerts</span>
                  </div>
                  <div className="control-metric-pill warning">
                    <strong>{inventoryAlerts.flagged_products || 0}</strong>
                    <span>flagged products</span>
                  </div>
                  <div className="control-metric-pill neutral">
                    <strong>{inventoryAlerts.affected_vendors || 0}</strong>
                    <span>vendors affected</span>
                  </div>
                </div>
                <div className="admin-inventory-list">
                  {inventoryAlerts.alerts.map((alert) => (
                    <div key={alert.product_id} className={`admin-inventory-row ${alert.level}`}>
                      <div>
                        <strong>{alert.product_name}</strong>
                        <span>{alert.vendor_name || 'Vendor'} - {alert.category}</span>
                      </div>
                      <div>
                        <strong>{alert.stock === 0 ? 'Out of stock' : `${alert.stock} left`}</strong>
                        <span>Suggested restock {alert.suggested_restock_units} units</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="analytics-card card">
              <div className="analytics-card-header">
                <div>
                  <h2 className="panel-header-title">Daily Sales Overview</h2>
                  <p className="panel-subtitle">Day-by-day paid sales for the current month.</p>
                </div>
              </div>

              {dailyChart === null ? (
                <div className="empty-state compact-empty">
                  <div className="empty-state-icon">R</div>
                  <h3>No daily sales yet</h3>
                  <p>Paid orders for the current month will show up here.</p>
                </div>
              ) : (
                <div className="daily-chart">
                  <div className="daily-chart-grid">
                    {dailyChart.ordered.map((item) => (
                      <div key={item.day} className="daily-chart-day">
                        <span>Rs {parseFloat(item.revenue || 0).toFixed(0)}</span>
                        <div className="daily-bar-track">
                          <div
                            className="daily-bar-fill"
                            style={{ height: `${Math.max((parseFloat(item.revenue || 0) / dailyChart.max) * 100, 8)}%` }}
                          />
                        </div>
                        <strong>{new Date(item.day).getDate()}</strong>
                        <small>{item.orders} orders</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="analytics-card card">
              <div className="analytics-card-header">
                <div>
                  <h2 className="panel-header-title">Yearly Revenue</h2>
                  <p className="panel-subtitle">Compare paid-order performance year over year.</p>
                </div>
              </div>

              {yearlyBars.length === 0 ? (
                <div className="empty-state compact-empty">
                  <div className="empty-state-icon">Y</div>
                  <h3>No yearly sales yet</h3>
                  <p>Yearly revenue will populate as paid orders accumulate.</p>
                </div>
              ) : (
                <div className="yearly-chart">
                  {yearlyBars.map((item) => (
                    <div key={item.year} className="yearly-column">
                      <span className="chart-value">Rs {item.revenueValue.toFixed(0)}</span>
                      <div className="chart-bar-track yearly-track">
                        <div className="chart-bar-fill yearly-fill" style={{ height: `${item.barHeight}%` }} />
                      </div>
                      <span className="chart-label">{item.year}</span>
                      <small>{item.orders} orders</small>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="analytics-card card">
              <div className="analytics-card-header">
                <div>
                  <h2 className="panel-header-title">Monthly Snapshot</h2>
                  <p className="panel-subtitle">Recent month-by-month revenue context.</p>
                </div>
              </div>

              <div className="monthly-list">
                {chartBars.map((item) => (
                  <div key={item.month} className="monthly-row">
                    <div>
                      <div className="monthly-month">{item.month}</div>
                      <div className="monthly-orders">{item.orders} orders</div>
                    </div>
                    <div className="monthly-revenue">Rs {item.revenueValue.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-card card">
              <div className="analytics-card-header">
                <div>
                  <h2 className="panel-header-title">Recent Orders</h2>
                  <p className="panel-subtitle">A quick look at the newest orders in the system.</p>
                </div>
              </div>

              <div className="monthly-list">
                {recentOrders.map((order) => (
                  <div key={order.id} className="monthly-row">
                    <div>
                      <div className="monthly-month">Order #{order.id}</div>
                      <div className="recent-order-meta">
                        <span>{order.customer_name}</span>
                        <span className={`status-pill ${getOrderStatusTone(order.status)}`}>{order.status}</span>
                      </div>
                    </div>
                    <div className="monthly-revenue">Rs {parseFloat(order.total_price || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    }

    if (activeSection === 'users') {
      return (
        <>
          {(blockedUsers.length > 0 || riskyUsers.length > 0) && (
            <div className="admin-controls-strip">
              <div className="card admin-controls-tile">
                <span className="table-muted">Blocked users</span>
                <strong>{blockedUsers.length}</strong>
              </div>
              <div className="card admin-controls-tile">
                <span className="table-muted">Suspicious customer patterns</span>
                <strong>{riskyUsers.length}</strong>
              </div>
            </div>
          )}
          {pendingUsersApprovalCount > 0 && (
            <div className="admin-alert-banner">
              <strong>{pendingUsersApprovalCount} vendor {pendingUsersApprovalCount === 1 ? 'account is' : 'accounts are'} awaiting approval.</strong>
              <span>Use the Approve action in this table or open the Vendors section for the dedicated approval queue.</span>
            </div>
          )}
          <UserTable users={users} onDelete={handleDeleteUser} onBlock={handleBlockUser} onApprove={handleApproveVendor} />
        </>
      );
    }

    if (activeSection === 'vendors') {
      return <VendorTable vendors={vendors} onApprove={handleApproveVendor} onBlock={handleBlockVendor} />;
    }

    if (activeSection === 'products') {
      return (
        <>
          {lowStockProducts.length > 0 && (
            <div className="admin-alert-banner">
              <strong>{lowStockProducts.length} products need inventory attention.</strong>
              <span>Review the stock badges below to spot low-stock and out-of-stock listings before they hurt conversion.</span>
            </div>
          )}
          {inventoryAlerts && inventoryAlerts.alerts?.length > 0 && (
            <div className="admin-controls-strip">
              <div className="card admin-controls-tile critical">
                <span className="table-muted">Critical inventory alerts</span>
                <strong>{inventoryAlerts.critical_count || 0}</strong>
              </div>
              <div className="card admin-controls-tile warning">
                <span className="table-muted">Suggested restocks queued</span>
                <strong>{inventoryAlerts.flagged_products || 0}</strong>
              </div>
            </div>
          )}
          <ProductTable products={products} onDelete={handleDeleteProduct} />
        </>
      );
    }

    if (activeSection === 'reviews') {
      const flaggedReviews = reviews.filter((review) => (review.moderationSignals?.length || 0) > 0);
      const unverifiedReviews = reviews.filter((review) => !review.verifiedPurchase);

      return (
        <>
          {(flaggedReviews.length > 0 || unverifiedReviews.length > 0) && (
            <div className="admin-controls-strip">
              <div className="card admin-controls-tile warning">
                <span className="table-muted">Reviews with signals</span>
                <strong>{flaggedReviews.length}</strong>
              </div>
              <div className="card admin-controls-tile critical">
                <span className="table-muted">Unverified reviews</span>
                <strong>{unverifiedReviews.length}</strong>
              </div>
            </div>
          )}
          {reviews.length === 0 ? (
            <div className="empty-state compact-empty">
              <div className="empty-state-icon">S</div>
              <h3>No reviews to moderate</h3>
              <p>Customer reviews will appear here so admins can remove abusive or fake content.</p>
            </div>
          ) : (
            <ReviewTable reviews={reviews} onDelete={handleDeleteReview} />
          )}
        </>
      );
    }

    if (activeSection === 'coupons') {
      return (
        <CouponManagement
          coupons={coupons}
          analytics={couponAnalytics}
          vendors={vendors.filter((vendor) => vendor.role === 'vendor')}
          onCreate={handleCreateCoupon}
          onUpdate={handleUpdateCoupon}
          onToggleStatus={handleToggleCouponStatus}
        />
      );
    }

    if (activeSection === 'support') {
      return (
        <SupportTicketCenter
          title="Support Ticket Queue"
          subtitle="Review customer tickets, assign them to vendors or admin, and move issues through resolution."
        />
      );
    }

    if (activeSection === 'orders') {
      return (
        <>
          {(suspiciousOrders.length > 0 || manualReviewOrders.length > 0) && (
            <div className="admin-controls-strip">
              <div className="card admin-controls-tile warning">
                <span className="table-muted">Suspicious repeated orders</span>
                <strong>{suspiciousOrders.length}</strong>
              </div>
              <div className="card admin-controls-tile critical">
                <span className="table-muted">Manual review flags</span>
                <strong>{manualReviewOrders.length}</strong>
              </div>
            </div>
          )}
          <OrderTable orders={orders} onToggleReview={handleToggleManualReview} />
        </>
      );
    }

    if (activeSection === 'returns') {
      return (
        <>
          <div className="returns-summary-grid">
            <div className="card returns-summary-card">
              <span className="returns-summary-label">All return cases</span>
              <strong>{returnOrders.length}</strong>
            </div>
            <div className="card returns-summary-card warning">
              <span className="returns-summary-label">Pending review</span>
              <strong>{pendingReturns.length}</strong>
            </div>
            <div className="card returns-summary-card success">
              <span className="returns-summary-label">Refunded</span>
              <strong>{refundedReturns.length}</strong>
            </div>
          </div>
          {returnOrders.length === 0 ? (
            <div className="empty-state compact-empty">
              <div className="empty-state-icon">R</div>
              <h3>No return requests yet</h3>
              <p>Customer return and refund cases will appear here for admin review.</p>
            </div>
          ) : (
            <ReturnTable orders={returnOrders} onDecision={handleReturnDecision} />
          )}
        </>
      );
    }

    return <PaymentTable payments={payments} />;
  };

  const getSectionMeta = () => {
    switch (activeSection) {
      case 'users':
        return { title: 'User Management', subtitle: 'View all users, spot vendor approvals clearly, and block or delete accounts when needed.' };
      case 'vendors':
        return {
          title: 'Vendor Management',
          subtitle: pendingVendorApprovalCount > 0
            ? `${pendingVendorApprovalCount} vendor ${pendingVendorApprovalCount === 1 ? 'request is' : 'requests are'} waiting for admin approval.`
            : 'Approve and manage vendors from one dedicated queue.',
        };
      case 'products':
        return { title: 'Product Management', subtitle: 'Review marketplace inventory, remove risky listings, and catch low-stock issues early.' };
      case 'reviews':
        return { title: 'Review Moderation', subtitle: 'Inspect customer reviews, spot abusive or fake content, and remove it from the marketplace.' };
      case 'orders':
        return { title: 'Order Management', subtitle: 'Track order status, review suspicious repeat orders, and flag cases for manual admin review.' };
      case 'payments':
        return { title: 'Payment Monitoring', subtitle: 'Monitor payment status and payment identifiers by order.' };
      case 'coupons':
        return { title: 'Coupon Management', subtitle: 'Manage usage limits, vendor-specific offers, expiry handling, and coupon reporting.' };
      case 'returns':
        return { title: 'Returns & Refunds', subtitle: 'Review customer return requests and monitor refund outcomes.' };
      case 'support':
        return { title: 'Support Tickets', subtitle: 'Handle structured customer support cases with assignment, status, and threaded replies.' };
      default:
        return { title: 'Dashboard', subtitle: 'Monitor users, vendors, orders, revenue, and sales trends.' };
    }
  };

  const sectionMeta = getSectionMeta();

  return (
    <div className="admin-page page-content">
      <div className="admin-shell">
        <Sidebar items={navItems} activeKey={activeSection} onSelect={setActiveSection} />

        <section className="admin-main">
          <div className="admin-main-header">
            <div>
              <h1 className="page-title">{sectionMeta.title}</h1>
              <p className="panel-subtitle">{sectionMeta.subtitle}</p>
            </div>
          </div>

          {renderContent()}
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
