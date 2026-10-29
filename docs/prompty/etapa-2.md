# Etapa 2 – Kontrola lokace (čtečka)

Podle `docs/specifikace.md` (kap. 5) a makety postav obrazovku **Kontrola lokace**:

1. Skenovací pole s trvalým fokusem a reakcí na Enter (hardwarový skener Urovo v režimu klávesnice); tlačítko 📷 pro skenování
   kamerou (`BarcodeDetector`, záloha knihovnou z CDN s pevnou verzí). Rozlišení lokace vs. EAN.
2. Načtení lokace: seznam záznamů `Na lokaci` s pásmem, zbývajícími dny, ks, posledním ověřením a poznámkou.
3. Akce ✓ Je tu / ✗ Není tu / ✎ Upravit (oprava expirace, ks, poznámky, stav Vydáno/Zlikvidováno, fotka).
4. Přidání zboží: EAN → položka z číselníku → expirace MM/RR (číselná klávesnice, automatické lomítko, validace) → ks → poznámka → fotka.
   Neznámý EAN → ruční číslo položky, příznak `k_doplneni`. Zákaz duplicity klíče podnik+lokace+EAN+expirace.
5. **Lokace hotová** (dialog pro neoznačené řádky, „Vše ostatní je tu“) a **Bez expiračního zboží** (s potvrzením, pokud jsou záznamy).
6. Backend akce: `lokace.nacti`, `lokace.dokonci` (jedna dávka = všechny změny lokace + zápis do `Kontroly`, výpočet `zapocteno`
   – max. 1× za den na uživatele a lokaci), `foto.nahraj` (base64 → Disk).
7. **Offline fronta** v IndexedDB: dávky se odesílají na pozadí, opakují se při chybě, v hlavičce ikona s počtem neodeslaných.
   Na serveru idempotence podle ID dávky (opakované odeslání nic nezdvojí).
8. Fotky zmenšovat v prohlížeči (max 1600 px, JPEG 0,8).
9. Na Domů zobrazit počet dnes započtených lokací.

**Hotovo, když:** na čtečce Urovo naskenuju štítek lokace hardwarovým skenerem, uvidím evidované zboží, označím řádky,
přidám nové zboží včetně neznámého EAN, dokončím lokaci; v tabulce se správně změní `Zaznamy` a přibudou řádky v `Kontroly`;
druhé dokončení stejné lokace týž den se nezapočte; v režimu letadlo se dávka uloží do fronty a po zapnutí signálu odešle.
