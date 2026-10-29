# Changelog

## 0.1.0 – 2026-10-29 – Etapa 1: základ

### Přidáno
- Struktura repa: `web/` (PWA), `apps-script/` (backend), nasazení `web/` na GitHub Pages přes GitHub Actions.
- Backend (Apps Script navázaný na tabulku):
  - `setup()` z menu *Aplikace CS* v tabulce – založí listy se sloupci ze specifikace, doplní výchozí nastavení
    (DEK 90/180, Stachema 180/360, plánovač 60/30/20) a prvního administrátora (jméno a PIN přes dialog).
  - Menu *Přidat uživatele* a *Změnit PIN / odemknout uživatele* (do doby, než bude Správa v aplikaci).
  - JSON API `doPost` s akcemi `uzivatele.seznam`, `login`, `logout`, `ja`, `data.zaklad`; kontrola tokenu a role.
  - PIN jako SHA-256 se solí; token platný do konce dne (ve Script Properties jen jeho hash);
    5 chybných PINů = zámek na 10 minut.
  - Čtení a zápis listů podle názvů sloupců, zápisy pod `LockService`, textový formát pro kódy (úvodní nuly),
    log neočekávaných chyb do listu `Log_chyb`.
- Frontend (PWA): přihlášení (výběr jména + PIN klávesnice, funguje i fyzická klávesnice čtečky, pamatuje posledního
  uživatele), rozcestník modulů, Expirace – Domů s přepínačem podniku (pamatuje si volbu) a třemi dlaždicemi
  (zatím bez funkce), stažení číselníku/lokací/nastavení do IndexedDB, odhlášení, manifest, ikony, service worker.
- README s návodem na nasazení krok za krokem.

### Poznámky
- List `Log_chyb` není ve specifikaci – přidán kvůli požadavku na log chyb z etapy 1.
- Do čtečky se z nastavení neposílají `report_prijemci` a `slozka_fotky_id`.
