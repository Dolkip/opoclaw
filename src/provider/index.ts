import { getActiveProvider, type OpoclawConfig } from "../config.ts";
import { generateCompletion as openaiGenerate } from "./openai.ts";
import { generateCompletion as anthropicGenerate } from "./anthropic.ts";
import type { Message, CompletionResult, ProviderFn } from "./types.ts";
import type { ToolDefinition } from "@/tools/types.ts";

export type { Message, ToolCall, CompletionResult, ProviderFn } from "./types.ts";

function defaultGenerateCompletion(
    messages: Message[],
    config: OpoclawConfig,
    onFirstToken: () => void,
    tools: ToolDefinition[],
    sessionId: string,
): Promise<CompletionResult> {
    const tool_schema = tools.map(x=>x.schema);
    if (getActiveProvider(config) === "custom" && config.provider?.custom?.api_type === "anthropic") {
        return anthropicGenerate(messages, config, onFirstToken, tool_schema);
    }
    return openaiGenerate(messages, config, onFirstToken, tool_schema, sessionId);
}

export const provider: { generateCompletion: ProviderFn } = {
    generateCompletion: defaultGenerateCompletion,
};
