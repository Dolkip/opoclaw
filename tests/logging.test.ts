import { describe, expect, test, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { initFileLogging } from "../src/logging.ts";

describe("logging", () => {
  // initFileLogging overrides the global console; save and restore it so this
  // test can't leak the tee into the rest of the suite.
  const saved = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };
  afterEach(() => {
    console.log = saved.log;
    console.error = saved.error;
    console.warn = saved.warn;
    console.info = saved.info;
  });

  test("tees console output to the log file, ANSI-stripped", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opoclaw-log-"));
    const logFile = join(dir, "nested", "gateway.log");
    try {
      initFileLogging(logFile);

      console.log("hello \x1b[31mworld\x1b[0m");
      console.error("[core] boom");

      const contents = await readFile(logFile, "utf-8");
      const lines = contents.trim().split("\n");

      expect(lines.length).toBe(2);
      // ANSI codes stripped, message preserved, timestamped.
      expect(lines[0]).toContain("hello world");
      expect(lines[0]).not.toContain("\x1b[");
      expect(lines[1]).toContain("[core] boom");
      expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
