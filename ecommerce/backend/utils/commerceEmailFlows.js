const { sendEmail } = require('./email');

const frontendBaseUrl = () => (process.env.FRONTEND_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
const ordersUrl = () => `${frontendBaseUrl()}/orders`;
const vendorUrl = () => `${frontendBaseUrl()}/vendor`;

const formatCurrency = (value) => `Rs ${Number.parseFloat(value || 0).toFixed(2)}`;
const formatDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const sendOrderPlacedEmail = async ({ user, order }) => {
  if (!user?.email || !order) return;

  await sendEmail({
    to: user.email,
    subject: `ShopVault order placed: #${order.id}`,
    text: `Your ShopVault order #${order.id} was placed on ${formatDateTime(order.createdAt)} for ${formatCurrency(order.total_price)}. Track it here: ${ordersUrl()}`,
    html: `
      <p>Your ShopVault order <strong>#${order.id}</strong> was placed successfully.</p>
      <p>Total: <strong>${formatCurrency(order.total_price)}</strong></p>
      <p>Placed: ${formatDateTime(order.createdAt)}</p>
      <p><a href="${ordersUrl()}">Track your order</a></p>
    `,
  });
};

const sendOrderStatusEmail = async ({ user, order, status, note }) => {
  if (!user?.email || !order || !status) return;

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  await sendEmail({
    to: user.email,
    subject: `ShopVault order #${order.id} is now ${statusLabel}`,
    text: `Your order #${order.id} is now ${statusLabel}.${note ? ` Update: ${note}` : ''} Track it here: ${ordersUrl()}`,
    html: `
      <p>Your order <strong>#${order.id}</strong> is now <strong>${statusLabel}</strong>.</p>
      ${note ? `<p>${note}</p>` : ''}
      <p><a href="${ordersUrl()}">Track your order</a></p>
    `,
  });
};

const sendRefundApprovedEmail = async ({ user, order }) => {
  if (!user?.email || !order) return;

  await sendEmail({
    to: user.email,
    subject: `Refund approved for ShopVault order #${order.id}`,
    text: `Your refund request for order #${order.id} has been approved.${order.payment_status === 'refunded' ? ' The payment has been marked as refunded.' : ''} View details here: ${ordersUrl()}`,
    html: `
      <p>Your refund request for order <strong>#${order.id}</strong> has been approved.</p>
      <p>${order.payment_status === 'refunded' ? 'The order payment has been marked as refunded.' : 'The return has been approved and refund processing is underway.'}</p>
      <p><a href="${ordersUrl()}">View order details</a></p>
    `,
  });
};

const sendVendorApprovedEmail = async ({ vendor }) => {
  if (!vendor?.email) return;

  await sendEmail({
    to: vendor.email,
    subject: 'Your ShopVault vendor account is approved',
    text: `Your vendor account has been approved. You can now manage products and orders here: ${vendorUrl()}`,
    html: `
      <p>Your ShopVault vendor account has been approved.</p>
      <p>You can now add products, manage orders, and access analytics.</p>
      <p><a href="${vendorUrl()}">Open vendor dashboard</a></p>
    `,
  });
};

module.exports = {
  sendOrderPlacedEmail,
  sendOrderStatusEmail,
  sendRefundApprovedEmail,
  sendVendorApprovedEmail,
};
