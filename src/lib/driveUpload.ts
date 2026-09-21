// Uploads a file to Drive using the resumable upload protocol (see the PRD's
// reliability requirement), so a dropped connection on a large scanned PDF
// can pick back up instead of forcing a full re-upload.
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const MAX_ATTEMPTS = 4;

export type UploadProgress = (fraction: number) => void;

export type UploadedFile = { id: string; name: string };

type FileMetadata = {
  name: string;
  parentId: string;
  mimeType: string;
  size: number;
  description?: string;
  properties?: Record<string, string>;
};

async function initResumableSession(accessToken: string, file: FileMetadata): Promise<string> {
  const res = await fetch(`${UPLOAD_API}?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.mimeType,
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify({
      name: file.name,
      parents: [file.parentId],
      description: file.description || undefined,
      // Drive "properties" are private custom metadata, readable only by
      // this app — used to store the expiry date for later search/reminders
      // without needing a separate backend.
      properties: file.properties && Object.keys(file.properties).length ? file.properties : undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`Could not start the upload (${res.status}): ${await res.text()}`);
  }
  const location = res.headers.get('Location');
  if (!location) throw new Error('Drive did not return an upload session URL.');
  return location;
}

function putRange(
  sessionUrl: string,
  blob: Blob,
  start: number,
  total: number,
  onProgress?: UploadProgress
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUrl, true);
    xhr.setRequestHeader('Content-Range', `bytes ${start}-${total - 1}/${total}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.((start + event.loaded) / total);
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(start === 0 ? blob : blob.slice(start));
  });
}

// Asks Drive how many bytes of a resumable session it actually has, per the
// resumable-upload protocol's recovery flow (PUT with an open Content-Range).
async function queryUploadedBytes(sessionUrl: string, total: number): Promise<number | 'complete'> {
  const res = await fetch(sessionUrl, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes */${total}` },
  });
  if (res.status === 308) {
    const range = res.headers.get('Range');
    const match = range ? /bytes=0-(\d+)/.exec(range) : null;
    return match ? Number(match[1]) + 1 : 0;
  }
  if (res.status === 200 || res.status === 201) return 'complete';
  throw new Error(`Could not resume the upload (status ${res.status}).`);
}

export async function uploadFileToDrive(
  accessToken: string,
  file: Omit<FileMetadata, 'size'> & { blob: Blob },
  onProgress?: UploadProgress
): Promise<UploadedFile> {
  const total = file.blob.size;
  const sessionUrl = await initResumableSession(accessToken, { ...file, size: total });

  let start = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { status, body } = await putRange(sessionUrl, file.blob, start, total, onProgress);
      if (status === 200 || status === 201) {
        onProgress?.(1);
        return JSON.parse(body) as UploadedFile;
      }
      if (status !== 308) {
        throw new Error(`Upload failed with status ${status}: ${body}`);
      }
      // 308 mid-flight is unexpected for a single full-body PUT, but fall
      // through to the recovery path below just in case.
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
    }

    const uploaded = await queryUploadedBytes(sessionUrl, total);
    if (uploaded === 'complete') {
      onProgress?.(1);
      return { id: '', name: file.name };
    }
    start = uploaded;
  }

  throw new Error('Upload failed after multiple attempts. Please check your connection and try again.');
}
