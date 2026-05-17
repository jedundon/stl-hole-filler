# Code Architecture

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build / dev server | **Vite** | Fast HMR, first-class TS, zero config for static deploys. |
| Language | **TypeScript** | Geometry code is the kind of thing where types catch real bugs. |
| UI framework | **React** | Mature, well-paired with Three.js via R3F, lots of off-the-shelf primitives. |
| 3D rendering | **Three.js** via **@react-three/fiber** + **@react-three/drei** | De facto standard. R3F gives a declarative model that maps cleanly to React state (selections, hover, depth). |
| Geometry helpers | **three-mesh-bvh** | Fast raycasting and spatial queries — needed for snappy click-to-select on large meshes. |
| State management | **Zustand** | Light, no boilerplate, plays well with workers. Redux would be overkill. |
| Workers | Native **Web Workers** + **Comlink** | Keeps 3MF building and heavy geometry off the main thread. |
| Styling | **Tailwind CSS** | The UI is sparse; utility classes keep CSS surface area near zero. |
| Hosting | Static (Cloudflare Pages / GitHub Pages) | Fully client-side, no backend. |

### Things deliberately *not* chosen

- **Next.js** — overkill for a single-page client-only app.
- **lib3mf via WASM** — full library is heavy (~MB) and 3MF for our use case is just zipped XML with predictable structure. We roll our own writer.
- **OpenCascade.js / CGAL WASM** — we don't need general CAD ops. Our geometry needs are narrow: planar region detection, boundary loop extraction, prism extrusion.
- **A backend** — see PRD.

## Module structure

```
src/
├── app/                     React shell: layout, providers, route-less single page
│   ├── App.tsx
│   └── providers.tsx
│
├── viewport/                Everything inside the 3D canvas
│   ├── Viewport.tsx         R3F <Canvas>, camera, lighting
│   ├── ModelMesh.tsx        Renders the loaded STL
│   ├── FillOverlay.tsx      Renders the per-selection surface highlight
│   ├── FillSolid.tsx        Renders the per-selection extruded preview
│   ├── HoverHighlight.tsx   Live recess preview on hover
│   └── interaction.ts       Raycasting + click/hover handlers
│
├── panel/                   UI chrome around the viewport
│   ├── HolesPanel.tsx
│   ├── HoleRow.tsx
│   ├── DepthControl.tsx
│   ├── Header.tsx
│   ├── DropZone.tsx
│   └── StatusBar.tsx
│
├── geometry/                Pure geometry logic, no React, no Three.js scene
│   ├── stl/
│   │   ├── parser.ts        Binary + ASCII STL parsing → indexed BufferGeometry
│   │   └── normalize.ts     Weld duplicate vertices, build adjacency
│   ├── recess/
│   │   ├── detect.ts        Given a click hit, find the connected recessed region
│   │   ├── boundary.ts      Extract the boundary loop of the region
│   │   └── plane.ts         Fit the "opening plane" from the loop + surrounding faces
│   └── fill/
│       └── extrude.ts       Build the inward-extruded prism mesh from a loop + depth
│
├── export/
│   ├── 3mf/
│   │   ├── writer.ts        Build the OPC zip with model XML + content types
│   │   ├── model-xml.ts     Build 3D Manufacturing XML for n parts
│   │   └── relationships.ts
│   └── exportFlow.ts        Orchestrates the export, calls into a worker
│
├── workers/
│   ├── export.worker.ts     Hosts export/3mf/* off the main thread
│   └── geometry.worker.ts   Hosts geometry/recess/* if profiling shows main thread blocking
│
├── state/
│   ├── store.ts             Zustand store: model, selections, defaults, ui flags
│   └── selectors.ts
│
├── lib/
│   ├── palette.ts           Categorical color palette for selections
│   └── filename.ts          Derives export filename from input
│
└── main.tsx
```

## Data flow

