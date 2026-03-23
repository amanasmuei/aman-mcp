import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  identityRead,
  identitySummary,
  identityUpdateSession,
} from "./tools/identity.js";
import { toolsList, toolsSearch } from "./tools/tools.js";
import { workflowList, workflowGet } from "./tools/workflows.js";
import { rulesList, rulesCheck } from "./tools/rules.js";
import { evalStatus, evalLog } from "./tools/eval.js";

const server = new McpServer({
  name: "aman-mcp",
  version: "0.1.0",
});

// --- Identity (acore) ---

server.tool(
  "identity_read",
  "Read the user's current core.md identity file. Returns the full content.",
  {},
  async () => ({
    content: [{ type: "text", text: identityRead() }],
  })
);

server.tool(
  "identity_summary",
  "Get a structured summary of the identity: AI name, user name, trust level, personality.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(identitySummary(), null, 2) }],
  })
);

server.tool(
  "identity_update_session",
  "Update the Session section of core.md with resume, active topics, and recent decisions.",
  {
    resume: z.string().describe("1-2 sentence summary of where we left off"),
    topics: z.string().describe("Current active topics/threads"),
    decisions: z.string().describe("Key choices made recently"),
  },
  async ({ resume, topics, decisions }) => ({
    content: [
      { type: "text", text: identityUpdateSession(resume, topics, decisions) },
    ],
  })
);

// --- Tools (akit) ---

server.tool(
  "tools_list",
  "List all installed tools with their status (MCP vs manual).",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(toolsList(), null, 2) }],
  })
);

server.tool(
  "tools_search",
  "Search the tool registry by query string.",
  {
    query: z.string().describe("Search query to match against tool names and descriptions"),
  },
  async ({ query }) => ({
    content: [{ type: "text", text: JSON.stringify(toolsSearch(query), null, 2) }],
  })
);

// --- Workflows (aflow) ---

server.tool(
  "workflow_list",
  "List all defined workflows.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(workflowList(), null, 2) }],
  })
);

server.tool(
  "workflow_get",
  "Get a specific workflow's steps by name.",
  {
    name: z.string().describe("Name or partial name of the workflow to retrieve"),
  },
  async ({ name }) => {
    const workflow = workflowGet(name);
    if (!workflow) {
      return {
        content: [{ type: "text", text: `Workflow not found: ${name}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(workflow, null, 2) }],
    };
  }
);

// --- Guardrails (arules) ---

server.tool(
  "rules_list",
  "List all rule categories and their rules.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(rulesList(), null, 2) }],
  })
);

server.tool(
  "rules_check",
  "Check if a proposed action might violate any rules. Returns matching violations.",
  {
    action: z
      .string()
      .describe("Description of the proposed action to check against rules"),
  },
  async ({ action }) => ({
    content: [{ type: "text", text: JSON.stringify(rulesCheck(action), null, 2) }],
  })
);

// --- Evaluation (aeval) ---

server.tool(
  "eval_status",
  "Get current evaluation metrics: sessions count, trust level, trajectory, recent ratings.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evalStatus(), null, 2) }],
  })
);

server.tool(
  "eval_log",
  "Log a session evaluation with rating and notes.",
  {
    rating: z
      .enum(["great", "good", "okay", "frustrating"])
      .describe("Overall session rating"),
    highlights: z.string().describe("What went well this session"),
    improvements: z.string().describe("What could be improved"),
  },
  async ({ rating, highlights, improvements }) => ({
    content: [{ type: "text", text: evalLog(rating, highlights, improvements) }],
  })
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
