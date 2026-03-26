import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  identityRead,
  identitySummary,
  identityUpdateSession,
  identityUpdateSection,
} from "./tools/identity.js";
import { toolsList, toolsSearch, toolsAdd, toolsRemove } from "./tools/tools.js";
import {
  workflowList,
  workflowGet,
  workflowAdd,
  workflowUpdate,
  workflowRemove,
} from "./tools/workflows.js";
import {
  rulesList,
  rulesCheck,
  rulesAdd,
  rulesRemove,
  rulesToggle,
} from "./tools/rules.js";
import {
  evalStatus,
  evalLog,
  evalMilestone,
  evalReport,
} from "./tools/eval.js";
import {
  skillList,
  skillSearch,
  skillInstall,
  skillUninstall,
} from "./tools/skills.js";
import { fileRead, docConvert, fileList } from "./tools/files.js";

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

server.tool(
  "identity_update_section",
  "Update a specific section of core.md by heading name. Replaces the section content.",
  {
    section: z.string().describe("The section heading to update (e.g. 'Personality')"),
    content: z.string().describe("New content for the section"),
  },
  async ({ section, content }) => ({
    content: [{ type: "text", text: identityUpdateSection(section, content) }],
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

server.tool(
  "tools_add",
  "Add a new tool to kit.md.",
  {
    name: z.string().describe("Tool name"),
    type: z.string().describe("Tool type (e.g. 'mcp', 'cli', 'manual')"),
    description: z.string().describe("Brief description of the tool"),
  },
  async ({ name, type, description }) => ({
    content: [{ type: "text", text: toolsAdd(name, type, description) }],
  })
);

server.tool(
  "tools_remove",
  "Remove a tool from kit.md by name.",
  {
    name: z.string().describe("Name of the tool to remove"),
  },
  async ({ name }) => ({
    content: [{ type: "text", text: toolsRemove(name) }],
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

server.tool(
  "workflow_add",
  "Add a new workflow with named steps.",
  {
    name: z.string().describe("Workflow name"),
    description: z.string().describe("Brief description of the workflow"),
    steps: z.array(z.string()).describe("Ordered list of step descriptions"),
  },
  async ({ name, description, steps }) => ({
    content: [{ type: "text", text: workflowAdd(name, description, steps) }],
  })
);

server.tool(
  "workflow_update",
  "Update the steps of an existing workflow by name.",
  {
    name: z.string().describe("Name of the workflow to update"),
    steps: z.array(z.string()).describe("New ordered list of step descriptions"),
  },
  async ({ name, steps }) => ({
    content: [{ type: "text", text: workflowUpdate(name, steps) }],
  })
);

server.tool(
  "workflow_remove",
  "Remove a workflow by name.",
  {
    name: z.string().describe("Name of the workflow to remove"),
  },
  async ({ name }) => ({
    content: [{ type: "text", text: workflowRemove(name) }],
  })
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

server.tool(
  "rules_add",
  "Add a new rule to a category. Creates the category if it doesn't exist.",
  {
    category: z.string().describe("Rule category name"),
    rule: z.string().describe("The rule text to add"),
  },
  async ({ category, rule }) => ({
    content: [{ type: "text", text: rulesAdd(category, rule) }],
  })
);

server.tool(
  "rules_remove",
  "Remove a rule by 1-based index from a category.",
  {
    category: z.string().describe("Rule category name"),
    ruleIndex: z.number().describe("1-based index of the rule to remove"),
  },
  async ({ category, ruleIndex }) => ({
    content: [{ type: "text", text: rulesRemove(category, ruleIndex) }],
  })
);

server.tool(
  "rules_toggle",
  "Toggle a rule's active state (strikethrough) by 1-based index.",
  {
    category: z.string().describe("Rule category name"),
    ruleIndex: z.number().describe("1-based index of the rule to toggle"),
  },
  async ({ category, ruleIndex }) => ({
    content: [{ type: "text", text: rulesToggle(category, ruleIndex) }],
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

server.tool(
  "eval_milestone",
  "Record a milestone achievement in the evaluation log.",
  {
    text: z.string().describe("Description of the milestone"),
  },
  async ({ text }) => ({
    content: [{ type: "text", text: evalMilestone(text) }],
  })
);

server.tool(
  "eval_report",
  "Get a full evaluation report with status, milestones, and summary.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evalReport(), null, 2) }],
  })
);

// --- Skills (askill) ---

server.tool(
  "skill_list",
  "List all skills (installed and available from built-in registry).",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(skillList(), null, 2) }],
  })
);

server.tool(
  "skill_search",
  "Search skills by name or description.",
  {
    query: z.string().describe("Search query to match against skill names and descriptions"),
  },
  async ({ query }) => ({
    content: [{ type: "text", text: JSON.stringify(skillSearch(query), null, 2) }],
  })
);

server.tool(
  "skill_install",
  "Install a skill by name. Adds it to skills.md.",
  {
    name: z.string().describe("Name of the skill to install"),
  },
  async ({ name }) => ({
    content: [{ type: "text", text: skillInstall(name) }],
  })
);

server.tool(
  "skill_uninstall",
  "Uninstall a skill by name. Removes it from skills.md.",
  {
    name: z.string().describe("Name of the skill to uninstall"),
  },
  async ({ name }) => ({
    content: [{ type: "text", text: skillUninstall(name) }],
  })
);

// --- Files ---

server.tool(
  "file_read",
  "Read a text file and return its contents. Supports all common text formats (.txt, .md, .json, .js, .ts, .py, .html, .css, .yml, .sql, etc). For binary documents (.docx, .pdf), use doc_convert instead.",
  {
    path: z.string().describe("Absolute file path or ~/relative path"),
  },
  async ({ path: filePath }) => ({
    content: [{ type: "text", text: fileRead(filePath) }],
  })
);

server.tool(
  "doc_convert",
  "Convert a binary document (PDF, DOCX, PPTX, XLSX, etc) to readable markdown text. Uses Docling if installed (best quality), falls back to textutil on macOS. Also works with text files.",
  {
    path: z.string().describe("Absolute file path or ~/relative path to the document"),
  },
  async ({ path: filePath }) => ({
    content: [{ type: "text", text: docConvert(filePath) }],
  })
);

server.tool(
  "file_list",
  "List files and directories at a given path. Shows file names with sizes. Hides hidden files and node_modules by default.",
  {
    path: z.string().describe("Absolute directory path or ~/relative path"),
    recursive: z.boolean().optional().describe("List recursively (default: false, max 500 entries)"),
  },
  async ({ path: dirPath, recursive }) => ({
    content: [{ type: "text", text: fileList(dirPath, recursive) }],
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
