const escapePdfText = (value = '') => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const formatMoney = (value) => `Rs ${Number.parseFloat(value || 0).toFixed(2)}`;
const formatDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const sanitizeLine = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const splitText = (value = '', maxLength = 64) => {
  const text = sanitizeLine(value);
  if (!text) return ['N/A'];

  const words = text.split(' ');
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines;
};

const buildInvoiceNumber = (order) => `SV-${String(order.id).padStart(6, '0')}`;

const getInvoiceBreakdown = (order) => {
  const grossTotal = Number.parseFloat(order.total_price || 0);
  const couponDiscount = Number.parseFloat(order.couponRedemption?.discount_amount || 0);
  const campaignDiscount = Number.parseFloat(order.campaign_discount_amount || 0);
  const preDiscountTotal = grossTotal + couponDiscount + campaignDiscount;

  // Assumption: order total is customer-facing tax-inclusive pricing.
  const taxableValue = Number((grossTotal / 1.18).toFixed(2));
  const gstAmount = Number((grossTotal - taxableValue).toFixed(2));
  const cgst = Number((gstAmount / 2).toFixed(2));
  const sgst = Number((gstAmount - cgst).toFixed(2));

  return {
    preDiscountTotal: Number(preDiscountTotal.toFixed(2)),
    couponDiscount: Number(couponDiscount.toFixed(2)),
    campaignDiscount: Number(campaignDiscount.toFixed(2)),
    taxableValue,
    gstAmount,
    cgst,
    sgst,
    total: Number(grossTotal.toFixed(2)),
  };
};

const buildInvoiceLines = (order, user) => {
  const breakdown = getInvoiceBreakdown(order);
  const invoiceNumber = buildInvoiceNumber(order);
  const issuerName = 'ShopVault Marketplace';
  const issuerAddress = 'ShopVault Commerce, India';
  const issuerGstin = 'GSTIN: SV-DEMO-27AABCU9603R1ZX';
  const billingName = user?.billingName || user?.name || 'Customer';
  const customerGstin = sanitizeLine(user?.gstin);
  const shippingAddressLines = splitText(order.shipping_address || user?.address || 'N/A', 58);
  const couponLabel = order.couponRedemption?.coupon_code || 'None';
  const campaignLabel = order.campaignSummary?.appliedCampaigns?.length
    ? order.campaignSummary.appliedCampaigns.map((campaign) => campaign.name).join(', ')
    : 'None';

  const lines = [
    { text: 'ShopVault Tax Invoice / GST Bill', size: 18, x: 50, y: 800 },
    { text: issuerName, size: 11, x: 50, y: 782 },
    { text: issuerAddress, size: 10, x: 50, y: 768 },
    { text: issuerGstin, size: 10, x: 50, y: 754 },
    { text: `Invoice No: ${invoiceNumber}`, size: 10, x: 360, y: 782 },
    { text: `Order No: #${order.id}`, size: 10, x: 360, y: 768 },
    { text: `Invoice Date: ${formatDateTime(new Date().toISOString())}`, size: 10, x: 360, y: 754 },
    { text: `Order Date: ${formatDateTime(order.createdAt)}`, size: 10, x: 360, y: 740 },
    { text: 'Bill To', size: 12, x: 50, y: 716 },
    { text: billingName, size: 11, x: 50, y: 700 },
    { text: `Email: ${user?.email || 'N/A'}`, size: 10, x: 50, y: 686 },
    { text: `Phone: ${user?.phone || 'N/A'}`, size: 10, x: 50, y: 672 },
    { text: `Customer GSTIN: ${customerGstin || 'Not provided'}`, size: 10, x: 50, y: 658 },
    { text: 'Ship To', size: 12, x: 360, y: 716 },
  ];

  let shippingY = 700;
  shippingAddressLines.slice(0, 4).forEach((line) => {
    lines.push({ text: line, size: 10, x: 360, y: shippingY });
    shippingY -= 14;
  });

  lines.push({ text: `Payment Status: ${order.payment_status}`, size: 10, x: 360, y: Math.max(shippingY, 644) });
  lines.push({ text: 'Items', size: 13, x: 50, y: 624 });
  lines.push({ text: 'Description', size: 10, x: 50, y: 608 });
  lines.push({ text: 'Qty', size: 10, x: 310, y: 608 });
  lines.push({ text: 'Rate', size: 10, x: 360, y: 608 });
  lines.push({ text: 'Amount', size: 10, x: 450, y: 608 });

  let currentY = 590;
  (order.items || []).slice(0, 8).forEach((item, index) => {
    const itemName = `${index + 1}. ${item.product?.name || 'Product'}${item.variant_label ? ` (${item.variant_label})` : ''}`;
    const itemLines = splitText(itemName, 38);
    const amount = Number.parseFloat(item.price || 0) * Number.parseInt(item.quantity || 0, 10);

    itemLines.slice(0, 2).forEach((line, lineIndex) => {
      lines.push({ text: line, size: 10, x: 50, y: currentY - (lineIndex * 12) });
    });
    lines.push({ text: String(item.quantity), size: 10, x: 312, y: currentY });
    lines.push({ text: formatMoney(item.price), size: 10, x: 360, y: currentY });
    lines.push({ text: formatMoney(amount), size: 10, x: 450, y: currentY });
    currentY -= 30;
  });

  const summaryStartY = Math.max(currentY - 8, 320);
  lines.push({ text: `Catalog Total: ${formatMoney(breakdown.preDiscountTotal)}`, size: 10, x: 320, y: summaryStartY });
  lines.push({ text: `Campaign Discount: -${formatMoney(breakdown.campaignDiscount)}`, size: 10, x: 320, y: summaryStartY - 16 });
  lines.push({ text: `Coupon Discount (${couponLabel}): -${formatMoney(breakdown.couponDiscount)}`, size: 10, x: 320, y: summaryStartY - 32 });
  lines.push({ text: `Taxable Value: ${formatMoney(breakdown.taxableValue)}`, size: 10, x: 320, y: summaryStartY - 48 });
  lines.push({ text: `CGST @ 9%: ${formatMoney(breakdown.cgst)}`, size: 10, x: 320, y: summaryStartY - 64 });
  lines.push({ text: `SGST @ 9%: ${formatMoney(breakdown.sgst)}`, size: 10, x: 320, y: summaryStartY - 80 });
  lines.push({ text: `GST Included: ${formatMoney(breakdown.gstAmount)}`, size: 10, x: 320, y: summaryStartY - 96 });
  lines.push({ text: `Grand Total: ${formatMoney(breakdown.total)}`, size: 13, x: 320, y: summaryStartY - 118 });

  lines.push({ text: `Applied Campaigns: ${campaignLabel}`, size: 10, x: 50, y: summaryStartY - 16 });
  lines.push({ text: `Invoice Note: This is a computer-generated GST bill for your marketplace order.`, size: 9, x: 50, y: 108 });
  lines.push({ text: 'Thank you for shopping with ShopVault.', size: 10, x: 50, y: 92 });

  return lines;
};

export const downloadInvoicePdf = (order, user) => {
  const lines = buildInvoiceLines(order, user);
  const content = lines.map((line) => (
    `BT /F1 ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${escapePdfText(line.text)}) Tj ET`
  )).join('\n');

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const pageId = addObject(`<< /Type /Page /Parent 4 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  const pagesId = addObject(`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shopvault-gst-bill-order-${order.id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
