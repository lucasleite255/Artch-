import { auth } from './firebase';

export interface UploadedMediaResult {
  url: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  size: number;
}

const SUPPORTED_DIRECT_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_DURABLE_IMAGE_BYTES = 450 * 1024;
const IMAGE_DIM_STEPS = [1400, 1100, 880];
const IMAGE_QUALITY_STEPS = [0.86, 0.78, 0.68, 0.56];

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

async function prepareImageForUpload(
  file: File | Blob,
  safeName: string
): Promise<{ payload: Blob; mimeType: string; filename: string }> {
  const rawType = (file.type || '').toLowerCase();
  const isImageLike =
    rawType.startsWith('image/') ||
    /\.(jpe?g|png|webp|avif|jfif|bmp|gif|heic|heif)$/i.test(safeName);

  if (!isImageLike || typeof document === 'undefined') {
    return {
      payload: file,
      mimeType: rawType || 'application/octet-stream',
      filename: safeName,
    };
  }

  const normalizedMime = rawType === 'image/jpg' ? 'image/jpeg' : rawType;
  if (SUPPORTED_DIRECT_IMAGE_MIMES.has(normalizedMime) && file.size <= MAX_DURABLE_IMAGE_BYTES) {
    return {
      payload: file,
      mimeType: normalizedMime,
      filename: safeName,
    };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;

    const finishFallback = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve({
        payload: file,
        mimeType: SUPPORTED_DIRECT_IMAGE_MIMES.has(normalizedMime) ? normalizedMime : 'image/jpeg',
        filename: safeName,
      });
    };

    img.onload = async () => {
      if (settled) return;
      try {
        const w = img.naturalWidth || 1200;
        const h = img.naturalHeight || 1500;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finishFallback();
          return;
        }

        let bestBlob: Blob | null = null;
        for (const maxDim of IMAGE_DIM_STEPS) {
          const scale = Math.min(1, maxDim / Math.max(w, h));
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          for (const quality of IMAGE_QUALITY_STEPS) {
            const candidate = await canvasToBlob(canvas, 'image/jpeg', quality);
            if (!candidate) continue;
            bestBlob = candidate;
            if (candidate.size <= MAX_DURABLE_IMAGE_BYTES) {
              settled = true;
              URL.revokeObjectURL(objectUrl);
              const nextName = safeName.replace(/\.[^.]+$/, '') + '.jpg';
              resolve({
                payload: candidate,
                mimeType: 'image/jpeg',
                filename: nextName,
              });
              return;
            }
          }
        }

        settled = true;
        URL.revokeObjectURL(objectUrl);
        if (bestBlob) {
          const nextName = safeName.replace(/\.[^.]+$/, '') + '.jpg';
          resolve({
            payload: bestBlob,
            mimeType: 'image/jpeg',
            filename: nextName,
          });
          return;
        }
        resolve({
          payload: file,
          mimeType: SUPPORTED_DIRECT_IMAGE_MIMES.has(normalizedMime) ? normalizedMime : 'image/jpeg',
          filename: safeName,
        });
      } catch {
        finishFallback();
      }
    };

    img.onerror = finishFallback;
    img.src = objectUrl;
  });
}

export async function uploadMediaFile(file: File | Blob, filename?: string): Promise<UploadedMediaResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login com sua conta administradora para enviar arquivos.');
  }

  const idToken = await user.getIdToken();
  const initialName = filename || (file instanceof File ? file.name : 'arquivo.jpg');
  const prepared = await prepareImageForUpload(file, initialName);

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': prepared.mimeType,
      'X-File-Name': encodeURIComponent(prepared.filename),
    },
    body: prepared.payload,
  });

  const data = (await response.json().catch(() => ({}))) as Partial<UploadedMediaResult> & {
    error?: string;
  };

  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Não foi possível enviar o arquivo.');
  }

  return {
    url: data.url,
    mediaType: data.mediaType === 'video' ? 'video' : 'image',
    mimeType: data.mimeType || prepared.mimeType,
    size: data.size || prepared.payload.size,
  };
}

export interface SiteMediaAsset {
  url: string;
  filename: string;
  folder: string;
  mediaType: 'image' | 'video';
}

export async function listSiteMediaLibrary(): Promise<SiteMediaAsset[]> {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/media/library', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!response.ok) return [];
    const data = (await response.json().catch(() => ({}))) as { items?: SiteMediaAsset[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function captureVideoPosterBlob(videoFile: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    let settled = false;

    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(blob);
    };

    const timer = window.setTimeout(() => finish(null), 4000);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.2, video.duration ? video.duration * 0.1 : 0);
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 800;
        const maxDim = 900;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.clearTimeout(timer);
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            window.clearTimeout(timer);
            finish(blob);
          },
          'image/jpeg',
          0.84
        );
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };

    video.src = objectUrl;
  });
}
