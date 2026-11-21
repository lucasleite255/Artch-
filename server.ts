import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig: FirebaseAppletConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf8')
);

const BOOTSTRAPPED_ADMIN_EMAILS = new Set([
  'lucasleite255@gmail.com',
  'artchesul@gmail.com',
]);
const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_IMAGE_MIMES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

const ALLOWED_VIDEO_MIMES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const MAX_IMAGE_BYTES = 680 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const VIDEO_CHUNK_BYTES = 512 * 1024;

function filenameToMediaId(filename: string): string | null {
  const clean = filename.trim();
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif|mp4|webm|mov)$/i.test(clean)) return null;
  const mediaId = clean.toLowerCase().replace(/\./g, '-');
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(mediaId)) return null;
  return mediaId;
}

async function persistImageToFirestore(params: {
  filename: string;
  mimeType: string;
  body: Buffer;
  uid: string;
  idToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const mediaId = filenameToMediaId(params.filename);
  if (!mediaId) {
    return { ok: false, error: 'Nome de arquivo inválido para persistência.' };
  }
  const normalizedMime = params.mimeType === 'image/jpg' ? 'image/jpeg' : params.mimeType;
  const base64 = params.body.toString('base64');
  if (base64.length > 920000 || params.body.length > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: 'A imagem ficou acima do limite persistente. Tente uma foto menor ou em JPG.',
    };
  }

  const docName = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/mediaAssets/${mediaId}`;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents:commit`;

  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields: {
              id: { stringValue: mediaId },
              filename: { stringValue: params.filename },
              mimeType: { stringValue: normalizedMime },
              mediaType: { stringValue: 'image' },
              dataBase64: { stringValue: base64 },
              chunkCount: { integerValue: '0' },
              size: { integerValue: String(params.body.length) },
              status: { stringValue: 'active' },
              createdBy: { stringValue: params.uid },
            },
          },
          updateTransforms: [
            {
              fieldPath: 'createdAt',
              setToServerValue: 'REQUEST_TIME',
            },
          ],
          currentDocument: { exists: false },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('Firestore mediaAssets image persist failed:', res.status, errText);
    return {
      ok: false,
      error: 'Não foi possível salvar a imagem permanentemente no banco de dados.',
    };
  }

  return { ok: true };
}

async function persistVideoToFirestore(params: {
  filename: string;
  mimeType: string;
  body: Buffer;
  uid: string;
  idToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const mediaId = filenameToMediaId(params.filename);
  if (!mediaId) {
    return { ok: false, error: 'Nome de vídeo inválido para persistência.' };
  }
  if (params.body.length > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      error: 'O vídeo excede o limite de 25 MB para armazenamento permanente.',
    };
  }

  const chunkCount = Math.ceil(params.body.length / VIDEO_CHUNK_BYTES);
  if (chunkCount < 1 || chunkCount > 60) {
    return {
      ok: false,
      error: 'O vídeo excede o limite de 25 MB para armazenamento permanente.',
    };
  }

  const baseDocPath = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/mediaAssets/${mediaId}`;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents:commit`;

  const CHUNKS_PER_COMMIT = 4;
  for (let start = 0; start < chunkCount; start += CHUNKS_PER_COMMIT) {
    const writes: Array<Record<string, unknown>> = [];
    for (let i = start; i < Math.min(start + CHUNKS_PER_COMMIT, chunkCount); i++) {
      const slice = params.body.subarray(i * VIDEO_CHUNK_BYTES, (i + 1) * VIDEO_CHUNK_BYTES);
      const chunkId = `c${i}`;
      writes.push({
        update: {
          name: `${baseDocPath}/chunks/${chunkId}`,
          fields: {
            id: { stringValue: chunkId },
            mediaId: { stringValue: mediaId },
            index: { integerValue: String(i) },
            dataBase64: { stringValue: slice.toString('base64') },
            status: { stringValue: 'active' },
            createdBy: { stringValue: params.uid },
          },
        },
        updateTransforms: [
          {
            fieldPath: 'createdAt',
            setToServerValue: 'REQUEST_TIME',
          },
        ],
        currentDocument: { exists: false },
      });
    }

    const chunkRes = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ writes }),
    });

    if (!chunkRes.ok) {
      const errText = await chunkRes.text().catch(() => '');
      console.error('Firestore mediaChunks persist failed:', chunkRes.status, errText);
      return {
        ok: false,
        error: 'Não foi possível salvar o vídeo permanentemente no banco de dados.',
      };
    }
  }

  const manifestRes = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: baseDocPath,
            fields: {
              id: { stringValue: mediaId },
              filename: { stringValue: params.filename },
              mimeType: { stringValue: params.mimeType },
              mediaType: { stringValue: 'video' },
              dataBase64: { stringValue: '' },
              chunkCount: { integerValue: String(chunkCount) },
              size: { integerValue: String(params.body.length) },
              status: { stringValue: 'active' },
              createdBy: { stringValue: params.uid },
            },
          },
          updateTransforms: [
            {
              fieldPath: 'createdAt',
              setToServerValue: 'REQUEST_TIME',
            },
          ],
          currentDocument: { exists: false },
        },
      ],
    }),
  });

  if (!manifestRes.ok) {
    const errText = await manifestRes.text().catch(() => '');
    console.error('Firestore mediaAssets video manifest persist failed:', manifestRes.status, errText);
    return {
      ok: false,
      error: 'Não foi possível registrar o vídeo permanentemente no banco de dados.',
    };
  }

  return { ok: true };
}

