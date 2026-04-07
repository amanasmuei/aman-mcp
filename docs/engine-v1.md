# Engine v1 — what changed for aman-mcp

aman-mcp v0.6.0 is the first release that runs on **engine v1**, a shared substrate published as 3 npm packages:

- [`@aman_asmuei/aman-core`](https://www.npmjs.com/package/@aman_asmuei/aman-core) `^0.2.0` — scope, `withScope`, `Storage<T>`
- [`@aman_asmuei/acore-core`](https://www.npmjs.com/package/@aman_asmuei/acore-core) `^0.1.0` — multi-tenant Identity layer
- [`@aman_asmuei/arules-core`](https://www.npmjs.com/package/@aman_asmuei/arules-core) `^0.1.0` — multi-tenant guardrails layer

## What it means for aman-mcp

- **`src/tools/identity.ts`** and **`src/tools/rules.ts`** are rewritten as thin wrappers over `acore-core` and `arules-core`. All handlers are now async.
- **Scope is environment-driven.** The active scope comes from `$AMAN_MCP_SCOPE` (defaulting to `dev:plugin` for backward compatibility). Set this env var to switch tenants.
- **Storage routing is automatic** via the engine: `dev:*` scopes use `MarkdownFileStorage`, everything else uses the shared SQLite engine DB at `~/.aman/engine.db`.
- **No more duplicated parsers.** The rule parser, identity section helpers, and enforcement logic all come from the engine packages.

## Why it matters

aman-mcp is now one frontend among four (Claude Code via aman-plugin, CLI via aman-agent, Telegram via aman-tg, and direct MCP). Improvements to the engine land everywhere at once.

## Migration impact

**Existing users:** zero — the default `dev:plugin` scope reads the same files you already had. If you want a separate identity per Claude Code project, point `$AMAN_MCP_SCOPE` at a sub-scope like `dev:plugin:work`.

**New: 11 handlers became async.** If you fork or extend `src/index.ts`, make sure tool callbacks `await` the engine APIs.

## Learn more

- Engine architecture: https://github.com/amanasmuei/aman-core
- Identity layer: https://github.com/amanasmuei/acore-core
- Guardrails layer: https://github.com/amanasmuei/arules-core
