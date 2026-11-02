# Etapa 5 – Report, převod dat z AppSheet, pilot

1. **Týdenní report** (kap. 7): e-mail pro každý podnik příjemcům z nastavení, souhrn + příloha xlsx; spouštěč pondělí 7:00;
   v PC přehledu *Náhled* a *Odeslat teď*.
2. **Převod dat z AppSheet** (kap. 8): funkce pro jednorázový import z původní Google tabulky (ID zadá admin v dialogu,
   ne v kódu), sloučení duplicit, protokol importu (kolik převzato, kolik chyb a proč). Sloupec „EAN“ je čárový kód
   (i `DEK…` nebo číslo položky) – text velkými písmeny bez mezer, žádná kontrola „jen číslice“; zboží hledat podle
   čárového kódu i čísla položky (`hledaniPolozek_` v Kontrola.gs), viz specifikace kap. 4 a 8.
3. **Doladění pro pilot**: kontrola na čtečkách Urovo (velikost písma a tlačítek, fokus skeneru po každé akci, rychlost),
   chybová hlášení česky a lidsky, stav fronty, verze aplikace v patičce, aktualizace PWA (nová verze → nabídka obnovit).
4. **README**: provozní příručka – jak přidat skladníka, resetovat PIN, nahrát týdenní export, co dělat, když něco nejde.
5. **Hromadné založení uživatelů** (Správa / import seznamu): **jen jména a role, bez PINů** – PIN si každý nastaví sám
   při prvním přihlášení („Nastav si PIN“, viz specifikace kap. 3, verze 0.4.1). Žádné generované PINy ani aktivační kódy.

**Hotovo, když:** v pondělí ráno přijde report; stará data z AppSheet jsou v nové aplikaci; pilot s jedním vedoucím
a dvěma skladníky proběhne bez ztráty dat.