const restoringUploads = new Map<string, Promise<string | null>>();

async function restoreMediaFileFromFirestore(filename: string): Promise<string | null> {
  const mediaId = filenameToMediaId(filename);
  if (!mediaId) return null;

  const targetPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(targetPath)) {
    return targetPath;
  }

  const existingPromise = restoringUploads.get(filename);
  if (existingPromise) {
    return existingPromise;
  }

  const restorePromise = (async (): Promise<string | null> => {
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(
      firebaseConfig.firestoreDatabaseId
    )}/documents/mediaAssets/${encodeURIComponent(mediaId)}`;

    try {
      const res = await fetch(baseUrl);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        fields?: {
          status?: { stringValue?: string };
          mimeType?: { stringValue?: string };
          dataBase64?: { stringValue?: string };
          chunkCount?: { integerValue?: string };
        };
      };
      const f = data.fields;
      if (!f || f.status?.stringValue !== 'active') {
        return null;
      }

      const chunkCount = Number(f.chunkCount?.integerValue || '0');
      let finalBuffer: Buffer;

      if (chunkCount > 0) {
        const buffers: Buffer[] = new Array(chunkCount);
        const FETCH_BATCH = 8;
        for (let start = 0; start < chunkCount; start += FETCH_BATCH) {
          const indices: number[] = [];
          for (let i = start; i < Math.min(start + FETCH_BATCH, chunkCount); i++) {
            indices.push(i);
          }
          const fetched = await Promise.all(
            indices.map(async (idx) => {
              const chunkRes = await fetch(`${baseUrl}/chunks/c${idx}`);
              if (!chunkRes.ok) return null;
              const chunkData = (await chunkRes.json()) as {
                fields?: {
                  status?: { stringValue?: string };
                  dataBase64?: { stringValue?: string };
                };
              };
              const cf = chunkData.fields;
              if (!cf || cf.status?.stringValue !== 'active' || !cf.dataBase64?.stringValue) {
                return null;
              }
              return Buffer.from(cf.dataBase64.stringValue, 'base64');
            })
          );
          for (let j = 0; j < indices.length; j++) {
            const buf = fetched[j];
            if (!buf) return null;
            buffers[indices[j]] = buf;
          }
        }
        finalBuffer = Buffer.concat(buffers);
      } else if (f.dataBase64?.stringValue) {
        finalBuffer = Buffer.from(f.dataBase64.stringValue, 'base64');
      } else {
        return null;
      }

      if (finalBuffer.length === 0) return null;

      const tmpPath = `${targetPath}.tmp-${crypto.randomUUID().slice(0, 8)}`;
      await fs.promises.writeFile(tmpPath, finalBuffer);
      await fs.promises.rename(tmpPath, targetPath);
      return targetPath;
    } catch (err) {
      console.error('Failed to restore media from Firestore:', filename, err);
      return null;
    }
  })().finally(() => {
    restoringUploads.delete(filename);
  });

  restoringUploads.set(filename, restorePromise);
  return restorePromise;
}

async function listFirestoreMediaAssets(
  idToken: string
): Promise<Array<{ filename: string; mediaType: 'image' | 'video'; mtimeMs: number }>> {
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents:runQuery`;

  try {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          select: {
            fields: [
              { fieldPath: 'filename' },
              { fieldPath: 'mediaType' },
              { fieldPath: 'mimeType' },
              { fieldPath: 'createdAt' },
            ],
          },
          from: [{ collectionId: 'mediaAssets' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'active' },
            },
          },
        },
      }),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      document?: {
        fields?: {
          filename?: { stringValue?: string };
          mediaType?: { stringValue?: string };
          mimeType?: { stringValue?: string };
          createdAt?: { timestampValue?: string };
        };
      };
    }>;
    const out: Array<{ filename: string; mediaType: 'image' | 'video'; mtimeMs: number }> = [];
    for (const row of rows) {
      const fn = row.document?.fields?.filename?.stringValue;
      if (!fn) continue;
      const declaredType = row.document?.fields?.mediaType?.stringValue;
      const mimeType = row.document?.fields?.mimeType?.stringValue || '';
      const isVid =
        declaredType === 'video' ||
        mimeType.startsWith('video/') ||
        /\.(mp4|webm|mov)$/i.test(fn);
      const ts = row.document?.fields?.createdAt?.timestampValue;
      const mtimeMs = ts ? Date.parse(ts) || 0 : 0;
      out.push({ filename: fn, mediaType: isVid ? 'video' : 'image', mtimeMs });
    }
    return out;
  } catch {
    return [];
  }
}

