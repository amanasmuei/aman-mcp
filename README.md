# @aman_asmuei/aman-mcp

MCP server for the **aman** AI companion ecosystem. Exposes identity, tools, workflows, guardrails, and evaluation as MCP tools that any AI agent can call.

```
┌─────────────────────────────────────────────┐
│              AI Agent / LLM                 │
│         (Claude, GPT, etc.)                 │
└──────────────────┬──────────────────────────┘
                   │ MCP
        ┌──────────┴──────────┐
        │     aman-mcp        │ ← this server
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

## Setup

### Claude Code

Add to `~/.claude/settings.json`:

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

### Cursor

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

### Windsurf

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

## Tools

### Identity (acore) — `~/.acore/core.md`

| Tool | Description |
|------|-------------|
| `identity_read` | Read the full core.md identity file |
| `identity_summary` | Get structured summary: AI name, user name, trust level, personality |
| `identity_update_session` | Update the Session section (resume, topics, decisions) |

### Tools (akit) — `~/.akit/kit.md`

| Tool | Description |
|------|-------------|
| `tools_list` | List all installed tools with status |
| `tools_search` | Search tool registry by query |

### Workflows (aflow) — `~/.aflow/flow.md`

| Tool | Description |
|------|-------------|
| `workflow_list` | List all defined workflows |
| `workflow_get` | Get a specific workflow's steps |

### Guardrails (arules) — `~/.arules/rules.md`

| Tool | Description |
|------|-------------|
| `rules_list` | List all rule categories |
| `rules_check` | Check if an action violates any rules |

### Evaluation (aeval) — `~/.aeval/eval.md`

| Tool | Description |
|------|-------------|
| `eval_status` | Get evaluation metrics (sessions, trust, trajectory) |
| `eval_log` | Log a session with rating and notes |

## File Locations

The server reads and writes the same files as the CLI tools:

- `~/.acore/core.md` — Identity and personality
- `~/.akit/kit.md` and `~/.akit/installed.json` — Tool registry
- `~/.aflow/flow.md` — Workflow definitions
- `~/.arules/rules.md` — Guardrail rules
- `~/.aeval/eval.md` — Evaluation log

## Development

```bash
npm install
npm run build
npm run lint
```

## License

MIT
