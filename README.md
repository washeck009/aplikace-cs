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

**Etapa 3 – Úkoly, Blíží se expirace, plánovač**
- **Moje úkoly** (čtečka): úkoly pro mě a pro „kdokoliv“ ve zvoleném podniku, lokace podle trasy (hala → řada →
  sloupec → nosník), hotové přeškrtnuté, průběh x z y. *Začít / pokračovat* otevře kontrolu s nabídkou zbývajících
  lokací (klepnutím nebo skenem). Dokončení lokace (kýmkoliv) ji odškrtne ve všech otevřených úkolech; s poslední
  lokací je úkol splněný. Na Domů je počet otevřených úkolů.
- **Blíží se expirace** (čtečka): záznamy na lokacích podle zbývajících dní, filtr *Červené + expirované* / *Žluté* /
  *Vše*, akce *Na lokaci* (otevře kontrolu lokace), *Vydáno*, *Zlikvidováno* – zapíše se do logu s kým a kdy
  (i bez signálu přes frontu). Na Domů je počet červených + expirovaných.
- **PC – Úkoly** (v rozcestníku dlaždice *Expirace – řízení*): nový úkol (komu, lokace – jednotlivé,
  čárkou, rozsah „od až do“ v rámci řady, volitelně zboží, termín, poznámka), přehled úkolů s průběhem, zrušení,
  pravidla plánovače.
- **Plánovač** (každý den kolem 5:30): pro každý podnik a pravidlo (červené pásmo neověřené / lokace bez kontroly /
  zboží z importu bez záznamů) nejvýš jeden otevřený úkol pro „kdokoliv“ s max. 20 nejnaléhavějšími lokacemi
  podle trasy; bez duplicit s otevřenými úkoly. Ručně: menu *Aplikace CS → Plánovač – spustit teď*.

**Etapa 4 – Řízení: přehled, záznamy, správa, importy**
- **Oprávnění v řízení:** vedoucí vidí přehled, záznamy a úkoly (i kolik je hotovo), ale úkoly nezadává ani neruší;
  manažer navíc zadává a ruší úkoly; admin navíc Správa a Importy. Hlídá i server.
- **Přehled** za zvolený podnik: pokrytí lokací za 30 / 90 dní, kontroly tento týden proti cíli, červené pásmo,
  expirované na lokaci, zboží bez kontroly a naskladněné po kontrole (z importu), plnění úkolů, položky k doplnění;
  **mapa pokrytí** (řádek = hala · řada, barva podle dní od kontroly), kontroly po lidech za 8 týdnů, zboží podle pásem
  + trend, **FEFO** (odkud vychystávat: nejbližší expirace, při shodě dřív naskladněné). Výpočet drží server 5 minut v cache.
- **Záznamy**: hledání (lokace, EAN, číslo, název), filtr pásma a stavu, řazení kliknutím na sloupec, **export .xlsx**
  s aktuálním filtrem a **log kontrol** za období (max. 366 dní).
- **Správa** (admin): uživatelé (přidat – PIN se vygeneruje a ukáže jednou, role, aktivní, nový PIN / odemknutí),
  nastavení po podnicích, položky k doplnění (doplnit název nebo spárovat s číslem položky).
- **Importy** (admin) z xlsx / csv, podnik se volí při importu, vždy náhled → *Importovat*:
  - *Číselník* (EAN, Číslo položky, Název položky) – nové přidá, změny přepíše, položky „k doplnění“ doplní.
  - *Lokace* (LOKACE) – jen H nebo P s číslicí (H1, P0…); regálové `H2-P-37-1` / `H1-AB-12` aktivní, zóny
    (`H2-ZASOBNIK`) neaktivní; BAL, RAMP, PRIJEM, PAL… se přeskočí.
  - *Stav na lokacích* (export DATUM, UMISTENI, ID_POLOZKY, POL_NAZEV, MNOZ_ZAKL_MJ, ZAKL_MJ) – prohlížeč sečte řádky
    za lokaci a položku (DATUM = nejnovější naskladnění) a pošle jen lokace H/P a hlídané zboží. Server uzavře zboží,
    které z lokace zmizelo (*Není na lokaci*, v Kontrolách `import uzavřel`; záznamy založené / ověřené po čase
    exportu se neuzavřou), založí chybějící lokace H/P a nahradí předchozí import podniku.
