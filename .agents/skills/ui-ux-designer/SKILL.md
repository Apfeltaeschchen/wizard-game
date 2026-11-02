---
name: ui-ux-designer
description: Leitfaden für UI/UX, Fächer-Layout, 3D-Karten-Animationen, Mobile Responsive & Themes in Grimoire Online.
---

# UI/UX Designer Skill

Nutze diesen Skill, wenn du CSS, Layouts, Animationen, Touch-Bedienung oder Kartendarstellungen verbesserst.

## Kern-Dateien
- Markup & Dialoge: `public/index.html`
- Styles & 3D-Bühne: `public/style.css`
- Client-Rendering & Interaktion: `public/client.js`
- Grafiken & Hintergründe: `public/images/`

## Verbindliche Design-Prinzipien
1. **0px Overflow Garantie:**
   - Auf mobilen Viewports (380px–420px, z. B. Samsung Galaxy A35 5G) darf kein horizontaler Scrollbalken auf der Hauptebene (`body` / `#app`) entstehen.
   - Drawers (`#score-board-drawer`, `#rules-drawer`, etc.) müssen im geschlossenen Zustand `box-shadow: none` und `visibility: hidden` haben, um Randschatten im Displayrand zu vermeiden.
2. **Kartenfächer & Ergonomie:**
   - Mindest-Touch-Target für Buttons: 44×44px (WCAG).
   - Kartenfächer mit taktilem Hover/Tap-Lift (`translateY(-34px) scale(1.08)`).
3. **Android-Synchronisation:**
   - Nach Änderungen im Frontend (`public/`) immer Android-Assets spiegeln:
     ```bash
     npm run cap:sync
     ```
