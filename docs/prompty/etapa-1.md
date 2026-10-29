# Etapa 1 – Základ

Přečti `CLAUDE.md`, `docs/specifikace.md` a projdi `docs/maketa.html`. Pak postav základ aplikace:

1. **Struktura repa**: `web/` (PWA), `apps-script/` (backend), `.github/workflows/pages.yml` (nasazení jen `web/` na GitHub Pages),
   `.gitignore`, `docs/CHANGELOG.md`.
2. **Backend (Apps Script, container-bound k Google tabulce)**:
   - `setup()` – založí všechny listy ze specifikace s hlavičkami, výchozí nastavení pro oba podniky (pásma 180/360 a 90/180,
     plánovač 60/30/20) a prvního uživatele s rolí admin (jméno a PIN si vyžádá přes dialog / parametr, **nikdy ne v kódu**).
   - `doPost` JSON API (`{action, token, data}` → `{ok, data|error}`), router akcí, kontrola tokenu a role.
   - Akce: `uzivatele.seznam` (jen jména aktivních, bez tokenu), `login` (jméno + PIN → token do konce dne, zámek po 5 chybách),
     `logout`, `ja` (kdo jsem, role), `data.zaklad` (číselník + lokace + nastavení pro podnik – pro cache v klientovi).
   - Pomocné vrstvy: čtení/zápis listů podle názvů sloupců (ne podle pořadí), `LockService` u zápisů, generování ID, log chyb.
3. **Frontend (PWA)**: `index.html`, `manifest.webmanifest`, ikony, service worker (cache statických souborů),
   `config.js` (URL API), API klient (`fetch` text/plain), přihlášení (seznam jmen + PIN klávesnice), rozcestník modulů
   (zatím jedna dlaždice **Expirace**), obrazovka Domů modulu Expirace s přepínačem podniku a třemi dlaždicemi
   (zatím bez funkce), odhlášení. Vzhled podle makety.
4. **README.md** – návod pro vlastníka krok za krokem česky: založení Google tabulky, vložení kódu Apps Scriptu
   (nebo nastavení `clasp`, pokud vlastník souhlasí – nejdřív se zeptej), spuštění `setup()`, nasazení webové aplikace,
   vložení URL do `web/config.js`, zapnutí GitHub Pages (Settings → Pages → Source: GitHub Actions), instalace PWA na čtečku.

Před napsáním kódu mi krátce shrň plán a zeptej se na nejasnosti. Po dokončení commitni (česky) a řekni mi, co mám udělat ručně.

**Hotovo, když:** na čtečce otevřu adresu GitHub Pages, přidám aplikaci na plochu, přihlásím se jménem a PINem,
vidím rozcestník → Expirace → Domů s přepínačem DEK/Stachema; špatný PIN 5× zamkne účet na 10 minut; v repu nejsou žádné citlivé údaje.
