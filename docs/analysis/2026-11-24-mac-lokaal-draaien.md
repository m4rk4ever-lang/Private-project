# Lokaal draaien op een Mac, en wat daar nog niet werkt, 24-11-2026

Het GitHub-tegoed van de eigenaar (Codespaces) was op 23-11 op; sinds 15:21 UTC kwamen er geen logs
meer. De eigenaar gaat het spel op zijn Mac draaien. Hieronder de stappen, en twee scripts die op
macOS niet doen wat ze moeten.

## Voor de developer bot: wat op macOS niet werkt

### 1. `scripts/stop-game.sh` (gebruikt door `yarn stop`, `yarn start` en `yarn update`)

- r. 17 en 74: `ss -ltnH` bestaat niet op macOS. `ports_busy` geeft daardoor altijd "vrij", en het
  script stopt meteen met `exit 0`. Een draaiend spel wordt dus nooit gestopt.
- r. 29-48: het zoeken van processen leest `/proc/<pid>/status` en `/proc/<pid>/cmdline`. `/proc`
  bestaat niet op macOS.
- Gevolg: `yarn stop` doet niets; `yarn update` en een tweede `yarn start` lopen vast op "port
  already in use".

**Voorstel:**
- `ports_busy`: met `ss` als dat bestaat, anders `lsof -nP -iTCP -sTCP:LISTEN` met dezelfde poorten
  (3000, 43594, 49600).
- Processen zoeken: op macOS met `lsof -ti tcp:<poort>` (de processen die de poorten vasthouden),
  aangevuld met `pgrep -f` op dezelfde patronen als nu (`elvarg/Server.ts`, `local-panel.cjs`,
  `craco`, `run-with-env.mjs`, de checkout-map). De ouderketen van het script zelf (`keep`) via
  `ps -o ppid= -p <pid>` in plaats van `/proc/<pid>/status`.
- De rest (eerst TERM, 20 s wachten, dan KILL) kan blijven.
- Test: op Linux gedraagt het script zich zoals nu; op macOS stopt `yarn stop` een draaiend spel en
  geeft `yarn start` daarna geen poortfout.

### 2. `scripts/update.sh` r. 29

`sed -i 's/…/…/' .env` werkt niet met de sed van macOS (BSD-sed wil `sed -i ''`). Het raakt alleen
oude codespace-instellingen (`REACT_APP_DEFAULT_SERVER_NAME=Codespace`), dus lokaal komt de regel
meestal niet voor. Voorstel: een vorm die op beide werkt, bijvoorbeeld `sed -i.bak … && rm -f .env.bak`.

### 3. Logs delen

`scripts/share-bot-logs.sh` werkt op macOS (bash 3.2, `mktemp`, `git`). Voorwaarde: `git push` naar
de repo moet lokaal werken (`gh auth login` en `gh auth setup-git`). Mislukt de push, dan meldt het
script "pushen naar bot-logs mislukt" en probeert het 5 minuten later opnieuw.

## Voor de eigenaar: stappen op de Mac

Eenmalig:

```bash
brew install node@22 git gh
```

```bash
brew link --overwrite --force node@22
```

```bash
gh auth login
```

```bash
gh auth setup-git
```

Optioneel, voor de Quest Helper-bridge:

```bash
brew install openjdk@21
```

Repo en onderdelen:

```bash
git clone https://github.com/m4rk4ever-lang/Private-project.git ~/Private-project
```

```bash
cd ~/Private-project
```

```bash
corepack enable
```

```bash
corepack install
```

```bash
npm run setup
```

```bash
echo 'OWNER_USERNAME=Mark' >> .env
```

Starten, zonder dat de Mac gaat slapen:

```bash
caffeinate -dims yarn start
```

Controleren of de logs gedeeld worden (na een paar minuten, in een tweede venster):

```bash
cd ~/Private-project && yarn logs
```

Stoppen: `Ctrl+C` (tot punt 1 hierboven is opgelost werkt `yarn stop` niet). Een achtergebleven
proces op de poorten:

```bash
lsof -ti tcp:43594 -ti tcp:3000 | xargs kill
```

Bijwerken: eerst `Ctrl+C`, dan `git pull`, `npm run setup` en opnieuw `caffeinate -dims yarn start`.
