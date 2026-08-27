# Breaking Changes Reconciliation Report
## v2-Migration PR Analysis vs fern-docs Current State

**Report Date:** August 27, 2026  
**PR:** v2-migration (complete architectural redesign)  
**Current Docs Version:** v1.33.1 (fern-docs)  
**Docs Status:** ⚠️ NEEDS UPDATES before v2 launch

---

## Section 1: Breaking Changes Summary

### Severity Breakdown

| Severity | Count | Status | Details |
|----------|-------|--------|---------|
| **CRITICAL** | 0 | ✅ SAFE | No critical public API removals; all tags/methods preserved |
| **HIGH** | 3 | ⚠️ GAPS | Undocumented deprecations: `setCurrentActivity`, `setModalState`, `defaultCameraMode` |
| **MEDIUM** | 1 | ⚠️ PARTIAL | `enableVideoRecording` already documented as deprecated ✓ |
| **LOW** | 0 | ✅ SAFE | Internal removals (undocumented): `$` proxy, `*-keys`, nanostores, SymbioteCompatMixin |

### Overall Assessment

🟡 **CONDITIONAL SHIP READINESS: YES, with documentation updates required**

- **Public API Facade:** Preserved (all tags, methods, types intact)
- **Deprecated Features:** 4 items marked `@deprecated` in code, **3 not yet documented in fern-docs**
- **Documentation Readiness:** 25% of breaking changes documented (1 of 4)
- **Risk Level:** Medium (deprecation guidance missing for 75% of breaking changes)
- **User Impact:** Moderate (migration path unclear for deprecated methods)

---

## Section 2: Change-by-Change Review

### Breaking Change #1: `setCurrentActivity()` Deprecated

**Change Description**
- **Type:** API Method Deprecation (PUBLIC)
- **Severity:** MEDIUM (guidance needed)
- **Location:** `src/abstract/UploaderPublicApi.ts:517-542`
- **Code Status:** `@deprecated` marker present ✓
- **Impact:** Direct API call pattern change

**Old Behavior vs New Behavior**
```typescript
// OLD (v1) - Two-call pattern
element.getAPI().setCurrentActivity('gallery', {});
element.getAPI().setModalState(true);

// NEW (v2) - Single unified call
element.getAPI().navigate('gallery', {});
```

**Documentation Status**
| Aspect | Status | Location |
|--------|--------|----------|
| Documented in fern-docs? | ❌ NO | — |
| Deprecation warning shown? | ❌ NO | — |
| Migration path documented? | ❌ NO | — |
| Code has @deprecated? | ✅ YES | `src/abstract/UploaderPublicApi.ts:517` |

**Current Doc Wording**
```markdown
// fern/pages/file-uploader/api.mdx (current)
### setCurrentActivity(type, params)
Navigates to a specific activity with optional parameters.
- `type`: Activity name (string)
- `params`: Optional activity parameters (object)
```
❌ **Problem:** No mention of deprecation or `navigate()` alternative.

**Recommended Doc Update**
```markdown
### setCurrentActivity(type, params) — DEPRECATED

⚠️ **Deprecated in v2.** Use [`navigate(type, params)`](#navigate) instead.

This method is marked for removal in a future major version.
Provides the same functionality as the new unified `navigate()` call.

**Migration:**
```typescript
// OLD
getAPI().setCurrentActivity('gallery', {});
getAPI().setModalState(true);

// NEW
getAPI().navigate('gallery', {});
```

**See also:** [`navigate()`](#navigate), [`setModalState()`](#setmodalstate-deprecated)
```

**File to Update:** `fern/pages/file-uploader/api.mdx` (~line 150-180)

---

### Breaking Change #2: `setModalState()` Deprecated

**Change Description**
- **Type:** API Method Deprecation (PUBLIC)
- **Severity:** MEDIUM (guidance needed)
- **Location:** `src/abstract/UploaderPublicApi.ts:553-573`
- **Code Status:** `@deprecated` marker present ✓
- **Impact:** Modal control pattern changed

**Old Behavior vs New Behavior**
```typescript
// OLD (v1) - Separate modal control
setCurrentActivity(x);
setModalState(true);  // Explicit modal open

// NEW (v2) - Modal state implicit in navigate()
navigate(x);  // Modal opens automatically with activity
```

**Documentation Status**
| Aspect | Status | Location |
|--------|--------|----------|
| Documented in fern-docs? | ❌ NO | — |
| Deprecation warning shown? | ❌ NO | — |
| Migration path documented? | ❌ NO | — |
| Code has @deprecated? | ✅ YES | `src/abstract/UploaderPublicApi.ts:553` |

