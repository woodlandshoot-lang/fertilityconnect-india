// src/services/mediaService.js
// Handles image/video upload to Cloudinary

const env = require('../config/env');

// Upload a base64 or URL file to Cloudinary
const uploadToCloudinary = async (fileData, folder = 'fertilityconnect') => {
  // Dev mode — return a placeholder URL
  if (env.nodeEnv === 'development' || !process.env.CLOUDINARY_CLOUD_NAME) {
    console.log(`📁 [DEV] Mock upload to ${folder}`);
    return {
      success:    true,
      url:        `https://res.cloudinary.com/demo/image/upload/sample.jpg`,
      public_id:  `${folder}/mock_${Date.now()}`,
      dev_mode:   true,
    };
  }

  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const result = await cloudinary.uploader.upload(fileData, {
      folder,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto:good', fetch_format: 'auto' },
        { width: 1200, height: 1200, crop: 'limit' },
      ],
    });

    return {
      success:   true,
      url:       result.secure_url,
      public_id: result.public_id,
    };
  } catch (err) {
    console.error('Cloudinary upload failed:', err.message);
    return { success: false, error: err.message };
  }
};

// Delete a file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  if (env.nodeEnv === 'development') return true;
  try {
    const cloudinary = require('cloudinary').v2;
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch {
    return false;
  }
};

// Validate file before upload
const validateFile = (file, type = 'image') => {
  const MAX_SIZE_MB = type === 'video' ? 50 : 5;
  const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];
  const allowed = type === 'video' ? [...ALLOWED_IMAGE, ...ALLOWED_VIDEO] : ALLOWED_IMAGE;

  if (!allowed.includes(file.mimetype)) {
    return { valid: false, error: `Invalid file type. Allowed: ${allowed.join(', ')}` };
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `File too large. Max ${MAX_SIZE_MB}MB.` };
  }
  return { valid: true };
};

module.exports = { uploadToCloudinary, deleteFromCloudinary, validateFile };
