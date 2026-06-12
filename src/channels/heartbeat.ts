import { AgentSession, type ToolCall } from "../agent.ts";
import { loadConfig } from "../config.ts";
import { getTools } from "../tools/index.ts";
import { defineTool } from "../tools/types.ts";
import { readFile } from "../workspace.ts";
import { buildSystemPrompt, isHibernating } from "./shared.ts";
import { sendToLastDiscordChannel, getLastDiscordChannelId } from "./discord/index.ts";

const DEFAULT_INTERVAL_MINUTES = 60;

const SEND_MESSAGE_TOOL = defineTool(
    "send_message",
    "Send a message to the last active Discord channel. Use this if the heartbeat task warrants reaching out. Does nothing if there is no recent Discord channel.",
    {
        content: {
            type: "string",
            description: "The message text to send.",
        },
    },
    ["content"],
);

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export async function runHeartbeat(): Promise<void> {
    const config = loadConfig();
    if (!config.heartbeat?.enabled) return;
    if (await isHibernating()) return;

    const content = (await readFile("HEARTBEAT.md").catch(() => "")).trim();
    if (!content) {
        console.error("[heartbeat] HEARTBEAT.md is empty or missing; skipping run.");
        return;
    }

    const session = new AgentSession(`opoclaw-heartbeat-${Date.now()}`);
    const hasChannel = getLastDiscordChannelId() !== null;
    const extraSections = [
        "\n## Heartbeat\nThis is an automated heartbeat invocation, not a user message. " +
        "Follow the instructions below. " +
        (hasChannel
            ? "You may call the `send_message` tool to post to the last active Discord channel if appropriate. Stay quiet if there is nothing worth sending."
            : "There is no active Discord channel right now, so the `send_message` tool will have no effect."),
    ];
    const systemPrompt = await buildSystemPrompt(config, extraSections, "heartbeat");

    await session.addMessage({ role: "user", content: `Heartbeat trigger:\n\n${content}` });

    const tools = [...getTools(config), SEND_MESSAGE_TOOL];

    const executeTool = async (call: ToolCall, args: Record<string, any>): Promise<string | undefined> => {
        if (call.function.name === "send_message") {
            const text = String(args.content || "").trim();
            if (!text) return "Error: 'content' is required for send_message.";
            const sent = await sendToLastDiscordChannel(text);
            return sent ? "Message sent to Discord." : "No active Discord channel to send to.";
        }
        return undefined;
    };

    try {
        await session.evaluate(systemPrompt, config, { onFirstToken: () => {}, executeTool }, { tools });
    } catch (err: any) {
        console.error(`[heartbeat] Run failed: ${err?.message || err}`);
    }
}

export function startHeartbeat(): void {
    const config = loadConfig();
    if (!config.heartbeat?.enabled) return;

    const intervalMinutes = config.heartbeat.interval_minutes ?? DEFAULT_INTERVAL_MINUTES;
    const intervalMs = Math.max(1, intervalMinutes) * 60_000;

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        void runHeartbeat();
    }, intervalMs);

    console.log(`[heartbeat] Enabled, running every ${intervalMinutes} minute(s).`);
}