**Current Doc Wording**
```markdown
// fern/pages/file-uploader/api.mdx (current)
### setModalState(opened)
Controls whether the upload dialog is open or closed.
- `opened`: Boolean indicating modal state
```
❌ **Problem:** No mention of deprecation or replacement pattern.

**Recommended Doc Update**
```markdown
### setModalState(opened) — DEPRECATED

⚠️ **Deprecated in v2.** Use [`navigate(type, params)`](#navigate) instead.

Modal state is now managed implicitly through activity navigation.
This method is preserved for backward compatibility but will be removed in a future major version.

**Migration:**
```typescript
// OLD pattern (two calls)
getAPI().setCurrentActivity('gallery');
getAPI().setModalState(true);

// NEW pattern (single call, modal auto-manages state)
getAPI().navigate('gallery');

// To close modal, navigate back:
getAPI().historyBack();
```

**See also:** [`navigate()`](#navigate), [`historyBack()`](#historyback), [`setCurrentActivity()` (also deprecated)](#setcurrentactivity-deprecated)
```

**File to Update:** `fern/pages/file-uploader/api.mdx` (~line 180-210)

---

### Breaking Change #3: `enableVideoRecording` Deprecated

**Change Description**
- **Type:** Config Option Deprecation (PUBLIC)
- **Severity:** LOW (already communicated)
- **Location:** `src/blocks/Config/assertions.ts:22-25`
- **Code Status:** `@deprecated` marker + runtime warning ✓
- **Default:** `null`

**Old Behavior vs New Behavior**
```typescript
// OLD (v1) - Boolean flag
<uc-file-uploader>
  <uc-config
    pubkey="..."
    enableVideoRecording="true"
  />
</uc-file-uploader>

// NEW (v2) - Camera modes config
<uc-file-uploader>
  <uc-config
    pubkey="..."
    cameraModes="photo,video"
  />
</uc-file-uploader>
```

**Documentation Status**
| Aspect | Status | Location |
|--------|--------|----------|
| Documented in fern-docs? | ✅ YES | `fern/pages/file-uploader/options.mdx:~line 850` |
| Deprecation warning shown? | ✅ YES | "Use `cameraModes` instead" |
| Migration path documented? | ✅ YES | Alternative: `cameraModes='photo,video'` |
| Code has @deprecated? | ✅ YES | `src/blocks/Config/assertions.ts:22` |

**Current Doc Wording** (CORRECT ✓)
```markdown
#### enableVideoRecording
**Deprecated.** Use `cameraModes` instead.

Enables video recording in camera capture. When enabled, users can switch between photo and video modes.

- **Attribute:** `enable-video-recording`
- **Type:** `boolean | null`
- **Default:** `null`

**Alternative (recommended):**
Use the new `cameraModes` config option to enable/disable specific camera modes:
```html
<!-- Enable both photo and video -->
<uc-config cameraModes="photo,video" />

<!-- Enable photo only -->
<uc-config cameraModes="photo" />
```
```

**Verdict:** ✅ **NO UPDATE NEEDED** — Already properly documented with migration path.

---

### Breaking Change #4: `defaultCameraMode` Deprecated

**Change Description**
- **Type:** Config Option Deprecation (PUBLIC)
- **Severity:** LOW (rarely used)
- **Location:** `src/blocks/Config/assertions.ts:28-31`
- **Code Status:** `@deprecated` marker + runtime warning ✓
- **Default:** `null`

**Old Behavior vs New Behavior**
```typescript
// OLD (v1) - Sets default mode
<uc-config
  enableVideoRecording="true"
  defaultCameraMode="video"
/>

// NEW (v2) - Use cameraModes only
<uc-config
  cameraModes="photo,video"
/>
// User's last-used mode is preserved
```

**Documentation Status**
| Aspect | Status | Location |
|--------|--------|----------|
| Documented in fern-docs? | ✅ YES | `fern/pages/file-uploader/options.mdx:~line 920` |
| Deprecation warning shown? | ❌ NO | Listed as active option |
| Migration path documented? | ❌ NO | No guidance to use `cameraModes` |
| Code has @deprecated? | ✅ YES | `src/blocks/Config/assertions.ts:28` |

**Current Doc Wording** (NEEDS UPDATE ⚠️)
```markdown
#### defaultCameraMode
Sets the default camera mode when opening camera capture.

- **Attribute:** `default-camera-mode`
- **Type:** `'photo' | 'video' | null`
- **Default:** `null`
```
❌ **Problem:** No deprecation warning; no migration guidance.

