AI_CONSTITUTION.md
Autonomous OSRS Adventurer Platform Constitution

Version: 1.0

Status: Source of Truth

1. Vision

Het doel van dit project is niet om een bot te bouwen.

Het doel is niet om quest-scripts te bouwen.

Het doel is niet om activiteiten hardcoded te automatiseren.

Het doel is het bouwen van een autonoom Adventurer Platform voor Old School RuneScape.

Adventurers moeten zelfstandig kunnen ontwikkelen van:

Plain Text
Combat Level 3
All Skills Level 1

naar:

Plain Text
Quest Cape
Achievement Diary Cape
Max Cape
Collection Log Progress
Endgame PvM
Long-Term Wealth

zonder account-specifieke scripting.

2. Core Philosophy

Kies altijd:

Plain Text
Reliability
+
Progression
+
Efficiency
+
Observability
+
Maintainability

boven:

Plain Text
Feature Count
+
Complexity

Volg altijd:

Plain Text
Simple > Clever
 
Data Driven > Hardcoded
 
Configuration > Custom Code
 
Reusable > Duplicated
 
Incremental > Rewrite
 
Runtime Data > Assumptions
 
Working > Perfect
3. Non-Goals

Het platform mag niet evolueren naar:

een RuneScape simulator
een combat simulator
een economy simulator
een verzameling losse scripts
een verzameling boss-specifieke implementaties
een black-box AI zonder uitlegbaarheid
4. Success Criteria

Succes wordt gemeten op:

Reliability

Kan een Adventurer duizenden uren draaien?

Progression

Kan een Adventurer zelfstandig unlocks behalen?

Autonomy

Kan een Adventurer zelfstandig nieuwe doelen bepalen?

Navigation

Kan een Adventurer de wereld betrouwbaar navigeren?

Recovery

Kan een Adventurer herstellen van fouten?

Observability

Kan een operator altijd begrijpen:

Plain Text
Wat doet de Adventurer?
 
Waarom doet hij dit?
 
Wat probeert hij te bereiken?
Extensibility

Kan nieuwe content toegevoegd worden zonder grote architectuurwijzigingen?

5. Runtime First Principle

Echte data heeft voorrang op aannames.

Gebruik:

Plain Text
Logs
 
Telemetry
 
Runtime Metrics
 
Observed Behaviour

boven:

Plain Text
Hypothetical Scenarios
 
Simulations
 
Assumptions

Verbeter systemen op basis van:

echte failures
echte stuck-events
echte deaths
echte inefficiënties

Niet op basis van theorie.

6. Architectural Layers

Het platform bestaat uit drie hoofdlagen.

Plain Text
Knowledge Layer
 
↓
 
Decision Layer
 
↓
 
Execution Layer
Knowledge Layer

Verzamelt feiten.

Bijvoorbeeld:

skills
quests
items
bank
unlocks
travel options
wealth
Decision Layer

Neemt keuzes.

Bijvoorbeeld:

goal selection
progression planning
route selection
activity selection
Execution Layer

Voert acties uit.

Bijvoorbeeld:

movement
combat
questing
banking
trading

Nooit lagen mengen.

7. Requirement Validation First

Geen enkele actie mag plaatsvinden zonder validatie.

Iedere actie vereist:

Plain Text
CanExecute()
 

Controleer minimaal:

skills
quests
quest points
achievements
equipment
transportation
spellbooks
items
GP
area access
Voorbeelden

Verboden:

Plain Text
Dragon Scimitar zonder Monkey Madness I
 
Abyssal Whip zonder 70 Attack
 
Rune Platebody zonder Dragon Slayer
 
Fairy Ring zonder unlock
 
Runite Mining zonder level requirement
8. Knowledge Graph

Eén centrale waarheid.

De Knowledge Graph bevat:

skills
quests
diaries
inventory
bank
wealth
equipment
unlocks
transportation
active goals
state

Andere systemen halen hier informatie uit.

9. Dependency Resolution Engine

Doelen worden automatisch opgesplitst.

Voorbeeld:

Plain Text
Dragon Scimitar
 
↓
 
Monkey Madness
 
↓
 
Quest Requirements
 
↓
 
Skill Requirements
 
↓
 
Travel Requirements
 
↓
 
GP Requirements
 
↓
 
Gear Requirements

Geen handmatige ketens.

Geen account-specifieke scripts.

10. Progression Engine

De belangrijkste intelligentielaag.

Centrale vraag:

Plain Text
Welke unlock heeft de hoogste toekomstige waarde?

Niet:

Plain Text
Welke activiteit geeft de hoogste XP?
11. Unlock Scoring

Unlocks krijgen een relatieve waarde.

Voorbeelden:

Plain Text
Quest Cape 1200
 
Achievement Cape 1200
 
Recipe For Disaster 1100
 
Fairy Rings 1000
 
Barrows Gloves 975
 
Graceful 950
 
Dragon Scimitar 900

Gebruik unlock-value als primaire planningsinput.

12. Skilling Philosophy

Skilling vormt de basis van accountontwikkeling.

Iedere skill moet ondersteunen:

XP-groei
Geld verdienen
Unlocks
Quest requirements
Diary requirements
Progressiewaarde

De planner moet begrijpen waarom een skill relevant is.

13. Activity Registry

Activiteiten moeten zoveel mogelijk data-driven zijn.

Iedere activiteit bevat minimaal:

YAML
requirements:
recommendedLevels:
recommendedGear:
xp:
gp:
risk:
travel:
duration:
unlocks:

Nieuwe activiteiten moeten vooral via configuratie toegevoegd worden.

14. Economic Planning

Een Adventurer moet begrijpen:

Plain Text
Kan ik mijn volgende doel betalen?

Zo niet:

