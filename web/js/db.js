// IndexedDB: cache číselníku, lokací a nastavení po podnicích (skenování i při slabém signálu).
const NAZEV_DB = 'aplikace-cs';
const VERZE_DB = 1;

function otevri() {
  return new Promise((hotovo, chyba) => {
    const pozadavek = indexedDB.open(NAZEV_DB, VERZE_DB);
    pozadavek.onupgradeneeded = () => {
      const db = pozadavek.result;
      if (!db.objectStoreNames.contains('zaklad')) db.createObjectStore('zaklad', { keyPath: 'podnik' });
    };
    pozadavek.onsuccess = () => hotovo(pozadavek.result);
    pozadavek.onerror = () => chyba(pozadavek.error);
  });
}

function transakce(store, rezim, akce) {
  return otevri().then((db) => new Promise((hotovo, chyba) => {
    const tx = db.transaction(store, rezim);
    const pozadavek = akce(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); hotovo(pozadavek.result); };
    tx.onerror = () => { db.close(); chyba(tx.error); };
  }));
}

/** Uložený základ podniku {podnik, polozky, lokace, nastaveni, stazeno}, nebo null. */
export async function nactiZaklad(podnik) {
  try {
    return (await transakce('zaklad', 'readonly', (s) => s.get(podnik))) || null;
  } catch {
    return null;
  }
}

export async function ulozZaklad(zaklad) {
  try {
    await transakce('zaklad', 'readwrite', (s) => s.put(zaklad));
  } catch {
    // Bez IndexedDB aplikace funguje dál, jen bez offline cache.
  }
}
