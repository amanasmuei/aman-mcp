import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  identityRead,
  identitySummary,
  identityUpdateSession,
  identityUpdateSection,
  identityUpdateDynamics,
  avatarPrompt,
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
import {
  intentionsAdd,
  intentionsGet,
  intentionsList,
  intentionsUpdate,
  intentionsTouch,
  intentionsClose,
  intentionsReview,
} from "./tools/intentions.js";

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
    content: [{ type: "text", text: await identityRead() }],
  })
);

server.tool(
  "identity_summary",
  "Get a structured summary of the identity: AI name, user name, trust level, personality.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await identitySummary(), null, 2) }],
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
      { type: "text", text: await identityUpdateSession(resume, topics, decisions) },
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
    content: [{ type: "text", text: await identityUpdateSection(section, content) }],
  })
);

server.tool(
  "identity_update_dynamics",
  "Update the Dynamics section of core.md with current personality state. Call this to adapt tone based on time of day, session energy, or conversation signals.",
  {
    currentRead: z.string().describe("Current emotional/energy read for this session (e.g., 'focused and productive', 'late-night, winding down', 'energetic morning start')"),
    energy: z.string().optional().describe("Baseline energy override (high-drive / steady / reflective)"),
    activeMode: z.string().optional().describe("Active context mode (Default / Focused Work / Creative / Personal)"),
  },
  async ({ currentRead, energy, activeMode }) => ({
    content: [
      { type: "text", text: await identityUpdateDynamics(currentRead, energy, activeMode) },
    ],
  })
);

server.tool(
  "avatar_prompt",
  "Generate a deterministic image generation prompt from the AI's Appearance section in core.md. Same date + period always produces the same visual seed for consistent character appearance.",
  {
    date: z.string().optional().describe("Date for seed (YYYY-MM-DD). Defaults to today."),
    period: z.string().optional().describe("Time period for lighting/mood (morning / afternoon / evening / night / late-night). Defaults to 'default'."),
  },
  async ({ date, period }) => ({
    content: [
      { type: "text", text: await avatarPrompt(date, period) },
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
    content: [{ type: "text", text: JSON.stringify(await rulesList(), null, 2) }],
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
    content: [{ type: "text", text: JSON.stringify(await rulesCheck(action), null, 2) }],
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
    content: [{ type: "text", text: await rulesAdd(category, rule) }],
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
    content: [{ type: "text", text: await rulesRemove(category, ruleIndex) }],
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
    content: [{ type: "text", text: await rulesToggle(category, ruleIndex) }],
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
  "Convert a binary document to readable text. Supports PDF (built-in) and DOCX (built-in). For PPTX, XLSX, images: install Docling (pip install docling) or use 'akit add docling'. Also reads text files directly.",
  {
    path: z.string().describe("Absolute file path or ~/relative path to the document"),
  },
  async ({ path: filePath }) => ({
    content: [{ type: "text", text: await docConvert(filePath) }],
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

// --- Intentions (aintentions) — keystone of the agentic substrate ---

server.tool(
  "intentions_add",
  "Create a new active intention (niyyah). Use when Aman commits to a durable goal across sessions.",
  {
    description: z.string().min(1).describe("Short, action-oriented title"),
    niyyah: z.string().min(1).describe("Why this matters — the spiritual/personal anchor"),
    successCriteria: z.string().min(1).describe("Concrete observable signal of fulfillment"),
    horizon: z.enum(["this-week", "this-month", "this-quarter", "lifelong"]),
    linkedProjectId: z.string().optional(),
  },
  async (input) => {
    const intent = await intentionsAdd(input);
    return {
      content: [{ type: "text", text: JSON.stringify(intent, null, 2) }],
    };
  },
);

server.tool(
  "intentions_get",
  "Read a single intention by id.",
  { id: z.string() },
  async ({ id }) => {
    const intent = await intentionsGet(id);
    return {
      content: [
        {
          type: "text",
          text: intent === null ? "null" : JSON.stringify(intent, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "intentions_list",
  "List intentions filtered by status (default: active) and/or horizon.",
  {
    status: z
      .enum(["active", "paused", "complete", "abandoned"])
      .optional(),
    horizon: z
      .enum(["this-week", "this-month", "this-quarter", "lifelong"])
      .optional(),
  },
  async (filters) => {
    const list = await intentionsList(filters);
    return {
      content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
    };
  },
);

server.tool(
  "intentions_update",
  "Patch an intention's description, niyyah, success criteria, horizon, or linked project. Bumps lastTouchedAt automatically.",
  {
    id: z.string(),
    description: z.string().optional(),
    niyyah: z.string().optional(),
    successCriteria: z.string().optional(),
    horizon: z
      .enum(["this-week", "this-month", "this-quarter", "lifelong"])
      .optional(),
    linkedProjectId: z.string().optional(),
  },
  async ({ id, ...patch }) => {
    const updated = await intentionsUpdate(id, patch);
    return {
      content: [
        {
          type: "text",
          text: updated === null ? "null" : JSON.stringify(updated, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "intentions_touch",
  "Bump an intention's lastTouchedAt to now. Call when the conversation moves the intention forward without otherwise modifying it.",
  { id: z.string() },
  async ({ id }) => {
    const touched = await intentionsTouch(id);
    return {
      content: [
        {
          type: "text",
          text: touched === null ? "null" : JSON.stringify(touched, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "intentions_close",
  "Move an intention to complete or abandoned with a reason.",
  {
    id: z.string(),
    status: z.enum(["complete", "abandoned"]),
    reason: z.string().min(1),
  },
  async ({ id, status, reason }) => {
    const closed = await intentionsClose(id, status, reason);
    return {
      content: [
        {
          type: "text",
          text: closed === null ? "null" : JSON.stringify(closed, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "intentions_review",
  "Bulk review of intentions: counts per status (active, paused, complete, abandoned), stale (active intentions untouched > staleDays), due (active intentions whose horizon window has elapsed since creation: this-week=7d, this-month=30d, this-quarter=90d, lifelong never), and horizon distribution of active intentions. Used by Friday muhasabah agent.",
  { staleDays: z.number().int().positive().default(7) },
  async ({ staleDays }) => {
    const review = await intentionsReview({ staleDays });
    return {
      content: [{ type: "text", text: JSON.stringify(review, null, 2) }],
    };
  },
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
