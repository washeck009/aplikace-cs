/**
 * Konfigurace – podniky, role, listy a jejich sloupce, výchozí nastavení.
 * Repo je veřejné: žádné PINy, e-maily, ID tabulek ani složek sem nepatří.
 */

// Kódy podniků (sloupec `podnik` v každém listu) a jejich názvy.
const PODNIKY = {
  DEK: 'Stavebniny DEK',
  STA: 'Stachema'
};

// Role a jejich úroveň – vyšší úroveň smí vše, co nižší.
const ROLE_UROVEN = {
  skladnik: 1,
  vedouci: 2,
  manazer: 2,
  admin: 3
};

// Zámek účtu po chybných PINech.
const ZAMEK_POKUSU = 5;
const ZAMEK_MINUT = 10;

// Klíč tokenu ve Script Properties = prefix + SHA-256 tokenu (samotný token se neukládá).
const PREFIX_TOKENU = 'token_';

// Zpracované dávky z čtečky (idempotence): Script Properties `davka_<id>`, drží se 30 dní.
const PREFIX_DAVKY = 'davka_';
const DAVKY_DRZET_DNI = 30;

// Dávka z offline fronty smí nést čas kontroly nejvýš 2 dny zpět, starší dostane čas přijetí.
const ZPETNY_ZAPIS_DNI = 2;

// Stavy záznamů (list Zaznamy).
const STAV = {
  NA_LOKACI: 'Na lokaci',
  NENI: 'Není na lokaci',
  VYDANO: 'Vydáno',
  ZLIKVIDOVANO: 'Zlikvidováno'
};

// Listy a jejich sloupce. Pořadí slouží jen pro založení – kód vždy čte podle názvů.
const LISTY = {
  Uzivatele: ['id', 'jmeno', 'role', 'pin_hash', 'pin_salt', 'aktivni', 'chybne_pokusy', 'zamceno_do'],
  Polozky: ['podnik', 'ean', 'cislo_polozky', 'nazev', 'aktivni', 'zdroj', 'k_doplneni'],
  Lokace: ['podnik', 'kod', 'hala', 'rada', 'sloupec', 'nosnik', 'zona', 'aktivni', 'k_overeni'],
  Zaznamy: ['id', 'podnik', 'lokace', 'ean', 'cislo_polozky', 'expirace', 'expirace_text', 'pocet_ks', 'stav',
    'zalozil', 'zalozeno', 'overil', 'overeno', 'zmenil', 'zmeneno', 'poznamka', 'foto_url', 'k_doplneni'],
  Kontroly: ['id', 'cas', 'uzivatel', 'podnik', 'lokace', 'id_zaznamu', 'akce', 'pocet_ks', 'poznamka', 'id_ukolu', 'zapocteno'],
  Ukoly: ['id', 'podnik', 'typ', 'komu', 'lokace', 'polozka', 'termin', 'popis', 'stav', 'zadal', 'zadano', 'splneno', 'splnil'],
  Nastaveni: ['podnik', 'klic', 'hodnota', 'popis'],
  Import_stav_lokaci: ['podnik', 'lokace', 'cislo_polozky', 'mnozstvi', 'datum_importu'],
  Log_chyb: ['cas', 'akce', 'uzivatel', 'chyba']
};

// Sloupce, které musí zůstat textem (úvodní nuly, MM/RR, kódy lokací) – jinak z nich tabulka udělá číslo či datum.
const TEXTOVE_SLOUPCE = {
  Uzivatele: ['id', 'jmeno', 'pin_hash', 'pin_salt'],
  Polozky: ['ean', 'cislo_polozky'],
  Lokace: ['kod', 'hala', 'rada', 'sloupec', 'nosnik'],
  Zaznamy: ['id', 'lokace', 'ean', 'cislo_polozky', 'expirace_text'],
  Kontroly: ['id', 'lokace', 'id_zaznamu', 'id_ukolu'],
  Ukoly: ['id', 'lokace', 'polozka'],
  Import_stav_lokaci: ['lokace', 'cislo_polozky']
};

// Sloupce s datem a časem (jen formát zobrazení v tabulce).
const DATUMOVE_SLOUPCE = {
  Uzivatele: ['zamceno_do'],
  Zaznamy: ['zalozeno', 'overeno', 'zmeneno'],
  Kontroly: ['cas'],
  Ukoly: ['zadano', 'splneno'],
  Import_stav_lokaci: ['datum_importu'],
  Log_chyb: ['cas']
};
const DATUMOVE_SLOUPCE_BEZ_CASU = {
  Zaznamy: ['expirace'],
  Ukoly: ['termin']
};

// Výchozí nastavení: [klíč, popis, hodnota DEK, hodnota STA]. Setup doplní jen chybějící řádky.
const VYCHOZI_NASTAVENI = [
  ['hranice_cervena', 'Červené pásmo (Expiruje brzy): max. dní do expirace', 90, 180],
  ['hranice_zluta', 'Žluté pásmo (Pozor): max. dní do expirace', 180, 360],
  ['cil_kontrol_tyden', 'Týdenní cíl kontrol (lokací); prázdné = bez cíle', '', ''],
  ['report_prijemci', 'Příjemci týdenního reportu (e-maily oddělené čárkou)', '', ''],
  ['planovac_dni_bez_kontroly', 'Plánovač: lokace bez kontroly déle než (dní)', 60, 60],
  ['planovac_cervene_overit_dni', 'Plánovač: červené pásmo ověřit alespoň 1× za (dní)', 30, 30],
  ['planovac_max_lokaci_ukol', 'Plánovač: max. lokací v jednom úkolu', 20, 20],
  ['slozka_fotky_id', 'ID složky na Google Disku pro fotky', '', '']
];

// Nastavení, která se do čtečky neposílají (e-maily, ID složek).
const NASTAVENI_JEN_SERVER = ['report_prijemci', 'slozka_fotky_id'];
