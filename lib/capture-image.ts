export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_OCR_IMAGE_BYTES = 3 * 1024 * 1024;

const MAX_OCR_IMAGE_DIMENSION = 2400;
const JPEG_QUALITIES = [0.86, 0.76, 0.66, 0.56];
const RESIZE_ATTEMPTS = 5;

export type OcrImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export type PreparedOcrImage = {
  base64: string;
  mimeType: OcrImageMimeType;
  originalBytes: number;
  preparedBytes: number;
  optimized: boolean;
};

export function isOcrImageMimeType(value: string): value is OcrImageMimeType {
  return value === 'image/png' || value === 'image/jpeg' || value === 'image/webp';
}

export function formatImageBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this image. Try uploading it again.'));
    reader.onabort = () => reject(new Error('Image reading was interrupted.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This image could not be decoded. Try exporting it as JPEG or PNG.'));
    };
    image.src = objectUrl;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('This browser could not prepare the image for OCR.'));
    }, 'image/jpeg', quality);
  });
}

async function toPreparedImage(
  blob: Blob,
  mimeType: OcrImageMimeType,
  originalBytes: number,
  optimized: boolean,
): Promise<PreparedOcrImage> {
  const dataUrl = await readBlobAsDataUrl(blob);
  const separator = dataUrl.indexOf(',');
  if (separator === -1) throw new Error('This image could not be encoded for OCR.');

  return {
    base64: dataUrl.slice(separator + 1),
    mimeType,
    originalBytes,
    preparedBytes: blob.size,
    optimized,
  };
}

/**
 * Keeps OCR uploads below Vercel's 4.5 MB function payload limit.
 *
 * JSON carries the image as Base64, which is roughly 4/3 the binary size. A
 * 3 MB binary cap leaves room for that expansion and the surrounding JSON.
 * Large phone photos are converted to JPEG and progressively resized until
 * they fit, before any request or billable Azure OCR operation is attempted.
 */
export async function prepareImageForOcr(file: File): Promise<PreparedOcrImage> {
  if (!isOcrImageMimeType(file.type)) {
    throw new Error('Use a PNG, JPEG, or WebP image.');
  }
  if (file.size === 0 || file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error(`Choose a non-empty image up to ${formatImageBytes(MAX_SOURCE_IMAGE_BYTES)}.`);
  }

  if (file.size <= MAX_OCR_IMAGE_BYTES) {
    return toPreparedImage(file, file.type, file.size, false);
  }

  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('This image has invalid dimensions.');

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser cannot resize images for OCR.');

  let scale = Math.min(1, MAX_OCR_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
  let smallestBlob: Blob | null = null;

  for (let attempt = 0; attempt < RESIZE_ATTEMPTS; attempt += 1) {
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of JPEG_QUALITIES) {
      const blob = await canvasToJpeg(canvas, quality);
      if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
      if (blob.size <= MAX_OCR_IMAGE_BYTES) {
        return toPreparedImage(blob, 'image/jpeg', file.size, true);
      }
    }

    scale *= 0.78;
  }

  if (smallestBlob && smallestBlob.size <= MAX_OCR_IMAGE_BYTES) {
    return toPreparedImage(smallestBlob, 'image/jpeg', file.size, true);
  }

  throw new Error('This photo is still too large after compression. Try cropping it to the note page.');
}