- **Plánovač d) Naskladněno po poslední kontrole**: lokace s hlídaným zbožím naskladněným (DATUM) po poslední dokončené
  kontrole lokace, jen naskladnění za posledních `planovac_naskladneno_dni` (výchozí 14); vypíná
  `planovac_naskladneno_zapnuto`. Do plánovače ani pokrytí nepatří lokace mimo H/P.
- EAN a čísla položek se porovnávají bez úvodních nul (Excel je u čísel zahazuje) – sken `0…` najde i EAN uložený bez nuly.
- Ukázkové soubory se **smyšlenými** daty pro vyzkoušení importů: [`docs/testovaci-data/`](docs/testovaci-data/).

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
5. Pro každý soubor `.gs` ze složky [`apps-script/`](apps-script/) – `Api.gs`, `Auth.gs`, `Fotky.gs`, `Import.gs`,
   `Konfigurace.gs`, `Kontrola.gs`, `Listy.gs`, `Planovac.gs`, `Prehled.gs`, `Setup.gs`, `Sprava.gs`, `Ukoly.gs`:
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
7. **Aplikace CS → Plánovač – zapnout denní spouštění (5:30)**. Google požádá o oprávnění ke spouštěčům – povol.
   Plánovač pak každé ráno vytvoří úkoly (stav spouštěče je vidět v PC části na obrazovce Úkoly).

**Další uživatelé:** menu **Aplikace CS → Přidat uživatele** (jméno, role, PIN). Roli napiš číslem
(1 skladník, 2 vedoucí, 3 manažer, 4 admin) nebo slovem – velká písmena ani háčky nevadí. Při chybě se dialog zeptá znovu.
**Zapomenutý PIN nebo zamčený účet:** **Aplikace CS → Změnit PIN / odemknout uživatele** (jméno najde i bez háčků).
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

## Přechod na etapu 4 (verze 0.4.0, pro už nasazenou verzi 0.3.1)

Web (verze **0.4.0**) se nasadí sám po pushi do `main`. V Apps Scriptu udělej ručně:

1. V tabulce **Rozšíření → Apps Script**.
2. **Nové soubory** (**+** vedle *Soubory* → **Skript**, název bez `.gs`), obsah z repa:
   - `Import` – [`apps-script/Import.gs`](apps-script/Import.gs),
   - `Prehled` – [`apps-script/Prehled.gs`](apps-script/Prehled.gs),
   - `Sprava` – [`apps-script/Sprava.gs`](apps-script/Sprava.gs).
3. **Nahraď celý obsah** změněných souborů verzí z repa: `Api.gs`, `Konfigurace.gs`, `Kontrola.gs`, `Listy.gs`,
   `Planovac.gs`, `Ukoly.gs`. (`Auth.gs`, `Setup.gs`, `Fotky.gs` a `appsscript.json` se nezměnily.) Ulož (Ctrl+S).
4. Vrať se do tabulky a **obnov stránku** (F5).
5. **Aplikace CS → Založit / doplnit listy (setup)** – do listu `Import_stav_lokaci` přidá sloupce `naskladneno` a `mj`
   a do `Nastaveni` obou podniků řádky `planovac_naskladneno_zapnuto` (TRUE) a `planovac_naskladneno_dni` (14).
   Nic existujícího nepřepíše.
6. **Nasadit → Spravovat nasazení** → tužka → *Verze: **Nová verze*** → **Nasadit**. URL zůstane stejná.
   (Nová oprávnění Google nežádá – cache a komprese jsou součástí Apps Scriptu.)
7. Spouštěč plánovače znovu instalovat **nemusíš** – pravidlo d) běží v tom stávajícím. Chceš-li ho vyzkoušet hned
   po prvním importu stavu: **Aplikace CS → Plánovač – spustit teď**.
8. Na PC otevři aplikaci (Ctrl+F5) – v rozcestníku verze **0.4.0**, dlaždice *Expirace – řízení* vede na Přehled.
9. **První importy** (řízení → *Importy*, jako admin, pro každý podnik zvlášť – nahoře zvol podnik):
   číselník → lokace (pokud máš seznam) → stav na lokacích. U stavu zkontroluj *Stav ke dni* (předvyplní se z data
   souboru) a v náhledu počet „Uzavře se“ – při prvním importu se uzavře zboží, které podle ERP na lokaci není.

