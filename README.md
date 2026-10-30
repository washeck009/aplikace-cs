# Aplikace CS

Webová aplikace (PWA) pro centrální sklad. Hlavní aplikace je rozcestník modulů, prvním modulem je
**Kontrola expirací** pro podniky Stavebniny DEK a Stachema. Podrobné zadání: [docs/specifikace.md](docs/specifikace.md),
vzhled: [docs/maketa.html](docs/maketa.html), změny: [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Co je hotové

**Etapa 1 – základ**
- Google tabulka s listy podle specifikace, výchozí nastavení obou podniků, první administrátor.
- Přihlášení jménem a 4místným PINem, platnost do konce dne, po 5 chybných PINech zámek účtu na 10 minut.
- PWA instalovatelná na plochu čtečky: přihlášení → rozcestník → Expirace → Domů s přepínačem DEK / Stachema.
- Po přihlášení se číselník, lokace, záznamy na lokacích a nastavení podniku uloží do zařízení (pro práci při slabém signálu).

**Etapa 2 – Kontrola lokace (čtečka)**
- Skenovací pole je dole na obrazovce, drží fokus a reaguje na Enter (hardwarový skener Urovo v režimu klávesnice).
  Zelený pruh nad polem = připraveno ke skenování, šedý = klepni na pole. Na čtečce nevyskakuje klávesnice;
  ⌨ otevře ruční zadání kódu, 📷 skenuje kamerou.
- Po naskenování lokace se ukáže evidované zboží s pásmem, zbývajícími dny, kusy, posledním ověřením a poznámkou.
  U každého řádku ✓ Je tu / ✗ Není tu / ✎ Upravit (expirace, kusy, poznámka, Vydáno / Zlikvidováno, fotka).
- Přidání zboží skenem EAN, expirace MM/RR s automatickým lomítkem; neznámý EAN → ruční číslo položky a příznak
  „k doplnění“. Stejné zboží se stejnou expirací se nezaloží dvakrát – existující záznam se označí ✓.
- **Lokace hotová** (dialog pro neoznačené řádky) a **Bez expiračního zboží** (s potvrzením).
- Celá lokace odchází na server jednou dávkou. Bez signálu se dávka uloží do zařízení a odešle se sama;
  v hlavičce je žlutá ikona ⇡ s počtem neodeslaných (klepnutím seznam a *Odeslat teď*).
- Lokace se započítá max. 1× za den na uživatele; na Domů je počet dnes započtených lokací.
- Fotky se zmenší v čtečce (max. 1600 px) a uloží na Google Disk, sdílené „kdokoli s odkazem“.
- Neznámá lokace se při dokončení založí s příznakem `k_overeni`.

Dlaždice *Moje úkoly* a *Blíží se expirace* přijdou v etapě 3.

## Struktura repa

| Složka | Obsah |
|---|---|
| `web/` | Frontend – statická PWA (HTML, CSS, JavaScript), nasazuje se na GitHub Pages |
| `apps-script/` | Backend – Google Apps Script navázaný na Google tabulku (JSON API) |
| `.github/workflows/pages.yml` | Automatické nasazení složky `web/` na GitHub Pages |
| `docs/` | Specifikace, maketa, prompty, changelog (na web se nepublikuje) |

---

## Nasazení krok za krokem

Celé nastavení se dělá jednou. Potřebuješ osobní Google účet (Gmail) a přístup k tomuto repu na GitHubu.

### 1. Založ Google tabulku

1. Otevři [sheets.google.com](https://sheets.google.com) → **Prázdná tabulka**.
2. Pojmenuj ji, např. *Aplikace CS – data*.
3. Tabulku **nesdílej** s nikým, kdo ji nemusí upravovat – jsou v ní uživatelé a hashe PINů.
   Skladníci k tabulce přístup nepotřebují, pracují jen přes aplikaci.

### 2. Vlož kód Apps Scriptu

1. V tabulce: **Rozšíření → Apps Script**. Otevře se editor s projektem navázaným na tabulku.
2. Vlevo nahoře klikni na *Projekt bez názvu* a pojmenuj ho *Aplikace CS*.
3. Vlevo **Nastavení projektu** (ozubené kolo):
   - zaškrtni **Zobrazit v editoru soubor manifestu „appsscript.json“**,
   - zkontroluj **Časové pásmo: (GMT+01:00) Praha**.
4. Zpět v **Editoru** (ikona `< >`) otevři `appsscript.json`, smaž obsah a vlož obsah souboru
   [`apps-script/appsscript.json`](apps-script/appsscript.json).
5. Pro každý soubor `.gs` ze složky [`apps-script/`](apps-script/) – `Api.gs`, `Auth.gs`, `Fotky.gs`,
   `Konfigurace.gs`, `Kontrola.gs`, `Listy.gs`, `Setup.gs`:
   - klikni na **+** vedle *Soubory* → **Skript**, zadej název bez `.gs` (např. `Api`),
   - smaž předvyplněný obsah a vlož celý obsah souboru z repa.
6. Výchozí soubor `Kód.gs` smaž (tři tečky vedle názvu → *Smazat*).
7. Ulož (ikona diskety nebo Ctrl+S).

> Kód z repa zkopíruješ nejsnáz tak, že soubor na GitHubu otevřeš a klikneš na ikonu **Copy raw file**.

### 3. Spusť setup (založí listy a prvního administrátora)

1. Vrať se do tabulky a **obnov stránku** (F5). Po chvíli se v horní liště objeví menu **Aplikace CS**.
2. **Aplikace CS → Založit / doplnit listy (setup)**.
3. Poprvé Google požádá o autorizaci: *Pokračovat* → vyber svůj účet → *Rozšířená nastavení* →
   *Přejít na Aplikace CS (nebezpečné)* → *Povolit*. (Varování je běžné u vlastních skriptů, které Google neověřoval.)
4. Po autorizaci spusť menu **znovu**. Skript založí listy a zeptá se na **jméno a PIN administrátora** (to jsi ty).
   PIN se uloží jen jako hash, nikde jinde se neobjeví.
5. Zkontroluj, že vznikly listy `Uzivatele`, `Polozky`, `Lokace`, `Zaznamy`, `Kontroly`, `Ukoly`, `Nastaveni`,
   `Import_stav_lokaci` a `Log_chyb`, a že v `Nastaveni` jsou hodnoty pro `DEK` i `STA`.

Setup můžeš spouštět opakovaně – doplní jen to, co chybí, nic nepřepíše.

6. **Aplikace CS → Povolit fotky (Google Disk)**. Google požádá o další oprávnění (přístup k Disku) – povol stejně
   jako v bodu 3. Skript založí na tvém Disku složky *Aplikace CS – fotky – Stavebniny DEK* a *… – Stachema*
   a jejich ID zapíše do listu `Nastaveni` (`slozka_fotky_id`). Chceš-li jinou složku, přepiš ID v `Nastaveni`.

**Další uživatelé:** menu **Aplikace CS → Přidat uživatele** (jméno, role `skladnik` / `vedouci` / `manazer` / `admin`, PIN).
**Zapomenutý PIN nebo zamčený účet:** **Aplikace CS → Změnit PIN / odemknout uživatele**.
Deaktivace uživatele: v listu `Uzivatele` přepiš `aktivni` na `FALSE`.
(Správa uživatelů přímo v aplikaci přijde v etapě 4.)

### 4. Nasaď webovou aplikaci (API)

1. V editoru Apps Scriptu vpravo nahoře **Nasadit → Nové nasazení**.
2. Ozubené kolo u *Vyberte typ* → **Webová aplikace**.
3. Vyplň:
   - Popis: např. `etapa 1`,
   - **Spustit jako: Já**,
   - **Kdo má přístup: Kdokoli**.
4. **Nasadit** → zkopíruj **URL webové aplikace** (končí na `/exec`).
5. Kontrola: otevři URL v prohlížeči – musí se ukázat text *Aplikace CS – API běží*.

**Po každé změně kódu Apps Scriptu** (další etapy): **Nasadit → Spravovat nasazení** → tužka →
*Verze: Nová verze* → **Nasadit**. URL zůstane stejná. (Nové nasazení by vytvořilo novou URL.)

### 5. Vlož URL do aplikace

1. Na GitHubu otevři soubor [`web/config.js`](web/config.js) → tužka (Edit).
2. Mezi uvozovky vlož URL z kroku 4:
   ```js
   export const API_URL = 'https://script.google.com/macros/s/…/exec';
   ```
3. **Commit changes** přímo do větve `main`.

URL do veřejného repa patří – bez platného PINu se přes ni nic nedostane.

### 6. Zapni GitHub Pages

1. Na GitHubu v repu **Settings → Pages**.
2. **Build and deployment → Source: GitHub Actions**.
3. Záložka **Actions** – běh *Nasazení na GitHub Pages* musí skončit zeleně
   (spouští se po každé změně ve `web/`; ručně: Actions → Nasazení na GitHub Pages → *Run workflow*).
4. Adresa aplikace je `https://<tvůj-github-účet>.github.io/aplikace-cs/` (najdeš ji i v Settings → Pages).

### 7. Nainstaluj aplikaci na čtečku

1. Na čtečce otevři **Chrome** a zadej adresu z kroku 6.
2. Menu **⋮ → Přidat na plochu** (nebo *Instalovat aplikaci*) → *Instalovat*.
3. Spusť aplikaci z ikony **Aplikace CS** na ploše – otevře se bez lišty prohlížeče.
4. Přihlas se: vyber jméno, zadej PIN. Čtečka si pamatuje posledního uživatele.

Nová verze webu se na čtečku dostane sama: při spuštění se na pozadí stáhne a projeví se při dalším otevření aplikace.

---

## Přechod na etapu 2 (pro už nasazenou etapu 1)

Web se aktualizuje sám po pushi do `main`. Backend v Apps Scriptu je potřeba aktualizovat ručně:

1. V tabulce **Rozšíření → Apps Script**.
2. Přidej dva nové soubory (**+** vedle *Soubory* → **Skript**): `Kontrola` a `Fotky` – vlož do nich obsah
   [`apps-script/Kontrola.gs`](apps-script/Kontrola.gs) a [`apps-script/Fotky.gs`](apps-script/Fotky.gs).
3. Nahraď celý obsah změněných souborů verzí z repa: `Api.gs`, `Konfigurace.gs`, `Listy.gs`, `Setup.gs`
   (`Auth.gs` a `appsscript.json` se nezměnily). Ulož (Ctrl+S).
4. Vrať se do tabulky, **obnov stránku** (F5) a spusť **Aplikace CS → Povolit fotky (Google Disk)**.
   Povol přístup k Disku (*Rozšířená nastavení → Přejít na Aplikace CS → Povolit*). Bez tohoto kroku se fotky
   nenahrají – zůstanou čekat ve frontě čtečky.
5. **Nasadit → Spravovat nasazení** → tužka → *Verze: **Nová verze*** → **Nasadit**. URL zůstane stejná,
   `web/config.js` se nemění.
6. Na čtečce aplikaci zavři a otevři **dvakrát** (poprvé se na pozadí stáhne nová verze, podruhé se spustí).
   V rozcestníku musí být verze **0.2.0**.

Listy ani sloupce se nemění, setup znovu spouštět není potřeba.

---

## Ověření etapy 2

- [ ] Na čtečce naskenuju štítek lokace hardwarovým skenerem → zobrazí se evidované zboží.
- [ ] Označím řádky ✓ / ✗, jeden upravím (✎), přidám zboží známým EAN i neznámým EAN (zadám číslo položky).
- [ ] *Lokace hotová* → v tabulce se změní `Zaznamy` (overil/overeno, stav, nové řádky) a přibudou řádky v `Kontroly`
      (u prvního `zapocteno = TRUE`); neznámý EAN je v `Polozky` s `k_doplneni = TRUE`.
- [ ] Druhé dokončení stejné lokace týž den: toast „dnes už byla započtena“, v `Kontroly` už `zapocteno = FALSE`.
- [ ] Režim letadlo: dokončím lokaci → v hlavičce ⇡ 1; po vypnutí režimu letadlo se dávka odešle a ikona zmizí.
- [ ] Fotka u nového zboží: v `Zaznamy.foto_url` je odkaz, který se otevře i v anonymním okně.
- [ ] Na Domů sedí *Zkontrolované lokace dnes*.

## Ověření etapy 1

- [ ] Na čtečce otevřu adresu GitHub Pages a přidám aplikaci na plochu.
- [ ] Přihlásím se jménem a PINem → rozcestník → **Expirace** → Domů s přepínačem **Stavebniny DEK / Stachema**.
- [ ] U podniku se v sekci *Data podniku* ukážou pásma (DEK 90/180, Stachema 180/360 dní).
- [ ] Špatný PIN 5× → hláška o zámku; ani správný PIN 10 minut nepustí (ve `Uzivatele` je vyplněné `zamceno_do`).
- [ ] V repu nejsou žádné PINy, e-maily, jména zaměstnanců ani ID tabulky.

## Pro vývoj

- Frontend nemá build krok – soubory ve `web/` jsou přesně to, co běží v prohlížeči.
  Lokálně ho lze spustit libovolným statickým serverem ze složky `web/`.
- **Při každé změně ve `web/` zvyš verzi** v `web/sw.js` (`VERZE`) i ve `web/js/verze.js` – jinak čtečky drží starou cache.
- API: `POST` na URL webové aplikace, `Content-Type: text/plain`, tělo `{"action", "token", "data"}`,
  odpověď `{"ok": true, "data"}` nebo `{"ok": false, "error", "kod"}`.
  Akce: `uzivatele.seznam`, `login`, `logout`, `ja`, `data.zaklad`, `lokace.nacti`, `lokace.dokonci`,
  `kontroly.dnes`, `foto.nahraj`.
- `lokace.dokonci` je idempotentní podle `id_davky`: zpracované dávky si server pamatuje 30 dní ve Script Properties
  (`davka_<id>`), opakované odeslání vrátí původní výsledek.
- Čas kontroly z offline fronty se bere z čtečky, nejvýš 2 dny zpět (starší dávka dostane čas přijetí).
- Neočekávané chyby serveru se zapisují do listu `Log_chyb`.
- **Diagnostika skenování** na čtečce: v rozcestníku 5× rychle klepni na *verze …* → nahoře se ukáže panel
  s posledními 20 událostmi klávesnice a stavem fokusu (zůstane zapnutý i po restartu; vypíná se tlačítkem *Vypnout*).
  *Kopírovat* zkopíruje výpis do schránky – hodí se poslat při hlášení chyby.
