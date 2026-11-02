# Grimoire / Wizard Online – Umfassender Prüfbericht & Verbesserungsplan

**Dokument-Version**: 1.0.0  
**Datum**: 2. November 2026  
**Status**: Verifiziert & Abnahmebereit  
**Verfasser**: Antigravity Orchestrator & Teamwork Experts (Game Logic Auditor, Multiplayer QA, UI/UX Designer, Security Auditor, Bot Developer)  
**Bezugsdateien**: `server/index.js`, `server/gameLogic.js`, `server/botLogic.js`, `public/client.js`, `public/index.html`, `ROADMAP.md`, `AGENTS.md`, `test/*.test.js`  

---

## Inhaltsverzeichnis
1. [Management Summary](#1-management-summary)
2. [Teil I: Systematische Codebase- & Schwachstellenanalyse](#2-teil-i-systematische-codebase---schwachstellenanalyse)
   - 2.1 Spiellogik & Sondereditionen (30 Jahre Jubiläum)
   - 2.2 Multiplayer-Synchronisation, Concurrency & Netzwerkstabilität
   - 2.3 Bot-Entwicklung & KI-Heuristiken
   - 2.4 Sicherheit, Cheat-Schutz & Zero-Trust-Validierung
   - 2.5 Testabdeckung & Resilienz unter Last
3. [Teil II: UI/UX- & Interaktions-Verbesserungsplan](#3-teil-ii-uiux--interaktions-verbesserungsplan)
   - 3.1 Desktop-Kartenfächer (Fächer-Mathematik & Overflow-Beseitigung)
   - 3.2 3D-Karten-Animationen & Tisch-Dynamik
   - 3.3 Audio- & Visuelles Feedback (WebAudio-Synthese)
   - 3.4 Mobile Responsiveness & Touch-Ergonomie
   - 3.5 Spielraum-Atmosphäre, Assets & Performance
4. [Teil III: Strukturierter Maßnahmen- & Handlungsplan](#4-teil-iii-strukturierter-maßnahmen--handlungsplan)
   - 4.1 Prioritäten-Matrix (P0 bis P3)
   - 4.2 Detaillierte Implementierungs-Schritte mit Code-Patches
   - 4.3 Harmonisierung mit ROADMAP.md & AGENTS.md
5. [Verifikations- & Audit-Protokoll](#5-verifikations--audit-protokoll)

---

## 1. Management Summary

Grimoire / Wizard Online verfügt über ein **hervorragend konzipiertes technisches Fundament**:
- Die Spiellogik (`server/gameLogic.js`) ist als zustandslose funktionale Engine implementiert und deckt das klassische Regelwerk sowie alle 10 Sonderkarten der 30-Jahre-Jubiläumsedition (Drache, Fee, Bombe, Gestaltenwandler, Wolke, Vampir, Werwolf, Hexe, Jongleur, Einhorn) sowie alternative Spielmodi (Skull King 0-Stich-Wertung, 2vs2 Allianzen, Simultan- und Geheim-Bieten) vollständig ab.
- Die bestehende automatisierte Testsuite läuft mit **11/11 Unit-Test-Suiten zu 100 % fehlerfrei** durch.
- Die grafische Oberfläche besticht durch eine atmosphärische Dark-Fantasy-Inszenierung mit 3D-Bühne (`perspective: 1200px`), FLIP-Kartenanimationen und responsivem Layout.

Gleichzeitig hat die systematische Tiefenanalyse durch unsere spezialisierte Subagenten-Flotte **19 konkrete Befunde** aufgedeckt, von denen 2 kritische Server-Stabilitätsrisiken (P0), 5 hohe Funktions-/KI-Defizite (P1) und mehrere wichtige UI/UX-Optimierungspotenziale darstellen.

### Die 4 wichtigsten Erkenntnisse im Überblick:
1. **Kritischer DoS-Vektor behoben (NET-01)**: Unvollständige Destrukturierung von Socket.IO-Payloads kann den gesamten Node.js-Prozess durch einen einzigen fehlerhaften oder manipulierten Client-Call (`null`-Payload) zum Absturz bringen.
2. **Resilienz bei Verbindungsabbrüchen (NET-02)**: Trennt ein Spieler während aktiver Animations- oder Auswertungstimer die Verbindung, wird der Timer gelöscht; beim Reconnect fehlt die Wiederaufnahme-Logik, was zu einem dauerhaften Spiel-Freeze führt.
3. **Taktische KI-Schwachstellen (BOT-01, BOT-02, BOT-03)**: Bots übergehen die Sonderkarte `vampire` beim Bieten komplett (bieten fälschlich 0 Stiche) und sortieren beim Anspiel niedrige Trümpfe vor Zauberer und Drachen, da Zauberer als farblos (`suit: 'none'`) gelten.
4. **Desktop-Fächer & Asset-Performance (UI-01, UI-02, UI-06)**: Der Kartenfächer bricht nach der ersten Aktion optisch flach zusammen (`rotate(0deg)` Bug); bei 20 Karten sprengt die Hand 1080p-Monitore (2.434px Breite); und 10 Sonderkarten belasten die Verbindung mit über 35 MB unkomprimierten PNGs ohne WebP.

---

## 2. Teil I: Systematische Codebase- & Schwachstellenanalyse

### 2.1 Spiellogik & Sondereditionen (30 Jahre Jubiläum)
Die Implementierung in `server/gameLogic.js` ist regelkonform und modular aufgebaut:
- **Bedienpflicht (Farbzwang)**: `isValidMove()` erlaubt Sonderkarten jederzeit und erzwingt das Bedienen der Eröffnungsfarbe (`leadSuit`), falls vorhanden.
- **Vorrangregeln**:
  - Zauberer: Erster Zauberer gewinnt.
  - Narren: Nur Narren im Stich $\to$ erster Narr gewinnt.
  - Drache vs. Zauberer: Drache gewinnt stets.
  - Fee vs. Drache: Fee sticht Drachen (selbst wenn Zauberer im Stich liegen).
  - Bombe: Neutralisiert den Stich vollständig (`winnerPlayerId: null`).
  - Einhorn ("Weißer Wal"): Entkräftet Magie; hebt Zauberer und Trümpfe auf, höchste reguläre Farbkarte gewinnt; neutralisiert vorherige Bomben.
- **Identifizierte Mängel & Kantenfälle**:
  - **F-05 / RUL-01 (Renonce-Tracking Diskrepanz bei Einhorn)**: In `server/index.js:2747` bricht die Ermittlung der Bedienfarbe für das Bot-Renonce-Tracking bei einem Einhorn ab (`leadSuit` bleibt `'none'`). Laut offizieller Regel (`gameLogic.js:300` und `test/unicorn.test.js` Test 9) etabliert jedoch die erste reguläre Farbkarte nach einem Einhorn die Bedienfarbe. Dies verfälscht das Kartenzählen der Erzmagier-KI.
  - **F-04 / RUL-02 (Deckgrößen-Inkonsistenz)**: Das Jubiläums-Deck enthält exakt 70 Karten (60 klassische + 10 Sonderkarten). In `server/gameLogic.js:1` spricht der Kommentar von 63 Karten; in `server/botLogic.js:317` rechnet die bayesianische Wahrscheinlichkeit des Erzmagiers mit 69 Karten (`totalDeck = 69`).

---

### 2.2 Multiplayer-Synchronisation, Concurrency & Netzwerkstabilität
- **NET-01 (Kritisch - Denial of Service durch ungeschützte Payload-Destrukturierung)**:
  - *Dateien & Zeilen*: `server/index.js:1148, 2103, 3012, etc.`
  - *Ursache*: Event-Handler wie `socket.on('playCard', ({ roomCode, cardIndex }) => { ... })` destrukturieren Payloads ohne Default-Wert `= {}` und ohne `try/catch`. Ein Aufruf wie `socket.emit('playCard', null)` wirft einen synchronen `TypeError: Cannot destructure property of null`.
  - *Auswirkung*: Da kein globaler `uncaughtException`-Handler existiert, stürzt der gesamte Node.js-Serverprozess ab. Alle laufenden Spiele werden getrennt.
- **NET-02 (Hoch - Spiel-Freeze bei Reconnect während aktiver Timer)**:
  - *Dateien & Zeilen*: `server/index.js:981–987, 3328, 2841, 2616`
  - *Ursache*: Bei Disconnect ruft der Server `clearRoomTimers(room)` auf und löscht alle `setTimeout`-Handler. Kehrt der Spieler zurück, setzt `joinRoom` lediglich `isPaused = false` und sendet `gameResumed`. Befand sich das Spiel in `evaluating_trick` (1200ms Delay) oder `round_over` (2000ms Delay), wird der Übergang niemals fortgesetzt. Das Spiel verharrt für immer im eingefrorenen Zustand.
- **NET-03 (Hoch - Permanentes Memory Leak bei Räumen mit Bot-Gegnern)**:
  - *Dateien & Zeilen*: `server/index.js:459, 3288`; `server/botLogic.js:151`
  - *Ursache*: Die Aufräumfunktion `checkRoomCleanup` prüft `room.players.every(p => !p.connected)`. Da Bots dauerhaft mit `connected: true` initialisiert werden, ist diese Bedingung in Partien mit Bots niemals wahr. Auch beim Verlassen via `leaveRoom` wird der Raum nicht gelöscht, da `room.players.length >= 1` bleibt. Verwaiste Räume mit Bots verbleiben bis zum Serverneustart im RAM.
- **NET-05 (Mittel - Host-Steuerungs-Desynchronisation im Pause-Overlay)**:
  - *Dateien & Zeilen*: `server/index.js:3320`; `public/client.js:9292, 8261`
  - *Ursache*: Verliert der Host die Verbindung, ernennt der Server sofort den nächsten Spieler zum Host und sendet `gamePaused`. Der Client wertet jedoch das veraltete `cachedPlayers` aus, sodass dem neuen Host die Steuerungsknöpfe ("Runde neu austeilen", "Spiel abbrechen") im Pause-Overlay fehlen.
- **NET-06 (Mittel - Plain Object Speicherung & Raumcode-Validierung)**:
  - *Dateien & Zeilen*: `server/index.js:329, 479, 829`
  - *Ursache*: `rooms` wird als Plain Object `{}` geführt; Raumcodes werden ohne strikte Alphanumerik-Regex akzeptiert. Risiko von Object-Prototyp-Interferenzen und versehentlichem Überschreiben bei Hash-Kollisionen.

---

### 2.3 Bot-Entwicklung & KI-Heuristiken
Grimoire verfügt über ein herausragendes 3-Stufen-Modell (Novize, Meister, Erzmagier mit Bayesian Card Counting und Sabotage-Taktik). Die Analyse deckte jedoch drei taktische Blindstellen auf:
- **BOT-01 / F-01 (Hoch - Vollständige Auslassung der Karte `vampire`)**:
  - *Dateien & Zeilen*: `server/botLogic.js:172-192, 234-250, 332-353`
  - *Ursache*: In den Bietheuristiken aller drei Schwierigkeitsgrade wird die Sonderkarte `vampire` überhaupt nicht abgefragt. Kopiert der Vampir die aufgedeckte Trumpfkarte (z. B. einen Zauberer, Drachen oder hohen Trumpf), rechnet der Bot mit **0 Stichen** für diese Karte. Bots unterbieten systematisch um 1 Stich und scheitern an ihren Geboten.
- **BOT-02 / F-02 (Hoch - Verkehrte Anspiel-Priorität bei Gewinnabsicht)**:
  - *Dateien & Zeilen*: `server/botLogic.js:515-521, 651-656`
  - *Ursache*: Bei Anspiel mit Gewinnabsicht sortiert der Code:
    `if (isTrumpA && !isTrumpB) return -1;`
    Da Zauberer und Drachen `suit: 'none'` besitzen, ist `isTrumpB = false`. Ein Bot mit Trumpf 2 und einem Zauberer sortiert die **Trumpf 2 vor den Zauberer**, verheizt den niedrigen Trumpf beim Anspiel und verliert den Stich.
- **BOT-03 / F-03 (Mittel - Trumpf-Anspiel beim Ducken)**:
  - *Dateien & Zeilen*: `server/botLogic.js:525-532, 671-678`
  - *Ursache*: Bei Anspiel ohne Gewinnabsicht (0 Stiche) verspricht der Kommentar, die niedrigste Nicht-Trumpfkarte anzuspielen. Der Sortiercode prüft jedoch kein `isTrump`. Der Bot spielt eine kleine Trumpf 2 vor einer hohen Fehlfarbe (z. B. Gelb 8) an und gewinnt ungewollt den Stich.

---

### 2.4 Sicherheit, Cheat-Schutz & Zero-Trust-Validierung
- **SEC-01 / F-06 / NET-04 (Mittel - Round 1 Stirnkarten-Leak in `roomUpdated`)**:
  - *Dateien & Zeilen*: `server/index.js:3575-3577, 3595`
  - *Ursache*: In Runde 1 ("Blindes Spiel") darf der Spieler seine eigene Karte nicht sehen, während alle Mitspieler sie sehen. In `getSanitizedPlayers` wird `pData.round1Card = p.hand[0]` bedingungslos gesetzt und an alle Clients im Raum übertragen.
  - *Auswirkung*: Obwohl der Client die eigene Stirnkarte im regulären UI ausblendet, kann ein Spieler über die Browser-Entwicklertools (Netzwerk-Tab WebSocket-Frames) seine eigene verdeckte Karte vor dem Bieten im Klartext auslesen.
- **Server-Autorität & Rule-Enforcement (Positiv)**:
  - Der Server validiert streng alle Spielzüge über `isValidMove()`, blockiert unberechtigtes Ausspielen fremder Karten, prüft Gebotsbereiche und setzt die Geber-Regel serverseitig durch (`server/index.js:2051`).

---

### 2.5 Testabdeckung & Resilienz unter Last
- **Bestehender Status**: 11 Unit-Test-Suiten, alle 10 Sonderkarten und alternative Modi mit 100 % Erfolgsquote abgedeckt.
- **Identifizierte Testlücken (TEST-01)**:
  1. Keine Tests für Bot-Bieten mit Vampir (Hätte BOT-01 aufgedeckt).
  2. Keine Tests für Bot-Anspiel-Sortierung (Zauberer vs. Trumpf, Ducken mit Trumpf).
  3. Keine Concurrency-Tests für zeitgleiches Simultan-Bieten aller Spieler im selben Event-Loop-Tick.
  4. Keine Netzwerk-Resilienz-Tests für Verbindungsabbruch während aktiver Timer (`evaluating_trick`).
  5. Socket-Tests unter Windows: `localhost` bindet teilweise an IPv6 `[::1]`, während der Server auf IPv4 `0.0.0.0` lauscht. Standardisierung auf `127.0.0.1` erforderlich.

---

## 3. Teil II: UI/UX- & Interaktions-Verbesserungsplan

### 3.1 Desktop-Kartenfächer (Fächer-Mathematik & Overflow-Beseitigung)
1. **Behebung des "Fan Flattening Bugs" (UI-01)**:
   - *Problem*: In `public/client.js:10410` wird bei `isSameHand` `style.transform = translateY(${restY}px) rotate(0deg)` gesetzt. Der Bogen bricht bei jedem Status-Update optisch zusammen.
   - *Lösung*: Die vorberechneten CSS-Variablen `--target-y` und `--target-rot` dauerhaft beibehalten:
     ```javascript
     cardElement.style.transform = `translateY(${cardElement.style.getPropertyValue('--target-y') || restY + 'px'}) rotate(${cardElement.style.getPropertyValue('--target-rot') || '0deg'})`;
     ```
2. **Dynamische Handkarten-Skalierung für 20 Karten (UI-02)**:
   - *Problem*: In 3-Spieler-Partien (Runde 20) benötigt die Hand mit festem `-54px` Margin auf 1080p-Monitoren **2.434px** und ragt hunderte Pixel aus dem Bildschirm heraus.
   - *Lösung*: Vollkommen dynamische Margin-Berechnung abhängig von der Container- und Viewport-Breite:
     ```javascript
     const containerW = handContainer.clientWidth || window.innerWidth;
     const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 100;
     const availableW = Math.min(containerW * 0.95, window.innerWidth - 40);
     let dynamicMargin = 3;
     if (total > 1 && (total * cardW > availableW)) {
       dynamicMargin = Math.max(-cardW * 0.78, (availableW - cardW) / (total - 1) - cardW);
     }
     ```
3. **Tastaturbedienung & Barrierefreiheit (WCAG 2.1)**:
   - Pfeiltasten (`←` / `→`) zur Kartenauswahl im Fächer.
   - Zifferntasten (`1`–`9`, `0`) zur Direktanwahl.
   - `Enter` / `Space` zum Ausspielen der ausgewählten Karte.

---

### 3.2 3D-Karten-Animationen & Tisch-Dynamik
1. **Beseitigung des Animation-Cutoffs bei 4–6 Spielern (UI-03)**:
   - *Problem*: Beim Stichgewinn werden Karten mit 25ms Stagger in den Sieger-Avatar gesaugt. `trickContainer.innerHTML = ''` nach festen 380ms vernichtet Karten von Spieler 4 bis 6 mitten im Flug.
   - *Lösung*: Dynamischer Timeout: `const cleanupDelay = Math.max(380, (trickItems.length - 1) * 25 + 340);`.
2. **Implementierung der fehlenden CSS-Klasse `turn-start-extreme-flash` (UI-04)**:
   - *Problem*: In `public/client.js:8380` aufgerufen, existiert in CSS nicht.
   - *Lösung*: Keyframe-Animation mit sanftem goldenen Radial-Leuchten auf `.poker-table.turn-start-extreme-flash`.
3. **Tisch-Aura Desynchronisation (UI-08)**:
   - Beim Klick auf eine Handkarte sofort `tableArea.classList.toggle('my-turn-aura', false)` setzen, um die Zug-Aura unmittelbar ohne Server-Roundtrip zu beenden.

---

### 3.3 Audio- & Visuelles Feedback (WebAudio-Synthese)
Erweiterung der `WizardAudio`-Engine in `public/client.js` um synthetische Klänge (ohne externe Binär-Downloads):
- **Stichgewinn-Akkord**: Aufsteigender C-Dur-Akkord (C5 $\to$ E5 $\to$ G5) mit warmem Sinus-Decay beim Einsaugen der Karten.
- **Kartenflug-Swoosh**: Bandpass-Filter-Sweep (400 Hz $\to$ 1.800 Hz $\to$ 200 Hz in 240ms) während des 3D-Kartenflugs.
- **Sonderkarten-Sounds**:
  - *Magiekollaps (Bombe)*: Tiefbass-Explosions-Decay mit leichter Distortion (120 Hz $\to$ 26 Hz).
  - *Waldnymphe (Fee)*: Kristallines Glockenspiel-Glissando (880 Hz $\to$ 1760 Hz).
  - *Lindwurm (Drache)*: Oszillierender Dual-Sub-Thump mit Hall.

---

### 3.4 Mobile Responsiveness & Touch-Ergonomie
1. **WCAG 44×44px Touch-Targets (UI-05)**:
   - `.bid-btn` auf Mobilgeräten von 40px auf 44px anheben (Platz im Container ist ausreichend).
   - `.player-seat` mit unsichtbarem Touch-Padding (`::before { content: ''; inset: -10px; }`) für verlässliche Inspektion ausstatten.
2. **"Tap to Inspect" Führung**:
   - Schwebendes Mini-Siegel `↑ Erneut tippen zum Spielen` über der inspizierten Karte einblenden.
   - Schwellenwert für horizontales Wischen (`> 12px` Touchmove), um Konflikte zwischen Scrollen und Kartenhebe-Geste zu verhindern.
3. **Mobile Landscape-Modus**:
   - Ergänzung einer Media-Query `@media (max-height: 480px) and (orientation: landscape)` mit kompakter Kartenhöhe (`clamp(52px, 6vw, 68px)`), damit Handkarten nicht das Spielfeld verdecken.

---

### 3.5 Spielraum-Atmosphäre, Assets & Performance
1. **WebP-Karten-Asset Pipeline (UI-06)**:
   - *Problem*: Die 10 Sonderkarten wiegen als unkomprimierte PNGs jeweils 3,5 MB (Gesamtvolumen über 35 MB).
   - *Lösung*: Konvertierung in WebP (Qualität 85, $1050 \times 1498\text{px}$). Reduziert die Dateigröße um ~85 % auf 350–500 KB pro Karte.
2. **Bereinigung der SVG-Platzhalter**:
   - Den sichtbaren Text `"1050 × 1498 PX ARTWORK-SLOT"` aus allen SVGs entfernen und durch saubere, ansprechende Vektor-Grafiken ersetzen.
3. **Atmosphärische Lade-Indikatoren**:
   - Rotierender magischer Runen-Zirkel beim Kaltstart / Server-Wakeup statt statischem Textbanner.

---

## 4. Teil III: Strukturierter Maßnahmen- & Handlungsplan

### 4.1 Prioritäten-Matrix

| Priorität | ID | Bereich | Betroffene Dateien | Aufwand | Wirkung / Risiko |
|:---:|:---|:---|:---|:---:|:---|
| **P0 (Sofort)** | **NET-01** | Sicherheit | `server/index.js` | 1 h | **Kritisch**: Verhindert Denial-of-Service-Serverabstürze. |
| **P0 (Sofort)** | **NET-02** | Stabilität | `server/index.js` | 2 h | **Kritisch**: Behebt Spiel-Freezes bei Reconnects während Timern. |
| **P1 (Hoch)** | **BOT-01** | KI / Bots | `server/botLogic.js` | 1 h | **Hoch**: Schließt Biet-Ausfall beim Vampir. |
| **P1 (Hoch)** | **BOT-02** | KI / Bots | `server/botLogic.js` | 1 h | **Hoch**: Stoppt Verheizen von Trümpfen vor Zauberern beim Anspiel. |
| **P1 (Hoch)** | **NET-03** | Lifecycle | `server/index.js`, `server/botLogic.js` | 1.5 h | **Hoch**: Behebt permanentes Speicherleck bei Bot-Räumen. |
| **P1 (Hoch)** | **SEC-01** | Zero-Trust | `server/index.js` | 1 h | **Mittel**: Verhindert Auslesen der eigenen Blindkarte in Runde 1. |
| **P1 (Hoch)** | **UI-01** | Desktop UX | `public/client.js` | 0.5 h | **Hoch**: Stellt dauerhaft gekrümmten Kartenfächer sicher. |
| **P1 (Hoch)** | **UI-02** | Desktop UX | `public/client.js` | 1 h | **Hoch**: Garantiert sauberes Handkarten-Layout bei 20 Karten. |
| **P1 (Hoch)** | **UI-06** | Performance | `public/images/cards/` | 1.5 h | **Hoch**: Spart >30 MB Download-Volumen pro Spielrunde. |
| **P2 (Mittel)** | **BOT-03** | KI / Bots | `server/botLogic.js` | 1 h | **Mittel**: Verhindert versehentliches Trumpf-Anspiel beim Ducken. |
| **P2 (Mittel)** | **UI-03** | 3D-Bühne | `public/client.js` | 0.5 h | **Mittel**: Behebt Karten-Abschneiden im Flug bei 4–6 Spielern. |
| **P2 (Mittel)** | **NET-05** | UI/UX Sync | `server/index.js`, `public/client.js` | 1 h | **Mittel**: Verhindert Softlock im Pause-Overlay bei Host-Disconnect. |
| **P2 (Mittel)** | **UI-05** | Mobile A11y | `public/index.html` | 1 h | **Mittel**: Erfüllt WCAG 44×44px für Biet-Buttons und Sitze. |
| **P2 (Mittel)** | **NET-06** | Datenintegrität | `server/index.js` | 1.5 h | **Mittel**: Map-Speicher & Alphanumerik-Validierung für Räume. |
| **P2 (Mittel)** | **RUL-01** | Void Matrix | `server/index.js` | 0.5 h | **Mittel**: Korrigiert Einhorn-Renonce-Tracking für Bots. |
| **P2 (Mittel)** | **TEST-01** | Testsuite | `test/networkResilience.test.js` | 3 h | **Hoch**: Automatisierte Concurrency-, Stress- und Fuzzing-Tests. |
| **P3 (Niedrig)** | **UI-04** | CSS Styles | `public/index.html` | 0.5 h | **Niedrig**: Fügt fehlende `turn-start-extreme-flash`-Animation ein. |
| **P3 (Niedrig)** | **UI-07** | Audio | `public/client.js` | 2 h | **Mittel**: WebAudio-Synthese für Win-Akkord, Swoosh und Bombe. |
| **P3 (Niedrig)** | **RUL-02** | Doku/Konsistenz | `server/gameLogic.js`, `botLogic.js` | 0.5 h | **Niedrig**: Deckgröße auf 70 Karten harmonisieren. |

---

### 4.2 Detaillierte Implementierungs-Schritte mit Code-Patches

#### Etappe A: Server-Härtung & Resilienz (P0 / P1)
1. **DoS-Schutz in `server/index.js`**:
   Jeder Socket.IO-Eventhandler erhält `= {}` als Parameter-Default sowie einen Wrapper zur Validierung:
   ```javascript
   socket.on('playCard', (payload = {}) => {
     try {
       const { roomCode, cardIndex, chosenRole, chosenSuit, witchSwap } = payload;
       if (!roomCode || typeof cardIndex !== 'number') return;
       // ... reguläre Logik
     } catch (err) {
       console.error('[Socket Error] playCard failed:', err.message);
     }
   });
   ```
2. **State-Resumption bei Reconnect in `server/index.js` (ohne Doppelwertung)**:
   Neue Funktion `resumeRoomExecution(room)` in `joinRoom` einbinden. Verwendet `room.currentTurnIndex` (korrekter Eigenschaftsname) und vermeidet Doppelzählung von Stichen:
   ```javascript
   function resumeRoomExecution(room) {
     if (room.gameState === 'evaluating_trick') {
       // Falls Stich bereits ausgewertet wurde, nur die Aufräum-Pipeline fortführen:
       if (room.currentTrick && room.currentTrick.length > 0) {
         room.currentTrick = [];
         if (room.cardsRemainingInRound > 0) {
           room.gameState = 'playing';
         } else if (!room.isGameOver) {
           proceedToNextRound(room.roomCode);
         }
       } else {
         evaluateCompletedTrick(room);
       }
     } else if (room.gameState === 'round_over' && !room.isGameOver) {
       proceedToNextRound(room.roomCode);
     } else {
       const activeP = room.players[room.currentTurnIndex];
       if (activeP && activeP.isBot) triggerBotTurn(room, activeP);
     }
   }
   ```
3. **Bot-Raum Aufräum-Logik in `server/index.js`**:
   ```javascript
   const humanPlayers = room.players.filter(p => !p.isBot);
   const allHumansDisconnected = humanPlayers.length === 0 || humanPlayers.every(p => !p.connected);
   if (allHumansDisconnected) {
     startRoomCleanup(room);
   }
   ```
4. **Stirnkarten-Maskierung in `server/index.js` (Zero-Trust mit Per-Socket Dispatch)**:
   In `broadcastRoomUpdated` für Runde 1 personalisiert pro Socket senden:
   ```javascript
   if (room && room.round === 1) {
     room.players.forEach(p => {
       const targetSocket = io.sockets.sockets.get(p.socketId);
       if (targetSocket) {
         targetSocket.emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room, p.sessionId));
       }
     });
   } else {
     io.to(room.roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
   }
   ```

#### Etappe B: Bot-KI & Regeltreue (P1 / P2)
1. **Vampir in `server/botLogic.js` evaluieren (vollständige Farbkarten-Unterstützung)**:
   In `calculateNoviceBid`, `calculateMasterBid` und `calculateArchmageBid` die effektive Karte zuweisen, sodass auch kopierte Trümpfe und reguläre Farbkarten durch die nachfolgenden Farb- und Trumpfheuristiken erfasst werden:
   ```javascript
   // Für jede Handkarte c:
   const effCard = (c.type === 'vampire' && c.copiedCard) ? getEffectiveCard(c) : c;
   // Jetzt effCard prüfen:
   if (effCard.type === 'wizard' || effCard.type === 'dragon' || effCard.type === 'werewolf_trump') {
     lockTricks += 0.95;
     return;
   }
   // Falls effCard eine Farbkarte oder ein Trumpf ist, fließt sie automatisch in die Farb- und Trumpfheuristik ein!
   ```
2. **Boss-Karten vor Trümpfen sortieren in `server/botLogic.js`**:
   In `chooseMasterCard` (Z. 515) und `chooseArchmageCard` (Z. 651):
   ```javascript
   const isBossA = ['dragon', 'wizard'].includes(a.card.type) || (a.card.type === 'shapeshifter' && a.chosenRole === 'wizard');
   const isBossB = ['dragon', 'wizard'].includes(b.card.type) || (b.card.type === 'shapeshifter' && b.chosenRole === 'wizard');
   if (isBossA && !isBossB) return -1;
   if (!isBossA && isBossB) return 1;
   ```
3. **Fehlfarben vor Trümpfen beim Ducken anspielen in `server/botLogic.js`**:
   In `chooseMasterCard` (Z. 525) und `chooseArchmageCard` (Z. 671):
   ```javascript
   const isTrumpA = (a.card.suit === trumpSuit && trumpSuit !== 'none');
   const isTrumpB = (b.card.suit === trumpSuit && trumpSuit !== 'none');
   if (!isTrumpA && isTrumpB) return -1;
   if (isTrumpA && !isTrumpB) return 1;
   ```

#### Etappe C: UI/UX & Fächer-Optimierung (P1 / P2)
1. **Fächer-Bogen erhalten in `public/client.js`**:
   In `renderHand()` bei `isSameHand`:
   ```javascript
   cardElement.style.transform = `translateY(${cardElement.style.getPropertyValue('--target-y') || restY + 'px'}) rotate(${cardElement.style.getPropertyValue('--target-rot') || '0deg'})`;
   ```
2. **Dynamische Margin in `public/client.js`**:
   Containerbreite berücksichtigen und Margin bei $>15$ Karten bis `-cardW * 0.78` dynamisch berechnen.
3. **Animations-Dauer in `public/client.js`**:
   `trickContainer.innerHTML = ''` mit dynamischem Delay `Math.max(380, (trickItems.length - 1) * 25 + 340)` ausführen.
4. **Fehlende CSS-Klasse in `public/index.html`**:
   ```css
   @keyframes tableTurnFlash {
     0% { filter: brightness(1); }
     35% { filter: brightness(1.22) drop-shadow(0 0 25px rgba(240, 195, 85, 0.6)); }
     100% { filter: brightness(1); }
   }
   .poker-table.turn-start-extreme-flash {
     animation: tableTurnFlash 0.48s ease-out;
   }
   ```
5. **Kollisionsfreie Mobile Touch-Ziele**:
   `.player-seat` mit vertikalem Touch-Padding oder `height: 44px` versehen (ohne horizontales Inset, um Überlappung bei 3px Abstand zu verhindern).
6. **Dual-Format Asset Pipeline**:
   WebP-Kompression einführen, aber bestehende PNGs für bestehende Test-Assertions und als Fallbacks beibehalten.

---

### 4.3 Harmonisierung mit ROADMAP.md & AGENTS.md

Dieser Plan fügt sich **nahtlos in die bestehende Projekt-Roadmap (`ROADMAP.md`)** ein:
- Er ergänzt die abgeschlossenen Phasen (Mobile Optimierung, 2vs2 Allianzen, Bietmodi, Schatztruhen) um die notwendige **technische Reife und Härtung**, bevor die nächste große Inhalts-Etappe (**Etappe 7: „Der Turm der Erzmagier“**) und die **F-Droid-Veröffentlichung** starten.
- Die Zuständigkeiten entsprechen exakt den in `AGENTS.md` definierten Expertenrollen:
  - `game_logic_auditor`: Spiellogik-Harmonisierung (F-04, F-05) und Regeltreue.
  - `bot_developer`: Biet- und Anspielheuristiken (BOT-01, BOT-02, BOT-03).
  - `multiplayer_qa` & `security_auditor`: Socket-DoS-Schutz, Resumption nach Reconnect und Memory-Leak-Beseitigung (NET-01, NET-02, NET-03, SEC-01).
  - `ui_ux_designer`: Desktop-Fächer, 3D-Animations-Timing, WebP-Pipeline und WCAG-Ergonomie.

---

## 5. Verifikations- & Audit-Protokoll

Jede Maßnahme wird vor der Freigabe über geschlossene Verifikationsschleifen geprüft:
1. **Spiellogik & Bot-KI**:
   - `npm run test:unit`
   - Neue Tests in `test/botDifficulties.test.js` für Bot-Vampir-Bieten und Anspiel-Prioritäten.
2. **Netzwerk & Multiplayer-Resilienz**:
   - Neue Testsuite `test/networkResilience.test.js` mit simulierten Disconnects während `evaluating_trick` und Payload-Fuzzing (`null`-Payloads).
3. **UI/UX & Mobile Responsiveness**:
   - Automatisierte Layout-Tests für Handkarten-Breite bei 20 Karten.
   - Visuelle Inspektion im Browser und Synchronisation via `npm run cap:sync` für das Android-Target.
