# Plan: Remove `ResponseTransformers.ts`

## Background

`ResponseTransformers.ts` provides direct JSON-to-JSON conversion between v1 and v2 dashboard formats. The codebase already has an alternative "Scene-based" pipeline that routes conversions through `DashboardScene`:

- **v1 → v2**: `transformSaveModelToScene` (v1 → Scene) → `transformSceneToSaveModelSchemaV2` (Scene → v2)
- **v2 → v1**: `transformSaveModelSchemaV2ToScene` (v2 → Scene) → `transformSceneToSaveModel` (Scene → v1)

The Scene-based pipeline is already validated to produce equivalent output via `ResponseTransformersToBackend.test.ts` (which confirms frontend/backend parity by routing both paths through Scene).

---

## What `ResponseTransformers.ts` exports

| Export                              | Purpose                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ensureV2Response`                  | Wraps a v1 `DashboardDTO` (or v0 K8s resource) into `DashboardWithAccessInfo<V2Spec>`, converting spec + metadata + access |
| `ensureV1Response`                  | Converts `DashboardWithAccessInfo<V2Spec>` back to `DashboardDTO`                                                          |
| `ResponseTransformers`              | Object containing `{ ensureV2Response, ensureV1Response }`                                                                 |
| `transformDashboardV2SpecToV1`      | Core v2 spec → v1 `DashboardDataDTO` conversion                                                                            |
| `buildPanelKind`                    | Converts a single v1 `Panel` to v2 `PanelKind`                                                                             |
| `getDefaultDatasource`              | Gets default `DataSourceRef` with `apiVersion` (wraps `getDefaultDataSourceRef`)                                           |
| `getPanelQueries`                   | Converts `DataQuery[]` targets to `PanelQueryKind[]`                                                                       |
| `transformMappingsToV1`             | Converts v2 field config mappings/thresholds/colors to v1 enums                                                            |
| `transformAnnotationMappingsV1ToV2` | Converts v1 annotation mappings to v2 format                                                                               |

---

## Import sites and replacement strategies

### 1. `public/app/features/dashboard/services/DashboardLoaderSrv.ts`

**Imports**: `ResponseTransformers` (uses `.ensureV2Response`)

**Usage**: `DashboardLoaderSrvV2` normalizes scripted, public, and snapshot dashboard responses to `DashboardWithAccessInfo<V2Spec>`.

- Line 194: `ResponseTransformers.ensureV2Response(r)` — scripted dashboards
- Line 197: `ResponseTransformers.ensureV2Response(result)` — public dashboards
- Line 238: `ResponseTransformers.ensureV2Response(r)` — snapshots

**Context**: These responses arrive as `DashboardDTO` (v1 format). The loader converts them to v2 so `DashboardScenePageStateManagerV2` can pass them to `transformSaveModelSchemaV2ToScene`.

**Replacement strategy**: Restructure to avoid the intermediate v2 conversion. Instead of:

```
DashboardDTO → ensureV2Response → DashboardWithAccessInfo<V2Spec> → transformSaveModelSchemaV2ToScene → DashboardScene
```

Go directly:

```
DashboardDTO → transformSaveModelToScene → DashboardScene
```

This requires changing `DashboardLoaderSrvV2` to either:

- **(A) Return `DashboardDTO` directly** for scripted/public/snapshot dashboards and have the caller use the v1 → Scene path.
- **(B) Build the Scene directly** in the loader for these cases.
- **(C) Return a union type** (`DashboardDTO | DashboardWithAccessInfo<V2Spec>`) and let callers handle both.

**Recommended approach**: Option **(A)** — Have the loader return a tagged union or discriminated type. The callers (`DashboardScenePageStateManagerV2`) already have access to both `transformSaveModelToScene` and `transformSaveModelSchemaV2ToScene`, so they can dispatch based on the format. The metadata/access wrapping that `ensureV2Response` does (mapping `DashboardDTO.meta` → K8s annotations/labels/access) only matters to `DashboardScenePageStateManagerV2` and can be inlined there.

**Complexity**: Medium. Requires touching `DashboardLoaderSrvV2`, `DashboardScenePageStateManagerV2`, and potentially `DashboardLoaderSrvBase` type signatures.

---

### 2. `public/app/features/dashboard-scene/pages/DashboardScenePageStateManager.ts`

**Imports**: `ensureV2Response`, `transformDashboardV2SpecToV1`

**Usage A** — `transformDashboardV2SpecToV1` (line 176):

```ts
if (isDashboardV2Spec(rsp.dashboard)) {
  rsp.dashboard = transformDashboardV2SpecToV1(rsp.dashboard, { name: '', ... });
}
```

Converts home dashboard v2 spec to v1 because there's no v2 API for home dashboards. The result is then passed to `transformSaveModelToScene`.

**Replacement**: Convert through Scene:

```ts
if (isDashboardV2Spec(rsp.dashboard)) {
  const wrappedV2: DashboardWithAccessInfo<DashboardV2Spec> = {
    apiVersion: 'v2beta1',
    kind: 'DashboardWithAccessInfo',
    metadata: { name: '', generation: 0, resourceVersion: '0', creationTimestamp: '' },
    spec: rsp.dashboard,
    access: {},
  };
  return transformSaveModelSchemaV2ToScene(wrappedV2);
}
```

Since the goal is to build a `DashboardScene`, go directly v2 → Scene using `transformSaveModelSchemaV2ToScene` instead of v2 → v1 → Scene.

**Complexity**: Low. Local change in `fetchHomeDashboard` / `loadHomeDashboard`.

---

**Usage B** — `ensureV2Response` (line 889):

```ts
const v2Response = ensureV2Response(rsp);
const scene = transformSaveModelSchemaV2ToScene(v2Response);
```

Used in `DashboardScenePageStateManagerV2.loadSnapshotScene`. The `rsp` comes from `DashboardLoaderSrvV2.loadSnapshot` which already calls `ensureV2Response` internally, so by the time it reaches this line, the response is already v2. The second `ensureV2Response` is likely a safety no-op.

**Replacement**: Once the loader is changed (see #1), this can be handled by checking the format and dispatching to the right Scene transform. Alternatively, if the snapshot response is already guaranteed v2 from the loader, this call can be removed.

**Complexity**: Low. Depends on loader changes.

---

### 3. `public/app/features/dashboard-scene/saving/getDashboardChanges.ts`

**Imports**: `ResponseTransformers` (uses `.ensureV2Response`)

**Usage** (line 94):

```ts
function convertToV2SpecIfNeeded(initial: DashboardV2Spec | Dashboard): DashboardV2Spec {
  if (isDashboardV2Spec(initial)) {
    return initial;
  }
  const dto: DashboardDTO = { dashboard: initial as DashboardDataDTO, meta: {} };
  return ResponseTransformers.ensureV2Response(dto).spec;
}
```

Normalizes the initial (pre-edit) dashboard to v2 for diffing against the current v2 spec.

**Replacement**: Use Scene pipeline:

```ts
function convertToV2SpecIfNeeded(initial: DashboardV2Spec | Dashboard): DashboardV2Spec {
  if (isDashboardV2Spec(initial)) {
    return initial;
  }
  const dto: DashboardDTO = { dashboard: initial as DashboardDataDTO, meta: {} };
  const scene = transformSaveModelToScene(dto);
  return transformSceneToSaveModelSchemaV2(scene);
}
```

**Note**: This is slightly more expensive (creates a Scene), but this code path only runs when saving (infrequent), so the overhead is acceptable.

**Complexity**: Low. Self-contained change.

---

### 4. `public/app/features/dashboard-scene/scene/export/exporters.ts`

**Imports**: `buildPanelKind`

**Usage** (line 368):

```ts
const fullLibraryPanel = await getLibraryPanel(libraryPanel.uid, true);
const panelModel: Panel = fullLibraryPanel.model;
const inlinePanel = buildPanelKind(panelModel);
```

Converts a library panel's raw `Panel` model to `PanelKind` during dashboard export (inlining library panels).

**Replacement options**:

- **(A) Move `buildPanelKind` to a shared utility** (e.g., `transformToV2TypesUtils.ts` or a new panel conversion utility). This function is purely a Panel → PanelKind mapper and doesn't depend on the rest of ResponseTransformers.
- **(B) Use `vizPanelToSchemaV2`** from `transformSceneToSaveModelSchemaV2.ts`, but this requires a `VizPanel` Scene object, which would mean wrapping the raw Panel in a Scene construct first — more complex than necessary.

**Recommended approach**: **(A)** — Extract `buildPanelKind` (and its dependencies `getPanelQueries`, `getPanelTransformations`, `extractAngularOptions`, `knownPanelProperties`, `getDefaultDatasource`) into a shared utility file. These are pure data transformation functions with no Scene dependency.

**Complexity**: Low-medium. Need to identify and extract the transitive dependencies of `buildPanelKind`.

---

### 5. `public/app/features/dashboard-scene/serialization/sceneVariablesSetToVariables.ts`

**Imports**: `getDefaultDatasource`

**Usage** (lines 444, 531, 559):
Used as a fallback when `variable.state.pluginId` or `variable.state.datasource?.type` is undefined.

**Replacement**: `getDefaultDatasource` is a thin wrapper around `getDefaultDataSourceRef` (already in `transformSceneToSaveModelSchemaV2.ts`) that adds `apiVersion`. Since the callers here only use `.type` (not `.apiVersion`), they can use `getDefaultDataSourceRef().type` directly.

`getDefaultDataSourceRef` is already exported from `transformSceneToSaveModelSchemaV2.ts` and is imported in `ResponseTransformers.ts` itself (line 66).

**Complexity**: Very low. Simple import swap.

---

## Files to delete

| File                                                                      | Reason                                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `public/app/features/dashboard/api/ResponseTransformers.ts`               | Primary target                                                                                      |
| `public/app/features/dashboard/api/ResponseTransformers.test.ts`          | Tests for the removed file                                                                          |
| `public/app/features/dashboard/api/ResponseTransformersToBackend.test.ts` | Compares ResponseTransformers vs Scene pipeline — no longer needed since we only use Scene pipeline |

### Note on `ResponseTransformersToBackend.test.ts`

This test already validates that the Scene pipeline produces equivalent results to ResponseTransformers. Once ResponseTransformers is removed, this test becomes redundant because the Scene pipeline is the only path. However, the **value of the test** (comparing frontend Scene pipeline output with backend conversion output) should be preserved. Consider:

- Renaming it to something like `frontendBackendConversionParity.test.ts`
- Removing the ResponseTransformers references (it doesn't actually import ResponseTransformers — it already uses the Scene pipeline)
- Keeping it as a parity test between frontend and backend conversion

**After review**: `ResponseTransformersToBackend.test.ts` does NOT import from `ResponseTransformers.ts` — it uses `transformSaveModelToScene` and `transformSceneToSaveModelSchemaV2` directly. Its name is misleading. **This file should be renamed, not deleted.**

---

## Functions to relocate

Some exported functions from `ResponseTransformers.ts` are independently useful and should be moved rather than deleted:

| Function                            | Move to                                                                                                   | Used by                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `getDefaultDatasource`              | Can be removed — callers should use `getDefaultDataSourceRef` from `transformSceneToSaveModelSchemaV2.ts` | `sceneVariablesSetToVariables.ts`   |
| `buildPanelKind`                    | New utility file or `transformToV2TypesUtils.ts`                                                          | `exporters.ts`                      |
| `getPanelQueries`                   | Move with `buildPanelKind` (dependency)                                                                   | `buildPanelKind` internally         |
| `transformMappingsToV1`             | Already duplicated in `transformToV1TypesUtils.ts` — consolidate there                                    | Internal to ResponseTransformers    |
| `transformAnnotationMappingsV1ToV2` | Already has counterpart in `annotations.ts` — consolidate                                                 | Internal to ResponseTransformers    |
| `transformDashboardV2SpecToV1`      | Not needed after all callers are updated                                                                  | `DashboardScenePageStateManager.ts` |

---

## Execution plan (ordered steps)

### Phase 1: Extract reusable utilities

1. **Move `buildPanelKind`** and its dependencies (`getPanelQueries`, `getPanelTransformations`, `extractAngularOptions`, `knownPanelProperties`) to a utility file (e.g., `public/app/features/dashboard-scene/serialization/panelV1ToV2Utils.ts` or add to an existing utils file).
2. **Update `exporters.ts`** to import from the new location.
3. **Update `sceneVariablesSetToVariables.ts`** to use `getDefaultDataSourceRef` from `transformSceneToSaveModelSchemaV2.ts` instead of `getDefaultDatasource` from `ResponseTransformers.ts`.

### Phase 2: Replace `ensureV2Response` usages

4. **Update `getDashboardChanges.ts`** to use `transformSaveModelToScene` → `transformSceneToSaveModelSchemaV2` instead of `ResponseTransformers.ensureV2Response`.
5. **Update `DashboardLoaderSrvV2`** to avoid `ensureV2Response` — either return `DashboardDTO` directly for scripted/public/snapshot dashboards, or convert to Scene directly. Update `DashboardScenePageStateManagerV2` accordingly.
6. **Update `DashboardScenePageStateManagerV2.loadSnapshotScene`** to use `transformSaveModelToScene` for v1 snapshot responses instead of `ensureV2Response` → `transformSaveModelSchemaV2ToScene`.

### Phase 3: Replace `transformDashboardV2SpecToV1` / `ensureV1Response` usages

7. **Update `DashboardScenePageStateManager.fetchHomeDashboard`** to use `transformSaveModelSchemaV2ToScene` directly when the home dashboard returns v2 format, instead of converting v2 → v1 → Scene.

### Phase 4: Clean up

8. **Delete `ResponseTransformers.ts`** and **`ResponseTransformers.test.ts`**.
9. **Rename `ResponseTransformersToBackend.test.ts`** to something like `frontendBackendConversionParity.test.ts` (it doesn't import from ResponseTransformers).
10. **Run tests** to verify nothing is broken: `yarn test public/app/features/dashboard/api/ public/app/features/dashboard-scene/`.
11. **Run typecheck**: `yarn typecheck`.

---

## Risks and considerations

1. **Performance**: The Scene pipeline creates full `DashboardScene` objects for conversions. For the `getDashboardChanges` use case (diffing), this adds overhead but only runs on save. For the loader use case, it changes the flow but the Scene is needed anyway.

2. **Metadata/access handling**: `ensureV2Response` maps `DashboardDTO.meta` fields to K8s-style annotations, labels, and access metadata. This mapping logic is not part of the Scene pipeline — it lives only in ResponseTransformers. When removing `ensureV2Response`, this metadata mapping must be preserved somewhere (likely in the callers or in a thin utility).

3. **Snapshot handling**: Snapshots have special handling (snapshot data, `AnnoKeyDashboardIsSnapshot` annotation). Verify that the Scene pipeline handles snapshots correctly after the change.

4. **Public dashboards**: Public dashboard responses may already have v2 specs returned through the legacy API (the `isDashboardV2Spec(dto.dashboard)` check at line 161). This edge case needs to be handled in the replacement.

5. **Scripted dashboards**: These are a legacy feature but still supported. Verify that the v1 → Scene path works for dynamically generated dashboard JSON.

6. **`transformMappingsToV1` duplication**: Both `ResponseTransformers.ts` and `transformToV1TypesUtils.ts` have implementations. Verify they are equivalent before removing the ResponseTransformers version.

---

## Test strategy

- Run existing Scene serialization tests to validate parity
- Run `ResponseTransformersToBackend.test.ts` (renamed) to confirm frontend/backend parity is maintained
- Run dashboard API tests: `yarn test public/app/features/dashboard/api/`
- Run dashboard-scene tests: `yarn test public/app/features/dashboard-scene/`
- Run typecheck: `yarn typecheck`
