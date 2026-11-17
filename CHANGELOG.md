# Changelog

Alle wijzigingen aan dit project, nieuwste bovenaan.

Dit project is een eigen voortzetting van [TSPS](https://github.com/RSPSApp/tsps)
(BSD 2-Clause, zie `LICENSE`). Wat hieronder staat, is ons eigen werk vanaf de kopie.

Indeling per versie:
- **Toegevoegd**: nieuwe functies, content of tools
- **Gewijzigd**: aanpassingen aan bestaand gedrag
- **Opgelost**: bugfixes
- **Verwijderd**: functies of bestanden die eruit zijn

## [Nog niet uitgebracht]

### Toegevoegd
- Avonturiers flicken hun protection prayer als hun prayer onder de helft zakt: aan rond de aanval van de tegenstander, ertussen uit. Met genoeg punten blijft de prayer gewoon aan.
- De metrics van elke avonturier tonen nu zijn inventaris (item, aantal, noted), vrije plekken, lopende boodschap en opgeslagen klus.
- Avonturiers nemen agility-shortcuts die hun level toelaat als die een flink stuk lopen schelen, zoals de underwall tunnel tussen de Grand Exchange en Edgeville (Agility 21). Lukt een shortcut niet, dan laten ze hem een half uur links liggen.
- Avonturiers met combat 90+ en Prayer 43+ doen Barrows-runs: met een spade, eten, prayer potions en Barrows- en Varrock-teleporttablets graven ze de heuvels in, verslaan de broers met de juiste protection prayer, gaan door de tunnels (deuren en puzzel) naar de kist en teleporteren daarna weg. Test een run met `::advtrain <naam>:boss_barrows`.
- Tijdelijk staan de quests die een skill, minigame of gebied openen (zoals Druidic Ritual, Rune Mysteries, Priest in Peril, Lost City, Fairytale, Song of the Elves en Desert Treasure) voor avonturiers op voltooid, zonder beloningen (geen XP, items of questpunten), tot de bots ze zelf kunnen spelen. De lijst staat in adventurers.json (grantedQuests).
- Avonturiers kunnen trappen en ladders naar ondergronds nemen (en weer omhoog), zoals de Mining Guild onder Falador (vanaf Mining 60).
- In `::teleports` staan nu ook de andere drie Desert Treasure II-bosses: Duke Sucellus (bij zijn poort), de Leviathan (bij de roeiboot) en de Whisperer (bij zijn kamer). Vardorvis stond er al.
- Bij een dood van een avonturier staat in de logs wie hem het laatst raakte (met level), waar hij stierf, of hij eten en prayer had, en een grove reden (geen eten, sterkere tegenstander, verloor met eten bij zich).
- Prayer potions zijn voorraad, net als eten: bij klussen zonder gevecht gaan ze naar de bank, en voor een boss haalt een avonturier ze eerst daar op (ook aangebroken potions) voordat hij nieuwe koopt.
- Avonturiers met Protect from Melee nemen prayer potions mee naar bosses waar ze tegen bidden (van hun bank, anders gekocht) en drinken er een als hun prayer-punten laag staan. Ze houden een voorraad aan (8 in de tas, 20 op de bank); wat ze daarboven hebben, zoals potions van Herblore-training, verkopen ze gewoon.
- Avonturiers zetten in een gevecht met een Barrows-broer, de Giant Mole of Sarachnis de juiste protection prayer aan (melee, missiles of magic), als hun Prayer-level en prayer-punten dat toelaten. Na het gevecht zetten ze hem weer uit.
- Elke regel in de avonturierslogs vermeldt de versie van de server (de git-commit), zodat je na een update ziet welke regels bij welke versie horen.
- Teleporteert een avonturier onderweg (spreuk, tablet, sieraad of home teleport), dan staat dat in zijn activiteitenlog.
- Als een avonturier iets gaat halen voor een quest, controleert hij daarna of het echt in zijn tas zit. In het log staat dan "Heeft ..." of "Kon ... niet halen".
- Kan een avonturier een quest-item niet kopen, dan verzamelt hij het zelf als het een grondstof is (clay mijnen voor Doric's Quest, logs hakken, vis vangen) en gaat hij daarna terug naar zijn quest. Daarvoor is er een nieuwe bot-activiteit: clay minen.
- Het spel start de Quest Helper-bridge zelf (en opnieuw als hij stopt) als die gebouwd is maar niet draait; zonder bridge liepen alle quests van de avonturiers na twee minuten vast. Uit te zetten met ADVENTURER_START_BRIDGE=0.
- Eigenaarscommando `::advquestall`: alle avonturiers proberen tegelijk elk een andere quest (blokkades opgeheven), en wie klaar is of vastloopt pakt de volgende quest die in de sweep nog niemand probeerde, twee uur lang; zo wordt in één run het hele questpad getest. `::advquestall stop` beëindigt de sweep.
- Avonturiers gaan af en toe (ongeveer 1 op de 10 keuzes) 20–40 minuten puur geld verdienen: met de klus die hen tot nu toe het meeste geld per uur opleverde (dat meten ze zelf per klus), soms iets nieuws om te proberen, of een boss als ze sterk genoeg zijn. In te stellen met "moneyChance" in adventurers.json.
- De questlogboeken van de avonturiers bevatten nu ook de gesprekskeuzes (welke opties er waren en welke de avonturier koos), bij vastlopen én bij een voltooide quest.
- Het ontwikkelaarslogboek zegt bij vastlopen, stilstaan en versperde routes ook waarom: wat de bot-actie op dat moment deed, welke monsters er in de buurt waren (met level), HP, vrije slots en hoe ver het doel nog was.
- Het ontwikkelaarslogboek legt elke dood van een avonturier vast: bij welke klus of quest, waar, door wie en of hij eten bij zich had.
- Bij het afsluiten van de server worden de logboeken van de avonturiers nog één keer gedeeld op de branch `bot-logs`, zodat de laatste minuten van quests en avonturiers niet verloren gaan.
- Bij het begin van een quest halen avonturiers wat Quest Helper aanraadt om mee te nemen (eten, een teleport, antipoison), als ze het kunnen krijgen.
- Avonturiers kunnen verder kijken dan rune: een abyssal whip (70 attack) en granite (50 defence/strength), Helm of Neitiznot (55, na The Fremennik Isles), dragon (60/70), Bandos (65) en Dharok's (70) armour, als ze het geld hebben; anders wordt het een spaardoel.
- Elke clan heeft tijdelijk 5 extra avonturiers (Jorgbot 5–9, Patrickbot 4–8, Markbot 4–8) voor een langere testrun, elk met een eigen testprofiel (vroege vechter, skiller, middenmoot, gevorderd, mix) met andere levels, al gedane quests en startgeld; ze tellen niet mee voor de achievements. In te stellen met "extraPerClan" en "testProfiles" in adventurers.json.
- De server deelt elke 5 minuten zelf de logboeken van de avonturiers op de branch `bot-logs`, zolang het spel draait (ook na een herstart), zonder dat iemand een commando hoeft te draaien.
- Een nieuw ontwikkelaarslogboek (logs/adventurers-metrics.jsonl) houdt per avonturier bij waar de tijd heen gaat (werken, lopen, boodschappen, quests, stilstaan), hoeveel XP en geld er per 5 minuten bijkomt, hoe elke taak afliep (doel gehaald, tijd op, tas vol, vastgelopen) en of gekozen doelen worden gehaald, welke skills wel en niet getraind worden en via welke activiteit, plus waar een route versperd was en hoe zwaar de avonturiers voor de server zijn.
- `yarn logs` deelt de logboeken van de avonturiers (wat ze deden en waar quests vastliepen) via de repo in docs/bot-logs/, zodat ze ook van een andere machine te lezen zijn.
- Met `::volg` toont je questtab de quests van de gevolgde avonturier (wat hij heeft gedaan en waar hij mee bezig is) en je combattab zijn wapensoort; als je stopt met volgen, krijg je je eigen tabs terug.
- Alles wat de avonturiers doen staat ook in logs/adventurers-activity.jsonl (met tijd en plek), om terug te zien waar het misging.
- In een Codespace wordt de Quest Helper-bridge vanzelf opgezet en gestart: Java 21, de geheime sleutel in .env, Quest Helper ophalen en bouwen bij het aanmaken (of op de achtergrond bij het starten), en de bridge start mee met het spel. Een bestaande Codespace heeft één keer 'Rebuild Container' nodig voor Java.
- Avonturiers proberen (met de Quest Helper) elke quest waarvan ze de eisen halen. Lopen ze vast, dan stoppen ze, laten ze de quest een tijd liggen (steeds langer) en schrijven ze op waar en waarom: in logs/adventurer-quest-feedback.jsonl en als questFeedback in /api/adventurers.
- Beheerders kunnen een avonturier een quest laten beginnen vanaf een bepaalde stap: `::advquest <naam>:<quest>:<stage>` (om één stap te testen).
- Avonturiers kunnen quests spelen met de echte Quest Helper als gids (als de quest-helper-bridge draait): per stap praten ze met de juiste NPC, gebruiken ze objecten, rapen ze spullen op, kopen ze wat in een winkel moet en kiezen ze de juiste antwoorden. Beheerders starten zo'n quest met ::advquest; quests die een bot helemaal heeft uitgespeeld komen op de lijst die ze zelf kiezen.
- Avonturiers kunnen Prayer trainen: ze begraven hun gebankte botten één voor één, of kopen botten (big bones vanaf Prayer 30) op de GE om te trainen, zoals spelers doen.
- Clanleden helpen elkaar met geld: een avonturier met ruim geld over geeft een clangenoot hooguit een kwart van zijn overschot voor diens doel (zoals nieuwe uitrusting), maximaal eens per uur; de rest verdient die zelf. Beide logboeken vermelden het.
- Avonturierspagina: nieuw tabblad Achievements met de clanrace in eerste keren: wie als eerste een level, totaal level, combat level, quest, questpunten, bezit of boss haalt, en welke clan als eerste samen een mijlpaal bereikt (met datum en tijd).
- Avonturiers sparen ook voor een staff (Magic) en kopen bij een stijl passende uitrusting: leather en d'hide voor Ranged, wizard- en mystic robes voor Magic, en betere bogen en staves. Ze trekken die aan als ze zo vechten.
- Met `::volg` zie je in de chat wat de gevolgde avonturier doet: klussen, lopen, kopen, verkopen en banken, met de items en de prijs.
- Beheerders kunnen een avonturier met `::advtrain <naam>:<modus>` (bv. `slayer`) meteen een trainingsklus laten beginnen.
- Avonturiers vangen vogels (Hunter, vanaf level 1): ze kopen bird snares (in een winkel of op de GE), lopen naar de crimson swifts in de Feldip Hills, zetten snares, controleren een snare met een vogel erin en rapen een omgevallen snare weer op. Vangst, XP en buit (botten, vogelvlees, veren) komen van de Hunter-plugin zelf.
- Gereedschap dat geen winkel in de buurt verkoopt (zoals een bird snare), kopen avonturiers op de GE.
- Avonturiers met geld over kopen ook een geladen teleport-sieraad op de GE (games necklace, ring of dueling of amulet of glory). Elke lading is een teleport voor een lange tocht, naar bestemmingen zonder quest-eis.
- Avonturiers die sterven, krijgen een grafsteen zoals spelers (gewone wereldbots niet). Na het respawnen lopen ze terug naar hun graf, pakken de gratis spullen en betalen het fee voor de rest (uit de Coffer, hun tas of bank). Hebben ze daar het geld niet voor, dan blijft dat deel liggen en gaat het daarna naar Death's Office. Het dagboek meldt waar ze stierven.
- Nieuw event `gravestones:reclaim` voor plugins: bij het graf Loot en Pay zoals een speler.
- Bots gebruiken voor lange tochten ook Ardougne Teleport (na Plague City) en Trollheim Teleport (na Eadgar's Ruse), met hun eigen runes en Magic-level, naast Varrock, Lumbridge, Falador en Camelot Teleport.
- Avonturiers met geld over (5.000 gp of meer) kopen op de GE een paar teleport tablets (Varrock, Lumbridge, Falador of Camelot). Bij een lange wandeling breken ze er een als dat veel lopen scheelt.
- Slayer-taken met monsters die beschermende uitrusting vereisen (earmuffs voor banshees, een nose peg voor aberrant spectres, een facemask voor dust devils en meer, uit de Slayer-gegevens van het spel): de avonturier draagt het item als hij het heeft, haalt het van de bank of koopt het in een winkel die het verkoopt. Anders laat hij Slayer een uur liggen.
- Elke clan heeft een eigen wapenschild op de avonturierspagina: de Jorg Clan een rode bijl, de Patrick Clan een groene schedel en de Mark Clan een blauwe ster. Het staat bij de clanrace, de clankopjes, de knoppen en op elke kaart. Kleur en symbool zijn in te stellen in `adventurers.json`.
- Avonturiers smelten hun eigen erts in de oven van Falador tot de beste staaf die hun Smithing-level toelaat (brons, ijzer, staal), en smeden die daarna. Zo volgt na mining vanzelf smithing.
- Runecraft voor avonturiers na Rune Mysteries: met hun eigen air talisman en rune essence (uit de bank of van de GE) lopen ze naar de Air-ruïnes ten zuiden van Falador, gaan naar binnen, maken runes bij het altaar en gaan via het portaal terug. (Nog niet in het spel getest.)
- Slayer-masters komen uit de eigen tabel van de Slayer-plugin: een avonturier gaat naar de hoogste master waarvan hij de combat- en Slayer-eisen haalt en die hij te voet kan bereiken (Turael en Spria, vanaf combat 85 Nieve en Steve). Mazchna in Morytania pas na Priest in Peril.
- `::volg` laat in de chat de quests van de gevolgde bot zien (hoeveel voltooid, welke bezig met hun stage) en hoeveel achievement diary-taken hij per gebied gedaan heeft. Bij het starten en elke keer dat het verandert.
- Avonturiers doen echt quests, stap voor stap zoals een speler: naar de NPC lopen (ook trappen op en via ladders een kelder in), Talk-to en de dialoog doorklikken, waarbij ze de juiste antwoorden kiezen. De quest zelf zet de stages en geeft de beloningen. De eerste is Rune Mysteries (Runecraft). Ze beginnen alleen aan een quest waarvan ze alle eisen halen. Lukt een stap niet, dan leggen ze de quest een uur weg. Owners kunnen een quest starten met `::advquest <naam>:<quest>`.
- Bots gebruiken de home teleport (Lumbridge) voor een lange wandeling: de echte spreuk met de lange animatie en de cooldown van 30 minuten.
- De avonturierspagina toont de avonturiers per clan (beste clan eerst, de leider bovenaan), met knoppen voor één ranglijst of voor één clan alleen (Jorg, Patrick of Mark Clan). De keuze wordt onthouden.
- Lange tochten voor bots lopen via een netwerk van tussenstops (steden en kruisingen, met routes die in het spel gecontroleerd zijn). Zo komen ze ook ver weg, bijvoorbeeld van Lumbridge naar de Agility-course in de Gnome Stronghold, in plaats van tegen de eerste muur of rivier te blijven staan.
- Avonturiers onthouden hun lopende klus: bij het begin van een klus en daarna elke 3 minuten wordt één regel per avonturier overschreven (wat, waarom, hoe lang nog) en opgeslagen. Na een herstart pakken ze die klus weer op voor de tijd die nog over was, in plaats van opnieuw te beginnen. Een opgeslagen klus van meer dan 6 uur oud vervalt.
- Drie clans racen tegen elkaar, elk met 5 avonturiers: de Jorg Clan (leider Bekoek, met Jorgbot 1 t/m 4), de Patrick Clan (leider Slayed Soul, met Eeshwar en Patrickbot 1 t/m 3) en de Mark Clan (leider Call me Mark, met Kram539 en Markbot 1 t/m 3). De leider sticht de clan in het spel; de anderen worden lid. Alle 15 zijn te volgen met `::volg` en staan op de avonturierspagina, met bovenaan een clanrace (score, totaal level en bezit per clan).
- Clangenoten geven elkaar materialen die ze echt over hebben: wie logs, staven of edelstenen nodig heeft om te trainen, krijgt die eerst uit de bank van een clangenoot (die houdt zelf 500 achter) voordat hij gaat kopen. Beide dagboeken melden het.
- Avonturiers doen Slayer: ze lopen naar Turael (Burthorpe) of Spria (Draynor), krijgen een echte taak en vechten alleen tegen de monsters die meetellen, op de dichtstbijzijnde plek waar dat kan. Is de taak klaar, dan halen ze een nieuwe of doen iets anders. Taken in de Wilderness, in dungeons of met een afmaak-item (zoals ijskoelers) laten ze voorlopig liggen.
- Avonturiers vechten ook met pijl en boog of met spells: met hun eigen boog en pijlen (shortbow tot magic shortbow, bronze tot rune arrows) of hun eigen runes (Wind Strike tot Fire Bolt, met een staf). Ze kiezen dat als ze de spullen hebben, halen ze uit de bank en kopen pijlen en runes bij op de GE. Ranged- en Magic-doelen sturen die keuze.
- Avonturiers trainen Agility: ze lopen rondjes op de beste course die hun level toelaat (Gnome Stronghold tot Seers' Village Rooftop), via de echte obstakels met slagingskans, vallen, XP en marks of grace. Marks rapen ze op en bewaren ze.
- Avonturiers hebben steeds een eigen doel, zoals "20 Attack voor een mithril scimitar", daarna "1.500 gp" om hem te kopen, Firemaking 50 voor Wintertodt of geld voor een amulet of glory. Het doel stuurt wat ze trainen; staat het op sparen, dan kiezen ze vaker wat geld oplevert en kopen ze minder materialen. Gehaalde en nieuwe doelen staan in hun dagboek, het huidige doel op de avonturierspagina. De vaste favoriete skills zijn weg.
- Bankstanders werken nu echt: ze halen hun mes of chisel en een inventaris logs of edelstenen uit hun eigen bank, maken het beste wat hun level toelaat via de echte menu's (met XP), en zetten de producten terug. Hebben ze niets meer om te maken, dan staan ze gewoon. Hun gegenereerde account heeft een voorraad om mee te beginnen.
- Trainen met gekochte materialen werkt nu ook voor Crafting (edelstenen slijpen met een chisel), Cooking (rauwe vis bakken in de keuken van Lumbridge) en Herblore (unfinished potions met hun ingrediënt, pas na Druidic Ritual). Bots maken dit via de echte menu's van het spel, met het beste product dat hun level toelaat.
- Avonturiers gebruiken hun bank slimmer en bewaren naar behoefte: wat ze opgebruiken (runes, pijlen, eten, teleport tablets, geladen sieraden) houden ze allemaal; materialen voor hun huidige of komende levels tot 10.000 per soort; materialen waar ze overheen gegroeid zijn verkopen ze op de GE. Waardeloze spullen laten ze vallen. Willen ze trainen met materialen, dan halen ze eerst hun eigen voorraad van de bank voordat ze iets kopen.
- Avonturiers met geld over kopen materialen om te trainen: logs om te fletchen of te branden bij de GE, staven om te smeden bij de aambeelden van Varrock West. Ze bieden op de GE, wachten tot het bod vol is, gaan aan het werk en verkopen de producten weer, ook met verlies, zoals spelers dat doen.
- Bots teleporteren ook met teleport tablets en geladen sieraden (glory, games necklace, ring of dueling en meer), alleen naar de bestemmingen van dat sieraad en zonder bestemmingen achter een quest of in de Wilderness. Een tablet wordt opgebruikt, een sieraad verliest een lading.
- House parties: een bot met een hoog Construction-level heeft een huis met kapel en gilded altar, houdt de wierookbranders aan en adverteert zijn huis in Rimmington. Vechtende bots sparen dan hun botten en offeren ze daar (350% Prayer-XP). Uit te zetten met `HOUSE_PARTY=0`.
- Bots maken zelf iets van hun grondstoffen: mijners smelten hun erts en smeden de staven op een aambeeld tot het beste wat hun Smithing-level toelaat, houthakkers fletchen hun logs met een mes, vissers koken hun vangst en banken die. Zonder hamer of mes, of met te laag level, verkopen ze het.
- Elke wereldbot krijgt bij het starten een eigen account alsof hij al speelde: gereedschap en uitrusting bij zijn levels, eten, coins en een bank met wat grondstoffen. Daarna speelt hij eerlijk: hij raapt loot op, verkoopt op de GE en koopt eten en gereedschap met zijn eigen coins. Uit te zetten met `BOT_GENERATED_ACCOUNTS=0`.
- Bij `::volg` zie je de inventaris, uitrusting en skills van de bot die je volgt; na het stoppen weer je eigen.
- `::volg <naam>`: volg een bot of avonturier live met de camera. Je bent onzichtbaar en loopt vanzelf mee. `::volg` zonder naam stopt.
- Avonturiers rapen hun eigen loot op en verkopen die op de Grand Exchange. De coins halen ze later op en gebruiken ze voor uitrusting en eten.
- Gevonden uitrusting die beter is en die ze mogen dragen, trekken avonturiers zelf aan.
- De avonturierspagina toont RuneScape-iconen (van de OSRS Wiki) voor skills, coins en items, de uitrusting die elke avonturier draagt, de inventaris en een Volg-knop.
- De avonturierspagina opent bij het starten van het spel in een eigen tabblad naast de game. Blokkeert de browser dat, dan staat er rechtsboven een link.
- `CHANGELOG.md` om ons werk bij te houden.
- Het spel draait in GitHub Codespaces: open de repo in een codespace en het spel start
  vanzelf in je browser (uitleg in `.devcontainer/README.md`).
- Tutorial Island staat aan: nieuwe accounts beginnen op het eiland en gaan daarna naar Lumbridge.
- Het account **Mark** logt in een codespace automatisch in als **owner**.
- Nieuwe instelling `OWNER_USERNAME` in `.env`: deze accounts loggen in als owner
  (meerdere namen met komma's).
- **Staffzone** (`::staffzone`, alleen owner en developer): een privé-kopie van de schatkamer
  van Tombs of Amascut, gedeeld door alle staff. Met vier gratis staffwinkels (wapens, armour,
  voorraad, skilling), een bankier, een trainingsdummy en een sierlijke verjongingspool.
  Osmumten houdt de wacht bij de sarcofaag en staande fakkels verlichten de hal. Je hitpoints,
  prayer, special attack en run-energie blijven er vol. Nog een keer `::staffzone` brengt je terug.
- `::allquests` (owner): zet alle quests en miniquests in één keer op voltooid, met questpunten
  maar zonder beloningen (geen items of XP). Ook quests en miniquests die nog niet speelbaar
  zijn gebouwd, worden in de questlijst afgevinkt en blijven dat na opnieuw inloggen.
  Ook alle achievement diaries (alle tiers) worden voltooid. De diary-beloningen haal je zelf op
  bij de NPC van elke diary.
- **Getrapte XP-rate**, per skill op basis van je level: x25 van level 1 tot 49, x15 van 50 tot 79,
  x10 van 80 tot 89 en x5 vanaf 90. Geldt ook voor quest-beloningen, lampen en tomes.
  Aan te passen met de instelling `TieredExperience:tiers`.
- **`update`** (of `yarn update`): stopt het spel, haalt de nieuwste versie op, installeert nieuwe
  onderdelen als dat nodig is en start het spel weer.
- **Automatische backups** van alle saves in `server/data/backups`: elk uur en bij het stoppen van
  de server, alleen als er iets veranderd is. De laatste 48 blijven bewaard
  (instelling `SaveBackups:keep`).
- **Wekelijkse backup naar GitHub:** hoogstens eens per 7 dagen, zolang de server draait, gaat de
  nieuwste backup naar de branch `saves` van de repo. Elke week een commit, dus oude versies blijven
  terug te halen. Alleen als de repo privé is, want de saves bevatten wachtwoord-hashes.
  Handmatig: `yarn saves:push`.

- **Eigen naam: Realm of Eeshwar.** Wereldnaam, tabtitel, loginscherm, welkomstbericht en
  pluginlijst gebruiken de nieuwe naam in plaats van "Old School RuneScape" en "RSPS.app".
- **Eigen logo** op het loginscherm in plaats van het RuneScape-logo, en "Realm of Eeshwar is loading"
  op het laadscherm. Een codespace met de oude servernaam "Codespace" wordt vanzelf omgezet.

### Gewijzigd
- Avonturiers kiezen hun geldklussen doelmatiger: een klus die eerder niets of verlies opleverde, geldt niet meer als geldklus, en iets nieuws proberen ("eens proberen") gebeurt nog maar af en toe. Een verwerkklus met gekochte materialen (zoals Herblore) telt niet meer als sparen voor een doel.
- Avonturiers trainen een skill die al op 99 staat bijna nooit meer (alleen combat en Slayer nog wel, voor de loot).
- Voor woodcutting, mining en fishing kiest een avonturier een plek die niet alleen dichtbij is, maar ook dicht bij een bank ligt, zoals een speler de willows bij een bank kiest boven die midden in het niets.
- Avonturiers reizen slimmer:
  - Met Magic 25 of hoger kopen ze law runes en elementen voor teleport-spreuken; anders van elke teleport-tablet een paar. Hoe rijker, hoe meer ze inslaan.
  - Bij een bankbezoek nemen ze hun law runes, tablets en teleport-sieraden mee in de tas, want alleen van daaruit teleporteren ze.
- Capes tellen nu mee als uitrusting met stats, per vechtstijl: obsidian, fire, infernal en (infernal) max cape voor melee; Ava's-apparaten voor ranged; god capes voor magic. Een avonturier trekt de beste aan die hij heeft. Verdiende capes (fire, infernal, max) koopt hij niet en worden geen doel; een cape voor de kleur koopt hij alleen als hij nog geen cape heeft.
- Hoge testprofielen hebben de capes die ze op dat niveau verdiend zouden hebben: midgame draagt een fire cape, late game een infernal cape, endgame een infernal max cape. Op de bank liggen Ava's-apparaten en een imbued saradomin cape.
- De gear-lijsten voor alle drie de vechtstijlen lopen nu van level 1 tot endgame, met de tussenstappen ertussen: voor ranged onder meer d'hide, Karil's, Armadyl, Masori en de Twisted bow; voor magic onder meer splitbark, Infinity, Ahrim's, Ancestral en de Kodai wand; plus dragon- en crystal-tools. Testprofielen met Ranged of Magic krijgen die set met pijlen of runes op de bank.
- Testopzet: geen wereldbots meer (site-bots en wilderness-bots staan op 0, met de nieuwe instelling `PlayerBots:wildernessBots`), en 15 extra avonturiers per clan (60 in totaal). Alle avonturiers beginnen opnieuw in Lumbridge. De originele accounts starten als nieuw account op level 3; de extra's krijgen een testprofiel van vroege vechter tot endgame (combat 126, alles 99, 2 miljard coins), met gear die past bij hun levels en geld.
- De gear-lijsten van avonturiers lopen nu door tot endgame: Scythe of Vitur, Osmumten's fang, Torva, avernic defender, ferocious gloves, primordial boots en amulet of torture. Er zijn ook slots voor handschoenen, laarzen en amulet bijgekomen.
- Elke avonturier heeft een eigen smaak in uitrusting: een scimitar, longsword, battleaxe, mace of warhammer, een kite- of square shield, een full of medium helm, een platebody of chainbody, platelegs of een plateskirt, en een cape in zijn eigen kleur zodra hij wat geld over heeft. Zo lopen ze niet meer allemaal in hetzelfde rond.
- Avonturiers kiezen minder vaak combat of een quest: een quest wordt in ongeveer 1 op de 5 keuzes gestart en training voor een quest-eis in 1 op de 4, zodat de 15 avonturiers meer verschillende skills trainen.
- Een quest waarin twee verschillende avonturiers vastlopen, wordt drie uur lang voor alle avonturiers overgeslagen.
- Avonturiers staan minder stil: ze denken elke servertick en gaan na een kill of actie meteen door naar de volgende, en eten en kiezen hun volgende taak binnen ruim een seconde.
- Avonturiers kennen nu elke bank in de wereld (elke bankbalie die echt opent), niet alleen een vaste lijst, en lopen naar de bank die het kortst lopen is.
- Alle avonturiers en de achievementsrace beginnen opnieuw bij nul in Lumbridge, met alle verbeteringen van vandaag.
- Een spaardoel voor een uitrustingsstuk dat een avonturier inmiddels heeft (of iets beters), vervalt; hij kiest een nieuw doel. Op de avonturierspagina staat onder Achievements nu ook waar quests vastlopen.
- Avonturiers doen meer verschillende skills: vechten komt minder vaak voorbij, en skills die ze nog nauwelijks hebben getraind (woodcutting, fletching, firemaking, smithing, agility, hunter) juist vaker.
- Een avonturier die voor een doel of quest-eis traint (zoals combat 10), stopt daarmee als hij dat level (plus 0 tot 3 levels) heeft gehaald, in plaats van door te trainen tot ver erboven. Een spaardoel dat gehaald is, koopt hij nu ook echt.
- Avonturiers trainen attack, strength en defence niet meer precies gelijk op: elk heeft een eigen voorkeur en houdt een stijl een tijdje vast; loopt één skill ver achter, dan haalt hij die eerst in.
- Bij het opstarten komen eerst de 15 avonturiers online, één per tick. De andere bots volgen pas na 45 seconden, ook één per tick, in plaats van ruim 90 tegelijk. Dat geeft minder lag en minder geheugenpieken bij de start. Met `BOT_WORLD_DELAY_MS` in `.env` stel je die wachttijd in (0 = meteen).
- Stopt de client steeds, dan blijft hij het opnieuw proberen met een steeds langere pauze (tot 1 minuut), in plaats van na 4 keer op te geven.
- Nog minder wereldbots voor minder lag: 3 per Edgeville-plek (was 5), 5 bij de Varrock-ditch (was 10) en een PvP-pool van 15 (was 30).
- Avonturiers begraven gewone botten meteen (zoals spelers onderweg doen) en bewaren alleen big bones en beter voor Prayer of het altaar op een house party; runes, pijlen en teleports verkopen ze nooit meer.
- Avonturiers kiezen hun klusplek nu zelf: de dichtstbijzijnde plek die bij hun klus, level en quests past, los van de regels waarmee de gewone bots zich over de wereld verspreiden.
- Het logboek van een avonturier vermeldt waarom hij niet kan gaan jagen (geen geld voor een bird snare, plek niet bereikbaar).
- Alle avonturiers en de achievementsrace beginnen opnieuw bij nul in Lumbridge, met alleen het startpakket, voor een eerlijk speelveld met alle verbeteringen.
- De clanleider krijgt voorrang bij hulp van clangenoten: hij krijgt meer materialen en tot de helft van hun overschot aan geld (elk half uur), en de anderen nemen niets uit de voorraad van de leider.
- Avonturierspagina: 'Per clan' toont de clanrace met de kaarten per clan, 'Ranglijst' de ranglijst van alle avonturiers.
- Een avonturier zonder boog en pijlen of runes spaart daar nu voor (met houthakken, mijnen, vissen, stelen of vechten) en koopt ze zodra het geld er is; daarna kan hij Ranged of Magic trainen.
- Na het verkopen of banken van een volle tas gaat een avonturier verder met dezelfde klus voor de tijd die nog over was, in plaats van na één tas iets anders te kiezen.
- Een avonturier maakt zijn klus af als hij een level haalt dat een betere plek opent (zoals Thieving 5), in plaats van meteen naar de andere kant van de kaart te lopen; de betere plek kiest hij bij zijn volgende klus.
- Avonturiers banken ook bij de Grand Exchange, Al Kharid, Ardougne en Yanille, en lopen niet meer voor een verkoop helemaal naar de GE als een bank veel dichterbij is; ze verkopen later.
- Een avonturier die al op een goede plek staat (mannen om hem heen) traint daar, in plaats van naar Lumbridge te lopen; ook bij Edgeville en Seers' Village kunnen ze mannen bestelen.
- Avonturiers kiezen een quest pas zelf als een bot die quest in het spel helemaal heeft uitgespeeld; Rune Mysteries staat daarom voorlopig niet op hun lijst.
- De avonturierspagina noemt meer plekken bij naam, zoals de Wizards' Tower in plaats van de haven van Port Sarim.
- Avonturiers die veel verder zijn met houthakken of mijnen dan met fletching, firemaking, smelten of smithing kiezen die verwerkende skills nu veel vaker.
- De tijd voor een trainingsklus van een avonturier loopt pas als hij op de plek is, niet al tijdens het lopen.
- Avonturiers blijven langer bij één klus (20 tot 40 minuten), zodat ze meer levels en geld halen in plaats van vooral te reizen.
- Avonturiers kopen gereedschap pas als ze de skill gaan doen (een bijl als ze gaan hakken, een pickaxe als ze gaan mijnen), en niet meer bij elke ronde een hamer en een mes terwijl ze nog vechten zonder wapen.
- Agressieve monsters vallen avonturiers aan zoals spelers, met dezelfde regels (combatlevel, bereik, tolerantie na 10 minuten in een gebied). Avonturiers hebben auto-retaliate aan en vechten dus terug. Gewone wereldbots worden met rust gelaten.
- Na een (her)start beginnen de avonturiers gespreid (binnen anderhalve minuut), in plaats van alle vijftien tegelijk naar dezelfde bank te lopen.
- Avonturiers trainen alleen nog samen bij een gedeeld doel (samen een boss, samen Wintertodt). Het doelloze "samen" op één plek trainen is weg: groepen van vijf die door Falador Park renden, of "samen met" iemand die allang een quest deed.
- Een Slayer-taak maken avonturiers af voordat ze iets anders gaan doen (hooguit anderhalf uur), in plaats van na 8 tot 18 minuten te wisselen.
- Een tocht geldt pas als versperd als de bot 45 seconden geen stap zet (tijd genoeg voor een poort of deur), of vier minuten lang niet dichterbij komt. Een omweg rond een rivier of door een poort breekt de tocht niet meer af.
- Alle 15 avonturiers beginnen opnieuw op level 1 (generatie 9), in Lumbridge met het starterspakket van Tutorial Island. Ze worden nu ook echt naar Lumbridge teruggezet, en hun hele savedata gaat terug naar die van een nieuw account: ook de Slayer-taak, diary-taken, minigame-standen en cooldowns.
- Gereedschap dat de volgende klus niet gebruikt (hamer, pickaxe, chisel, messen), zetten avonturiers op de bank. Hebben ze het later nodig, dan halen ze het daar weer op in plaats van een nieuwe te kopen.
- Avonturiers kiezen bij het vechten niet altijd de dichtstbijzijnde plek, maar een van de beste paar plekken voor hun level, met een voorkeur voor sterkere monsters. Zo zie je ze op meer plekken dan bij de ratten en mannen van Lumbridge.
- Avonturiers die met pijl en boog of met spells vechten, trainen ook Defence als die achterloopt: longrange (Ranged- en Defence-XP) of defensief casten (Magic- en Defence-XP).
- Avonturiers gaan pas naar de Canifis Rooftop na Priest in Peril, en kiezen een course die onlangs onbereikbaar bleek even niet.
- Pijlen, bogen en runes die een avonturier voor zijn volgende klus niet nodig heeft (een klus zonder vechten, of met een andere vechtstijl), zet hij op de bank als hij daar toch is. Wat zijn huidige vechtstijl gebruikt, houdt hij bij zich.
- Alle 15 avonturiers beginnen opnieuw op level 1 (ook de eerste 5), zodat de clanrace eerlijk start: levels, spullen, bank, quests, GE-biedingen en dagboek zijn gewist.
- Veel minder wereldbots: hooguit 3 PvP-bots per actief gebied (was 16) en een pool van 30 (was 845). Samen met de vaste plekken zijn dat er zo'n 50 in plaats van 150 tot 180. Zo blijft er ruimte voor de avonturiers.
- Avonturiers maken zelf de afweging bij een volle tas: is een bank of de GE onbereikbaar, dan proberen ze de volgende bank. Een versperde weg blokkeert alleen die ene plek. Alleen als niets bereikbaar is, laten ze goedkope spullen (minder dan 500 gp per stapel) vallen; duurdere spullen houden ze en ze proberen het even later opnieuw.
- Avonturiers die sparen voor een doel (betere uitrusting, een teleport-amulet, gereedschap) verkopen ook materialen van hun bank op de GE, zoals logs, edelstenen of staven, tot het tekort gedekt is. Runes, pijlen en eten houden ze.

### Opgelost
- Avonturiers vechten tijdens een Barrows-run weer terug tegen de broers; hun aanval werd afgebroken alsof ze onderweg waren.
- Een avonturier op weg naar een boss verkoopt zijn net gekochte spade, tablets en prayer potions niet meer meteen op de GE.
- Een avonturier met een volle tas die zijn prayer potions noted ontving, bleef op de GE nieuwe kopen. Hij ruilt ze nu op de bank om voor drinkbare potions en zet zijn reserve-uitrusting daar neer.
- Avonturiers kopen de spade en teleporttablets voor de Barrows eerst op de GE, in plaats van te lopen naar een winkel die ze niet kunnen bereiken (zoals in Darkmeyer).
- Ahrim the Blighted speelt zijn eigen aanvalsanimatie als hij een spreuk cast (hij stond stil terwijl zijn spreuken insloegen).
- Avonturiers gooien geen questitems (sleutels, de magneet, een research package) en clue geodes meer weg als "waardeloos".
- Avonturiers blijven niet meer uren staan na een boodschap die geen vervolg vroeg (een GE-aankoop voor de Barrows, een bankbezoek in Edgeville). Na 20 seconden zonder lopende boodschap pakken ze hun klus weer op.
- De Barrows-kist wordt door avonturiers weer goed aangeklikt (ook als hij open staat).
- Een vastgelopen avonturier schrijft dat nog maar één keer per minuut in de logs, zodat de gedeelde logs niet vollopen.
- Een avonturier die na de muursprong op de Seers' Village Rooftop een eind van het volgende obstakel landt, loopt de ronde weer verder in plaats van daar te blijven staan.
- Avonturiers die naar een boss gaan zetten hun prayer potions, spade en teleporttablets niet meer bij de GE op de bank (waarna ze nieuwe kochten).
- Avonturiers graven weer echt met hun spade (Barrows-heuvels, molshoop van de Giant Mole); de klik koos de verkeerde menuoptie.
- Een Barrows-teleporttablet wordt nu gebruikt om naar de Barrows te reizen.
- Avonturiers lopen niet meer naar de Bounty Hunter-winkel (Deadman Mode) in Edgeville of naar andere winkels die geen coins aannemen.
- De Mining Guild onder Falador telt bij het kiezen van een mijnplek weer mee (de afstand werd gemeten alsof hij 6400 tegels ver lag).
- Avonturiers met een testprofiel krijgen wapens met charges (zoals de scythe of vitur) geladen. Eerder viel de scythe na de eerste klap terug naar uncharged en droegen ze een rune scimitar met rune sq shield. Bestaande testbots worden één keer bijgeladen.
- Een avonturier die potions maakt verkoopt zijn eigen materialen (zoals kwuarm potion (unf) en limpwurt root) niet meer op de GE om ze daarna opnieuw te kopen.
- Avonturiers die hakken of minen wisselen niet meer bij elk bankbezoek hun axe of pickaxe voor hun wapen (en terug).
- Een `update` laat de Quest Helper-bridge nu draaien en start hem als hij er niet is; quests in het spel werken daardoor direct na een update.
- Avonturiers starten geen tweede Quest Helper-bridge meer als de eerste druk bezig is.
- `::advquestall` meldt niet meer dat de Quest Helper-bridge niet draait terwijl hij druk bezig is met de quests van de avonturiers. De bridge beantwoordt zijn controle nu ook als hij bezig is, en `update` bouwt en herstart hem als zijn code veranderd is.
- Een iron longsword (en andere spullen met één vreemde GE-transactie) telt niet meer als 1m gp in het bezit van een avonturier en op de GE.
- Lage avonturiers (combat onder 35) gaan niet meer naar plekken voorbij White Wolf Mountain (Catherby, Seers' Village, Gnome Stronghold); de white wolves onderweg doodden ze. Bij thieving nemen ze eten mee, want de knights en wachters slaan terug.
- Een avonturier zonder pickaxe of axe die er geen kan kopen, gaat niet meer met lege handen naar de mijn of het bos; hij doet eerst iets anders. Mithril en hogere ertsen worden niet meer "in Falador" gezocht, waar ze aan de oppervlakte niet liggen.
- Avonturiers wisselden na elke taslading van klus bij verwerkskills (firemaking, fletching, smithing: één lading duurde een minuut). Met nog voorraad op de bank halen ze nu de volgende lading en gaan ze door met dezelfde klus.
- Een avonturier met een tas vol spullen die hij bewaart (bijvoorbeeld de grondstoffen van zijn vorige klus) bleef wachten met "geen bank bereikbaar", ook naast een bank. Hij brengt ze nu naar de dichtstbijzijnde bank.
- Avonturiers kozen bij de Al Kharid-tolpoort soms "Open" zonder Prince Ali Rescue, waarna ze vastzaten in het gesprek met de wachter. Ze openen de poort nu alleen na die quest en betalen anders de tol. Bij een bankbezoek nemen ze een paar honderd coins mee als hun tas bijna leeg is.
- De gameserver startte een tweede Quest Helper-bridge naast die van start.sh ("Address already in use"). Hij start er nu pas een als de bridge anderhalve minuut onbereikbaar blijft, en kijkt daarvoor elke minuut.
- Avonturiers die materialen kopen voor een verwerkskill (bijvoorbeeld herblore) kopen nu een partij voor meerdere tasladingen. Wat noted van de GE komt, zetten ze op de bank en halen ze per taslading weer op. Eerder bleven ze staan met noted kruiden waar ze niets mee konden.
- Voor een verwerkklus zetten avonturiers eerst alles op de bank behalve hun materialen, het gereedschap en hun coins.
- Avonturiers kochten op de GE uitrusting die ze al op de bank hadden (ranged-, magic- en doel-items keken alleen naar tas en uitrusting), en kochten hetzelfde item steeds opnieuw. Ze kijken nu ook naar hun bank en kopen hetzelfde stuk niet binnen 6 uur nog een keer.
- Avonturiers gaan alleen naar Morytania (Slayer Tower, Canifis, Mort'ton) als ze Priest in Peril hebben gedaan. Eerder probeerden ze de Slayer Tower via de Wilderness te bereiken. Ook voor Slayer-taken zoeken ze geen monsters meer in Morytania zonder die quest, of in de Wilderness.
- Pickpocketen op paladins gebeurt in Ardougne. Wie pickpocket heroes nog niet kan doen (de Heroes' Guild heeft nog geen plek), pakt de beste thieving-klus die wel bereikbaar is.
- Na een omgevallen boom of uitgeputte rots kiest een bot de dichtstbijzijnde volgende (hooguit een paar tegels verder), niet willekeurig een die ver weg staat.
- Een klus die op een vaste plek hoort (bomen, rotsen, visplekken, stalls en pickpocketen) maar waarvoor de avonturier geen bereikbare plek heeft, begint hij niet meer op de plek waar hij toevallig staat (zoals redwoods "in" Lumbridge of bij de GE); hij kiest dan iets anders.
- De home teleport onderweg werd afgebroken doordat een avonturier in dezelfde tijd van uitrusting wisselde; tijdens de teleport doet hij nu niets anders.
- Avonturiers op de dakbanen van Varrock en Al Kharid bleven bij één obstakel staan (een muur in Varrock, de tropical tree in Al Kharid): hun klik ging pas af als ze het obstakel "bereikt" hadden, en dat gebeurde aan de dakrand nooit. Staan ze er tot 5 tegels vandaan, dan klikken ze nu direct.
- Een avonturier met een two-handed wapen (zoals een Scythe) koopt en draagt geen schild meer als hij even een axe in de hand heeft.
- High-level avonturiers trainen combat niet meer op monsters ver onder hun level (een combat 70 op jail guards van level 26): de laagste tegenstander is minstens zo'n 45% van hun combatlevel, en lage plekken zoals Lumbridge en Port Sarim hebben een maximumlevel.
- De Al Kharid-tolpoort werd door de bots niet herkend (de poort heeft pas een naam als je hem als speler bekijkt); ze gaan er nu echt doorheen.
- High-level avonturiers liepen voor magic trees en redwoods rondjes in Lumbridge, omdat elke plek met bomen meetelde. Yews, magic trees en redwoods hakken ze nu alleen waar die echt staan; hetzelfde geldt voor elke ertssoort (van koper tot runite) en elke soort vis (van shrimps tot anglerfish). Kunnen ze daar niet komen (redwoods in Kourend), dan kiezen ze de beste boom die wel bereikbaar is, of een andere klus.
- Een avonturier die aan de Al Kharid-kant van de tolpoort bleef staan (met genoeg coins) betaalt nu na een paar seconden stilstand de tol, of opent de poort na Prince Ali Rescue, en loopt daarna verder. Een bank achter de tolpoort telt bij het kiezen van een bank als een omweg.
- Een schild duwde een two-handed wapen (zoals de Scythe) uit de hand: de wooden shield van Tutorial Island werd in het lege schildslot gezet. Naast een two-hander blijft het schildslot nu leeg.
- Een avonturier met een two-handed wapen (zoals een Scythe) trekt er geen schild bij aan; schild en wapen duwden elkaar steeds af.
- Na een volledige reset loopt een avonturier niet meer terug naar de plek van zijn oude account.
- Een avonturier die onder de grond staat (zoals in de kelder van de Wizards' Tower) en niet bij een plek boven de grond kan komen, klimt eerst de ladder op en probeert het dan opnieuw.
- Avonturiers kregen de diagonale binnendeur van de Wizards' Tower niet open ("I can't reach that!" van een paar tegels afstand). Ze lopen nu eerst naar een tegel naast de deur en openen hem dan.
- De home teleport van een vastzittende avonturier werd meteen weer afgebroken, omdat hij tijdens de spreuk bleef klikken en lopen. Daardoor bleef hij op hetzelfde dak of in hetzelfde huis staan. Tijdens de spreuk staat hij nu stil, tot hij geland is.
- Een avonturier die al minuten op het dak van een agility-baan staat en de baan niet af kan lopen, gebruikt de home teleport naar Lumbridge.
- Een avonturier die een quest-doel op een geblokkeerde tegel heeft (zoals de ladder in de Wizards' Tower) loopt naar een tegel er direct naast, niet naar een tegel twee verder in een andere kamer.
- Avonturiers die vogels vangen leggen hun snares bij de vogels die rondvliegen, niet op een leeg stuk strand ernaast.
- Avonturiers op weg naar de Feldip Hills of de Gnome Stronghold gaven halverwege op met "de weg was versperd", omdat ze een paar minuten niet dichterbij kwamen terwijl de weg eerst om White Wolf Mountain loopt. Lange tochten krijgen nu meer tijd, naar verhouding van de afstand.
- Avonturiers op het dak van een agility-baan (zoals Falador) bleven staan, omdat ze wachtten op een looproute naar de grond die vanaf het dak nooit lukt. Ze springen nu verder.
- Avonturiers in een quest liepen eindeloos een trap op en af (bijvoorbeeld bij de Duke in Lumbridge castle), omdat ze na de trap nog een oude Quest Helper-stap volgden. Ze wachten nu op een stap die ná de trap gevraagd is, kiezen bij een trap met twee kanten de richting die de stap aangeeft, en de trap telt niet als mislukte poging. Rune Mysteries komt zo tot in de kelder van de Wizards' Tower.
- Een avonturier die zakken rolt, kiest de dichtstbijzijnde man waar hij ook echt heen kan lopen, niet een man achter een dichte deur.
- Een avonturier op een verdieping met een quest-doel, zoals de Wizards' Tower-ladder of een trap, loopt naar de vrije tegel ernaast. Eerder liep hij naar de ladder zelf en meldde hij "de weg was versperd".
- Een bovenverdieping vlak bij een agility-baan (zoals Lumbridge castle bij de Duke) telt niet meer als dak van die baan; alleen echt op de baan loopt een avonturier hem eerst af.
- Bij `::advquestall` faalden bijna alle quests tegelijk met "fetch failed", omdat dertig avonturiers de Quest Helper tegelijk om een stap vroegen. Nu vragen er maximaal vier tegelijk. De helper gaat pas uit na drie mislukte vragen op rij, en dan maar twee minuten; een lopende quest wacht tot vijf minuten op een herstartende helper.
- Een avonturier die op het dak van een agility-baan staat als hij aan een quest begint, loopt eerst de baan af tot hij beneden is en gaat dan verder met die quest. Eerder liep elke quest vanaf daar vast op "geen trap gevonden".
- Een avonturier die op een dak van een agility-baan staat zonder lopende ronde (zoals bij de tropical tree in Al Kharid) gaat verder met het obstakel waar hij staat, in plaats van vast te blijven staan.
- Avonturiers halen voor een quest geen aangeraden teleport-items meer (zoals The Chronicle), en de log zegt nu "gaat halen" in plaats van "haalt", omdat het halen nog kan mislukken.
- Een avonturier die klei gaat hakken voor Doric's Quest gaat na het legen van zijn tas ook echt naar de kleirotsen, niet naar coal.
- Avonturiers die fletchen of iets anders met materialen van de bank maken, zetten die materialen niet meteen weer terug op de bank (dat werd een lus van honderden bankbezoeken).
- Avonturiers maken hun tas vaker leeg voor woodcutting, mining of fishing, zodat ze niet met een tas vol gereedschap en spullen gaan hakken.
- Avonturiers zoeken de monsters van hun Slayer-taak alleen nog op het vasteland waar ze lopend kunnen komen, niet op ondergrondse kaarten of in Kourend waar ze niet heen konden.
- Een avonturier die ergens gestrand is (het eiland van Misthalin Mystery na een mislukte quest, binnen het hek van Draynor Manor, onder de grond) en drie keer vanaf dezelfde plek nergens heen kan, gebruikt de home teleport naar Lumbridge, zoals een speler die vastzit.
- Avonturiers rapen quest-items op zoals een speler erop klikt (de echte route, om meubels heen), ook tijdens een quest; Freds shears achter zijn tafel bleven anders liggen.
- Een queststap die zelf oplevert wat er ontbreekt (schapen scheren voor de wol bij Sheep Shearer) wordt gewoon gedaan, in plaats van als mislukt te tellen omdat de wol er nog niet is.
- Avonturiers gaan als een speler naar de Giant Mole: ze halen een spade en een brandende kaars (de Mole Hole is donker), lopen naar een molshoop in Falador Park en graven zich naar binnen. Sarachnis (Kourend, alleen per boot of teleport) kiezen ze voorlopig niet meer; daar liepen ze steeds vast.
- Avonturiers kiezen in een questgesprek een antwoord dat verder gaat ("Certainly, I'll be right back!", "Ok, I'll go do that then.") in plaats van een uitlegvraag die terugleidt naar hetzelfde menu ("Where can I find those?", "Remind me how to spin wool."); daar liepen Doric's Quest, Druidic Ritual en Sheep Shearer op vast.
- Avonturiers rekenen bij een aankoop op de Grand Exchange ook hun bankgeld mee en halen het daar op, zoals een speler; met weinig geld op zak (453 gp) konden ze anders geen clay voor Doric's Quest kopen terwijl er genoeg op de bank stond.
- Een avonturier die halverwege een dakbaan staat (Al Kharid, Varrock, Falador), vindt het volgende obstakel op zijn eigen verdieping en loopt de baan af, in plaats van daar vast te blijven staan.
- Een avonturier die onderweg is naar een queststap en merkt dat hij een quest-item mist (clay voor Doric's Quest, fish food voor Ernest the Chicken), haalt dat eerst op of koopt het, in plaats van te melden dat hij het "nu niet kan krijgen".
- Een avonturier die houthakt of mijnt, wisselt niet meer telkens tussen zijn wapen en zijn bijl of pickaxe; zijn wapen gaat pas weer aan na de klus.
- Wat een avonturier tijdens een quest krijgt of maakt (een beloning, geverfde goblin mail), staat niet meer als "onverklaard" in zijn logboek.
- Een avonturier die geen gevecht aan het doen is (een quest, een boodschap, vissen), laat zich niet meer vastzetten door iets dat hem onderweg aanvalt, zoals de bomen bij Draynor Manor: hij slaat niet terug maar loopt door. Auto-retaliate staat alleen aan bij combat, Slayer en bosses.
- Wat een avonturier uit zijn graf terughaalt, en een sieraad dat een lading verbruikt (games necklace (7) → (6)), staat niet meer als "onverklaard" in zijn logboek.
- Avonturiers kunnen queststappen doen als "gebruik X op Y" (zoals de blauwe verf op goblin mail bij Goblin Diplomacy), kiezen in een gesprek niet eindeloos dezelfde vraag die terugleidt naar hetzelfde menu (Sanfew bij Druidic Ritual), vinden een quest-NPC ook als ze hem in een andere vorm zien (Veos bij X Marks the Spot), pakken een item dat op een tafel ligt (garlic bij Fishing Contest) en komen van een schip of verdieping af via een loopplank, ladder of uitgang als er geen bekende trap is (The Corsair Curse).
- Avonturiers zien quest-objecten die van uiterlijk veranderen (zoals de doodskist van The Restless Ghost, dicht of open) zoals een speler ze ziet, en openen iets wat dicht is eerst voordat ze het doorzoeken.
- `::advquestall` weigert met een duidelijke melding als de Quest Helper-bridge niet draait, in plaats van alle avonturiers twee minuten te laten wachten tot hun quest mislukt.
- Een avonturier die materialen van de bank haalt om te fletchen of te firemaken, zet ze niet meer meteen terug omdat zijn tas "vol" is (een lus van honderden banktripjes zonder XP).
- Een avonturier verkoopt het wapen of pantser van zijn eigen smaak (zoals een battleaxe) niet meer als handelswaar om het daarna opnieuw te kopen; dat gaf een eindeloze koop-en-verkooplus bij de GE.
- Avonturiers vechten ook tegen monsters net onder hun eigen niveau (combat 37 tegen barbarians van level 10–17), zodat ze niet in Barbarian Village staan met "niets te doen" terwijl er genoeg vijanden rondlopen.
- Een avonturier die onder de helft van zijn HP zakt zonder eten (in een gevecht, bij Slayer, een boss of bij thieving met de wachten achter zich aan), stopt meteen en kiest de komende tien minuten geen gevaarlijke klus meer tot hij eten heeft, in plaats van door te gaan tot hij sterft en alles verliest.
- Een avonturier die tot vlak bij zijn bestemming komt (Barbarian Village, waar het precieze vak in een hut ligt), is er en begint, in plaats van te melden dat de weg versperd was.
- Bots kiezen in een gevecht eerst een monster dichtbij (wat variatie tussen de dichtstbijzijnde), niet meer af en toe eentje ver weg terwijl er drie naast hen staan; verder weg gaan ze pas als de dichtbije bezet of achter een hek zijn.
- Avonturiers wachten bij de Grand Exchange alleen nog op hun koopbiedingen; hun verkoopbiedingen lopen door terwijl ze verder gaan, zoals bij een speler (ze stonden minutenlang te wachten tot hun loot verkocht was).
- Een quest waarbij Quest Helper eerst het quest journal wil lezen (Pirate's Treasure) wordt meteen opzijgelegd in plaats van zes minuten te blijven proberen.
- Een avonturier houdt geen doel meer voor een stuk uitrusting dat hij al heeft (zoals "30 Attack voor adamant scimitar" terwijl hij die al draagt).
- Een avonturier die monsters achter een hek probeert te bereiken (Draynor Manor), geeft het na een halve minuut op en zoekt een andere plek, in plaats van eindeloos langs het hek te lopen.
- Avonturiers tellen genoteerde materialen (van de GE) mee: die gaan via de bank terug als gewone items, in plaats van dat ze er nog eentje bij kopen; en ze kopen geen partij van één of twee meer, maar minstens tien of niets.
- Voor houthakken, mijnen of vissen maken avonturiers eerst hun tas leeg op de bank als die vol spullen voor andere klussen zit.
- Een na een herstart hervatte klus duurt minstens tien minuten, in plaats van na twee vissen alweer iets anders te kiezen.
- Testaccounts beginnen niet meer bij elke herstart van de server opnieuw (hun testprofiel wordt bewaard).
- Een nieuwe klus wordt niet meer meteen als "vastgelopen" afgebroken omdat de avonturier vóór de klus even stilstond (bij de GE of de bank).
- Een avonturier die op een dakbaan (Al Kharid, Varrock, Falador) is blijven staan, probeert de baan af te lopen om beneden te komen in plaats van van daaruit quests te starten.
- Avonturiers die pickpocketen klikken nu op het NPC zoals een speler: ze kijken het aan en je ziet de thieving-animatie.
- Een avonturier die voor een quest iets van de grond moet pakken (het ei voor Cook's Assistant) zoekt de hele ren af en wacht tot anderhalve minuut op een nieuw exemplaar, in plaats van na een paar pogingen op te geven.
- Avonturiers gooien quest- en cluebeloningen niet meer weg als waardeloos: een antique lamp wrijven ze op (XP in hun laagste skill die de lamp toestaat), een casket maken ze open en een scroll box of clue scroll bewaren ze.
- Avonturiers die materialen op de GE wilden kopen (logs om te fletchen, bars om te smithen) liepen op een fout vast; ze kopen ze nu en gaan aan de slag.
- Avonturiers vechten niet meer door zonder eten: is het op, dan halen ze eerst nieuw eten (bank, winkel), en lukt kopen niet, dan gaan ze eerst zelf vissen en koken.
- Avonturiers trainen weer fletching, firemaking, smithing en cooking: ze tellen hun bankgeld mee, kopen een kleinere partij materialen als het geld niet voor een volle reikt, en hun eigen logs of erts verwerken telt niet langer als geld uitgeven bij een spaardoel.
- Het opzetten van een testaccount zet geen tientallen "Level N"-regels meer in zijn logboek.
- Avonturiers betalen de tol van 10 gp bij de poort van Al Kharid als ze die bij zich hebben, zoals een speler; eerst moesten ze 1.000 gp op zak hebben en stonden ze vast in Al Kharid.
- Bij een quest-stap die geen praten is (schapen scheren voor Sheep Shearer) gebruiken avonturiers de juiste optie van het NPC en nemen ze steeds een ander schaap.
- Avonturiers nemen ook eten mee voor een Slayer-taak, en pakken daarvoor eerst eten van hun bank voordat ze iets kopen.
- Avonturiers kopen eerst het beste wapen dat ze kunnen betalen en daarna hun armour als één set van hetzelfde metaal (het beste setje dat er nog bij past), in plaats van een mix van rune, adamant en mithril.
- Rune en adamant scimitars vragen geen quest meer voordat een avonturier ze koopt (alleen de dragon scimitar vraagt Monkey Madness I en de rune platebody Dragon Slayer I).
- Een avonturier met genoeg geld koopt zijn uitrusting nu in één bezoek aan de Grand Exchange, in plaats van voor elk stuk opnieuw "naar de GE" te lopen terwijl hij er al stond; en een gekocht stuk heet in zijn logboek niet langer "gevonden".
- Avonturiers kiezen in een gesprek de optie waarmee ze een quest aannemen ("I'm looking for a quest", "Perhaps I could help…"), zodat Sheep Shearer en Romeo & Juliet niet meer bij het eerste gesprek vastlopen.
- Een avonturier die trainde voor een doel (zoals combat 10 voor The Restless Ghost) stopte niet meer bij dat doel nadat hij tussendoor had gebankt, verkocht of de server herstartte; ook taken die vóór deze update waren opgeslagen stoppen nu bij hun doel, en een gehaald doel wordt na een tussentijdse trip niet opnieuw opgepakt.
- Een avonturier begint geen Quest Helper-quest als de bridge niet antwoordt, en een quest waarin de helper geen stap geeft legt hij na twee minuten weg in plaats van niets te doen. De questfeedback staat niet meer op de avonturierspagina, maar uitgebreider (tijdlijn per stap, duur, fout van de helper) in logs/adventurer-quest-feedback.jsonl.
- Avonturiers vinden questspullen die een paar vakjes verderop op de grond liggen (zoals de eieren bij de boerderij voor Cook's Assistant), en verkopen hun pot, emmer en kan niet meer: die zijn nodig voor quests en koken.
- Een avonturier die op zijn klus niets kan doen (geen XP, niet bewegen), kiest al na ruim een minuut iets anders in plaats van na twee minuten of langer.
- Avonturiers kopen in de dichtstbijzijnde winkel: een winkelier die in meerdere dorpen staat (zoals de Shop keeper van de general stores) telde maar op één plek, waardoor een bot uit Lumbridge naar Varrock liep voor een pot.
- Avonturiers kiezen een logische bank (een van de dichtstbijzijnde), niet meer een bank aan de andere kant van de kaart; een queststap die met de Quest Helper 6 minuten niet opschiet, leggen ze weg (met feedback) in plaats van er lang op te blijven staan.
- Het spel loopt in een codespace niet meer vast op geheugen. Gradle-processen (van de Quest Helper-bouw en de Java-extensies van VS Code) namen samen ruim 3 GB in. `start.sh`, `yarn start` en `update` stoppen die nu eerst. De bridge wordt zonder blijvend Gradle-proces gebouwd. VS Code importeert de Java/Gradle-projecten in de repo niet meer vanzelf.
- Het spel valt niet meer helemaal om als de client stopt: crasht de client steeds (bijvoorbeeld door te weinig geheugen in de codespace), dan blijft de gameserver draaien.
- De Quest Helper-bridge gebruikt hooguit 512 MB geheugen (was een kwart van de codespace). Daardoor raakt het geheugen minder snel op en wordt de server niet meer afgeschoten ("Killed").
- Openen of opnieuw verbinden met de codespace start geen tweede spel meer terwijl het eerste nog opstart; een tweede start stopte eerst het lopende spel.
- De Quest Helper geeft avonturiers nu ook stappen in en rond het kasteel van Lumbridge (de bot stuurt, net als de client, de objectgegevens mee), en avonturiers vinden grote objecten zoals de kasteeltrap ook als die op een ander vakje staat dan de Quest Helper noemt.
- Een avonturier die voor een quest iets moet kopen, praat niet meer steeds met de winkelier terwijl hij het elders koopt, en stopt meteen (met de reden in de questfeedback) als de Quest Helper op zijn plek geen stap kan geven.
- Avonturiers die met de Quest Helper een object of item moeten bereiken, openen eerst een dichte deur die ertussen zit (zoals in het kasteel van Lumbridge).
- Heeft een winkel iets niet op voorraad, dan koopt een avonturier het op de GE in plaats van steeds dezelfde winkel te proberen. Ligt een quest-item niet op de grond, dan haalt hij het van de bank of koopt hij het.
- Avonturiers lopen voor een Slayer-taak niet meer naar monsters die alleen in een kerker leven waar ze de weg nog niet naartoe kennen (zoals de minotaurs in de Stronghold of Security); zo'n taak laten ze even liggen.
- Avonturiers die sparen en ver van de GE zijn, liepen steeds opnieuw naar een bank zonder iets te doen; nu gaan ze alleen naar de bank met een tas om te legen en beginnen ze anders aan hun klus.
- Bots stelen nu echt van kramen: ze klikten de verkeerde menu-optie van de kraam aan en kregen daardoor nooit XP of buit. Dit geldt voor elk object waarvan de actie niet de eerste in het menu is.
- Avonturiers stellen zich bij een kraam eerst op een plek op waar de eigenaar en de wachten hen niet zien; ziet iedereen hen, dan wachten ze even en wagen ze daarna toch een poging.
- Een avonturier die kramen wil bestelen (bakery stalls) loopt naar de markt van Ardougne, niet meer naar de mannen in Lumbridge of Edgeville waar geen kramen staan.
- Een avonturier die een Slayer-plek niet kan bereiken (zoals de skeletons achter de dichte deur in Draynor Manor) kiest de volgende plek met dezelfde monsters, in plaats van steeds terug te gaan.
- De looptijd naar een klus telt nu voor alle klussen niet mee, niet alleen voor agility.
- Een avonturier krijgt alleen nog een Ranged- of Magic-doel als hij die stijl kan trainen (boog en pijlen, of runes); eerder trainde hij melee 'voor' een Ranged-doel.
- Avonturiers wachten bij de Grand Exchange tot hun bod binnen is en nemen de spullen mee; eerder liepen ze meteen weg en bleef het gekochte (zoals eten) in de GE liggen. In het logboek staat wat ze ophalen.
- Na een herstart van de server staan avonturiers weer waar ze waren, in plaats van allemaal in Lumbridge.
- In een Codespace wordt de gameserverpoort nu ook publiek als de server pas later opstart; je hoeft hem niet meer zelf op Public te zetten.
- Avonturiers eten nu ook onderweg en tijdens hun klus als hun hitpoints onder de helft zakken, en een avonturier met minder dan 40 hitpoints neemt eerst eten mee (van de bank of gekocht) voordat hij aan een klus begint.
- Avonturiers gaan nu ook met magic en ranged trainen: met de runes uit hun startpakket kopen ze bij genoeg geld een eerste voorraad runes, en ze kiezen magic of ranged vaker als die ver achterlopen op melee.
- Avonturiers die in Ardougne stelen klikken nu echt op de bakkerskraam (Baker's stall); eerder stonden ze op de markt zonder iets te doen.
- Een avonturier legt een quest niet meer na een paar seconden weg als één wandeling ernaartoe mislukte; hij probeert het opnieuw.
- Avonturiers in een quest openen nu ook deuren op weg naar een trap of ladder, zoals de deur van de Wizards' Tower naar de kelder.
- Avonturiers in een quest nemen eerst de trap naar de juiste verdieping voordat ze naar een ladder op een andere verdieping lopen (zoals van Duke Horacio naar de kelder van de Wizards' Tower).
- Avonturiers blijven niet meer eindeloos vechten met een monster dat ze niet kunnen bereiken, zoals de gevangenen achter de tralies in Edgeville; ze laten het gevecht los en gaan verder met hun klus.
- Bij een quest kiest de avonturier de deur naar de NPC met de deur-opener van de bots zelf: die opent alleen een deur die de weg echt korter maakt, in plaats van de dichtstbijzijnde deur in een kamer met meerdere deuren.
- De Construction-plugin startte nog steeds niet: er ontbrak een tweede handler (een huis adverteren voor een house party). Huizen werken weer.
- Een avonturier op weg naar de trap voor een quest kon eindeloos blijven staan: op 3 tegels gold hij als aangekomen, maar hij klikte pas op 2 tegels. Nu klikt hij de trap of ladder aan en loopt het laatste stuk zelf, zoals een speler.
- Avonturiers bleven voor een dichte deur staan als de NPC voor hun quest erachter stond (zoals Duke Horacio in het kasteel van Lumbridge). Nu openen ze eerst de deur, poort of doorgang (ook grotingangen en gaten) die tussen hen en die NPC ligt; kisten en laden laten ze daarbij dicht.
- Avonturiers gooiden de coin pouches van het zakkenrollen weg als "waardeloos". Nu openen ze ze (Open-all) en houden ze de coins.
- Een avonturier die voor een quest bij een trap of NPC aankwam, liep soms meteen weer weg (zijn vorige klus nam het over). Tijdens een quest blijft hij nu staan tot de quest de volgende stap zet.
- De wandeling naar een klus telde mee als trainingstijd, waardoor avonturiers na een lange tocht (zoals naar de Gnome Stronghold) al weer omdraaiden voordat ze iets gedaan hadden. Nu begint de tijd pas als ze er zijn.
- Avonturiers hadden onbeperkte run energy. Nu raken ze buiten adem zoals spelers, lopen dan verder en gaan weer rennen als ze tot 40% zijn bijgekomen. Gewone wereldbots blijven onvermoeibaar.
- Avonturiers kiezen geen bestemmingen meer in de woestijn achter de Shantay Pass zonder een Shantay pass bij zich. Afgesloten gebieden (achter een quest of een item) staan in `travel-hubs.json` onder `lockedAreas`.
- Een bot die vlak bij zijn doel tegen een muur liep (bijvoorbeeld buiten het kasteel van Lumbridge, met de trap binnen), bleef daar staan: de rechte weg leek gelukt. Staat hij 6 seconden stil op weg, dan plant de routeplanner de weg eromheen.
- Avonturiers vochten met lege handen: hun bronze dagger en wooden shield gingen bij de eerste bankbeurt de bank in. Nu trekken ze aan wat ze hebben voor een lege plek (uit de tas, of uit de bank als ze daar staan), en met lege handen kopen ze eerst een wapen voordat ze gereedschap kopen.
- Bots bleven soms minutenlang heen en weer lopen tussen twee punten (bijvoorbeeld bij de trap van het kasteel van Lumbridge): vlak bij het doel lieten ze hun route los, liepen tegen een muur en pakten een oude route van een andere bot die weer terugleidde. Nu volgen ze hun route tot het eind, en plannen ze vanaf hun eigen plek opnieuw als die doodloopt.
- Een quest met een NPC op een andere verdieping lukt: de bot loopt zelf naar de juiste trap en klimt.
- De Construction-plugin startte niet (een ontbrekende handler voor huisbezoek), waardoor huizen en house parties niet werkten.
- Avonturiers proberen niet meer naar Wintertodt te lopen: dat ligt in Kourend en is alleen per boot bereikbaar.
- Avonturiers kiezen geen bestemmingen meer die ze te voet niet kunnen bereiken, zoals Kourend (alleen per boot), Morytania (achter Priest in Peril), eilanden en dungeons zonder route ernaartoe.
- Bij hun eerste bankbezoek zetten nieuwe avonturiers hun starter-gereedschap niet meer weg om het meteen daarna weer op te halen.
- Een wandeling naar een andere verdieping (zoals de eerste verdieping van het kasteel van Lumbridge) gaf de bot na een minuut op voordat hij bij de trap was.
- Op lange tochten hield de bot zijn tussenstop niet vast: bij elke stap koos hij een andere, plande hij opnieuw en liep hij vast. Nu loopt hij door tot de gekozen tussenstop bereikt is.
- Zakkenrollen door bots werkt: ze zochten hun doelwit in een lijst die alleen een echte client vult, vonden nooit een man of vrouw en kregen dus geen XP of buit. Nu zoeken ze in de wereld om zich heen.
- Bots klikken na een level-up door de pop-up heen (na 1 tot 3 seconden, zoals een speler) en gaan verder met wat ze deden, in plaats van stil te blijven staan.
- Avonturiers schakelen over op melee als hun pijlen of runes op zijn, in plaats van met lege handen door te gaan.
- Avonturiers houden geen notes meer in hun tas: wat ze op de GE niet kwijt konden, gaat terug de bank in (als gewone items, zoals de bank dat doet).
- Nieuwe avonturiers bleven op het spawnpunt in Lumbridge staan met "Loopt naar Draynor om te banken": hun eerste klus was een wandeling, maar zonder lopende training werd die route nooit uitgevoerd. Na een minuut gaven ze het op en probeerden ze de volgende bank, eindeloos. Nu lopen ze echt.
- Avonturiers halen hun boog, pijlen of runes niet meer op afstand uit de bank: ze lopen naar de bank en pakken ze daar. Ze beginnen pas met boogschieten of toveren als ze minstens 50 pijlen of runes voor 50 spreuken hebben.
- Avonturiers wisselen weer tussen Attack, Strength en Defence: tussen gevechten zetten ze hun vechtstijl op de laagste van de drie. Daardoor groeien ze ook door naar sterkere monsters en blijven ze niet eindeloos op ratten en mannen in Lumbridge hangen (de plek hangt af van de laagste van de drie, en Defence bleef op 1 staan).
- De avonturierspagina toont niet meer "Begint" terwijl een avonturier al bezig is: je ziet nu waar hij heen loopt en waarom (banken, kopen, verkopen, Slayer-taak, trainen), hoe lang al, of dat hij wacht op een GE-bod. Lukt het hem niet iets te starten, dan staat erbij wat hij probeerde.
- Avonturiers nemen de spullen van hun vorige klus niet meer mee naar de volgende: liggen er 6 of meer vakjes aan logs, erts of vis in hun tas, dan banken ze die eerst, ook als het weinig waard is. Lukt de weg naar de bank niet, dan laten ze het goedkoopste vallen in plaats van met een volle tas verder te werken.
- Avonturiers blijven niet meer hangen bij de tolpoort van Al Kharid. Ze betalen alleen als 10 gp kleingeld voor ze is (1.000 gp of meer op zak); anders lopen ze om via het pad naar Varrock. Plekken en banken achter de poort tellen voor hen als verder weg, dus ze kiezen ze minder snel.
- Na een paar keer `::volg` wisselen gaat de camera bij stoppen weer naar je eigen character, niet naar de laatst gevolgde avonturier.
- Bots liepen lang met een volle inventaris rond. Gebakken vis telde als eten en werd nooit gebankt, wereldbots kwamen pas na minuten aan de beurt, en het enige alternatief was de verre GE. Nu: eten boven de 10 stuks gaat naar de bank, bots met een volle tas komen eerst aan de beurt en lopen naar de dichtstbijzijnde bank, en lukt niets anders dan laten ze de lading vallen. Al Kharid staat niet meer op de banklijst (de tolpoort).
- Zakkenrollende bots bleven aan de verkeerde kant van een muur of heg staan bij een doelwit dat ze niet konden bereiken. Zo'n doelwit slaan ze nu een minuut over en ze kiezen er een die wel bereikbaar is.
- Avonturiers kregen nog op drie manieren iets wat ze niet verdienden: een PvP-uitrusting als ze niets aan hadden (de iron scimitar na een reset), coins voor tolpoorten, en het geld van GE-verkopen uit hun vorige start. Alle drie zijn dicht, en de avonturiers beginnen daarom nog één keer opnieuw. Ze hebben nu ook een eigen tinderbox nodig om vuur te maken.
- Krijgt een avonturier toch een draagbaar item zonder koop, vondst of eigen werk, dan staat er 'Onverklaard' in zijn dagboek en in de serverlog, zodat de oorzaak gevonden kan worden.
- Avonturiers stonden soms minutenlang stil: als een keuze niet kon starten (geen gereedschap in de buurt te koop) wachtten ze een minuut. Nu kiezen ze meteen iets anders, en wie twee minuten geen XP haalt en niet beweegt, kiest ook iets anders.
- Eerlijke bots konden alsnog gratis uitrusting krijgen (zoals een iron full helm) wanneer ze van klus wisselden. Ze worden nu ook als eerlijk herkend als hun klus opnieuw start. Avonturiers kopen ook alleen nog in winkels in de buurt, niet overal op de kaart. De avonturiers beginnen daarom nog één keer opnieuw.
- Het dagboek van een avonturier toont elke wijziging in zijn uitrusting, zodat je kunt nagaan waar een stuk vandaan komt.
- Avonturiers kregen bij het reizen nog vakkleding, capes en ringen (zoals de Explorer's ring) aangetrokken die ze nooit verdiend hadden. Dat kan niet meer bij eerlijke bots; de avonturiers beginnen daarom nog één keer opnieuw.
- De iconen op de avonturierspagina laden nu echt: de game-server haalt ze één keer op bij de OSRS Wiki en bewaart ze.
- Stoppen vindt het spel nu ook in een codespace, waar niet te zien is welk proces een poort
  vasthoudt: op de opdrachtregel. Een achtergebleven client op poort 3000 wordt zo ook gestopt.
  De client neemt bij stoppen ook zijn eigen ontwikkelserver mee, zodat die niet achterblijft.
- `yarn start` stopt eerst een spel dat nog draait. Zo'n oud spel hield poort 43594 bezet,
  waardoor je verbond met de oude server en nieuwe bots en wijzigingen niet zag. Nieuw:
  `yarn stop`. `update` laat VS Code zelf voortaan altijd met rust.
- Opnieuw verbinden met de codespace start het spel niet nog een keer als het al draait. Die
  tweede kopie botste met de eerste (poort 43594 bezet).
- Stopt de client toch onverwacht, dan start hij zichzelf opnieuw en meldt hij waardoor hij
  stopte. Alleen een stopsignaal (zoals Ctrl+C) stopt hem echt.
- `yarn start` stopte direct na het compileren van de client ("exited with code 0") en nam de
  server mee. De client blijft nu draaien.
- Opstarten is rustiger: geen pagina's met stijlwaarschuwingen van de client meer en geen
  SQLite-melding van de server.
- `update` stopte een gameserver die bleef hangen tijdens het afsluiten niet, waardoor poort
  43594 bezet bleef. Hij wordt nu na 20 seconden geforceerd gestopt.
- `update` stopt als laatste redmiddel alle node-processen van het spel zelf (server, client en
  hulpprocessen), ook als de poort niet aan een proces te koppelen is. Lukt het dan nog niet, dan
  laat het zien wat er draait.
- De snelle eerste-keer-download van de cache werkt nu in elke codespace meteen na `update`,
  zonder de codespace opnieuw te starten.
- `update` stopt nu ook een spel dat op een poort blijft hangen zonder dat zichtbaar is welk
  proces het is (de melding "Er draait nog iets op poort 3000").
- Minder bots die vastlopen bij de Al Kharid-mijn en de tolpoort: die mijn wordt minder vaak gekozen.
- In een codespace laden de graphics op een nieuwe plek niet langer traag. De client haalt de
  hele game-cache bij de eerste keer laden in één keer binnen en bewaart die in je browser.
  Die eerste keer duurt wat langer, daarna komen er geen graphics meer over het netwerk.
- Combat-bots kozen hun uitrusting met een zwakke hash, waardoor bots met bijna gelijke namen
  vaak hetzelfde droegen. Elke bot houdt zijn eigen vaste uitrusting, maar de spreiding is nu echt
  willekeurig, en beginners dragen nog maar de helft van de tijd een cape.
- `update` stopt het spel nu ook als een proces blijft hangen: het zoekt wat de poorten bezet
  houdt, wacht tot 20 seconden en stopt het daarna geforceerd.
- Account Management toont "Membership: Unlimited" in plaats van "None". De client behandelt
  iedereen nu ook als member in de skills-tab en de questlijst (op een members-wereld).

### Gewijzigd
- Skills hangen samen: na houthakken fletcht een bot zijn logs, brandt ze of zet ze op de bank, afwisselend; na minen smelt en smeedt hij of bankt hij het erts. Eerlijke bots gooien niets weg wat ze nog kunnen gebruiken. Avonturiers met logs, erts of staven op de bank kiezen vaker de skill die daarbij hoort, ook zonder geld om te kopen.
- Avonturiers en wereldbots lopen nu naar hun klus, de bank, de GE, een winkel of een house party, in plaats van te teleporteren. Wie het spel kent kan ook teleporteren: met het juiste Magic-level en de runes in zijn tas casten ze Varrock, Lumbridge, Falador of Camelot Teleport als dat een lange wandeling scheelt.
- Avonturiers zetten de spullen van hun vorige klus op de dichtstbijzijnde bank. Naar de GE gaan ze als die ongeveer even dichtbij is, als ze veel bij zich hebben of als er verkopen klaarliggen; dan nemen ze ook gebankte spullen mee (als notes).
- Uitrusting die geen winkel in de buurt verkoopt, kopen avonturiers op de GE.
- Eerlijke bots trekken voor een gevecht hun beste eigen wapen en armour aan.
- Een drop die een lege plek vult (een wizard hat van een imp op een kaal hoofd) rapen eerlijke bots op en trekken ze meteen aan, ook als hij weinig waard is.
- Avonturiers kiezen hun training niet meer allemaal hetzelfde: combat gaat voor op een nieuw account (loot is inkomen), elk heeft eigen favorieten, achterblijvende skills halen in en ze doen liever iets anders dan de rest.
- Eerlijke bots begraven tussen gevechten de botten die ze oppakten.
- Wereldbots hebben niet meer allemaal Agility 99; ook dat level is nu deel van hun eigen account.
- Bots en avonturiers verkopen de spullen van hun vorige klus voordat ze aan een nieuwe beginnen, zodat hun inventaris niet volloopt met erts, logs en vis van drie klussen.
- Avonturiers doen niets meer dat nog niet echt gespeeld kan worden: geen gesimuleerde quests meer. Ze beginnen daarom opnieuw (generatie 3).
- Avonturiers krijgen geen outfits of capes meer toegewezen; ze dragen alleen wat ze zelf kochten of vonden.
- De avonturierspagina telt alle quests van de server (ongeveer 200) in plaats van alleen de 45 op hun pad.
- De server start in ontwikkelmodus ongeveer twee keer zo snel en gebruikt zo'n 450 MB minder geheugen.
  Typefouten zoek je voortaan met `yarn --cwd server typecheck`.
- De ontwikkel-client leest geen bronkaarten van bibliotheken meer: sneller opstarten, minder geheugen.
- De avonturierspagina vraagt de server minder vaak om een nieuw overzicht.
- De README is herschreven voor Realm of Eeshwar: spelen, bijwerken, terminal- en staff-commands,
  backups en een link naar deze changelog.
- Nieuwe spelers starten in Lumbridge in plaats van Edgeville. `::home` gaat ook naar Lumbridge.

- **Bots terug, als levendige wereld:** 131 bots die hakken, minen, vissen en tegen monsters vechten,
  elk met een eigen naam, level en uitrusting. Ze starten in Lumbridge, Draynor, Varrock, Falador,
  Catherby en Seers' Village en wisselen om de 15 tot 25 minuten van activiteit. Bij zo'n wissel
  reizen ze vaak (6 op de 10 keer) naar een van 32 plekken in de wereld waar die activiteit kan,
  passend bij hun level: van Lumbridge tot de Slayer Tower, de Woodcutting Guild en Piscarilius.
  De PvP-bots bij Edgeville blijven uit.
- **High-level bots:** twee nieuwe groepen, masters (level 80+) en legends (90+). Zij hakken magic
  trees en redwoods, minen adamantite en runite, vangen sharks en anglerfish, en vechten in Barrows-,
  Bandos- en Armadyl-gear met wapens als de whip, godswords en de Ghrazi rapier.
- **Meer variatie in hoe bots eruitzien:** niet meer elk slot gevuld (de meeste beginners dragen geen
  cape), keuze uit 50 team capes, cloaks, hoeden en kostuums, skilling-outfits (Lumberjack,
  Prospector, Angler, Graceful) vanaf gevorderd niveau, en een skillcape bij 99. Na het reizen
  kleedt een skiller zich om voor zijn nieuwe klus.
- Meer bots in de wereld: de groepen zijn verdubbeld en met `PlayerBots:population` teruggeschaald
  zodat de server het bijhoudt.
- Nieuwe instelling `PlayerBots:population` in `world.json`: vermenigvuldigt het aantal bots
  (0.5 is de helft). Handig als de server het niet bijhoudt.
- **Thieving-bots:** bots stelen van stalls passend bij hun level, van de bakery- en tea stall
  tot silk, fruit, fur, silver, spice en gem stalls, vooral op de markt van Ardougne.
- **Bank standing:** bij drukke banken (Grand Exchange, Varrock West, Edgeville, Falador,
  Seers, Catherby, Draynor, Al Kharid) staan bots te fletchen, potions te mixen of te craften.
- **Bots bij minigames:** groepjes bots verzamelen zich bij Wintertodt (in Pyromancer-outfit),
  Guardians of the Rift (Raiments of the Eye), Fishing Trawler, Giants' Foundry, Blast Furnace,
  Tithe Farm, Mage Training Arena, en in combat-gear bij Castle Wars, Soul Wars, Pest Control,
  Barbarian Assault, Nightmare Zone en Shades of Mort'ton. Waar al bots zijn, komen er meer bij.
  Ze blijven in de lobby, bij Wintertodt in de veilige gang. Echt meespelen volgt per minigame.
- Bots lopen minder rondjes: rondhangen bij een bank, de GE of een lobby is nu een korte pauze
  (2 tot 15 minuten) en gebeurt minder vaak. Daarna gaan ze weer aan het werk.
- **Vijf avonturiers:** Eeshwar, Call me Mark, Bekoek, Slayed Soul en Kram539 beginnen als nieuw account in
  Lumbridge en spelen zelf verder. Ze trainen naar de quests op hun pad (45 quests, van Cook's
  Assistant tot Dragon Slayer I), voltooien die en houden een logboek bij. Hun voortgang wordt
  opgeslagen. Quests zonder uitgewerkte playthrough worden gesimuleerd (ze gaan naar het begin
  van de quest, blijven daar een tijdje, en krijgen de normale beloning); dat staat er altijd bij.
  Af en toe doen ze iets samen: Wintertodt, of trainen op dezelfde plek.
- **Avonturiers spelen eerlijk:** ze krijgen niets meer cadeau. Alle vijf zijn opnieuw begonnen
  met alleen de spullen van Tutorial Island. Wapens, armour en tools kopen ze bij een echte
  winkel in de wereld (met de echte voorraad en prijs, van hun eigen geld), food moeten ze zelf
  hebben, en ze dragen alleen wat hun level en quests toestaan (rune platebody pas na Dragon
  Slayer I). Hun geld verdienen ze door wat ze verzamelen te verkopen. Aankopen staan in het
  logboek. Zelf maken (smithing, fletching, koken) en loot oppakken volgen nog.
- Avonturiers gaan alleen naar plekken waar hun quests en levels het toelaten: Prifddinas na
  Song of the Elves, Varlamore na Children of the Sun, Morytania na Priest in Peril, de guilds
  vanaf hun level. Voor ze gaan vechten kopen ze food als ze niets bij zich hebben en het geld
  hebben.
- **Bots verspreiden zich:** een plek waar al bots zijn, wordt minder vaak gekozen, en de meeste
  bots gaan bij het opstarten meteen naar een plek waar hun klus kan, in plaats van allemaal
  naar de dichtstbijzijnde mijn of boom. De trek naar de eigen hub is zwakker.
- **Door naar de volgende tier:** haalt een bot een level waarmee iets beters kan (60 Woodcutting:
  yews in plaats van willows, 15 Mining: iron in plaats van copper), dan stapt hij meteen over
  en reist hij zo nodig naar een plek waar dat kan. Dit geldt ook voor de avonturiers.
- **Avonturiers gaan bossen:** vanaf combat 65 de Giant Mole, vanaf 75 Sarachnis, alleen of
  samen. Kills komen in het bosslog.
- **Ranglijst, bank en bezit:** de pagina toont een ranglijst (score: totaal level + 2 per
  questpunt + 1 per miljoen gp aan bezit), per avonturier de waarde van bank en wat hij bij zich
  heeft, en de waardevolste stacks in zijn bank. Avonturiers staan in het spel onder hun eigen
  naam (eerst kregen ze een gegenereerde botnaam).
- Bij het starten van het spel opent de avonturierspagina vanzelf in een tabblad naast het spel.
- **Live meekijken:** de pagina `/adventurers.html` op je spel-adres (poort 3000) toont per
  avonturier levels, combat, totaal, questpunten, wat hij doet en waar hij is, met logboeken
  voor skills, quests, bosses, drops (vanaf 10k) en activiteit. Ververst elke 5 seconden.
  In het spel: `::adventurers` voor een overzicht en `::adventurer <naam>` om erheen te gaan.
- **Ironmen tussen de bots:** ongeveer 1 op de 10 bots is Ironman, 3 op de 100 Ultimate en 5 op de
  100 Hardcore, met het icoontje bij hun naam. Hardcores kunnen sterven: af en toe overleeft
  een vechtende Hardcore-bot een klap niet en wordt hij een gewone Ironman. Elke Hardcore-dood
  (van een bot of een speler) wordt aan iedereen gemeld: "... has died as a Hardcore Ironman
  with a total level of ...". De avonturiers zijn gewone accounts.
- **Pickpocketen:** thieving-bots pickpocketen ook: men en women in Lumbridge, guards,
  knights of Ardougne, paladins en heroes in Ardougne. Ze wachten een stun uit, openen hun coin
  pouches en eten als ze geraakt zijn.
- **Thieving in Ardougne:** de thieving-bots staan nu op de markt van Ardougne in plaats van in
  Varrock, waar geen stalls zijn om van te stelen.
- **Bank standing bij de booths:** bots bankstanden naast de bank booths, ook in Varrock West
  en Edgeville, waar nu een vaste groep bank standers staat.
- Ongeveer 160 bots in de wereld (`PlayerBots:population` 0.48), plus de vijf avonturiers.
- **Grand Exchange als handelsplek:** de bots bij de GE lopen geen rondjes meer. Het is nu een
  mix van alle levels die staan te handelen (wachten op hun offers en af en toe een plek
  verder schuiven) en aan het bankstanden zijn. Bots die naar de GE reizen, doen meestal
  hetzelfde.
- **Bots praten:** in de buurt van een speler zegt een bot af en toe iets dat past bij waar hij
  is en wat hij doet: handelspraat bij de GE, "Light the brazier!" bij Wintertodt, "Rock stolen
  lol" in een mijn. Na een eigen level-up meldt een bot dat soms, zeg je "hi" dan groet een bot
  terug, en level jij in de buurt van bots, dan zegt er een "Gz". Alleen bots die je kunt zien
  praten, met rustpauzes zodat het niet spamt. De zinnen staan in `chatter.json`.
- **Bots spelen Wintertodt echt mee:** ze kiezen een hoek, hakken bruma roots, voeren die aan
  hun brazier voor punten, repareren een kapotte brazier en steken een gedoofde aan. Ze nemen
  een tinderbox, hammer en rejuvenation potions mee, drinken als ze het koud krijgen en zoeken
  de veilige gang op als hun hitpoints laag zijn. Tussen de rondes wachten ze bij hun brazier.
- **Soul Wars met bots:** wacht je in de Soul Wars-lobby, dan vullen bots de teams aan en spelen
  ze de game echt mee (zoals al bij Castle Wars, Pest Control en Last Man Standing).
- **Nieuwe gebieden voor bots:** Kourend (kasteel, Hosidius met de sand crabs, Land's End,
  Port Roberts), Varlamore (Civitas illa Fortis, de haven, Aldarin, Sunset Coast), de woestijn
  (Shantay Pass, Bedabin Camp, Pollnivneach, Nardah, Sophanem), Morytania (Mort'ton), Feldip
  Hills, Tree Gnome Village, Corsair Cove en de Void Knights' Outpost. Hubs in het kasteel van
  Kourend en Civitas, en bots bij de havens van Port Sarim, Piscarilius, Civitas en Catherby.
- **Loot beam op waarde:** in de instellingen van de plugin **Ground Items** stel je met een
  schuifbalk in vanaf welke waarde een drop een loot beam krijgt (1k tot 100m, standaard 100k).
  Aan of uit met "Lootbeam by value". De kleur volgt de waardegrenzen van Ground Items.
- **Maxed bots:** 13 extra bots bij de Grand Exchange, waarvan 10 maxed (alles 99, combat 126)
  in max gear: Torva, Masori en Ancestral, met de Scythe of Vitur, Twisted bow en Kodai wand.
  Opgeladen wapens zijn echt opgeladen. Meestal dragen ze een max cape.
- **Bots hebben een thuisbasis:** elke bot heeft per activiteit een vaste hub die erbij past.
  Vissers bij Catherby, Seers of Draynor, miners bij Falador, Varrock West of Al Kharid,
  woodcutters bij Seers, Draynor of Edgeville, vechters bij Edgeville of Varrock. Iedereen kan
  de Grand Exchange als hub hebben, beginners Lumbridge, en vanaf combat 90 ook Prifddinas.
  Tussen activiteiten lopen bots daar een tijdje rond en ze werken het liefst in de buurt.
- **Drukke plekken:** bots hangen ook rond bij de Grand Exchange (verreweg het drukst), de banken
  en pleinen van Varrock, Falador, Edgeville en Ardougne. High-level bots staan in hun
  combat-gear bij Chambers of Xeric, Theatre of Blood, Tombs of Amascut, de Colosseum,
  God Wars, Barrows, TzHaar, de Giant Mole en de Kalphite Lair.
- Bots trainen nu ook in de Taverley, Brimhaven en Fremennik Slayer Dungeons en de Catacombs of
  Kourend, en vechten op master- en legend-niveau tegen sterkere monsters met betere food.


## [0.1.0] - 15-11-2026

Startpunt: 1-op-1 kopie van TSPS `main` (commit `8be9d78`), daarna losgekoppeld.

### Gewijzigd
- Client en server hebben geen ingebouwde WebRTC-relay of STUN-server meer
  (`worlds.rsps.app`, `stun.rsps.app`). Een relay werkt alleen nog als je die zelf instelt met
  `REACT_APP_WEBRTC_SIGNAL_URL` (client) of `WEBRTC_SIGNAL_URL` (server).
- Plugin-downloads in het adminpanel staan uit. Plugins installeer je door een zip te uploaden,
  of je stelt `PLUGIN_RELEASES_URL` in op je eigen GitHub-releases.
- De bugreport-knop in de client opent een issue in deze repo.
- Het adminpanel haalt de plugin-catalogus en minimap niet meer op bij het originele project.
  De minimap in de spawn-picker is daardoor voorlopig leeg.

### Verwijderd
- GitHub Actions-workflows, deploy-scripts en `CODEOWNERS` van het originele project (`.github/`).
- Agent-scripts die naar `RSPSApp/tsps` pushten of daar issues ophaalden (`scripts/agents/ship`,
  `watch-prs`, `watch-issues`, `prune-worktrees`) en de bijbehorende bugfix-skill.
