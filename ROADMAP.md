# Grimoire Online – Projekt-Roadmap & Arbeitsstand

> **WICHTIGE ENTWICKLER-NOTIZ FÜR MORGEN**:  
> Sobald du morgen wieder am Start bist, findest du hier als Erstes die genaue Schritt-für-Schritt-Anleitung, um die Android-APK zu bauen und auf deinem Smartphone zu testen!  
> Danach geht es direkt mit **Etappe 4 (F-Droid)** und den Folge-Erweiterungen weiter.

---

## 📱 Kurzanleitung für morgen: Android APK bauen & auf dem Smartphone testen

Falls du die frisch vorbereitete Android-App morgen direkt auf deinem Handy ausprobieren möchtest:

1. **Android Studio öffnen**:
   ```powershell
   npm run cap:open:android
   ```
2. **APK kompilieren**:
   - In Android Studio oben im Menü: **Build** ➔ **Build Bundle(s) / APK(s)** ➔ **Build APK(s)**.
3. **APK-Datei finden**:
   - Nach ca. 30–60 Sekunden erscheint unten rechts ein Pop-up mit dem Link **`locate`**.
   - Die fertige Datei liegt unter:  
     `android/app/build/outputs/apk/debug/app-debug.apk`
4. **Auf dein Handy übertragen & installieren**:
   - Übertrage `app-debug.apk` per USB-Kabel, Nextcloud, Google Drive oder Web-Messenger auf dein Smartphone und tippe auf **Installieren**.
5. **Spielserver auf dem PC starten**:
   ```powershell
   npm start
   ```
   *(Wichtig: Dein PC und dein Smartphone müssen im selben WLAN sein).*
6. **Server-Adresse in der App verbinden**:
   - Ermittle kurz deine PC-IP im Terminal via `ipconfig` (z. B. `192.168.178.50`).
   - Öffne die **Grimoire**-App auf dem Smartphone.
   - Tippe oben rechts auf das neue Zahnrad-Symbol **`⚙️ Server`**.
   - Trage deine PC-Adresse ein (z. B. `http://192.168.178.50:3000`) und tippe auf **`⚔️ Speichern & Verbinden`**.
   - Schon bist du voll vernetzt und kannst mit Haptik, Safe-Areas und flüssigen Touch-Gesten spielen!

---

## 🧭 Master-Fahrplan & Aktuelle Reihenfolge

```mermaid
flowchart TD
    subgraph P1["PHASE 1: JETZT (Vor dem Offline-Gehen)"]
        E3_1["Aufgabe 3.1: Server-URL Konfiguration für mobile Geräte"]
        E3_2["Aufgabe 3.2: Git-Sicherung & Thematische Commits"]
        E3_3["Aufgabe 3.3: APK-Generierung & Test-Dokumentation"]
    end

    subgraph P2["PHASE 2: NACH WIEDERKEHR DES ENTWICKLERS"]
        E4["ETAPPE 4: F-Droid Veröffentlichung (FOSS & 100% Kostenlos)"]
        OPT3["ERWEITERUNG A: Automatisches Ranked-Matchmaking (1-Klick Queue)"]
        OPT4["ERWEITERUNG B: Visuelles Polish & AAA 3D-Karten-Animationen"]
        OPT5["ERWEITERUNG C: Produktiv-Deployment (Docker, SSL/WSS, Nginx)"]
    end

    P1 --> P2
    E4 --> OPT3 --> OPT4 --> OPT5
```

---

## 📌 Phase 1: Abschluss von Etappe 3 (ABGESCHLOSSEN ✅)

* [x] **Aufgabe 3.1: Server-URL Konfiguration für mobile Endgeräte**
  - In `public/client.js` Server-URL dynamisch ermitteln: Im Browser `window.location.origin`, in Capacitor primär `localStorage.getItem('grimoire_server_url')`.
  - Einstellungs-Icon (⚙️) im Lobby-Header & Button im Verbindungs-Banner öffnet Dialog *"Spielserver-Verbindung"*.
  - Speicherung im `localStorage` & automatischer Reconnect.
  - Automatische Asset-Spiegelung nach `android/` via `npx cap sync`.
  - Verifiziert durch 27/27 bestandene Tests inkl. `test/mobileServerConfig.test.js`.
* [x] **Aufgabe 3.2: Git-Bereinigung & Thematische Commits**
  - Arbeitskopie (über 9.500 Zeilen Diff) in Git gesichert (Commit `60fc868`).
  - Working Tree sauber und konsolidiert.