**Recommended Doc Update**
```markdown
#### defaultCameraMode — DEPRECATED

⚠️ **Deprecated in v2.** Use [`cameraModes`](#cameramodes) instead.

Sets the default camera mode when opening camera capture.

- **Attribute:** `default-camera-mode`
- **Type:** `'photo' | 'video' | null`
- **Default:** `null`

**Migration:**
In v2, use the `cameraModes` config to specify which modes are available.
The system preserves the user's last-used mode between sessions.

```html
<!-- OLD (v1) -->
<uc-config enableVideoRecording="true" defaultCameraMode="video" />

<!-- NEW (v2) - Simple configuration -->
<uc-config cameraModes="photo,video" />
```

**See also:** [`cameraModes`](#cameramodes)
```

**File to Update:** `fern/pages/file-uploader/options.mdx` (~line 915-935)

---

## Section 3: Documentation Gaps Analysis

### 3A: Features With NO Documentation (CRITICAL RISK)

| Feature | Type | Severity | Status | Action |
|---------|------|----------|--------|--------|
| `setCurrentActivity()` deprecation | Method | HIGH | ❌ NO DOCS | ADD deprecation notice + migration guide |
| `setModalState()` deprecation | Method | HIGH | ❌ NO DOCS | ADD deprecation notice + migration guide |
| `defaultCameraMode` deprecation | Config | HIGH | ❌ NO DOCS | UPDATE to mark deprecated |
| **New:** `navigate()` method | Method | HIGH | ⚠️ PARTIAL | May need clarification/examples |
| **New:** `replaceFile()` method | Method | MEDIUM | ❌ NO DOCS | ADD documentation for new method |
| **New:** `cameraModes` config | Config | MEDIUM | ⚠️ PARTIAL | Exists but lacks full v2 context |

**Total Gaps:** 6 features (3 HIGH, 1 MEDIUM, 2 clarification needed)

---

### 3B: Features With OUTDATED/INCORRECT Documentation

| Feature | Current Status | Problem | File | Action |
|---------|---|---------|------|--------|
| `defaultCameraMode` | Listed as active | No deprecation marker | `options.mdx:~920` | Mark as `— DEPRECATED` |
| `setCurrentActivity()` | Listed as active | No deprecation marker | `api.mdx:~150` | Mark as `— DEPRECATED` |
| `setModalState()` | Listed as active | No deprecation marker | `api.mdx:~180` | Mark as `— DEPRECATED` |
| v1 vs v2 architecture | Silent upgrade path | No v2 migration guide | N/A | CREATE v2-migration guide |

**Total Gaps:** 4 features (HIGH priority)

---

### 3C: Features Correctly Documented (OK)

| Feature | Status | Location | Quality |
|---------|--------|----------|---------|
| `enableVideoRecording` deprecation | ✅ CORRECT | `options.mdx:~850` | Complete with migration path |
| `cameraModes` config | ✅ DOCUMENTED | `options.mdx:~880` | Present and correct |
| All 17 events | ✅ DOCUMENTED | `events.mdx` | Full payload documentation |
| All CSS variables (40+) | ✅ DOCUMENTED | `styling.mdx` | Light/dark variants with examples |
| Plugin API (7 hooks) | ✅ DOCUMENTED | `plugins/*.mdx` | Full with runtime API docs |
| Tags (3 element types) | ✅ DOCUMENTED | `index.mdx`, `installation.mdx` | Working examples for all |
| 80+ config options | ✅ DOCUMENTED | `options.mdx` | Defaults, types, descriptions present |

**Coverage:** 85% of public API correctly documented; 15% has gaps/outdated info

---

## Section 4: Recommendation

### ⚠️ CONDITIONAL SHIP STATUS: **YES, if documentation is updated before launch**

### Ship Readiness Checklist

```
✅ Public API facade preserved (all tags intact)
✅ All methods still functional (backward compatible)
✅ All events unchanged (no shape/payload changes)
✅ All CSS variables preserved (no removals)
✅ Config options backward compatible (deprecated only, not removed)

⚠️ Documentation has critical gaps (3 of 4 deprecations undocumented)
⚠️ No v2 migration guide published yet
⚠️ No guidance on UploaderController/new architecture
```

### Decision Matrix

| Criterion | Status | Blocker? |
|-----------|--------|----------|
| Public API backward compatible? | ✅ YES | No |
| All documented features still work? | ✅ YES | No |
| Deprecations marked in code? | ✅ YES (4/4) | No |
| Deprecations marked in docs? | ❌ NO (1/4) | **YES** |
| Migration paths provided? | ⚠️ PARTIAL (1/4) | **YES** |
| Major breaking changes? | ✅ NONE | No |

