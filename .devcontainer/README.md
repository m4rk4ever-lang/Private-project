# Spelen in Codespaces

1. Wacht tot de terminal `Compiled successfully` laat zien. De eerste keer duurt dat
   10 tot 15 minuten: alle onderdelen worden geïnstalleerd en de game-cache wordt gedownload.
2. Het spel opent vanzelf in een nieuw tabblad. Gebeurt dat niet: open het tabblad **Ports**
   en klik op het wereldbolletje bij poort **3000**.
3. Log in met een zelfgekozen naam en wachtwoord. Het account wordt aangemaakt bij de eerste login.

**Werkt inloggen niet?** Open het tabblad **Ports**, klik met rechts op **43594** en kies
**Port Visibility > Public**. Herlaad daarna het spel.

**Stoppen:** sluit het tabblad, of kies op github.com/codespaces bij je codespace **Stop**.
Een codespace stopt na 30 minuten zonder activiteit vanzelf.
Gratis zit er per maand 120 core-uur in: 60 uur op deze 2-core machine.

**Bijwerken naar de nieuwste versie:** typ `update` in een terminal. Het spel stopt, de nieuwste
versie wordt opgehaald en het spel start weer. Backups van alle saves staan in `server/data/backups`
(elk uur, als er iets veranderd is).

**Opnieuw starten:** open je codespace via github.com/codespaces. Het spel start vanzelf.
Gestopt met `Ctrl+C`? Typ `yarn start` in de terminal.
