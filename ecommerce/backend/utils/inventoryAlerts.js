const LOW_STOCK_THRESHOLD = 10;
const SALES_LOOKBACK_DAYS = 30;
const RESTOCK_COVERAGE_DAYS = 14;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPositive = (value) => Math.max(0, Math.round(toNumber(value, 0)));

const isRecentEnough = (value, days) => {
  const createdAt = new Date(value).getTime();
  if (!createdAt) return false;
  return createdAt >= Date.now() - (days * 24 * 60 * 60 * 1000);
};

const formatDays = (days) => {
  if (days === null || days === undefined) return 'steady';
  if (days <= 1) return 'within 24h';
  if (days < 7) return `in ${Math.ceil(days)} days`;
  return `in ${Math.ceil(days)} days`;
};

const buildAlertMessage = ({ stock, avgDailySales, daysUntilStockout, suggestedRestockUnits, recentRestockUnits }) => {
  if (stock <= 0) {
    if (avgDailySales > 0) {
      return `Out of stock. Recent demand is ${avgDailySales.toFixed(1)} unit/day, so add about ${suggestedRestockUnits} units to recover the next two weeks.`;
    }
    return `Out of stock. Restock at least ${suggestedRestockUnits} units to bring the listing back online.`;
  }

  if (avgDailySales > 0) {
    return `${stock} units left. At the current pace of ${avgDailySales.toFixed(1)} unit/day this may stock out ${formatDays(daysUntilStockout)}. Suggested restock: ${suggestedRestockUnits} units.`;
  }

  if (recentRestockUnits > 0) {
    return `${stock} units left. No recent sales trend yet, but ${recentRestockUnits} units were added recently. Keep a buffer before this drops below ${LOW_STOCK_THRESHOLD}.`;
  }

  return `${stock} units left. No recent sales history yet, so this is a threshold reminder to top up before the product goes unavailable.`;
};

const buildInventoryAlert = (product, history = []) => {
  const stock = clampPositive(product?.stock);
  const activeHistory = Array.isArray(history) ? history : [];
  const recentSales = activeHistory.filter((entry) => entry.change_type === 'sale' && isRecentEnough(entry.createdAt, SALES_LOOKBACK_DAYS));
  const recentRestocks = activeHistory.filter((entry) => ['restock', 'initial_stock'].includes(entry.change_type) && isRecentEnough(entry.createdAt, SALES_LOOKBACK_DAYS));
  const unitsSold30d = recentSales.reduce((sum, entry) => sum + Math.abs(Math.min(toNumber(entry.delta), 0)), 0);
  const recentRestockUnits = recentRestocks.reduce((sum, entry) => sum + Math.max(toNumber(entry.delta), 0), 0);
  const avgDailySales = Number((unitsSold30d / SALES_LOOKBACK_DAYS).toFixed(2));
  const daysUntilStockout = stock > 0 && avgDailySales > 0
    ? Number((stock / avgDailySales).toFixed(1))
    : null;
  const baselineRestock = Math.max(LOW_STOCK_THRESHOLD * 2, recentRestockUnits || 0);
  const demandBasedRestock = avgDailySales > 0 ? Math.ceil(avgDailySales * RESTOCK_COVERAGE_DAYS) : 0;
  const suggestedRestockUnits = Math.max(
    stock <= 0 ? LOW_STOCK_THRESHOLD * 2 : LOW_STOCK_THRESHOLD,
    baselineRestock,
    demandBasedRestock,
  );

  let level = 'healthy';
  let priority = 0;

  if (stock <= 0) {
    level = 'critical';
    priority = 100;
  } else if ((daysUntilStockout !== null && daysUntilStockout <= 5) || stock <= LOW_STOCK_THRESHOLD) {
    level = daysUntilStockout !== null && daysUntilStockout <= 3 ? 'critical' : 'warning';
    priority = level === 'critical' ? 90 : 60;
  }

  return {
    product_id: Number(product?.id),
    product_name: product?.name || 'Product',
    vendor_id: Number(product?.vendor_id || product?.vendor?.id || 0),
    vendor_name: product?.vendor?.name || '',
    category: product?.category || 'General',
    stock,
    level,
    priority,
    low_stock_threshold: LOW_STOCK_THRESHOLD,
    recent_units_sold_30d: unitsSold30d,
    avg_daily_sales: avgDailySales,
    recent_restock_units_30d: recentRestockUnits,
    days_until_stockout: daysUntilStockout,
    suggested_restock_units: suggestedRestockUnits,
    reminder_title: stock <= 0
      ? `${product?.name || 'Product'} is out of stock`
      : `${product?.name || 'Product'} needs a restock soon`,
    reminder_message: buildAlertMessage({
      stock,
      avgDailySales,
      daysUntilStockout,
      suggestedRestockUnits,
      recentRestockUnits,
    }),
  };
};

const sortAlerts = (left, right) => {
  if (right.priority !== left.priority) return right.priority - left.priority;
  if (left.days_until_stockout === null && right.days_until_stockout !== null) return 1;
  if (left.days_until_stockout !== null && right.days_until_stockout === null) return -1;
  if (left.days_until_stockout !== null && right.days_until_stockout !== null && left.days_until_stockout !== right.days_until_stockout) {
    return left.days_until_stockout - right.days_until_stockout;
  }
  return left.stock - right.stock;
};

const getVendorInventoryAlerts = (products = [], restockHistory = [], limit = 6) => {
  const historyByProductId = restockHistory.reduce((acc, entry) => {
    const productId = Number(entry.product_id);
    if (!productId) return acc;
    if (!acc[productId]) acc[productId] = [];
    acc[productId].push(entry);
    return acc;
  }, {});

  const alerts = products
    .filter((product) => product && product.isActive)
    .map((product) => buildInventoryAlert(product, historyByProductId[Number(product.id)] || []))
    .filter((alert) => ['warning', 'critical'].includes(alert.level))
    .sort(sortAlerts);

  return {
    low_stock_threshold: LOW_STOCK_THRESHOLD,
    total_flagged: alerts.length,
    critical_count: alerts.filter((alert) => alert.level === 'critical').length,
    warning_count: alerts.filter((alert) => alert.level === 'warning').length,
    reminders: alerts.slice(0, limit),
  };
};

const getAdminInventoryAlerts = (products = [], restockHistory = [], limit = 8) => {
  const alerts = getVendorInventoryAlerts(products, restockHistory, products.length).reminders;
  const vendorIds = new Set(alerts.map((alert) => alert.vendor_id).filter(Boolean));

  return {
    affected_vendors: vendorIds.size,
    flagged_products: alerts.length,
    critical_count: alerts.filter((alert) => alert.level === 'critical').length,
    alerts: alerts.slice(0, limit),
  };
};

module.exports = {
  LOW_STOCK_THRESHOLD,
  getVendorInventoryAlerts,
  getAdminInventoryAlerts,
  buildInventoryAlert,
};