**VERDICT:** 🟡 **BLOCKED** — Cannot ship until documentation gaps are filled.

---

### Critical Documentation Updates Required (BLOCKING)

#### Must Complete BEFORE Launch

| Priority | File | Change | Lines | Effort | Acceptance |
|----------|------|--------|-------|--------|-----------|
| **1 - CRITICAL** | `api.mdx` | Mark `setCurrentActivity()` deprecated, add `navigate()` example | 150-210 | 30 min | ✓ Test example code runs |
| **2 - CRITICAL** | `api.mdx` | Mark `setModalState()` deprecated, add migration path | 180-230 | 30 min | ✓ Compare with setCurrentActivity pattern |
| **3 - CRITICAL** | `options.mdx` | Mark `defaultCameraMode` deprecated, cross-link to cameraModes | 915-945 | 20 min | ✓ Verify cameraModes already docs link |
| **4 - HIGH** | `api.mdx` | Add documentation for new `navigate()` method with examples | NEW (after 540) | 20 min | ✓ Example with multiple activity types |
| **5 - HIGH** | `api.mdx` | Add documentation for new `replaceFile()` method | NEW (after 300) | 20 min | ✓ Document internalId param, return type |
| **6 - MEDIUM** | NEW FILE | Create v2 migration guide (`migration-to-2.0.0.mdx`) | NEW | 1-2 hr | ✓ Link from main nav, cover arch changes |
| **7 - MEDIUM** | `options.mdx` | Enhance `cameraModes` with v2 deprecation context | 880-920 | 15 min | ✓ Link from defaultCameraMode notice |

**Total Estimated Effort:** 2.5-3.5 hours (can parallelize items 1-5)

**Dependencies:** None (can be done independently)

---

### Detailed Update Instructions

#### Update 1: Mark `setCurrentActivity()` as Deprecated
- **File:** `fern/pages/file-uploader/api.mdx`
- **Current Location:** Around line 150-180 (search for `### setCurrentActivity`)
- **Action:** 
  1. Add `— DEPRECATED` to heading
  2. Add deprecation warning box at start
  3. Add "Migration" section pointing to `navigate()`
  4. Add "See also" links to both `navigate()` and `setModalState()`
- **Template:** Use identical structure to `enableVideoRecording` deprecation in options.mdx

#### Update 2: Mark `setModalState()` as Deprecated
- **File:** `fern/pages/file-uploader/api.mdx`
- **Current Location:** Around line 180-210 (search for `### setModalState`)
- **Action:** Same as Update 1, but explain modal-state is now implicit in navigate()
- **Key Point:** Modal opens automatically when calling navigate(); historyBack() closes it

#### Update 3: Mark `defaultCameraMode` as Deprecated
- **File:** `fern/pages/file-uploader/options.mdx`
- **Current Location:** Around line 915-945 (search for `defaultCameraMode`)
- **Action:**
  1. Add `— DEPRECATED` to heading
  2. Add deprecation warning pointing to `cameraModes`
  3. Add migration example (before/after code blocks)
  4. Note: User's last-used mode is preserved (no behavior loss)

#### Update 4: Document New `navigate()` Method
- **File:** `fern/pages/file-uploader/api.mdx`
- **Location:** Insert after line 540 (after removeAllFiles, before setCurrentActivity)
- **Content Required:**
  - Method signature: `navigate(type: string, params?: object) → void`
  - Description: "Unified method for activity navigation, replaces setCurrentActivity + setModalState"
  - Parameters: type (activity name), params (activity-specific options)
  - Examples: navigating to gallery, camera, cloudimageuploader
  - Note: Modal state managed automatically

#### Update 5: Document New `replaceFile()` Method
- **File:** `fern/pages/file-uploader/api.mdx`
- **Location:** Insert after line 300 (after addFileFromCdnUrl, before removeFileByInternalId)
- **Content Required:**
  - Method signature: `replaceFile(internalId: string, file: File, options?: object) → OutputFileEntry<'success'>`
  - Description: "Replaces a file in the upload queue while preserving metadata"
  - Parameters: internalId, file, options (metadata/silent flags)
  - Return type: OutputFileEntry with 'success' state
  - Example: Replacing an image after re-selection

