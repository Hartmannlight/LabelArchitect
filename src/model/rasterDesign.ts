export type RasterElement = {
  id: string; kind: 'text' | 'image' | 'rectangle'; x: number; y: number;
  width: number; height: number; text?: string; fontSize?: number; bold?: boolean;
  source?: string; filled?: boolean;
}
export type RasterDesign = { version: 1; name: string; widthMm: number; heightMm: number; elements: RasterElement[] }
export const MAX_RASTER_DESIGN_BYTES = 20_000_000
export const emptyRasterDesign = (): RasterDesign => ({ version: 1, name: 'Image label', widthMm: 40, heightMm: 30, elements: [] })

// getRandomValues also works on LAN HTTP origins, unlike randomUUID().
export const newRasterId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')

export function parseRasterDesign(value: unknown): RasterDesign {
  const doc = value as RasterDesign
  const positive = (n: unknown, max: number) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max
  if (!doc || doc.version !== 1 || typeof doc.name !== 'string' || doc.name.length > 200 || !positive(doc.widthMm, 300) || !positive(doc.heightMm, 300) || !Array.isArray(doc.elements) || doc.elements.length > 100) throw new Error('Invalid image design')
  const ids = new Set<string>()
  for (const item of doc.elements) {
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || !['text', 'image', 'rectangle'].includes(item.kind) || !Number.isFinite(item.x) || !Number.isFinite(item.y) || Math.abs(item.x) > 300 || Math.abs(item.y) > 300 || !positive(item.width, 300) || !positive(item.height, 300)) throw new Error('Invalid design element')
    ids.add(item.id)
    if (item.kind === 'text' && (typeof item.text !== 'string' || item.text.length > 10000 || !positive(item.fontSize, 100))) throw new Error('Invalid text element')
    if (item.kind === 'image' && (typeof item.source !== 'string' || item.source.length > 7_000_000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(item.source))) throw new Error('Only embedded PNG/JPEG images are supported')
  }
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_RASTER_DESIGN_BYTES) throw new Error('Design exceeds 20 MB including embedded images')
  return doc
}

export function serializeRasterDesign(doc: RasterDesign): string {
  return JSON.stringify(parseRasterDesign(doc))
}

export function parseRasterDesignFile(text: string): RasterDesign {
  if (new TextEncoder().encode(text).byteLength > MAX_RASTER_DESIGN_BYTES) throw new Error('Design exceeds 20 MB including embedded images')
  return parseRasterDesign(JSON.parse(text))
}

export function loadRasterImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => image.naturalWidth * image.naturalHeight <= 25_000_000 ? resolve(image) : reject(new Error('Image exceeds 25 megapixels'))
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = source
  })
}

export async function renderRasterDesign(doc: RasterDesign, dpi: number): Promise<HTMLCanvasElement> {
  parseRasterDesign(doc)
  if (!Number.isInteger(dpi) || dpi < 100 || dpi > 600) throw new Error('Unsupported printer resolution')
  const scale = dpi / 25.4
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(doc.widthMm * scale)); canvas.height = Math.max(1, Math.round(doc.heightMm * scale))
  if (canvas.width * canvas.height > 16_000_000) throw new Error('Label exceeds 16 megapixels')
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale); ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.textBaseline = 'top'
  for (const item of doc.elements) {
    ctx.save(); ctx.beginPath(); ctx.rect(item.x, item.y, item.width, item.height); ctx.clip()
    if (item.kind === 'image') {
      const image = await loadRasterImage(item.source!)
      const fit = Math.min(item.width / image.naturalWidth, item.height / image.naturalHeight)
      const w = image.naturalWidth * fit; const h = image.naturalHeight * fit
      ctx.drawImage(image, item.x + (item.width - w) / 2, item.y + (item.height - h) / 2, w, h)
    } else if (item.kind === 'rectangle') {
      ctx.lineWidth = .3
      if (item.filled) ctx.fillRect(item.x, item.y, item.width, item.height)
      else ctx.strokeRect(item.x + .15, item.y + .15, item.width - .3, item.height - .3)
    } else {
      // After scale(), font sizes are in the same millimetre user coordinates.
      ctx.font = `${item.bold ? 'bold ' : ''}${item.fontSize}px Arial, sans-serif`
      item.text!.split('\n').forEach((line, index) => ctx.fillText(line, item.x, item.y + index * item.fontSize! * 1.2))
    }
    ctx.restore()
  }
  // Match the backend's no-dither threshold so the preview is the printed bitmap.
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let n = 0; n < pixels.data.length; n += 4) {
    const v = .299 * pixels.data[n] + .587 * pixels.data[n + 1] + .114 * pixels.data[n + 2] >= 128 ? 255 : 0
    pixels.data[n] = pixels.data[n + 1] = pixels.data[n + 2] = v
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}