```
File drop
   │
   ▼
parser.ts → THREE.BufferGeometry (positions, indices, normals)
   │
   ▼
normalize.ts → indexed, welded mesh + face-adjacency map
   │                                  │
   ▼                                  ▼
state.model                state.adjacency (used by recess detect)
   │
   ▼
Viewport renders <ModelMesh> + builds BVH (three-mesh-bvh)
   │
   ▼
User hovers/clicks → interaction.ts raycasts → faceIndex
   │
   ▼
recess/detect.ts: flood-fill faces from faceIndex, gated by
                   normal similarity + planarity tolerance
   │
   ▼
recess/boundary.ts: walk boundary edges → ordered loop of vertices
   │
   ▼
recess/plane.ts: fit a plane from the loop vertices + a ring of
                  faces outside the loop (the "outer surface")
   │
   ▼
state.selections.push({ loop, plane, depth, color, id })
   │
   ▼
FillOverlay (uses face set) + FillSolid (uses extrude.ts)
   ▼
On export: workers/export.worker.ts assembles 3MF from
            state.model.geometry + selections.map(extrude)
   ▼
Browser download
```

## Key algorithms

### 1. Recess detection from a click

**Input**: face index that the ray hit, the mesh, the face-adjacency map.

**Output**: a set of face indices belonging to one connected recessed region.

**Approach**:
1. The clicked face is assumed to be on the *floor* of the recess.
2. Compute its normal `n0`.
3. BFS over adjacent faces. Include a neighbor if:
   - Its normal is within ~10° of `n0` (the recess floor is approximately planar).
   - The dihedral angle between the two faces is less than a wall threshold (~30°). Crossing a sharp edge means we've hit a wall of the recess.
4. Stop when the BFS frontier is exhausted. The collected set is the floor region.

Tolerances are constants we'll tune; expose them in dev-mode only.

### 2. Boundary loop extraction

**Input**: the set of face indices from (1).

**Output**: a list of closed loops on the original mesh — **one outer loop plus zero or more inner loops** (the islands). For typical engraved text like a 'B', 'A', 'D', 'O', 'P', 'Q', 'R', expect 2–3 loops; for letters like 'I', 'L', 'C', expect one.

**Approach**:
1. Build a half-edge representation over the face set.
2. Collect all boundary edges — edges used by exactly one face *within the set*. (Their other side belongs to a face outside the set: a recess wall or, for islands, the wall around the island.)
3. Walk boundary edges to form closed cycles. Keep walking and starting new cycles until every boundary edge is consumed. A face set with N islands yields N+1 cycles naturally.
4. **Reject if not a real recess.** Sample the dihedral angle across each boundary edge (between the inside face and its outside neighbor). For a real recess every boundary edge has a sharp wall (~90°). For a misclick on the outer surface, only silhouette edges exist with shallow dihedrals. If the average dihedral is below ~30°, the click was not on a recess — return no selection and show the "click inside a recessed area" tip.

### 2a. Outer vs inner loop classification

**Input**: the list of closed loops from (2), plus the opening plane (computed in step 3).

**Output**: one loop marked as **outer**, the rest marked as **holes**.

