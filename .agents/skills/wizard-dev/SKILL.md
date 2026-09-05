---
name: wizard-dev
description: Entwicklungs- und Testleitfaden für Wizard Online. Enthält Schnellbefehle für Testläufe, Architektur-Übersicht und Regelwerk-Referenzen.
---

# Wizard Online – Developer Guide & Runbook

## Wichtige Schnellbefehle

### Tests ausführen
```bash
# Alle Spiellogik- und Regel-Tests ausführen
node test/gameLogic.test.js

# Multiplayer-Integrations-Test (3 Spieler, Bieten, Stiche, Leave-Fallback)
node test/integration.test.js

# Pause & Reconnect-Test (Disconnect, Reconnect, Runden-Neustart)
node test/pauseAndReconnect.test.js

# Eindeutige 6-stellige Zahlencodes & Raum-Isolierung
node test/uniqueRooms.test.js
```

### Lokalen Entwicklungsserver starten
```bash
node server/index.js
# Öffne http://localhost:3000 im Browser
```

---

## Architektur-Übersicht

1. **`server/gameLogic.js`**: Reine, zustandslose Spiellogik.
   - `createDeck()`: Erstellt 60 Karten (4x13 Farben + 4 Zauberer + 4 Narren).
   - `evaluateTrick(trick, trumpSuit)`: Ermittelt den Gewinner eines Stichs nach offiziellen Wizard-Regeln.
   - `isValidMove(card, hand, leadCard)`: Prüft Bedienpflicht (Farbzwang).
   - `calculatePoints(bid, tricksWon)`: Berechnet Punkte (+20/+10 vs. -10).
   - `sortCards(hand, trumpSuit)`: Sortiert Handkarten nach Narren -> Gelb -> Rot -> Grün -> Blau -> Trumpf -> Zauberer.
   - `isForbiddenBid(bid, playerBids, round)`: Prüft die Geber-Regel (Plus/Minus Eins).

2. **`server/index.js`**: Express-Server & Socket.IO State-Machine.
   - Raum-Verwaltung mit kollisionsfreien 6-stelligen Zahlencodes.
   - Ereignisse: `createRoom`, `joinRoom`, `startGame`, `submitBid`, `playCard`, `leaveRoom`, `hostReDealRound`.
   - Disconnect- und Reconnect-Management (`gamePaused`, `gameResumed`).

3. **`public/index.html` & `public/client.js`**: Frontend mit 3 Screens.
   - **Screen 1 (Lobby)**: Neues Spiel erstellen oder mit Zahlencode beitreten.
   - **Screen 2 (Warteraum)**: Anzeige des Zahlencodes mit 1-Klick-Kopieren (`Kopieren 📋`), Spielerliste mit Host-Krone, Start-Button.
   - **Screen 3 (Tisch)**: Der Filztisch, subtile Tisch-Aura, zentriertes Bietfeld, "Block der Wahrheit" Drawer, responsive Kartenfächer mit Hover-Lift und Mobile Touch.
