import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryConfig } from '../config/cloudinary.js';

const uploadsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

export const UPLOADS_DIR = uploadsRoot;

function isCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  return Boolean(cloudName && apiKey && apiSecret);
}

function configureCloudinary() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured');
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

function getPublicBaseUrl() {
  const fromEnv = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;
  return fromEnv.replace(/\/$/, '');
}

function isCloudinaryConfigError(err) {
  const message = `${err?.message || ''} ${err?.error?.message || ''}`;
  const code = err?.http_code || err?.error?.http_code;
  if (code === 401 || code === 403) return true;
  return /invalid cloud_name|cloud_name mismatch|must supply cloud_name|invalid api key|invalid signature|not configured|missing permissions/i.test(
    message
  );
}

async function uploadToCloudinary(buffer, folder, publicIdPrefix) {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${publicIdPrefix}_${Date.now()}`,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function saveLocally(buffer, folder, publicIdPrefix) {
  const dir = path.join(uploadsRoot, folder);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${publicIdPrefix}_${Date.now()}_${randomBytes(4).toString('hex')}.webp`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return {
    photoUrl: `${getPublicBaseUrl()}/uploads/${folder}/${filename}`,
    photoPublicId: `local:${folder}/${filename}`,
  };
}

export async function processAndUploadPhoto(buffer, folder = 'resident-photos') {
  const processed = await sharp(buffer)
    .rotate()
    .resize(600, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  if (isCloudinaryConfigured()) {
    try {
      const result = await uploadToCloudinary(processed, folder, 'photo');
      return {
        photoUrl: result.secure_url,
        photoPublicId: result.public_id,
      };
    } catch (err) {
      if (!isCloudinaryConfigError(err)) {
        throw err;
      }
      console.warn('Cloudinary upload failed, storing photo locally:', err.message);
    }
  }

  return saveLocally(processed, folder, 'photo');
}

export async function deleteFromCloudinary(publicId) {
  if (!publicId) return;

  if (publicId.startsWith('local:')) {
    const relative = publicId.slice('local:'.length);
    const filePath = path.resolve(uploadsRoot, relative);
    const root = path.resolve(uploadsRoot);
    if (!filePath.startsWith(root + path.sep) && filePath !== root) return;
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Local photo delete failed:', err.message);
      }
    }
    return;
  }

  try {
    configureCloudinary();
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }
}
