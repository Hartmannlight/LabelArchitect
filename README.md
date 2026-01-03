# zplgrid Template Editor (Web)

A minimal web editor that creates `zplgrid` JSON templates (schema_version=1).

## Features (current)

- Split layout editor (vertical/horizontal)
- Drag split handles to adjust ratios (optional snapping)
- Leaf element placement: text / QR / DataMatrix / line
- Property editor for split/leaf/element fields
- Template defaults editor
- Import / export JSON
- Backend template store (save/list/load)
- Print handoff to operator UI (creates draft + redirect)
- Variable placeholders + macro hints (auto-detected)
- Undo / redo
- Zod validation (mirrors the schema rules)

This tool does not generate ZPL. It only produces JSON that the Python compiler consumes.

## Run locally

```bash
npm install
npm run dev
```

## Environment variables

- `VITE_BACKEND_API_BASE` (default: same origin) - Backend base URL for templates and print drafts.
- `VITE_RENDER_API_BASE` (default: `VITE_BACKEND_API_BASE`) - Backend base URL for render calls.
- `VITE_OPERATOR_APP_BASE` (default: `http://localhost:5174`) - Operator UI base URL for print handoff.

## Design constraints (v1)

- Each leaf contains exactly one element.
- Units for padding/thickness/gutter are mm.
- No rotations.

## Extensibility

- Document edits are expressed as pure operations in `src/state/operations.ts`.
- The template shape and validation live in `src/model/types.ts` and `src/model/schema.ts`.
- The canvas is a view over `computeLayout(...)` in `src/model/layout.ts`.

## Notes

- The canvas preview is a layout preview, not a pixel-accurate ZPL renderer.
- For a trustworthy preview, add a backend endpoint that renders via Labelary and show the PNG next to the canvas.
- Placeholders use `{name}` syntax; escape literal braces with `{{` and `}}`.
