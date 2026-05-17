# UX Specification

## Design principles

1. **One screen, one purpose.** No navigation. No tabs. The user is here to do one thing.
2. **The 3D viewport is the app.** Controls hug the edges; the model is always the focus.
3. **Selection should feel like clicking a button.** Click recess → it's selected. No mode switching, no tool palettes.
4. **The export button is always one click away** once the user has at least one selection. Nothing should make them hunt for it.

## Information architecture

A single page with three regions:

```
┌───────────────────────────────────────────────────────────┐
│  Header (logo, file name, "New" button)                   │
├──────────────────────────────────┬────────────────────────┤
│                                  │                        │
│                                  │  Holes panel           │
│        3D viewport               │  ───────────           │
│        (canvas)                  │  [✓] Hole 1   depth ▾  │
│                                  │  [✓] Hole 2   depth ▾  │
│                                  │  [ ] Hole 3   depth ▾  │
│                                  │                        │
│                                  │  Default depth: [2mm]  │
│                                  │                        │
│                                  │  [ Export 3MF ]        │
├──────────────────────────────────┴────────────────────────┤
│  Status bar: triangles, file size, tip text               │
└───────────────────────────────────────────────────────────┘
```

On narrow viewports (<900px) the holes panel collapses into a slide-out drawer triggered from the header.

## States

The app has four top-level states, defined by what the user can see and do:

### 1. Empty

Centered drop zone over a faintly-rendered placeholder. Single CTA: "Drop an STL or click to browse." Below: one sentence explaining the purpose ("Add multi-color regions to a 3D-printable model and export as 3MF.").

### 2. Loading

Drop zone disappears. Spinner with progress for large files (>10 MB). Status: "Parsing 1.2 MB STL…" → "Building mesh…" → "Ready."

### 3. Ready (no selections)

Model visible, orbit/pan/zoom enabled. Holes panel shows: "Click a recessed area to add it as a fill." Export button disabled with tooltip "Add at least one hole to export."

### 4. Active (one or more selections)

Holes panel lists each selection as a row. Each selection renders in the viewport as generated fill geometry: an opaque colored surface at the opening plane, a faint x-ray volume showing depth, and a crisp boundary outline. Export button enabled.

### Error states

- **Parse failed**: toast at top: "Couldn't read that STL. Make sure it's a valid binary or ASCII STL file." Stay in Empty state.
- **No boundary found at click point**: toast: "Couldn't find a recessed region here. Try clicking nearer the center of a flat-bottomed area."
- **Memory pressure** (very large mesh): warning banner: "This model has 2.3M triangles. Performance may be slow." (Non-blocking.)

## The selection interaction (most important detail)

This is the make-or-break interaction. Get it right and the app feels magical; get it wrong and it's frustrating.

### Behavior

- **Hover** over a face on the model: that face gets a subtle highlight (light tint, not a hard outline).
- **Hover dwell** (~150ms) over a face that the algorithm identifies as part of a planar recess: the entire detected recess region tints (showing the user what *would* be selected on click).
- **Click** on a face inside a recess: the recess becomes a permanent selection, gets the next color from the palette, and appears in the holes panel.
- **Click on an already-selected recess**: removes it.
- **Click on the outer surface** (not a recess): nothing happens, status bar shows the tip "Click inside a recessed area to fill it."

### Visual language for selections

- Each selection gets a distinct color from a categorical palette (8 colors, then repeats with a stripe pattern).
- The generated fill cap is rendered near-opaque at the opening plane so the recess reads as filled.
- The fill volume is rendered as a faint x-ray extrusion in the same color so the user can see how deep it goes.
- A subtle wireframe outline traces the generated top cap boundary at full opacity.
- Selected-fill preview meshes do not capture pointer events; clicks still target the original model for add/remove behavior.

### Cursor

- Default: orbit cursor.
- Hovering over a face: pointer.
- Hovering over a detected recess: pointer with a small "+" badge (or "−" if already selected).

## Depth control

Two ways to set depth, used together:

