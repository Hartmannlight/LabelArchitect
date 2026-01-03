# zplgrid Template Editor (Web)

Ein Web-Editor zum Erstellen von `zplgrid` JSON-Templates (schema_version = 1). Ziel: Nicht-ZPL-Logik im Frontend bearbeitbar machen, damit das Backend die Templates spaeter in ZPL kompiliert und druckt.

Wenn du den anderen Teil des Frontends bauen willst, solltest du hier verstehen:
- welches Template-Format erzeugt wird,
- wie der Editor intern arbeitet,
- welche Backend-Endpunkte angesprochen werden,
- und wie Variablen/Preview/Print-Workflow funktionieren.

## Was dieses Projekt liefert

- Visueller Split-Layout-Editor (vertikal/horizontal) mit Drag-Handles und optionalem Snap.
- Ein Element pro Leaf: Text, QR, DataMatrix, Image, Line.
- Eigenschaften-Panel fuer Split, Leaf, Element und Template-Defaults.
- Import/Export von JSON.
- Backend-Template-Store (list/save/load) inkl. Tags, Variablen-Definitionen und Sample-Daten.
- Print-Handoff: Erzeugt einen Draft im Backend und leitet zur Operator-UI weiter.
- Variablen-Erkennung inkl. Makro-Hinweisen.
- Undo/Redo + Zod-Validierung.

Wichtig: Das Frontend erzeugt nur JSON. ZPL entsteht im Backend (siehe Render- und Draft-Endpunkte).

## Architekturueberblick (Frontend)

Der Editor besteht aus drei Hauptbereichen:
- Links: Baumansicht der Layout-Knoten (`TreePanel`).
- Mitte: Canvas-Editor (Layout in mm -> Pixel), plus Render-Preview.
- Rechts: Properties + Defaults + Variablen.

State-Management laeuft ueber Zustand (`src/state/store.ts`) mit:
- `history`: undo/redo mit immutable operations (`src/state/operations.ts`).
- `selection`: aktueller Node.
- `tool`: selektieren/splitten/elemente platzieren.
- `preview`: Labelgroesse und dpi.
- `settings`: Snap/Zoom/Unit.
- Persistenz in localStorage (Template, Theme, Preview, Variablen).

## Datenmodell (Template-JSON)

Die zentralen Typen stehen in `src/model/types.ts`, validiert in `src/model/schema.ts`:

- `TemplateDoc`
  - `schema_version`: 1
  - `name` (optional)
  - `defaults`: Standardwerte (Text, Code2D, Image, Render)
  - `layout`: Tree aus `split` und `leaf`

- `SplitNode`
  - `direction`: `v` oder `h`
  - `ratio`: 0..1
  - `gutter_mm`: Abstand zwischen Kindern
  - `divider`: Sichtbarer Divider mit `thickness_mm`
  - `children`: 2 Nodes

- `LeafNode`
  - `elements`: genau 1 Element
  - `padding_mm`, `debug_border`, `alias`

- Elemente:
  - `text`, `qr`, `datamatrix`, `image`, `line`
  - Einheiten sind mm.
  - Keine Rotation in v1.

Die Layout-Berechnung fuer Canvas/Preview laeuft ueber `computeLayout(...)` in `src/model/layout.ts`.

## Variablen und Makros

- Platzhalter-Syntax: `{name}`.
- Literale Klammern: `{{` und `}}`.
- Automatische Erkennung in Text/QR/DataMatrix (`src/model/variables.ts`).
- Makros (z.B. `{_now_iso}`, `{_counter_template}`) werden als Backend-Fill dargestellt.

UI: `VariablesPanel` zeigt required variables + Makros; Werte werden im localStorage gehalten.

## Backend-Integration (API Contracts)

Konfiguration in `src/api/config.ts`:
- `VITE_BACKEND_API_BASE` (Default: same origin)
- `VITE_RENDER_API_BASE` (Default: Backend Base)
- `VITE_OPERATOR_APP_BASE` (Default: `http://localhost:5174`)

Aktuelle Endpunkte, die das Frontend erwartet:

Templates:
- `GET /v1/templates?tags=...` -> Liste von Templates
- `GET /v1/templates/{id}` -> Template-Details inkl. `template`, `variables`, `sample_data`
- `POST /v1/templates` -> neues Template speichern
- `PUT /v1/templates/{id}` -> Template aktualisieren
- `GET /v1/templates/{id}/preview` -> PNG Preview (optional)

Render-Preview:
- `POST /v1/renders/zpl` -> Backend liefert ZPL zur Weiterleitung an Labelary

Print-Handoff:
- `POST /v1/drafts` -> erstellt einen Draft (template + variables + target)
- redirect zu: `{VITE_OPERATOR_APP_BASE}/print?draft_id=...`

Wenn du einen neuen Frontend-Teil schreibst, der auf das Backend zugreift, halte dich an diese Payload-Formate oder erweitere sie bewusst.

## Render-Pipeline (Preview)

`LabelPreviewPanel` macht:
1) `POST /v1/renders/zpl` mit Template + Variablen + Zielgroesse
2) ruft Labelary mit dem ZPL auf und zeigt PNG an

Das heisst: Preview ist end-to-end, aber extern von Labelary abhaengig.

## Editor-Tools und Shortcuts

- Tools: Select, Split V/H, Text, QR, DataMatrix, Image, Line.
- Shortcuts:
  - Ctrl/Cmd+Z: undo
  - Ctrl/Cmd+Shift+Z oder Ctrl/Cmd+Y: redo
  - Ctrl/Cmd+N: neues Template
  - Ctrl/Cmd+I: Import
  - Ctrl/Cmd+E: Export
  - s/v/h/t/q/d/i/l: Tool-Wechsel (wenn kein Input fokussiert)

## Lokal starten

```bash
npm install
npm run dev
```

Optional:
- `npm run build` (tsc + vite build)
- `npm run preview`

## Design-Constraints (v1)

- Jedes Leaf hat genau ein Element.
- Einheiten fuer padding/thickness/gutter: mm.
- Keine Rotation.

## Einstiegspunkte fuer Erweiterungen

- Template-Operationen: `src/state/operations.ts`
- Validierung: `src/model/schema.ts`
- Layout und Hit-Testing: `src/model/layout.ts`
- Backend-Dialog: `src/ui/TemplateStoreDialog.tsx`
- Preview-Pipeline: `src/ui/LabelPreviewPanel.tsx`

## Hinweise

- Canvas-Preview ist Layout-orientiert; das PNG-Preview kommt aus dem Backend+Labelary.
- Bild-URLs sind im Backend gated (`ZPLGRID_ENABLE_IMAGE_URL=1`).
