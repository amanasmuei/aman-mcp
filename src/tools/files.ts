import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".py",
  ".html", ".css", ".scss", ".less", ".yml", ".yaml", ".toml",
  ".xml", ".csv", ".sh", ".bash", ".zsh", ".env", ".cfg", ".ini",
  ".log", ".sql", ".graphql", ".rs", ".go", ".java", ".rb", ".php",
  ".c", ".cpp", ".h", ".hpp", ".swift", ".kt", ".r", ".lua",
  ".vue", ".svelte", ".astro", ".mdx", ".prisma", ".tf",
  ".dockerfile", ".makefile", ".gitignore", ".editorconfig",
]);

const BINARY_DOC_EXTENSIONS = new Set([
  ".docx", ".doc", ".pdf", ".pptx", ".ppt", ".xlsx", ".xls",
  ".odt", ".ods", ".odp", ".rtf", ".epub",
]);

const MAX_FILE_SIZE = 100_000; // ~25K tokens

function resolvePath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return path.resolve(filePath);
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Common extensionless text files
  const knownNames = new Set([
    "makefile", "dockerfile", "procfile", "gemfile", "rakefile",
    "license", "readme", "changelog", "contributing", "authors",
    ".gitignore", ".dockerignore", ".env", ".eslintrc", ".prettierrc",
  ]);
  if (knownNames.has(basename)) return true;

  // No extension — try to detect if it's text
  if (ext === "") {
    try {
      const buf = Buffer.alloc(512);
      const fd = fs.openSync(filePath, "r");
      const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
      fs.closeSync(fd);
      // Check for null bytes (binary indicator)
      for (let i = 0; i < bytesRead; i++) {
        if (buf[i] === 0) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function findDoclingCli(): string | null {
  try {
    const result = execFileSync("which", ["docling"], { encoding: "utf-8", timeout: 3000 }).trim();
    return result || null;
  } catch {
    return null;
  }
}

function convertWithDocling(filePath: string): string | null {
  const docling = findDoclingCli();
  if (!docling) return null;

  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aman-docling-"));
    execFileSync(docling, ["convert", "--to", "md", "--output", tmpDir, filePath], {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Find the output markdown file
    const files = fs.readdirSync(tmpDir);
    const mdFile = files.find(f => f.endsWith(".md"));
    if (mdFile) {
      const content = fs.readFileSync(path.join(tmpDir, mdFile), "utf-8");
      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return content;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return null;
  } catch {
    return null;
  }
}

function convertWithTextutil(filePath: string): string | null {
  // macOS only — textutil can convert docx/doc/rtf/odt to txt
  if (process.platform !== "darwin") return null;

  const ext = path.extname(filePath).toLowerCase();
  if (![".docx", ".doc", ".rtf", ".odt"].includes(ext)) return null;

  try {
    const tmpFile = path.join(os.tmpdir(), `aman-convert-${Date.now()}.txt`);
    execFileSync("textutil", ["-convert", "txt", "-output", tmpFile, filePath], {
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const content = fs.readFileSync(tmpFile, "utf-8");
    fs.unlinkSync(tmpFile);
    return content;
  } catch {
    return null;
  }
}

async function convertWithPdfParse(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".pdf") return null;

  try {
    const buffer = fs.readFileSync(filePath);
    // pdf-parse v2 uses PDFParse class — dynamic import to avoid type issues
    const { PDFParse } = await import("pdf-parse") as any;
    const parser = new PDFParse({});
    await parser.load(buffer);
    const result = parser.getText();
    return typeof result === "string" ? result : result?.text || null;
  } catch {
    return null;
  }
}

// --- Exported tool functions ---

export function fileRead(filePath: string): string {
  const resolved = resolvePath(filePath);

  if (!fs.existsSync(resolved)) {
    return `Error: File not found: ${resolved}`;
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return `Error: "${resolved}" is a directory. Use file_list instead.`;
  }

  if (!isTextFile(resolved)) {
    const ext = path.extname(resolved).toLowerCase();
    if (BINARY_DOC_EXTENSIONS.has(ext)) {
      return `Error: "${path.basename(resolved)}" is a binary document (${ext}). Use doc_convert to read it.`;
    }
    return `Error: "${path.basename(resolved)}" appears to be a binary file and cannot be read as text.`;
  }

  try {
    const content = fs.readFileSync(resolved, "utf-8");
    if (content.length > MAX_FILE_SIZE) {
      return content.slice(0, MAX_FILE_SIZE) +
        `\n\n[... truncated at ${MAX_FILE_SIZE} chars. File is ${content.length} chars total.]`;
    }
    return content;
  } catch (err) {
    return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function docConvert(filePath: string): Promise<string> {
  const resolved = resolvePath(filePath);

  if (!fs.existsSync(resolved)) {
    return `Error: File not found: ${resolved}`;
  }

  const ext = path.extname(resolved).toLowerCase();
  const basename = path.basename(resolved);

  // If it's already a text file, just read it
  if (isTextFile(resolved)) {
    return fileRead(resolved);
  }

  if (!BINARY_DOC_EXTENSIONS.has(ext)) {
    return `Error: Unsupported format "${ext}". Supported: ${[...BINARY_DOC_EXTENSIONS].join(", ")}`;
  }

  // Priority 1: Docling (best quality, supports everything)
  const doclingResult = convertWithDocling(resolved);
  if (doclingResult) {
    return `[Converted from ${ext} using docling]\n\n${doclingResult}`;
  }

  // Priority 2: pdf-parse (PDF — built-in, no external deps)
  const pdfResult = await convertWithPdfParse(resolved);
  if (pdfResult) {
    return `[Converted from ${ext} using pdf-parse]\n\n${pdfResult}`;
  }

  // Priority 3: textutil (macOS, docx/doc/rtf/odt — uses OS-native converter)
  const textutilResult = convertWithTextutil(resolved);
  if (textutilResult) {
    return `[Converted from ${ext} using textutil]\n\n${textutilResult}`;
  }

  // No converter available — guide the user
  const installHint = [
    `Could not convert "${basename}" (${ext}).`,
    "",
    "For full document support, install Docling:",
    "  pip install docling",
    "",
    "Or add it via akit:",
    "  akit add docling",
    "",
    "Docling supports: PDF, DOCX, PPTX, XLSX, HTML, images, and more.",
  ];

  return installHint.join("\n");
}

export function fileList(dirPath: string, recursive?: boolean): string {
  const resolved = resolvePath(dirPath);

  if (!fs.existsSync(resolved)) {
    return `Error: Directory not found: ${resolved}`;
  }

  if (!fs.statSync(resolved).isDirectory()) {
    return `Error: "${resolved}" is a file, not a directory.`;
  }

  try {
    if (recursive) {
      const results: string[] = [];
      const walk = (dir: string, prefix: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        // Skip hidden dirs and node_modules
        const filtered = entries.filter(e =>
          !e.name.startsWith(".") && e.name !== "node_modules"
        );
        for (const entry of filtered) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(`${prefix}${entry.name}/`);
            if (results.length < 500) { // Safety limit
              walk(fullPath, prefix + "  ");
            }
          } else {
            const stat = fs.statSync(fullPath);
            const size = stat.size < 1024 ? `${stat.size}B`
              : stat.size < 1048576 ? `${(stat.size / 1024).toFixed(1)}KB`
              : `${(stat.size / 1048576).toFixed(1)}MB`;
            results.push(`${prefix}${entry.name} (${size})`);
          }
        }
      };
      walk(resolved, "");
      if (results.length >= 500) {
        results.push("... (truncated at 500 entries)");
      }
      return results.join("\n");
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const lines = entries
      .filter(e => !e.name.startsWith("."))
      .map(e => {
        if (e.isDirectory()) return `${e.name}/`;
        try {
          const stat = fs.statSync(path.join(resolved, e.name));
          const size = stat.size < 1024 ? `${stat.size}B`
            : stat.size < 1048576 ? `${(stat.size / 1024).toFixed(1)}KB`
            : `${(stat.size / 1048576).toFixed(1)}MB`;
          return `${e.name} (${size})`;
        } catch {
          return e.name;
        }
      });
    return lines.join("\n");
  } catch (err) {
    return `Error listing directory: ${err instanceof Error ? err.message : String(err)}`;
  }
}