async function verifyAdminToken(authHeader: string | undefined): Promise<{
  ok: boolean;
  uid?: string;
  idToken?: string;
  reason?: string;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'Token de autenticação ausente.' };
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return { ok: false, reason: 'Token inválido.' };
  }

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!lookupRes.ok) {
    return { ok: false, reason: 'Sessão expirada ou inválida. Faça login novamente.' };
  }

  const lookupData = (await lookupRes.json()) as {
    users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
  };
  const user = lookupData.users?.[0];
  if (!user?.localId || !user.emailVerified) {
    return {
      ok: false,
      reason: 'E-mail da conta ainda não verificado. Confirme seu e-mail antes de enviar arquivos.',
    };
  }

  if (user.email && BOOTSTRAPPED_ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return { ok: true, uid: user.localId, idToken };
  }

  const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents/admins/${encodeURIComponent(
    user.localId
  )}`;

  const adminRes = await fetch(adminDocUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!adminRes.ok) {
    return { ok: false, reason: 'Permissão administrativa necessária para enviar arquivos.' };
  }

  const adminDoc = (await adminRes.json()) as {
    fields?: { role?: { stringValue?: string } };
  };

  if (adminDoc.fields?.role?.stringValue !== 'admin') {
    return { ok: false, reason: 'Permissão administrativa necessária para enviar arquivos.' };
  }

  return { ok: true, uid: user.localId, idToken };
}

interface ProductShareMeta {
  id: string;
  name: string;
  brand: string;
  cover: string;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function loadBaseProductsMeta(): Map<string, ProductShareMeta> {
  const map = new Map<string, ProductShareMeta>();
  try {
    const catalogPath = path.resolve(process.cwd(), 'src', 'data', 'catalog.ts');
    if (!fs.existsSync(catalogPath)) return map;
    const raw = fs.readFileSync(catalogPath, 'utf8');
    const startIdx = raw.indexOf('export const PRODUCTS');
    const endIdx = raw.indexOf('export function', startIdx > 0 ? startIdx : 0);
    const slice = startIdx >= 0 ? raw.slice(startIdx, endIdx > startIdx ? endIdx : undefined) : raw;

    const entryRegex = /\{\s*id:\s*'([^']+)'([\s\S]*?)\n\s*\},/g;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(slice)) !== null) {
      const id = match[1];
      const body = match[2];
      const nameMatch = body.match(/name:\s*'((?:\\'|[^'])*)'/);
      const brandMatch = body.match(/brand:\s*'((?:\\'|[^'])*)'/);
      const coverMatch = body.match(/cover:\s*'((?:\\'|[^'])*)'/);
      const firstImageMatch = body.match(/images:\s*\[\s*'((?:\\'|[^'])*)'/);
      const name = (nameMatch?.[1] || '').replace(/\\'/g, "'");
      const brand = (brandMatch?.[1] || '').replace(/\\'/g, "'");
      const cover = (coverMatch?.[1] || firstImageMatch?.[1] || '').replace(/\\'/g, "'");
      if (id && name && cover) {
        map.set(id, { id, name, brand, cover });
      }
    }
  } catch {
    // Non-fatal fallback if source catalog is unavailable
  }
  return map;
}

const BASE_PRODUCTS_META = loadBaseProductsMeta();

async function resolveProductShareMeta(productId: string): Promise<ProductShareMeta | null> {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(productId)) return null;

  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(
      firebaseConfig.firestoreDatabaseId
    )}/documents/products/${encodeURIComponent(productId)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(docUrl, { signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );

    if (res.ok) {
      const data = (await res.json()) as {
        fields?: {
          status?: { stringValue?: string };
          name?: { stringValue?: string };
          brand?: { stringValue?: string };
          cover?: { stringValue?: string };
          images?: { arrayValue?: { values?: Array<{ stringValue?: string }> } };
        };
      };
      const f = data.fields;
      if (f && f.status?.stringValue === 'active') {
        const cover =
          f.cover?.stringValue ||
          f.images?.arrayValue?.values?.[0]?.stringValue ||
          '';
        if (f.name?.stringValue && cover) {
          return {
            id: productId,
            name: f.name.stringValue,
            brand: f.brand?.stringValue || '',
            cover,
          };
        }
      }
    }
  } catch {
    // Fall back to static base catalog metadata
  }

  return BASE_PRODUCTS_META.get(productId) || null;
}

function getRequestOrigin(req: Request): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    typeof protoHeader === 'string' && protoHeader.trim()
      ? protoHeader.split(',')[0].trim()
      : req.protocol || 'https';
  const hostHeader = req.headers['x-forwarded-host'] || req.get('host') || '';
  const host = typeof hostHeader === 'string' ? hostHeader.split(',')[0].trim() : '';
  return host ? `${proto}://${host}` : '';
}

