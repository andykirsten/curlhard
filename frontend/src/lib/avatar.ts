/** Kantenlänge des hochgeladenen Avatars in Pixeln. */
export const AVATAR_SIZE = 256
const JPEG_QUALITY = 0.85

interface LoadedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsDataURL(file)
  })
}

/**
 * Lädt die Datei als Bildquelle. Ohne createImageBitmap wird eine data:-URL genutzt,
 * weil die CSP `img-src` nur 'self' und data: erlaubt (keine blob:-URLs).
 */
async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    }
  }
  const dataUrl = await readAsDataUrl(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Ungültiges Bild'))
    img.src = dataUrl
  })
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => undefined,
  }
}

/**
 * Schneidet ein Bild mittig quadratisch zu und skaliert es auf 256×256 px als JPEG.
 * Transparenz (PNG/WebP) wird auf Weiß gelegt, da JPEG keinen Alphakanal hat.
 */
export async function resizeAvatar(file: File): Promise<Blob> {
  let image: LoadedImage
  try {
    image = await loadImage(file)
  } catch {
    throw new Error('Ungültiges Bild')
  }
  try {
    const side = Math.min(image.width, image.height)
    if (side <= 0) throw new Error('Ungültiges Bild')
    const sx = (image.width - side) / 2
    const sy = (image.height - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas nicht verfügbar')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image.source, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('Bild konnte nicht verarbeitet werden')),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
  } finally {
    image.release()
  }
}