> Role: v listu `Uzivatele` (nebo v řízení → Správa) – **vedoucí** od této verze úkoly jen čte; kdo má úkoly zadávat,
> potřebuje roli **manažer**.

---

## Ověření etapy 4

- [ ] Vedoucí na PC: Přehled za DEK i Stachemu (přepínač nahoře), Záznamy → *⬇ Excel* stáhne .xlsx s aktuálním
      filtrem (čísla položek s úvodními nulami jako text), log kontrol za období. V Úkolech nevidí formulář ani *Zrušit*.
- [ ] Admin: Importy → číselník (např. [`docs/testovaci-data/ciselnik-ukazka.csv`](docs/testovaci-data/ciselnik-ukazka.csv)
      na zkoušku, nebo ostrý export) → náhled → *Importovat*; v listu `Polozky` jsou nové řádky.
- [ ] Admin: Importy → stav na lokacích (ostrý export) → náhled ukáže lokace H/P, hlídané zboží a co se uzavře →
      *Importovat*; v `Zaznamy` mají uzavřené záznamy stav *Není na lokaci*, v `Kontroly` je akce `import uzavřel`.
- [ ] Správa → Přidat uživatele → ukáže se PIN; uživatel se s ním přihlásí.
- [ ] *Plánovač – spustit teď* po importu stavu: v Úkolech přibude úkol „Naskladněno po poslední kontrole…“.

---

## Přechod na verzi 0.3.1 (opravy po testu, pro už nasazenou etapu 3)

Web (verze **0.3.1**) se nasadí sám po pushi do `main`. V Apps Scriptu:

1. V tabulce **Rozšíření → Apps Script**.
2. **Nahraď celý obsah** tří souborů verzí z repa: [`Auth.gs`](apps-script/Auth.gs), [`Setup.gs`](apps-script/Setup.gs),
   [`Kontrola.gs`](apps-script/Kontrola.gs). Ostatní soubory se nezměnily. Ulož (Ctrl+S).
3. **Nasadit → Spravovat nasazení** → tužka → *Verze: **Nová verze*** → **Nasadit**. URL zůstane stejná.
4. Setup ani spouštěč plánovače znovu spouštět nemusíš (listy ani oprávnění se nemění).
5. Na čtečce aplikaci zavři a otevři **dvakrát** – v rozcestníku musí být verze **0.3.1**.

Firemní barvy podniků (hlavička a horní pruh v Expiraci) jsou v [`web/js/podniky.js`](web/js/podniky.js) – `barva`.

---

## Přechod na etapu 3 (pro už nasazenou etapu 2)

Web (verze **0.3.0**) se nasadí sám po pushi do `main`. V Apps Scriptu udělej ručně:

1. V tabulce **Rozšíření → Apps Script**.
2. **Nové soubory** (**+** vedle *Soubory* → **Skript**, název bez `.gs`):
   - `Ukoly` – obsah [`apps-script/Ukoly.gs`](apps-script/Ukoly.gs),
   - `Planovac` – obsah [`apps-script/Planovac.gs`](apps-script/Planovac.gs).
3. **Nahraď celý obsah** změněných souborů verzí z repa: `Api.gs`, `Konfigurace.gs`, `Kontrola.gs`, `Listy.gs`,
   `Setup.gs`. (`Auth.gs`, `Fotky.gs` a `appsscript.json` se nezměnily.) Ulož (Ctrl+S).
4. Vrať se do tabulky a **obnov stránku** (F5) – v menu *Aplikace CS* přibudou položky plánovače.
5. **Aplikace CS → Založit / doplnit listy (setup)** – do listu `Ukoly` přidá sloupec `hotove_lokace`
   (aplikace by ho doplnila i sama, ale takhle ho hned uvidíš).