function injectProductMetaHtml(
  html: string,
  meta: ProductShareMeta,
  origin: string,
  requestPath: string
): string {
  const title = `${meta.name} | Artchê`;
  const description = `${meta.brand || 'Seleção Artchê'} · Ref. ${meta.id}. Consulte tamanhos, cores, valor e disponibilidade na Artchê pelo WhatsApp.`;
  const imageUrl = /^https?:\/\//i.test(meta.cover)
    ? meta.cover
    : origin
      ? `${origin}${meta.cover.startsWith('/') ? meta.cover : `/${meta.cover}`}`
      : meta.cover;
  const pageUrl = origin ? `${origin}${requestPath}` : requestPath;

  const escapedTitle = escapeHtmlAttr(title);
  const escapedDesc = escapeHtmlAttr(description);
  const escapedImg = escapeHtmlAttr(imageUrl);
  const escapedName = escapeHtmlAttr(meta.name);
  const escapedUrl = escapeHtmlAttr(pageUrl);

  let updated = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/?>/i,
      `<meta name="description" content="${escapedDesc}" />`
    )
    .replace(
      /<meta\s+property="og:title"[\s\S]*?\/?>/i,
      `<meta property="og:title" content="${escapedTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"[\s\S]*?\/?>/i,
      `<meta property="og:description" content="${escapedDesc}" />`
    )
    .replace(
      /<meta\s+property="og:type"[\s\S]*?\/?>/i,
      `<meta property="og:type" content="product" />`
    );

  const extraTags = [
    `<meta property="og:url" content="${escapedUrl}" />`,
    `<meta property="og:image" content="${escapedImg}" />`,
    `<meta property="og:image:secure_url" content="${escapedImg}" />`,
    `<meta property="og:image:alt" content="${escapedName}" />`,
    `<meta name="twitter:title" content="${escapedTitle}" />`,
    `<meta name="twitter:description" content="${escapedDesc}" />`,
    `<meta name="twitter:image" content="${escapedImg}" />`,
  ].join('\n    ');

  return updated.replace('</head>', `    ${extraTags}\n  </head>`);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);

  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      maxAge: '7d',
      acceptRanges: true,
      setHeaders: (res, filePath) => {
        if (filePath.toLowerCase().endsWith('.mov')) {
          res.setHeader('Content-Type', 'video/mp4');
        }
      },
    })
  );
  app.get('/uploads/:filename', async (req: Request, res: Response) => {
    const filename = String(req.params.filename || '').trim();
    const restoredPath = await restoreMediaFileFromFirestore(filename);
    if (!restoredPath) {
      res.status(404).end();
      return;
    }

    res.sendFile(restoredPath, {
      maxAge: '7d',
      acceptRanges: true,
      headers: filename.toLowerCase().endsWith('.mov')
        ? { 'Content-Type': 'video/mp4' }
        : undefined,
    });
  });
  app.use('/uploads', (_req: Request, res: Response) => {
    res.status(404).end();
  });

  app.post(
    '/api/media/upload',
    express.raw({ type: ['image/*', 'video/*'], limit: '28mb' }),
    async (req: Request, res: Response) => {
      try {
        const authCheck = await verifyAdminToken(req.headers.authorization);
        if (!authCheck.ok || !authCheck.uid || !authCheck.idToken) {
          res.status(401).json({ error: authCheck.reason || 'Não autorizado.' });
          return;
        }

        const rawContentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const isImage = rawContentType in ALLOWED_IMAGE_MIMES;
        const isVideo = rawContentType in ALLOWED_VIDEO_MIMES;

        if (!isImage && !isVideo) {
          res.status(400).json({
            error:
              'Formato não suportado. Use imagens (JPG, PNG, WebP, AVIF) ou vídeos (MP4, WebM, MOV).',
          });
          return;
        }

        const body = req.body;
        if (!Buffer.isBuffer(body) || body.length === 0) {
          res.status(400).json({ error: 'Arquivo vazio ou não recebido.' });
          return;
        }

        if (isImage && body.length > MAX_IMAGE_BYTES) {
          res.status(413).json({
            error: 'A imagem excede o limite de armazenamento permanente. Tente uma foto menor.',
          });
          return;
        }

        if (isVideo && body.length > MAX_VIDEO_BYTES) {
          res.status(413).json({
            error:
              'O vídeo excede o limite de 25 MB para armazenamento permanente. Envie um vídeo MP4 de até 25 MB.',
          });
          return;
        }

        const ext = isImage
          ? ALLOWED_IMAGE_MIMES[rawContentType]
          : ALLOWED_VIDEO_MIMES[rawContentType];
        const prefix = isVideo ? 'video' : 'foto';
        const filename = `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
        const targetPath = path.join(UPLOADS_DIR, filename);

        if (isImage) {
          const persisted = await persistImageToFirestore({
            filename,
            mimeType: rawContentType,
            body,
            uid: authCheck.uid,
            idToken: authCheck.idToken,
          });
          if (!persisted.ok) {
            res.status(500).json({
              error: persisted.error || 'Não foi possível salvar a imagem permanentemente.',
            });
            return;
          }
        } else if (isVideo) {
          const persisted = await persistVideoToFirestore({
            filename,
            mimeType: rawContentType,
            body,
            uid: authCheck.uid,
            idToken: authCheck.idToken,
          });
          if (!persisted.ok) {
            res.status(500).json({
              error: persisted.error || 'Não foi possível salvar o vídeo permanentemente.',
            });
            return;
          }
        }

        await fs.promises.writeFile(targetPath, body);

        res.status(201).json({
          url: `/uploads/${filename}`,
          mediaType: isVideo ? 'video' : 'image',
          mimeType: rawContentType === 'image/jpg' ? 'image/jpeg' : rawContentType,
          size: body.length,
        });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Erro interno ao salvar o arquivo enviado.' });
      }
    }
  );

  app.get('/api/media/library', async (req: Request, res: Response) => {
    try {
      const authCheck = await verifyAdminToken(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(401).json({ error: authCheck.reason || 'Não autorizado.' });
        return;
      }

      const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
      const videoExts = new Set(['.mp4', '.webm', '.mov']);
      const ignoredSubdirs = new Set(['aistudio', 'brands']);
      const ignoredFiles = new Set(['artche-logo.png']);

      const items: Array<{
        url: string;
        filename: string;
        folder: string;
        mediaType: 'image' | 'video';
        mtimeMs: number;
      }> = [];
      const seenUrls = new Set<string>();

      const scanDir = async (dirPath: string, urlPrefix: string, topFolder: string) => {
        if (!fs.existsSync(dirPath)) return;
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            if (urlPrefix === '/assets' && ignoredSubdirs.has(entry.name)) continue;
            const nextFolder = topFolder === 'assets' ? entry.name : topFolder;
            await scanDir(fullPath, `${urlPrefix}/${entry.name}`, nextFolder);
          } else if (entry.isFile()) {
            const lower = entry.name.toLowerCase();
            if (ignoredFiles.has(lower)) continue;
            const ext = path.extname(lower);
            const isImg = imageExts.has(ext);
            const isVid = videoExts.has(ext);
            if (!isImg && !isVid) continue;
            const url = `${urlPrefix}/${entry.name}`;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);
            const stat = await fs.promises.stat(fullPath).catch(() => null);
            items.push({
              url,
              filename: entry.name,
              folder: topFolder,
              mediaType: isVid ? 'video' : 'image',
              mtimeMs: stat?.mtimeMs || 0,
            });
          }
        }
      };

      await scanDir(UPLOADS_DIR, '/uploads', 'uploads');

      if (authCheck.idToken) {
        const persistedAssets = await listFirestoreMediaAssets(authCheck.idToken);
        for (const asset of persistedAssets) {
          const url = `/uploads/${asset.filename}`;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          items.push({
            url,
            filename: asset.filename,
            folder: 'uploads',
            mediaType: asset.mediaType,
            mtimeMs: asset.mtimeMs,
          });
        }
      }

      const publicAssetsDir = path.resolve(process.cwd(), 'public', 'assets');
      const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
      if (fs.existsSync(publicAssetsDir)) {
        await scanDir(publicAssetsDir, '/assets', 'assets');
      } else if (fs.existsSync(distAssetsDir)) {
        await scanDir(distAssetsDir, '/assets', 'assets');
      }

      items.sort((a, b) => {
        if (a.folder === 'uploads' && b.folder !== 'uploads') return -1;
        if (b.folder === 'uploads' && a.folder !== 'uploads') return 1;
        if (a.folder === 'uploads' && b.folder === 'uploads') return b.mtimeMs - a.mtimeMs;
        return a.url.localeCompare(b.url, 'pt-BR');
      });

      res.status(200).json({
        items: items.map(({ url, filename, folder, mediaType }) => ({
          url,
          filename,
          folder,
          mediaType,
        })),
      });
    } catch (err) {
      console.error('Media library list error:', err);
      res.status(500).json({ error: 'Erro ao listar imagens do acervo.' });
    }
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') && err && typeof err === 'object' && 'type' in err) {
      const payloadErr = err as { type?: string };
      if (payloadErr.type === 'entity.too.large') {
        res.status(413).json({
          error: 'O arquivo excede o tamanho máximo permitido (25 MB) para armazenamento permanente.',
        });
        return;
      }
    }
    next(err);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');
    app.use(express.static(distDir));
    app.get(/^\/produto\/([^/]+)\/?$/, async (req: Request, res: Response) => {
      try {
        const html = await fs.promises.readFile(indexHtmlPath, 'utf8');
        const productId = decodeURIComponent(req.params[0] || '');
        const meta = await resolveProductShareMeta(productId);
        if (meta) {
          res
            .status(200)
            .type('html')
            .send(injectProductMetaHtml(html, meta, getRequestOrigin(req), req.originalUrl));
          return;
        }
        res.status(200).type('html').send(html);
      } catch {
        res.sendFile(indexHtmlPath);
      }
    });
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        next();
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.get(/^\/produto\/([^/]+)\/?$/, async (req: Request, res: Response, next: NextFunction) => {
      const accept = req.headers.accept || '';
      if (!accept.includes('text/html') && !accept.includes('*/*')) {
        next();
        return;
      }
      try {
        const rawHtml = await fs.promises.readFile(
          path.resolve(process.cwd(), 'index.html'),
          'utf8'
        );
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const productId = decodeURIComponent(req.params[0] || '');
        const meta = await resolveProductShareMeta(productId);
        const output = meta
          ? injectProductMetaHtml(transformed, meta, getRequestOrigin(req), req.originalUrl)
          : transformed;
        res.status(200).type('html').send(output);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Artchê server listening on port ${PORT}`);
  });
}

void startServer();
