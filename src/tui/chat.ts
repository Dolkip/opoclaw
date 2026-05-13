import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { Box, Text, createCliRenderer } from "@opentui/core";
import type { ToolCall } from "../agent.ts";
import { runCoreChatTurn } from "../channels/core.ts";

export async function chatTui() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "split-footer",
    footerHeight: 14,
    externalOutputMode: "capture-stdout",
    consoleMode: "disabled",
  });

  const sessionKey = `cli-${Date.now().toString(36)}`;
  let turn = 0;

  const statusText = Text({ content: "Ready", fg: "#78DCE8" });
  const inputText = Text({ content: "", fg: "#A6E22E" });
  const hintText = Text({ content: "Type a message and press Enter. Use /exit to quit.", fg: "#8A8F98" });

  renderer.root.add(
    Box(
      { borderStyle: "rounded", padding: 1, flexDirection: "column", gap: 1, width: "100%", height: "100%" },
      Text({ content: "opoclaw · OpenTUI chat", fg: "#FF79C6", bold: true }),
      statusText,
      inputText,
      hintText,
    ),
  );

  const rl = createInterface({ input, output });

  const askYesNo = async (prompt: string, defaultNo = true): Promise<boolean> => {
    const suffix = defaultNo ? " [y/N]: " : " [Y/n]: ";
    const answer = (await rl.question(prompt + suffix)).trim().toLowerCase();
    if (!answer) return !defaultNo;
    return answer === "y" || answer === "yes";
  };

  try {
    while (true) {
      const text = (await rl.question("\n> ")).trim();
      if (!text) continue;
      if (text === "/exit" || text === "/quit") break;

      turn += 1;
      statusText.content = `Turn ${turn} · thinking...`;
      inputText.content = `You: ${text}`;

      try {
        const result = await runCoreChatTurn(sessionKey, text, {
          approveTool: async (call: ToolCall, args: Record<string, any>) => {
            const preview = JSON.stringify(args).slice(0, 180);
            renderer.writeToScrollback((ctx) => ({
              root: Text({ content: `[tool] ${call.function.name} ${preview}`, fg: "#FFD866", width: ctx.width }),
              startOnNewLine: true,
              trailingNewline: true,
            }));
            return await askYesNo(`Approve tool call: ${call.function.name}?`, true);
          },
          requestPermission: async (message: string) => await askYesNo(message || "Approve request?", true),
          askQuestion: async (question: string, options: string[]) => {
            const listing = options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
            const raw = (await rl.question(`\n${question}\n${listing}\nSelect option #: `)).trim();
            if (!raw) return null;
            const idx = Number(raw) - 1;
            if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) return null;
            return { selected: options[idx]!, userLabel: "cli-user" };
          },
          onToolLine: (line: string) => {
            if (!line.trim()) return;
            renderer.writeToScrollback((ctx) => ({
              root: Text({ content: `[tool] ${line.trim()}`, fg: "#8BE9FD", width: ctx.width }),
              startOnNewLine: true,
              trailingNewline: true,
            }));
          },
        });

        renderer.writeToScrollback((ctx) => ({
          root: Box(
            { flexDirection: "column", width: ctx.width },
            Text({ content: `You: ${text}`, fg: "#A6E22E", width: ctx.width }),
            Text({ content: `Assistant: ${result.text}`, fg: "#F8F8F2", width: ctx.width }),
          ),
          startOnNewLine: true,
          trailingNewline: true,
        }));
        statusText.content = `Turn ${turn} · complete`;
      } catch (e: any) {
        statusText.content = `Turn ${turn} · error`;
        renderer.writeToScrollback((ctx) => ({
          root: Text({ content: `[error] ${e?.message || String(e)}`, fg: "#FF5555", width: ctx.width }),
          startOnNewLine: true,
          trailingNewline: true,
        }));
      }
    }
  } finally {
    rl.close();
    renderer.destroy();
  }
}
