const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const productUploadsDir = path.join(uploadsRoot, 'products');
const allowedMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

const ensureUploadDir = async () => {
  await fs.promises.mkdir(productUploadsDir, { recursive: true });
};

const getBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const isLocalProductUpload = (imageUrl) => (
  typeof imageUrl === 'string' && /\/uploads\/products\//.test(imageUrl)
);

const getLocalUploadPath = (imageUrl) => {
  if (!isLocalProductUpload(imageUrl)) return null;

  const match = imageUrl.match(/\/uploads\/products\/([^/?#]+)/);
  if (!match) return null;

  return path.join(productUploadsDir, match[1]);
};

const removeLocalUpload = async (imageUrl) => {
  const filePath = getLocalUploadPath(imageUrl);
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const saveDataUrlImage = async (imageData, req) => {
  const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    const error = new Error('Invalid image format');
    error.statusCode = 400;
    throw error;
  }

  const [, mimeType, base64Payload] = match;
  const extension = allowedMimeTypes.get(mimeType);
  if (!extension) {
    const error = new Error('Only JPG, PNG, WEBP, and GIF images are supported');
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(base64Payload, 'base64');
  const maxSizeInBytes = 5 * 1024 * 1024;
  if (buffer.length > maxSizeInBytes) {
    const error = new Error('Image must be 5MB or smaller');
    error.statusCode = 400;
    throw error;
  }

  await ensureUploadDir();

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(productUploadsDir, fileName);
  await fs.promises.writeFile(filePath, buffer);

  return `${getBaseUrl(req)}/uploads/products/${fileName}`;
};

const resolveProductImage = async (imageValue, req, existingImage = null) => {
  if (imageValue === undefined) return existingImage;
  if (imageValue === null) return null;

  const normalizedValue = typeof imageValue === 'string' ? imageValue.trim() : '';
  if (!normalizedValue) {
    if (existingImage && existingImage !== normalizedValue) await removeLocalUpload(existingImage);
    return null;
  }

  if (normalizedValue.startsWith('data:image/')) {
    const savedUrl = await saveDataUrlImage(normalizedValue, req);
    if (existingImage && existingImage !== savedUrl) await removeLocalUpload(existingImage);
    return savedUrl;
  }

  if (existingImage && existingImage !== normalizedValue && isLocalProductUpload(existingImage)) {
    await removeLocalUpload(existingImage);
  }

  return normalizedValue;
};

module.exports = { ensureUploadDir, resolveProductImage, removeLocalUpload };
