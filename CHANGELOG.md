# Changelog

## 0.8.0 — 2026-04-26

### Added — Projects layer (aprojects)

LRU-positioned work-thread tracker, peer to intentions / eval / rules.

- 9 MCP tools: `project_add`, `project_get`, `project_list`, `project_active`, `project_load`, `project_touch`, `project_save`, `project_close`, `project_update`
- 10-slot active LRU; eviction at position 11 keeps project alive but sets `inActiveList=false`
- Lifecycle (`status`) and LRU membership (`inActiveList`) are orthogonal
- Storage: `~/.aprojects/dev/plugin/projects.md` (single-file, matches intentions pattern)
- Override: `$AMAN_PROJECTS_HOME`
- Fuzzy match on `project_load` (exact name first, then substring; ambiguous returns candidate list)
- Session notes appended via `project_save` with auto date+period header

### Changed

- `intentions_update` now reciprocally patches the linked project's `linkedIntentionId` when `linkedProjectId` changes (and vice versa). Pass `{ skipReciprocal: true }` to disable (used internally to break the loop).

### Migration

- No breaking changes. The `intentions.linkedProjectId` field already existed; this release fills the slot.
- First call to any `project_*` tool creates `~/.aprojects/dev/plugin/projects.md` if absent.
