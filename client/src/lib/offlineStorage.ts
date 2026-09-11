/**
 * Offline & Local Multi-Layer Persistence Vault
 * Ensures Seif's study data, notes, goals, and sessions are never lost:
 * - Layer 1: LocalStorage (Fast Synchronous Cache)
 * - Layer 2: IndexedDB (Durable Large-Volume Offline Database)
 * - Layer 3: Server Periodic Backups (Every 6 Hours to SQLite & JSON)
 * - Layer 4: One-Click JSON Download for Google Drive / PC Backups
 */

const DB_NAME = "SeifStudyOsVault";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalVaultSnapshot(key: string, data: any): Promise<void> {
  // 1. Save to LocalStorage
  try {
    localStorage.setItem(`vault_${key}`, JSON.stringify({ data, updatedAt: Date.now() }));
  } catch (e) {
    console.warn("[Vault] LocalStorage write warn:", e);
  }

  // 2. Save to IndexedDB
  try {
    const idb = await openIndexedDb();
    const tx = idb.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, data, updatedAt: Date.now() });
  } catch (e) {
    console.warn("[Vault] IndexedDB write warn:", e);
  }
}

export async function getLocalVaultSnapshot<T = any>(key: string): Promise<T | null> {
  // Try LocalStorage first
  try {
    const raw = localStorage.getItem(`vault_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.data as T;
    }
  } catch {}

  // Fallback to IndexedDB
  try {
    const idb = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result?.data ?? null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function downloadObjectAsJson(data: any, exportName: string) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${exportName}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
