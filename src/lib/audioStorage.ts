// src/lib/audioStorage.ts
// Penyimpanan audio custom menggunakan IndexedDB agar tidak terkena limit kuota 5 MB localStorage

const DB_NAME = "candra_admin_audio_db";
const DB_VERSION = 1;
const STORE_NAME = "audio_store";
const AUDIO_KEY = "custom_notification_audio";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak didukung pada lingkungan ini"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Menyimpan data URL audio ke IndexedDB
 */
export async function saveAudioToStorage(dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, AUDIO_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[audioStorage] Gagal menyimpan ke IndexedDB:", err);
  }
}

/**
 * Mengambil data URL audio dari IndexedDB
 */
export async function getAudioFromStorage(): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AUDIO_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[audioStorage] Gagal membaca dari IndexedDB:", err);
    return null;
  }
}

/**
 * Menghapus audio custom dari IndexedDB
 */
export async function removeAudioFromStorage(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(AUDIO_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[audioStorage] Gagal menghapus dari IndexedDB:", err);
  }
}
