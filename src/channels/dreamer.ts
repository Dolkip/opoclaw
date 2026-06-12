import { AgentSession } from "../agent.ts";
import { loadConfig } from "../config.ts";
import { getTools } from "../tools/index.ts";
import { buildSystemPrompt } from "./shared.ts";
import {
    listInteractionDates,
    readInteractionsForDate,
    clearInteractionsForDate,
    formatInteractions,
    utcDateString,
} from "../interactions.ts";

let dreamerTimer: ReturnType<typeof setTimeout> | null = null;

async function dreamOverDate(date: string): Promise<void> {
    const config = loadConfig();
    const events = await readInteractionsForDate(date);
    if (events.length === 0) {
        await clearInteractionsForDate(date);
        return;
    }

    const transcript = formatInteractions(events);
    const session = new AgentSession(`opoclaw-dreamer-${date}-${Date.now()}`);

    const extraSections = [
        "\n## Dreamer\nYou are running as the dreamer: a nightly reflection pass over the day's interactions. " +
        "Review the transcript of everything you did today and consolidate what matters into your long-term memory. " +
        "Look for facts, preferences, decisions, recurring patterns, mistakes, and unfinished threads that you did not " +
        "already record. Update your memory files (e.g. MEMORY.md) accordingly using your tools, being careful not to " +
        "erase existing information. Do not contact users; this is an internal reflection. When done, briefly summarize " +
        "what you updated.",
    ];
    const systemPrompt = await buildSystemPrompt(config, extraSections, "dreamer");

    await session.addMessage({
        role: "user",
        content: `Reflect over your interactions from ${date} (UTC) and update your memory:\n\n${transcript}`,
    });

    try {
        await session.evaluate(systemPrompt, config, { onFirstToken: () => {} }, { tools: getTools(config) });
        await clearInteractionsForDate(date);
        console.log(`[dreamer] Reflected over ${events.length} events from ${date}.`);
    } catch (err: any) {
        // Leave the log in place so a future run can retry.
        console.error(`[dreamer] Reflection for ${date} failed: ${err?.message || err}`);
    }
}

// Process every completed (past) UTC day that still has interaction logs.
export async function runDreamerBacklog(): Promise<void> {
    const config = loadConfig();
    if (!config.dreamer?.enabled) return;

    const today = utcDateString();
    for (const date of await listInteractionDates()) {
        if (date >= today) continue;
        await dreamOverDate(date);
    }
}

function msUntilNextUtcMidnight(): number {
    const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 30);
    return next - now.getTime();
}

export function startDreamer(): void {
    const config = loadConfig();
    if (!config.dreamer?.enabled) return;

    // Catch up on any days that completed while the gateway was down.
    void runDreamerBacklog();

    const schedule = () => {
        dreamerTimer = setTimeout(async () => {
            await runDreamerBacklog();
            schedule();
        }, msUntilNextUtcMidnight());
    };
    schedule();

    console.log("[dreamer] Enabled, reflecting at the end of each UTC day.");
}
