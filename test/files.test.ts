import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileRead, docConvert, fileList } from "../src/tools/files.js";

// Create a temp directory with test files
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aman-files-test-"));

beforeAll(() => {
  // Create test files
  fs.writeFileSync(path.join(tmpDir, "hello.txt"), "Hello, world!", "utf-8");
  fs.writeFileSync(path.join(tmpDir, "data.json"), '{"key": "value"}', "utf-8");
  fs.writeFileSync(path.join(tmpDir, "code.ts"), 'export const x = 42;', "utf-8");
  fs.writeFileSync(path.join(tmpDir, "readme.md"), "# Title\n\nSome content.", "utf-8");

  // Create a subdirectory with files
  const subDir = path.join(tmpDir, "src");
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(path.join(subDir, "index.ts"), 'console.log("hi")', "utf-8");
  fs.writeFileSync(path.join(subDir, "utils.ts"), 'export const add = (a: number, b: number) => a + b;', "utf-8");

  // Create a binary-ish file (simulate)
  fs.writeFileSync(path.join(tmpDir, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("fileRead", () => {
  it("reads a text file", () => {
    const result = fileRead(path.join(tmpDir, "hello.txt"));
    expect(result).toBe("Hello, world!");
  });

  it("reads a json file", () => {
    const result = fileRead(path.join(tmpDir, "data.json"));
    expect(result).toContain('"key"');
  });

  it("reads a typescript file", () => {
    const result = fileRead(path.join(tmpDir, "code.ts"));
    expect(result).toContain("export const x");
  });

  it("reads a markdown file", () => {
    const result = fileRead(path.join(tmpDir, "readme.md"));
    expect(result).toContain("# Title");
  });

  it("returns error for nonexistent file", () => {
    const result = fileRead(path.join(tmpDir, "nope.txt"));
    expect(result).toContain("Error");
    expect(result).toContain("not found");
  });

  it("returns error for directory", () => {
    const result = fileRead(path.join(tmpDir, "src"));
    expect(result).toContain("directory");
    expect(result).toContain("file_list");
  });

  it("returns error for binary files", () => {
    const result = fileRead(path.join(tmpDir, "image.png"));
    expect(result).toContain("binary");
  });

  it("truncates large files", () => {
    const largePath = path.join(tmpDir, "large.txt");
    fs.writeFileSync(largePath, "x".repeat(200_000), "utf-8");
    const result = fileRead(largePath);
    expect(result).toContain("truncated");
    expect(result.length).toBeLessThan(200_000);
  });
});

describe("docConvert", () => {
  it("reads text files directly", () => {
    const result = docConvert(path.join(tmpDir, "hello.txt"));
    expect(result).toBe("Hello, world!");
  });

  it("returns error for nonexistent file", () => {
    const result = docConvert(path.join(tmpDir, "nope.docx"));
    expect(result).toContain("Error");
    expect(result).toContain("not found");
  });

  it("returns error for unsupported format", () => {
    const result = docConvert(path.join(tmpDir, "image.png"));
    expect(result).toContain("Unsupported format");
  });

  it("provides install hint when docling is not available for docx", () => {
    const docxPath = path.join(tmpDir, "test.docx");
    // Create a fake docx file (just needs to exist with right extension)
    fs.writeFileSync(docxPath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const result = docConvert(docxPath);
    // Should either convert or show install hint
    expect(
      result.includes("Converted") || result.includes("docling") || result.includes("textutil")
    ).toBe(true);
  });
});

describe("fileList", () => {
  it("lists files in a directory", () => {
    const result = fileList(tmpDir);
    expect(result).toContain("hello.txt");
    expect(result).toContain("data.json");
    expect(result).toContain("src/");
  });

  it("shows file sizes", () => {
    const result = fileList(tmpDir);
    expect(result).toMatch(/\d+(\.\d+)?(B|KB|MB)/);
  });

  it("lists recursively when requested", () => {
    const result = fileList(tmpDir, true);
    expect(result).toContain("src/");
    expect(result).toContain("index.ts");
    expect(result).toContain("utils.ts");
  });

  it("returns error for nonexistent directory", () => {
    const result = fileList(path.join(tmpDir, "nonexistent"));
    expect(result).toContain("Error");
    expect(result).toContain("not found");
  });

  it("returns error for file path", () => {
    const result = fileList(path.join(tmpDir, "hello.txt"));
    expect(result).toContain("not a directory");
  });
});