**Approach**:
1. Project every loop's vertices into 2D coordinates on the opening plane.
2. Compute the signed area of each loop. The loop with the largest absolute area is the outer loop. (For valid recesses this is always true — an island can't be larger than the floor that contains it.)
3. As a sanity check, verify every other loop's centroid lies *inside* the outer loop in 2D (standard point-in-polygon). If a loop fails this check the recess is non-simply-connected in a way we don't support; warn and skip.
4. Normalize winding: outer loop CCW, inner loops CW (signed-area test → reverse if needed). This is the convention earcut expects in step 4, and it also makes side-wall winding consistent.

### 3. Opening plane fit

**Input**: the boundary loop, plus a one-ring of faces *outside* the recess.

**Output**: a plane (point + normal) representing the surface at the opening.

**Why we don't just use the floor plane**: the floor might be tilted relative to the actual outer surface (the engraving could be on a curved or angled face). We want to extrude *inward into the body*, i.e., opposite the outer surface normal — not opposite the floor normal.

**Approach**:
1. Take the one-ring of faces just outside the boundary loop.
2. Average their normals (area-weighted) to get the outer-surface normal `n_out`.
3. Fit a plane through the boundary loop vertices, oriented so its normal aligns with `n_out`. (Least-squares plane fit; SVD on the centroid-relative vertex matrix.)
4. The extrusion direction is `-n_out` (inward).

### 4. Inward prism extrusion

**Input**: outer loop + zero or more inner loops (all 3D points), opening plane, depth `d`.

**Output**: a watertight triangle mesh — a single solid prism with islands properly carved out.

**Approach**:
1. Project every loop vertex onto the opening plane — these form the **top rings** (one outer, N inner).
2. Translate every top-ring vertex by `-n_out * d` to form the corresponding **bottom rings**.
3. **Top cap**: triangulate using earcut's polygon-with-holes mode — `earcut(outer2D, holeIndices, 2)` where `holeIndices` marks where each inner loop begins in the flattened vertex array. Outer is CCW, holes are CW (enforced in step 2a).
4. **Bottom cap**: identical triangulation, but reference the bottom-ring vertices and flip winding.
5. **Outer side walls**: quad strip between the outer top ring and the outer bottom ring, split into triangles. Winding is set so the wall normals point *outward* from the prism volume.
6. **Inner side walls**: quad strip for each inner loop between its top and bottom rings, with winding *reversed* compared to the outer walls — the inner walls' normals point *inward toward the hole*, i.e., still outward relative to the prism's solid volume.
7. Verify watertightness: every edge in the final mesh should be used by exactly two triangles. Assert in dev, log + best-effort in prod.

The top cap sits flush with the outer surface; the bottom cap sits inside the body, well below the floor of the recess. The overlap with the original mesh is intentional — slicers resolve this by giving the fill part's color priority in the overlap region.

For a typical engraved letter, expect ~2–4× the triangle count of a single-loop prism, which is still trivially small (the heavy mesh is always the original body, not the fills).

### 5. 3MF assembly

3MF is an OPC (Open Packaging Conventions) zip with a specific layout:

```
filled.3mf  (zip)
├── [Content_Types].xml
├── _rels/.rels
└── 3D/
    ├── 3dmodel.model    ← XML with <object> per part, <build> with <item>s
    └── _rels/
        └── 3dmodel.model.rels
```

**Per-part structure** in `3dmodel.model`:
- `<resources>` contains one `<object>` per part (original body + each fill).
- Each `<object>` has its own `<mesh>` with `<vertices>` and `<triangles>`.
- A `<build>` block references all parts via `<item>` with **identity transforms**. Critical: all parts share the same coordinate system so the slicer loads them already aligned.
- Each part gets a unique `id`. The body uses `partnumber="body"`; fills use `partnumber="fill-1"`, `fill-2`, …, which becomes the user-visible name in Bambu Studio.

**What we don't put in**:
- Materials/colors. We could write `<basematerials>` to suggest colors, but slicers ignore or remap these inconsistently. Cleaner to let the user assign filaments in their slicer.
- Thumbnails. Nice-to-have, not needed for MVP.
- Metadata beyond a `<metadata name="Application">STL Hole Filler</metadata>` line.

The writer streams into a zip via [fflate](https://github.com/101arrowz/fflate) (small, fast, no deps).

## Performance considerations

- **BVH on load**: `three-mesh-bvh` `computeBoundsTree()` on the mesh once after parsing. Makes raycasts O(log n) instead of O(n). Without it, click-to-select on a 500k-tri mesh is unusable.
- **Adjacency map** built once at load and reused for all detection calls. Storing as `Uint32Array`s per-face is cache-friendly and ~1/3 the memory of object representations.
- **Hover dwell** is debounced (150ms) so detection doesn't fire on every mouse move.
- **Recess detection** is bounded by the number of faces in the recess, not the whole mesh — fast even on big models.
- **Export** runs in a worker. Geometry serialization for transfer uses transferable `ArrayBuffer`s, not structured cloning.
- **Memory budget**: target a 200k-triangle mesh (~24 MB of float32 positions + normals) plus adjacency (~5 MB) plus BVH (~10 MB). Comfortable on any modern laptop; the warning banner appears above ~1M triangles.

## State shape (Zustand)

```ts
interface Store {
  // File
  fileName: string | null;
  model: {
    geometry: THREE.BufferGeometry;     // welded, indexed
    adjacency: Uint32Array;             // face-to-face neighbors
    bvh: MeshBVH;
  } | null;

  // Selections
  selections: Selection[];
  hoveredFaceIndex: number | null;
  hoverPreviewFaces: Set<number> | null; // candidate region under cursor

  // Defaults
  defaultDepth: number; // mm

  // UI
  isExporting: boolean;
  warning: string | null;

  // Actions
  loadFile: (file: File) => Promise<void>;
  addSelectionFromFace: (faceIndex: number) => void;
  removeSelection: (id: string) => void;
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  exportToFile: () => Promise<void>;
  reset: () => void;
}

interface Selection {
  id: string;
  label: string;             // "Hole 1", user-editable
  faceIndices: number[];     // floor faces (for overlay rendering)
  outerLoop: number[];       // vertex indices, ordered CCW in opening plane
  innerLoops: number[][];    // vertex indices for each island, ordered CW
  plane: { origin: Vector3; normal: Vector3 };
  depth: number;             // mm
  color: string;             // hex from palette
  visible: boolean;
}
```

## Testing strategy

- **Geometry units** (`geometry/**`): pure functions, plain Vitest tests. Test fixtures = small hand-built meshes:
  - Cube with a recessed square on one face — single-loop baseline.
  - Cube with a recessed 'B' on one face — canonical multi-loop / island case. The recess detection should yield three boundary loops (outer 'B' silhouette + two counter islands), and the extrusion should produce a single watertight prism with the two counters carved out.
  - Cube with a recessed 'O' — single-island case to catch off-by-one errors in the multi-loop code that pass on 'B' (since N=2 islands can mask N=1 bugs).
  - Wedge with a slanted recess — exercises the opening-plane fit vs floor-plane distinction.
  - Two close recesses — exercises overlapping fill prisms.
  - Click on the outer surface — exercises the "not a recess" rejection check (asserts no selection is created).
- **3MF writer**: write a 3MF, unzip it in the test, validate XML against the 3MF schema, and verify that the geometry round-trips.
- **End-to-end smoke**: Playwright test loads a fixture STL, clicks a known recess centroid, asserts a selection appears, clicks export, and validates the downloaded 3MF byte length and inner structure.
- **Visual regression** for the viewport is *not* in MVP — too brittle, low ROI for a single-screen app.
- **Manual validation in Bambu Studio** is the real acceptance test, done per PR for any changes to `export/3mf/` or `geometry/fill/`.

## Open technical questions

- **Self-intersecting fills.** If two selected recesses are very close, their extruded prisms might overlap each other. Slicers handle this fine (it's one part absorbing the other in the overlap), but we should at least surface a notice.
- **Detection on curved outer surfaces.** When the engraving is on a barrel/cylinder, the "outer surface normal" varies around the boundary loop. The current plan averages — good enough for gently curved surfaces, will start failing on tight curvatures. Worth profiling early on real downloaded models before over-engineering a per-vertex extrusion direction.
- **Loop simplification.** Boundary loops from triangle meshes often have hundreds of micro-segments. Extruding all of them produces a heavy fill mesh. We may want a Douglas-Peucker pass with a small tolerance (e.g., 0.05 mm) before extrusion. Defer until we see real export sizes.