Plain Text
Maak Money-Making Goal

automatisch aan.

15. World Navigation

Navigatie is een kernsysteem.

Hiërarchie
Plain Text
World
 
↓
 
Region
 
↓
 
Area
 
↓
 
Local
 
↓
 
Tile
Coordinates

Gebruik:

Plain Text
X
Y
Z

Z = plane.

Plane-awareness is verplicht.

Ondersteunen
gebouwen
torens
caves
kelders
dungeons
catacombs
Action-Based Pathfinding

Ondersteun:

doors
gates
ladders
ropes
boats
trapdoors
shortcuts
cave entrances

Niet enkel tile movement.

16. Transportation Framework

Ondersteun:

teleport spellbooks
fairy rings
spirit trees
charter ships
canoes
gnome gliders
jewelry teleports
POH teleports
minigame teleports
achievement teleports

Transport is onderdeel van routeplanning.

17. Instance Awareness

Ondersteun:

quest instances
boss instances
raid instances

Een Adventurer moet begrijpen dat een instance een andere navigatiecontext vormt.

18. Recovery Systems

Bij falen:

Plain Text
Analyse
 
↓
 
Recovery
 
↓
 
Retry

Nooit eindeloos herhalen.

Ondersteun:

repathing
teleport recovery
bank reset
home teleport
strategy adjustment
19. Banking Framework

Banking is een fundamenteel systeem.

Ondersteun:

deposit
withdraw
note handling
placeholders
tabs

Automatische classificatie van:

gear
resources
supplies
quest items
junk
20. Gear Progression

Niet:

Plain Text
Best Item

Maar:

Plain Text
Best Obtainable Item

Rekening houdend met:

levels
quests
unlocks
GP
21. Quest Framework

Quests zijn progression content.

Optimaliseer op:

unlock value
progression value
transportation unlocks
reward value

Maak gebruik van bestaande QuestHelper-functionaliteit waar beschikbaar.

22. Combat Philosophy

Combat ondersteunt progressie.

Ondersteun:

training
slayer
PvM
bossing

Automatisch beheer van:

food
potions
prayers
targets
gear
23. Bossing Philosophy

Bossing komt pas nadat accountfundamenten bestaan.

Volg:

Plain Text
Requirements
 
↓
 
Progression
 
↓
 
Survivability
 
↓
 
Bossing

Bossing-systemen moeten zoveel mogelijk configuratiegedreven zijn.

24. Memory & Learning

Adventurers onthouden historische prestaties.

Bewaar:

XP/hour
GP/hour
deaths
success rate
travel times

Gebruik deze kennis voor toekomstige beslissingen.

25. Clan Intelligence

Adventurers mogen leren van andere Adventurers.

Voorbeelden:

Plain Text
Success Rates
 
Profitability
 
Travel Durations
 
Failure Rates

Gebruik geaggregeerde data.

26. Personality System

Het doel is niet om 30 identieke accounts te bouwen.

Iedere Adventurer krijgt een persoonlijk profiel.

Voorbeelden:

YAML
combatAffinity:
questAffinity:
skillingAffinity:
wealthAffinity:
explorationAffinity:
riskTolerance:
efficiencyAffinity:
27. Diversity Framework

Voorkom:

Plain Text
30 Adventurers
 
↓
 
30x dezelfde activiteit
 

Gebruik:

weighted randomness
activity fatigue
crowding penalties

zonder efficiëntie op te offeren.

28. Human Override

Ondersteun:

Plain Text
Force Goal
 
Ban Goal
 
Force Quest
 
Ban Quest
 
Force Skill
 
Ban Activity
 
Preferred Region
 
Preferred Boss

zonder codewijzigingen.

29. Observability Is A First-Class Feature

Nieuwe functionaliteit moet zichtbaar gemaakt kunnen worden.

Observability is geen bijzaak.

Observability is een kernonderdeel van het platform.

30. ::volg Framework

De bestaande ::volg functionaliteit is strategisch belangrijk.

Deze moet behouden blijven.

Deze moet uitbreid worden.

Deze mag nooit verslechteren.

Toon minimaal
Plain Text
Current Goal
 
Current Subgoal
 
Current Activity
 
Current State
 
Current Location
 
Current Route
 
Current Inventory
 
Current Equipment
 
Current Wealth
 
Current Skill
 
XP Rate
31. Explainability

Een operator moet kunnen zien:

Plain Text
Wat doet de Adventurer?
 

en

Plain Text
Waarom?
 

Voorbeeld:

Plain Text
Goal:
Dragon Scimitar
 
Current Activity:
Attack Training
 
Reason:
60 Attack Required
32. Replay & Diagnostics

Logs moeten reconstructie mogelijk maken.

Bijvoorbeeld:

Plain Text
Wat gebeurde er?
 
Waarom gebeurde het?
 
Welke keuzes werden gemaakt?
 
Waarom liep de Adventurer vast?
33. Operator Modes

Ondersteun:

Plain Text
Read Only
 
Advisory
 
Override

voor beheer en debugging.

34. Development Process

Altijd:

Plain Text
Observe
 
↓
 
Analyze
 
↓
 
Identify Root Cause
 
↓
 
Implement Small Change
 
↓
 
Validate
 
↓
 
Deploy

Niet:

Plain Text
Assume
 
↓
 
Overbuild
 
↓
 
Rewrite
35. Ultimate Goal

Bouw geen verzameling scripts.

Bouw geen verzameling bots.

Bouw een autonoom Adventurer Platform dat:

leert van runtime-data
leert van clan-data
uitlegbaar is
observeerbaar is
efficiënt is
uitbreidbaar is
duizenden uren autonoom kan functioneren
continu accountprogressie kan realiseren zonder handmatige scripting.
