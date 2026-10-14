import { supabase } from '@/integrations/supabase/client';

/**
 * Private file storage on Hostinger.
 *
 * Files are NOT stored in Supabase Storage. They live outside the webroot
 * on Hostinger and are only reachable through file.php, which re-checks
 * the caller's permission on every single request.
 *
 * That means a stored file has no public URL. To display or download one
 * you must fetch it with the user's access token and turn the response
 * into a temporary blob URL — see fetchPrivateFileUrl below.
 */

// Defaults to /api on the same domain, which is where upload.php and
// file.php live. Same-origin means no CORS handshake at all.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

/**
 * Free-text label describing what the document is. The app uses human
 * labels ("Minutes of Meeting") in some places and internal slugs
 * ("tenant_docs") in others; both are fine. The server sanitises it for
 * the folder name and stores the original label in the database.
 */
export type DocumentCategory = string;

export interface UploadedFile {
  id: string;
  file_name: string;
  file_size: number;
  file_url: string;
}

function assertConfigured() {
  if (!API_BASE) {
    throw new Error('File storage is not configured.');
  }
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  return token;
}

/**
 * Send a file to Hostinger and record it in the documents table.
 * Permission is enforced server-side by Supabase RLS, using this user's token.
 */
export async function uploadPrivateFile(params: {
  file: File;
  societyId: string;
  category: DocumentCategory;
  entityId?: string | null;
}): Promise<UploadedFile> {
  assertConfigured();
  const token = await getAccessToken();

  const body = new FormData();
  body.append('file', params.file);
  body.append('society_id', params.societyId);
  body.append('category', params.category);
  if (params.entityId) body.append('entity_id', params.entityId);

  const res = await fetch(`${API_BASE}/upload.php`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Upload failed (server returned ${res.status}).`);
  }

  if (!res.ok) throw new Error(payload?.error || 'Upload failed.');
  return payload as UploadedFile;
}

/**
 * Fetch a stored file and return a temporary object URL usable in
 * <img src> or a download link.
 *
 * IMPORTANT: call revokePrivateFileUrl() when you are finished with it,
 * otherwise the blob stays in memory for the life of the page.
 */
export async function fetchPrivateFileUrl(
  documentId: string,
  opts: { download?: boolean } = {}
): Promise<string> {
  assertConfigured();
  const token = await getAccessToken();

  const url = `${API_BASE}/file.php?id=${encodeURIComponent(documentId)}${
    opts.download ? '&download=1' : ''
  }`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    if (res.status === 404) throw new Error('File not found, or you do not have access to it.');
    if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
    throw new Error(`Could not open the file (server returned ${res.status}).`);
  }

  return URL.createObjectURL(await res.blob());
}

export function revokePrivateFileUrl(objectUrl: string) {
  try {
    URL.revokeObjectURL(objectUrl);
  } catch {
    /* already revoked */
  }
}

/** Open a stored file in a new browser tab. */
export async function openPrivateFile(documentId: string) {
  const objectUrl = await fetchPrivateFileUrl(documentId);
  window.open(objectUrl, '_blank', 'noopener');
  // Give the new tab time to load before releasing the blob
  setTimeout(() => revokePrivateFileUrl(objectUrl), 60_000);
}

/** Download a stored file under its original name. */
export async function downloadPrivateFile(documentId: string, fileName: string) {
  const objectUrl = await fetchPrivateFileUrl(documentId, { download: true });
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => revokePrivateFileUrl(objectUrl), 10_000);
}

/**
 * Older rows may still hold a public Supabase Storage URL. Anything stored
 * by the PHP endpoint is marked with the php:// prefix.
 */
export function isPrivateFile(fileUrl?: string | null): boolean {
  return typeof fileUrl === 'string' && fileUrl.startsWith('php://');
}
