---
name: game-logic-auditor
description: Prüft und auditiert die Spiellogik, Sondereditionen (30 Jahre, Jubiläum) und Stichauswertungen von Grimoire/Wizard Online.
---

# Game Logic Auditor Skill

Nutze diesen Skill, wenn du Regeln, Stiche, Wertungen, Sonderkarten oder Bot-Entscheidungen testest oder anpasst.

## Kern-Dateien
- Spiellogik-Engine: `server/gameLogic.js`
- Bot-Heuristiken & Wahrscheinlichkeiten: `server/botLogic.js`
- Unit-Tests: `test/gameLogic.test.js`, `test/anniversary30Logic.test.js`, `test/unicorn.test.js`, etc.

## Arbeitsweise
1. **Regeltreue vor Schnelligkeit:**
   - Bedienpflicht (Farbzwang): Muss immer eingehalten werden, es sei denn, Zauberer/Narr oder Spezialkarten heben sie explizit auf.
   - Vorrangregeln:
     - Fee schlägt Drache.
     - Drache schlägt Zauberer.
     - Zauberer schlägt Standardfarben & Trümpfe.
     - Bombe neutralisiert den Stich.
   - Geber-Regel (Plus/Minus Eins): Die Summe der Gebote darf in klassischen Modi nicht der Rundenzahl entsprechen.
2. **Reine Tests ausführen:**
   - Führe Spiellogik-Tests isoliert ohne Server-Port aus:
     ```bash
     node test/gameLogic.test.js
     node test/anniversary30Logic.test.js
     node test/skullKingZeroScoring.test.js
     node test/botDifficulties.test.js
     ```
3. **Keine Mutation von Handkarten:**
   - Funktionen in `server/gameLogic.js` müssen zustandslos bleiben (Pure Functions).
