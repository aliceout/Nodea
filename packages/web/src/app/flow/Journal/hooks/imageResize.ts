/**
 * Client-side image resize for Journal attachments.
 *
 * Phone photos run 3-5 MB raw. Inlined as-is into the encrypted
 * payload that's a non-starter — the entry would balloon and every
 * decrypt of the journal list would carry the cost. Resize them
 * down before they leave the file picker.
 *
 * Strategy: max 1600 px on the longest side, JPEG q=0.82 — balances
 * « still readable on a phone » with « kilobytes, not megabytes ».
 * PNGs and WebPs get re-encoded to JPEG (we don't need transparency
 * for journal photos; sticking to one MIME keeps the renderer
 * simple).
 */

const MAX_LONGEST_SIDE = 1600;
const JPEG_QUALITY = 0.82;

export interface ResizedImage {
  /** MIME of the resized payload. Always `image/jpeg` for the
   *  current pipeline. */
  mime: string;
  /** Base64 of the raw bytes (no `data:…;base64,` prefix). */
  data: string;
  /** Approximate byte size after resize, computed from the base64
   *  length — useful for the « x KB » display in the thumbnail
   *  strip. Not a hard guarantee. */
  byteSize: number;
}

export async function resizeImageFile(file: File): Promise<ResizedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { width, height } = scaledDimensions(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.drawImage(img, 0, 0, width, height);
  const outDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  // toDataURL returns « data:image/jpeg;base64,xxx ». Strip prefix.
  const comma = outDataUrl.indexOf(',');
  if (comma < 0) throw new Error('Invalid image encoding.');
  const data = outDataUrl.slice(comma + 1);
  return {
    mime: 'image/jpeg',
    data,
    byteSize: Math.floor((data.length * 3) / 4),
  };
}

function scaledDimensions(w: number, h: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= MAX_LONGEST_SIDE) return { width: w, height: h };
  const scale = MAX_LONGEST_SIDE / longest;
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader returned a non-string.'));
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image non lisible."));
    img.src = src;
  });
}

/** Stitch a base64 + mime back into a renderable data URL. */
export function attachmentSrc(attachment: { mime: string; data: string }): string {
  return `data:${attachment.mime};base64,${attachment.data}`;
}
