export interface CaptureDraft {
  userId: string;
  text: string;
  files: File[];
  requestId: string;
  updatedAt: string;
}

const DB_NAME = 'sparkflow-capture-drafts-v1';
const STORE_NAME = 'drafts';

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}

export async function readCaptureDraft(userId: string): Promise<CaptureDraft | null> {
  try {
    const db = await openDatabase();
    if (!db) return null;
    return await new Promise<CaptureDraft | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(userId);
      request.addEventListener('success', () => resolve((request.result as CaptureDraft | undefined) || null));
      request.addEventListener('error', () => reject(request.error));
      transaction.addEventListener('complete', () => db.close());
    });
  } catch {
    return null;
  }
}

export async function writeCaptureDraft(draft: CaptureDraft) {
  try {
    const db = await openDatabase();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(draft);
      transaction.addEventListener('complete', () => {
        db.close();
        resolve();
      });
      transaction.addEventListener('error', () => reject(transaction.error));
    });
  } catch {
    // Draft persistence is best-effort; capture itself remains usable.
  }
}

export async function deleteCaptureDraft(userId: string) {
  try {
    const db = await openDatabase();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(userId);
      transaction.addEventListener('complete', () => {
        db.close();
        resolve();
      });
      transaction.addEventListener('error', () => reject(transaction.error));
    });
  } catch {
    // Best-effort cleanup.
  }
}
