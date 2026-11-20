# ADR-0002: Het Adventurer Platform groeit binnen `plugins/bots`, zonder rewrite

- Status: Aangenomen
- Datum: 20-11-2026
- Constitution: §2 (Incremental > Rewrite), §6 (Architectural Layers), §34 (Development Process)

## Context

De constitution vraagt drie lagen: Knowledge, Decision en Execution. De huidige code heeft die
scheiding niet expliciet. `adventurers/Adventurers.PlayerBots.js` is 4.650 regels en bevat
kennis (snapshot van levels, bank, quests), beslissingen (wat nu, welke bank) en uitvoering
(lopen, banken, kopen) door elkaar. Tegelijk draait het systeem: 60 avonturiers, 26,9 miljoen XP
in 4,9 uur op versie `7a8e40b` (metrics 17-11-2026).

## Beslissing

- Geen rewrite en geen nieuwe parallelle architectuur. De lagen worden zichtbaar gemaakt door
  bestaande modules aan een laag toe te wijzen ([ARCHITECTURE.md](../ARCHITECTURE.md#adventurer-platform))
  en nieuwe code in de juiste laag te zetten.
- Afsplitsen uit `Adventurers.PlayerBots.js` gebeurt alleen als bijwerking van een fix die door
  runtime-data gedreven is, één stuk tegelijk, volgens server-regel 12 (bestandsnaam eindigt op
  `.PlayerBots.js`).
- Alles blijft plugin-code (server-regel 1). Core krijgt geen avonturierslogica.
- Nieuwe activiteiten gaan bij voorkeur via data (`data/definitions/bot-activities.json`,
  `plugins/bots/data/*.json`), §13.

## Gevolgen

- Het draaiende systeem blijft draaien. Elke stap is klein en meetbaar.
- De lagen worden langzaam scherper. Tot die tijd mengt `Adventurers.PlayerBots.js` lagen; dat
  is bekende schuld, geen nieuwe norm.
- Een rewrite-voorstel heeft een eigen ADR nodig met runtime-bewijs dat incrementeel niet werkt.