1. **Default depth field** in the holes panel (number input + slider), in mm. Sets the depth applied to newly created fills. Default: 2.0 mm.
2. **Per-hole depth** in each row of the holes panel, with the same number+slider, defaulting to whatever the default depth was at creation time.

When the user drags a depth slider, the corresponding fill solid animates its extrusion in real time. This is the "ah-ha" moment that makes the projection-past-the-floor concept tangible.

Sensible bounds: 0.5 mm minimum (one nozzle layer worth), 20 mm maximum (probably more than any reasonable engraving). No hard validation — let the user go past these if they really want.

## Camera & navigation

- Orbit: left-drag.
- Pan: middle-drag or right-drag (configurable, default middle).
- Zoom: scroll wheel.
- Rotate view left/right 90 degrees: compact viewport buttons near the axis gizmo, or `Q` / `E` keys.
- Frame model: viewport button, double-click empty space, or `F` key.
- Reset view: viewport button, or `R` key.

A small axis gizmo in the bottom-right corner shows orientation; clicking an axis snaps to that view.

## Holes panel details

Each row contains:

- A colored swatch matching the selection color.
- An auto-generated label ("Hole 1", "Hole 2"…). Click to rename.
- A visibility toggle (eye icon) — hides just the colored overlay, not the underlying mesh.
- A depth control.
- A delete button (trash icon, on hover).

Empty state for the panel (no selections): instructional text + a small animation showing a click on a recess.

When selections exist, the panel includes compact bulk tools:

- Undo and redo icon buttons for selection changes.
- Select similar on plane.

The panel title includes a batch edit button. Batch edit mode changes the panel header into a compact action bar:

- Shows how many fills are checked for batch operations.
- Provides All, None, and Invert helpers.
- Adds checkboxes to fill rows.
- Applies Set depth, Show, Hide, and Delete actions only to checked fills.
- Confirms before deleting checked fills.
- Stays in batch edit mode after applying an action so the user can perform several operations on the same subset.

Undo/redo covers adding, removing, visibility changes, renames, per-fill depth changes, bulk select-similar, and batch edits. `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` activate undo/redo when focus is not inside an editable field.

## Export flow

Clicking "Export 3MF":

1. Button disables, shows a spinner: "Building 3MF…"
2. App generates the 3MF in a worker (so the UI stays responsive).
3. Triggers a browser download. Filename: `<original-name>-filled.3mf`.
4. Button re-enables, brief success toast: "Exported. Open in your slicer to assign colors."

No modal, no settings dialog. The user already configured everything before clicking export.

## Reset / "New" flow

The "New" button in the header clears the current session after a confirmation prompt ("Start over? You'll lose your current selections."). Returns to the Empty state.

## What we deliberately don't include in MVP

- **Saving sessions.** No persistence. If the user closes the tab, they start over. This forces the app to be fast enough that starting over isn't painful.
- **Hole auto-detection.** See PRD non-goals.
- **Onboarding tour.** A single example file linked from the empty state ("Try with an example") is enough.
- **Settings/preferences.** Nothing to configure globally beyond the default depth, which is already in the main UI.

## Accessibility notes

- All controls keyboard-accessible; standard focus rings.
- Holes panel is a real list (`<ul>`), each row focusable, with arrow-key navigation and Delete to remove.
- Color is not the only signal: selections also have labels and a wireframe outline. Sufficient for color-vision differences.
- 3D viewport itself is inherently visual — there's no reasonable screen-reader equivalent for "click on a recess." We accept this limit but ensure the rest of the chrome is fully accessible.

## Visual style (loose direction)

- Light, neutral background for the viewport (slightly off-white) — high contrast with both light and dark STL renders.
- Mesh rendered with matte PBR material, soft directional lighting + ambient. No skybox. Subtle ground-plane shadow.
- UI chrome: clean, minimal. Think Linear or Figma's right panel — not a CAD tool's cluttered toolbar.
- One accent color for primary actions; the categorical palette is reserved for hole selections so colors never compete for meaning.
