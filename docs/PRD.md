# Product Requirements: STL Hole Filler

## One-liner

A focused web app that takes an STL of a 3D-printable part, lets the user click on recessed text/logo areas, and exports a multi-part 3MF where each "fill" is a separate solid — ready to assign a different filament color in any modern slicer.

## The problem

Multi-color 3D printing of engraved text/logos is currently a clumsy workflow:

- The user has a single-color STL (e.g., a downloaded keychain, sign, or panel) with recessed text.
- To print the text in a different color, slicers like Bambu Studio require the text region to exist as a **separate part** in the same project.
- Today, users either model the part themselves from scratch, drop in matching text objects and align them by hand, or use the slicer's paint-on-color tool — which only colors *surfaces*, leaving shallow or sloped engravings prone to color bleed-through due to PLA's partial translucency.

There is no quick, model-aware tool that says: "here is the recessed region; give me a solid that fills it and projects past the floor so the color reads opaque."

## Target user

A hobbyist or prosumer 3D printer owner who:
- Owns a multi-material/multi-color capable printer (Bambu X1/P1/A1, Prusa XL/MMU, etc.).
- Downloads STLs from Printables, MakerWorld, Thingiverse rather than modeling from scratch.
- Wants multi-color prints of existing single-color models without learning CAD.
- Already uses a slicer (Bambu Studio, OrcaSlicer, PrusaSlicer) and knows how to assign filaments to parts.

Skill assumption: comfortable with a slicer, not comfortable with Blender/Fusion 360.

## Solution scope

### In scope (MVP)

1. **Load** a single `.stl` file (ASCII or binary) via drag-and-drop or file picker.
2. **Render** the model in an interactive 3D viewport (orbit, pan, zoom).
3. **Select** recessed planar regions by clicking inside them. The app detects the bounding loop of the recess and highlights the selected region.
4. **Configure fill depth** per hole — how far the fill solid extrudes inward from the surface opening, measured along the local surface normal.
5. **Preview** the fill solids in-context with the original mesh, distinguished by color.
6. **Export** a `.3mf` file containing the original mesh as one part and each fill as its own part, packaged so a slicer treats them as components of the same object.

### In scope (v1, post-MVP)

- Multiple holes per session, with a list panel to toggle/edit/delete each.
- Per-hole depth and a global default depth.
- Undo/redo for selection actions.
- Loading via URL (for sharing example files).

### Out of scope

- Non-planar surface depressions (organic dimples, scooped bottoms) — these need surface reconstruction; we are not solving that.
- Through-holes / cylindrical bores — different problem, different algorithm.
- Mesh repair (filling actual topological holes in a broken mesh).
- More than two colors per hole. Each fill is one part; the user assigns one filament to it in the slicer.
- Direct printer integration, slicer integration, or G-code generation.
- Account system, persistence, cloud sync. The app is stateless and session-local.
- Editing the original mesh in any way. The original STL bytes are preserved verbatim where possible.

## Success criteria

A user with a downloaded keychain STL containing recessed text can:

1. Open the app, drop the STL in, see it render correctly within 5 seconds for a typical hobbyist model (<5 MB / <500k triangles).
2. Click on each letter of the recessed text and see it highlighted as a selected hole within 1 second per click.
3. Adjust depth with a slider and see the preview update in real time (target: 60fps for ≤20 active fills on a mid-range laptop).
4. Export a `.3mf` that opens in Bambu Studio with the body and each fill as separate, assignable parts — no manual realignment needed.
5. Print the result and see crisp, opaque text in the accent color with no bleed-through from the body color.

## Key user flow

```
[Drop STL] → [Model renders] → [Click recess] → [Highlight + add to list]
   ↓                              ↑                       ↓
   └─────────── repeat for each desired hole ─────────────┘
                                  ↓
                       [Adjust depth, preview]
                                  ↓
                       [Export 3MF] → [Download]
```

## Non-goals (explicit)

- **We do not aim to make this work on arbitrary STLs.** It targets parts with clean, planar recesses that have well-defined boundary loops. If the engraving is curved-bottomed or the mesh is degenerate, the user should fall back to modeling tools.
- **We do not auto-detect holes.** Selection is user-driven. Auto-detection is a tempting v2 feature but adds significant complexity (heuristics, false positives, UX for confirming detections) and is deferred until we know whether the manual flow is fast enough on its own.
- **We do not preserve color, material, or any other STL metadata** beyond geometry — STL has none anyway.

## Open questions

- **Branding / naming.** Working title is "STL Hole Filler." A friendlier name would help adoption (e.g., "Inlay", "RecessFill", "ColorPocket"). Deferred until MVP works.
- **Distribution.** Static site (GitHub Pages, Cloudflare Pages) is the obvious path given fully-client-side processing. No backend required.
- **Telemetry.** None in MVP; revisit if we want to learn what's failing for users.
