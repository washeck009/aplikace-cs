# Testovací soubory pro importy

Všechna data jsou **smyšlená** (EAN `8599999…`, čísla položek `1000000…`, lokace hal H9 / P9) – žádná firemní data.
Repo je veřejné, ostré exporty z ERP sem nepatří.

| Soubor | Import | Co vyzkouší |
|---|---|---|
| `ciselnik-ukazka.csv` | Číselník | UTF-8, oddělovač `;`; EAN s úvodní nulou, EAN s 12 číslicemi (jako po Excelu), textové číslo položky `BZ…` |
| `lokace-ukazka.csv` | Lokace | regálové lokace H9 / P9, třídílná `H9-AB-07`, zóny se slovem (založí se neaktivní), BAL / RAMP / PRIJEM / PAL (přeskočí se) |
| `stav-lokaci-ukazka.xlsx` | Stav na lokacích | stejné sloupce jako export z ERP; čísla položek jako čísla, DATUM s časem, stejná lokace + položka ve dvou řádcích (sečte se), zboží mimo číselník (nehlídané), lokace mimo H/P |

Doporučené pořadí: číselník → lokace → stav. Na zkoušku importuj do podniku, kde nevadí smyšlené lokace H9 / P9
(nebo je po zkoušce v listech `Polozky`, `Lokace` a `Import_stav_lokaci` smaž).