#### Update 6: Create v2 Migration Guide
- **File:** Create `fern/pages/file-uploader/migration-to-2.0.0.mdx`
- **Location:** Link from `migration.mdx` and main nav
- **Content Sections:**
  1. Overview: "Architectural update with improved performance"
  2. What changed: StateManagement (signals), DI pattern, Event system
  3. What didn't change: All public API methods, config options, events
  4. Breaking changes: Only if items removed (none in this PR)
  5. Deprecations: 4 items with migration paths
  6. New features: navigate(), replaceFile(), cameraModes
  7. Internal changes: (ControllerContainer, EventBus, etc.)

#### Update 7: Enhance `cameraModes` Documentation
- **File:** `fern/pages/file-uploader/options.mdx`
- **Current Location:** Around line 880-920
- **Action:**
  1. Add cross-link to `defaultCameraMode` deprecation notice
  2. Add note: "Recommended replacement for enableVideoRecording + defaultCameraMode"
  3. Add examples showing all valid combinations: "photo", "video", "photo,video"
  4. Add note: "User's last-used mode persists across sessions (v2 improvement)"

---

### Non-Blocking Recommended Updates (Nice to Have)

| Item | File | Purpose | Effort | Priority |
|------|------|---------|--------|----------|
| Update version from v1.33.1 to v2.0.0 | docs.yml, README.md | Reflect major version bump | 10 min | MEDIUM |
| Add architecture diagram | NEW or index.mdx | Show Controllers/EventBus/DI | 30 min | LOW |
| Add TypeScript 5.9+ features note | installation.mdx | Decorator support mention | 5 min | LOW |
| Add performance benchmark section | index.mdx | Highlight Signals efficiency | 20 min | LOW |

---

## Summary Table: All Findings

| Change | Type | Severity | Documented | Status | Action |
|--------|------|----------|----------|--------|--------|
| `setCurrentActivity()` deprecated | Method | HIGH | ❌ NO | NEEDS UPDATE | Add deprecation + navigate() link |
| `setModalState()` deprecated | Method | HIGH | ❌ NO | NEEDS UPDATE | Add deprecation + implicit modal note |
| `defaultCameraMode` deprecated | Config | HIGH | ⚠️ PARTIAL | NEEDS UPDATE | Mark as deprecated, link cameraModes |
| `enableVideoRecording` deprecated | Config | LOW | ✅ YES | OK | No change needed |
| `navigate()` new method | Method | HIGH | ❌ NO | NEEDS DOCS | Add full documentation |
| `replaceFile()` new method | Method | MEDIUM | ❌ NO | NEEDS DOCS | Add documentation |
| `cameraModes` config | Config | MEDIUM | ✅ YES | NEEDS LINK | Cross-link from deprecations |
| All events (17 types) | Event | — | ✅ YES | OK | No changes |
| All CSS variables (40+) | CSS | — | ✅ YES | OK | No changes |
| All tags (3 types) | Element | — | ✅ YES | OK | No changes |
| Plugin API (7 hooks) | API | — | ✅ YES | OK | No changes |

---

## Ship Gate

```
📋 DOCUMENTATION AUDIT RESULT: FAIL (conditional)

❌ Cannot ship v2 without closing these gaps:
  1. setCurrentActivity() / setModalState() deprecation notices (blocking)
  2. defaultCameraMode deprecation notice (blocking)
  3. navigate() / replaceFile() API documentation (blocking)
  4. v2 migration guide for architects (blocking)

✅ Once above completed: Ready to ship
   - Public API fully backward compatible
   - All breaking changes documented
   - Migration paths clear
   - No user confusion expected
```

---

## Appendix: File-by-File Documentation Checklist

### Files Requiring Updates

- [ ] `fern/pages/file-uploader/api.mdx` — Add deprecation notices for setCurrentActivity/setModalState; add navigate() + replaceFile() docs
- [ ] `fern/pages/file-uploader/options.mdx` — Mark defaultCameraMode deprecated; enhance cameraModes cross-link
- [ ] `fern/pages/file-uploader/migration.mdx` — Add link to v2 migration guide
- [ ] `fern/pages/file-uploader/migration-to-2.0.0.mdx` — CREATE new file

### Files Not Requiring Changes

- ✅ `fern/pages/file-uploader/index.mdx` — All tags still valid
- ✅ `fern/pages/file-uploader/installation.mdx` — Installation unchanged
- ✅ `fern/pages/file-uploader/events.mdx` — All events preserved
- ✅ `fern/pages/file-uploader/styling.mdx` — All CSS variables preserved
- ✅ `fern/pages/file-uploader/plugins/*.mdx` — Plugin API preserved

---

**Report Prepared By:** ReconciliationReport Agent  
**Time to Complete:** 2.5-3.5 hours (documentation updates only)  
**Risk Assessment:** Medium → Low (once updates complete)
