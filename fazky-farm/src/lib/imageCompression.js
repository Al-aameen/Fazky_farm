/**
 * imageCompression.js
 * Lightweight wrapper around browser-image-compression.
 * Compresses farm photos to ≤100KB and ≤800px wide before
 * storing in IndexedDB or uploading to Supabase Storage.
 * This protects mobile data usage and device storage.
 */
import imageCompression from 'browser-image-compression';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.1,          // 100 KB hard ceiling
  maxWidthOrHeight: 800,   // Suitable for tablet viewing, tiny download
  useWebWorker: true,      // Non-blocking — keeps UI at 60fps during compression
  fileType: 'image/jpeg',  // JPEG is smaller than PNG for photos
  initialQuality: 0.7,     // Good visual quality at low size
};

/**
 * Compress an image file taken by a farm worker.
 * @param {File} file — The raw photo from <input type="file">
 * @returns {Promise<{ file: File, base64: string, sizeKB: number }>}
 */
export async function compressFarmImage(file) {
  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
    const sizeKB = (compressed.size / 1024).toFixed(1);
    console.log(`[ImageCompression] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${sizeKB}KB`);

    // Convert to base64 for storage in IndexedDB JSONB metadata field
    const base64 = await imageCompression.getDataUrlFromFile(compressed);

    return { file: compressed, base64, sizeKB: parseFloat(sizeKB) };
  } catch (err) {
    console.error('[ImageCompression] Failed:', err);
    throw new Error('Image compression failed. Please try a smaller photo.');
  }
}

/**
 * Quick helper: check if a file is an acceptable image type
 */
export function isValidImageFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  return file && allowed.includes(file.type.toLowerCase());
}