6. **Aplikace CS → Plánovač – zapnout denní spouštění (5:30)**. Google požádá o nové oprávnění
   (*spravovat spouštěče*): *Pokračovat → Rozšířená nastavení → Přejít na Aplikace CS → Povolit*.
   Pak menu spusť **znovu**, ať se spouštěč opravdu založí – potvrdí to hláška „Plánovač se bude spouštět…“.
   Kontrola: v editoru Apps Scriptu vlevo **Spouštěče** (budík) – je tam `planovac`, *Na základě času*, *Denní*.
7. Volitelně **Aplikace CS → Plánovač – spustit teď** – hned vytvoří první úkoly a ukáže souhrn.
8. **Nasadit → Spravovat nasazení** → tužka → *Verze: **Nová verze*** → **Nasadit**. URL zůstane stejná.
9. Na čtečce aplikaci zavři a otevři **dvakrát** – v rozcestníku musí být verze **0.3.0**.

Plánovač upravuješ v listu `Nastaveni` (`planovac_dni_bez_kontroly`, `planovac_cervene_overit_dni`,
`planovac_max_lokaci_ukol`) – bez zásahu do kódu.

---

## Ověření etapy 3

- [ ] Vedoucí na PC (rozcestník → *Expirace – řízení* → Úkoly) zadá úkol konkrétnímu skladníkovi, např.
      `H1-A-07-1 až H1-A-12-4` – v přehledu je úkol s průběhem 0 / N.
- [ ] Skladník ho na čtečce vidí v *Moje úkoly* (číslo na dlaždici), dá *Začít*, projde lokace (klepnutím
      na lokaci nebo skenem) a po poslední se objeví „Úkol splněn ✔“; v listu `Ukoly` je `splněný`, `splnil`, `splneno`.
- [ ] *Plánovač – spustit teď* vytvoří rozumné úkoly; druhé spuštění nevytvoří duplicity (hláška „beze změny“).
- [ ] *Blíží se expirace* → *Zlikvidováno* → v `Zaznamy` je stav, `zmenil`, `zmeneno`, v `Kontroly` řádek
      `zlikvidováno` se jménem a časem.
- [ ] Zrušení úkolu na PC → stav `zrušený`, v `splnil` / `splneno` kdo a kdy.

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
  `kontroly.dnes` (+ počet otevřených úkolů), `foto.nahraj`, `zaznam.stav` (Vydáno/Zlikvidováno, idempotentní podle
  `id_akce`), `ukoly.moje`, `diagnostika.odesli`; vedoucí+: `prehled.data` (cache 5 min, `obnovit: true` ji obejde),
  `zaznamy.seznam`, `kontroly.log`, `ukoly.seznam`; manažer+: `ukoly.zadej`, `ukoly.zrus`; admin: `import.info`,
  `import.polozky`, `import.lokace`, `import.stav` (bez `potvrdit` jen náhled), `sprava.uzivatele`, `sprava.uzivatel.uloz`,
  `sprava.uzivatel.pin`, `sprava.nastaveni`, `sprava.nastaveni.uloz`, `sprava.polozky`, `sprava.polozka.uloz`.
- Excel v prohlížeči: SheetJS 0.20.3 z `cdn.sheetjs.com` (pevná verze + kontrolní součet), načte se až v řízení.
- Plánovač: funkce `planovac()` (spouštěč i menu), instalace spouštěče `instalujPlanovac()`.
- `lokace.dokonci` je idempotentní podle `id_davky`: zpracované dávky si server pamatuje 30 dní ve Script Properties
  (`davka_<id>`), opakované odeslání vrátí původní výsledek.
- Čas kontroly z offline fronty se bere z čtečky, nejvýš 2 dny zpět (starší dávka dostane čas přijetí).
- Neočekávané chyby serveru se zapisují do listu `Log_chyb`.
- **Diagnostika skenování** na čtečce: v rozcestníku 5× rychle klepni na *verze …* → nahoře se ukáže panel
  s posledními událostmi klávesnice a IME a stavem fokusu (zůstane zapnutý i po restartu; vypíná se tlačítkem *Vypnout*).
  *Režim pole* C (výchozí, klávesnice nevyskakuje) / B (obyčejné pole) – kdyby C na některé čtečce nefungoval
  (pamatuje se v zařízení).
  *Odeslat výpis* uloží výpis do listu `Log_chyb` v tabulce (akce `diagnostika skenování`), *Kopírovat* do schránky.
