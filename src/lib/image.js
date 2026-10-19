export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_INPUT_BYTES = 10 * 1024 * 1024 // what a user may pick
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // what we store/send (matches bucket limit)
const MAX_SIDE = 1568

export const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

export function validateImage(file) {
  if (!file) return 'No file selected.'
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Unsupported file type. Use a JPG, PNG, WebP or GIF image.'
  if (file.size > MAX_INPUT_BYTES) return `That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`
  return null
}

// Downscales large photos (keeps GIFs untouched) so uploads stay small and fast.
export async function processImage(file) {
  if (file.type === 'image/gif') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('GIFs must be under 5 MB.')
    return { blob: file, mime: file.type, previewUrl: URL.createObjectURL(file) }
  }
  let bitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error('That image could not be read. It may be corrupted.') }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
  if (!blob) throw new Error('That image could not be processed.')
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('That image is still over 5 MB after resizing.')
  return { blob, mime: 'image/jpeg', previewUrl: URL.createObjectURL(blob) }
}
