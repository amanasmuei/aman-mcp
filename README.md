<div align="center">

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/aman--mcp-MCP_server-white?style=for-the-badge&labelColor=0d1117&color=58a6ff">
  <img alt="aman-mcp" src="https://img.shields.io/badge/aman--mcp-MCP_server-black?style=for-the-badge&labelColor=f6f8fa&color=24292f">
</picture>

### The MCP server for the aman ecosystem.

Exposes identity, tools, workflows, guardrails, and evaluation as MCP tools — so any AI agent can read and write your ecosystem programmatically.

<br>

[![npm](https://img.shields.io/npm/v/@aman_asmuei/aman-mcp?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@aman_asmuei/aman-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/amanasmuei/aman-mcp/ci.yml?style=flat-square&label=tests)](https://github.com/amanasmuei/aman-mcp/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2?style=flat-square)](https://modelcontextprotocol.io)
[![aman](https://img.shields.io/badge/part_of-aman_ecosystem-ff6b35.svg?style=flat-square)](https://github.com/amanasmuei/aman)

[Setup](#setup) · [Tools](#tools) · [Architecture](#architecture) · [Ecosystem](#the-ecosystem)

</div>

---

## How It Works

```
┌─────────────────────────────────────────────┐
│              AI Agent / LLM                 │
│         (Claude, GPT, Cursor, etc.)         │
└──────────────────┬──────────────────────────┘
                   │ MCP Protocol
        ┌──────────┴──────────┐
        │     aman-mcp        │  ← this server
        │  11 tools across    │
        │  5 ecosystem layers │
        └──┬──┬──┬──┬──┬─────┘
           │  │  │  │  │
     ┌─────┘  │  │  │  └─────┐
     ▼        ▼  ▼  ▼        ▼
  acore    akit aflow arules aeval
 identity tools flows guards  eval
```

> **amem** (memory) runs as its own MCP server — see [amem](https://github.com/amanasmuei/amem).

---

## Setup

<details>
<summary><strong>Claude Code</strong></summary>

**One-liner:**

```bash
claude mcp add aman -- npx -y @aman_asmuei/aman-mcp
```

**Or manually** add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "aman": {
      "command": "npx",
      "args": ["-y", "@aman_asmuei/aman-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aman": {
      "command": "npx",
      "args": ["-y", "@aman_asmuei/aman-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "aman": {
      "command": "npx",
      "args": ["-y", "@aman_asmuei/aman-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Any other MCP client</strong></summary>

aman-mcp speaks standard [Model Context Protocol](https://modelcontextprotocol.io/) over stdio:

```bash
npx @aman_asmuei/aman-mcp
```

</details>

---

## Tools

### Identity (acore) — `~/.acore/core.md`

| Tool | Description |
|:-----|:------------|
| `identity_read` | Read the full core.md identity file |
| `identity_summary` | Get structured summary: AI name, user name, trust level, personality |
| `identity_update_session` | Update the Session section (resume, topics, decisions) |

### Tools (akit) — `~/.akit/kit.md`

| Tool | Description |
|:-----|:------------|
| `tools_list` | List all installed tools with status |
| `tools_search` | Search tool registry by query |

### Workflows (aflow) — `~/.aflow/flow.md`

| Tool | Description |
|:-----|:------------|
| `workflow_list` | List all defined workflows |
| `workflow_get` | Get a specific workflow's steps |

### Guardrails (arules) — `~/.arules/rules.md`

| Tool | Description |
|:-----|:------------|
| `rules_list` | List all rule categories |
| `rules_check` | Check if an action violates any rules |

### Evaluation (aeval) — `~/.aeval/eval.md`

| Tool | Description |
|:-----|:------------|
| `eval_status` | Get evaluation metrics (sessions, trust, trajectory) |
| `eval_log` | Log a session with rating and notes |

---

## Architecture

```
src/
├── index.ts        Entry point — server setup, transport
├── tools/          MCP tool definitions per layer
├── parsers/        Markdown file parsers
└── utils/          Shared utilities
```

### File Locations

The server reads and writes the same files as the CLI tools:

| File | Layer |
|:-----|:------|
| `~/.acore/core.md` | Identity and personality |
| `~/.akit/kit.md` | Tool registry |
| `~/.aflow/flow.md` | Workflow definitions |
| `~/.arules/rules.md` | Guardrail rules |
| `~/.aeval/eval.md` | Evaluation log |

---

## Development

```bash
git clone https://github.com/amanasmuei/aman-mcp.git
cd aman-mcp
npm install
npm run build
npm run lint
npm test
```

---

## The Ecosystem

```
aman
├── acore      → identity    → who your AI IS
├── amem       → memory      → what your AI KNOWS
├── akit       → tools       → what your AI CAN DO
├── aflow      → workflows   → HOW your AI works
├── arules     → guardrails  → what your AI WON'T do
├── aeval      → evaluation  → how GOOD your AI is
└── aman-mcp   → MCP server  → the bridge  ← YOU ARE HERE
```

| Layer | Package | What it does |
|:------|:--------|:-------------|
| Identity | [acore](https://github.com/amanasmuei/acore) | Personality, values, relationship memory |
| Memory | [amem](https://github.com/amanasmuei/amem) | Automated knowledge storage (MCP) |
| Tools | [akit](https://github.com/amanasmuei/akit) | 15 portable AI tools (MCP + manual fallback) |
| Workflows | [aflow](https://github.com/amanasmuei/aflow) | Reusable AI workflows |
| Guardrails | [arules](https://github.com/amanasmuei/arules) | Safety boundaries and permissions |
| Evaluation | [aeval](https://github.com/amanasmuei/aeval) | Relationship tracking and session logging |
| **Unified** | **[aman](https://github.com/amanasmuei/aman)** | **One command to set up everything** |

---

## Contributing

Contributions welcome! Open an issue or submit a PR.

## License

[MIT](LICENSE)

---

<div align="center">

**11 tools. 5 layers. One MCP server.**

</div>
