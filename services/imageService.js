import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryConfig } from '../config/cloudinary.js';

cloudinary.config({
  cloud_name: cloudinaryConfig.cloudName,
  api_key: cloudinaryConfig.apiKey,
  api_secret: cloudinaryConfig.apiSecret,
});

async function uploadToCloudinary(buffer, folder, publicIdPrefix) {
  if (!cloudinaryConfig.cloudName || !cloudinaryConfig.apiKey || !cloudinaryConfig.apiSecret) {
    throw new Error('Cloudinary is not configured');
  }

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

export async function processAndUploadPhoto(buffer, folder = 'resident-photos') {
  const processed = await sharp(buffer)
    .rotate()
    .resize(600, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const result = await uploadToCloudinary(processed, folder, 'photo');
  return {
    photoUrl: result.secure_url,
    photoPublicId: result.public_id,
  };
}

export async function deleteFromCloudinary(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }
}