* [x] **Aufgabe 3.3: APK-Generierung & Build-Leitfaden**
  - Android Studio öffnen via `npm run cap:open:android`.
  - APK kompilieren via *Build -> Build Bundle(s) / APK(s) -> Build APK(s)*.
  - APK-Speicherort: `android/app/build/outputs/apk/debug/app-debug.apk`.
  - Installations- und Testanleitung dokumentiert.

---

## 📌 Phase 2: Nach Wiederkehr des Entwicklers

### 1. ETAPPE 4: F-Droid Veröffentlichung (FOSS & 100% Kostenlos)
* **Lizenzierung**: Saubere Open-Source-Lizenzdatei (`LICENSE`, z. B. GPLv3 oder MIT) im Root anlegen.
* **FOSS-Audit**: Sicherstellen, dass keine proprietären Google Play Services oder proprietäre Binaries in die App eingebunden sind.
* **Fastlane-Ordnerstruktur**:
  - `metadata/de.grimoire.online/en-US/short_description.txt`
  - `metadata/de.grimoire.online/en-US/full_description.txt`
  - Smartphone-Screenshots (Filztisch, Handkarten, Grimoire).
* **F-Droid Build-Rezept**: `.fdroid.yml` für reproducible builds erstellen und Merge Request im F-Droid Data Repository vorbereiten.

### 2. ERWEITERUNG A: Automatisches Ranked-Matchmaking (1-Klick Queue)
* **Warteschlangen-System**: Spieler klicken in der Lobby auf *"Gewertete Partie suchen"*.
* **Matchmaking-Logik**: Der Server gruppiert wartende Spieler anhand ihrer Skill-Rating (SR ±200 Punkte) in einen Raum (3–6 Spieler).
* **Match-Ready-Dialog**: Akustisches Signal & 15-Sekunden Bestätigungs-Countdown vor Spielstart.

### 3. ERWEITERUNG B: Visuelles Polish & AAA 3D-Karten-Animationen
* **3D-Kartenflugbahnen**: Bezier-Kurven und Fluganimationen von Handkarte zum Spieltisch und vom Tisch zum Stichgewinner (`transform-style: preserve-3d`).
* **Partikel- & Soundeffekte**:
  - Lindwurm: Flammenhauch & Brandspuren auf dem Tisch.
  - Magiekollaps: Schockwelle & Tisch-Beben.
  - Einhorn: Sternenstaub-Aura.
* **Tisch-Lichtreflexe**: Dynamischer Schattenwurf passend zur Finger-/Maus-Position.

### 4. ERWEITERUNG C: Produktiv-Deployment & Hosting
* **Docker & Container**: `Dockerfile` und `docker-compose.yml` für schnelles Deployment.
* **SSL/WSS**: Sichere WebSocket-Verschlüsselung mit Nginx Reverse Proxy.
* **Umgebungsvariablen**: Konsequente Trennung von `.env` (Port, JWT Secret, DB-Pfad).

---

## 📜 Historie der abgeschlossenen Etappen

* ✅ **Etappe 1: Core Quality & Grimoire der Gefährten** (Abgeschlossen)
  - 0ms Auto-Login via `localStorage`
  - SQLite `friendships`-Tabelle & Socket.IO Präsenzanzeige (Zitadelle, Spiel)
  - "Grimoire der Gefährten" Drawer
  - Overwatch-Style Einladungs-Popup mit 15s Countdown-Balken & Sound (`invite-chime.wav`)
  - 26 Test-Suiten mit 100% Erfolgsquote
* ✅ **Etappe 2: Rebranding & 1050×1498 px Karten-Pipeline** (Abgeschlossen)
  - Vollständiges Dark-Fantasy Rebranding (*Grimoire – Das Magische Kartenspiel der Zitadelle*)
  - Sonderkarten: Erzmagier (`E`), Scharlatan (`S`), Lindwurm (`L`), Waldnymphe (`F`), Magiekollaps (`K`), Doppelgänger (`D`), Blutfürst (`B`), Himmelsschleier (`9¾`), Mondbestie (`M`), Schattenhexe (`X`), Taschenspieler (`7½`/`T`), Einhorn (`H`)
  - 1050 × 1498 px Bild-Architektur mit SVG-Platzhaltern in `public/images/cards/`
  - Modus-gefiltertes Regel-Grimoire mit Lore-Texten & Bestiarium
