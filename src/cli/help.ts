import kleur from "kleur";
import { getConfigPath } from "../config.ts";
import { WORKSPACE_DIR, USAGE_FILE, banner, chip, cmdStyle, label, subtle, value } from "./shared.ts";

export function showExplainer() {
  console.log(`
${chip("EXPLAINER", "blue")}

${value("opoclaw is a Discord bot framework. When someone mentions the bot:")}

${label("1.")} ${kleur.bold("Message received")} — Discord event triggers the MessageCreate handler.
   Only messages that @mention the bot (or reply to it) are processed.
   Own messages are always ignored. Other bots are ignored unless
   channel.discord.allow_bots=true in config.toml.

${label("2.")} ${kleur.bold("System prompt loaded")} — Three workspace files are read and composed:
   - SOUL.md — personality, tone, rules, vibe
   - IDENTITY.md — name, appearance, self-description
   - AGENTS.md — operating instructions, memory system, safety rules
   These form the system prompt sent to the LLM.

${label("3.")} ${kleur.bold("Channel history")} — Last 50 messages in the channel are fetched,
   formatted as [name]: content, and sent as conversation context.

${label("4.")} ${kleur.bold("LLM call")} — The composed prompt + history is sent to the configured
   provider (OpenRouter, Ollama, or custom endpoint). The model generates
   a response. If reasoning is enabled, the model's thinking tokens are
   captured during streaming.

${label("5.")} ${kleur.bold("Tools")} — The model can request tool calls (file operations, etc.).
   Tools execute in a loop (max 20 iterations) until the model stops
   requesting them or sends a final text response.

${label("6.")} ${kleur.bold("Response sent")} — The reply is sent back to Discord, split into
   chunks if over 1990 characters.

${chip("SECURITY", "red")}

- ${label("No data exfiltration")} — workspace files (SOUL, IDENTITY, AGENTS,
  MEMORY) are sent to the LLM provider as part of the prompt. Do not
  put secrets in these files.
- ${label("Token safety")} — Discord token and API keys live in config.toml,
  never sent to the LLM or exposed in responses.
- ${label("Tool sandboxing")} — file tools only read from the workspace directory.
  The send_file tool reads workspace files and attaches them to messages.
- ${label("No system commands")} — the bot cannot run shell commands or access
  your filesystem outside the workspace.
- ${label("Rate limiting")} — max 20 agent iterations per message prevents
  runaway loops.

${chip("CONFIG", "cyan")}
${value("config.toml lives at the project root. Onboard wizard:")} ${cmdStyle("opoclaw onboard")}.
${value("Channels live under")} ${subtle("[channel.*]")}. ${value("Providers live under")} ${subtle("[provider.*]")}.
${value("Toggle:")} ${subtle("channel.discord.allow_bots, enable_reasoning, reasoning_summary")}.
`);
}

export function showHelp() {
  console.log(`
  ${banner()}
  
${chip("HELP", "blue")}
${kleur.blue().bold("Lightweight AI agent framework")}

${chip("COMMANDS", "magenta")}
  ${cmdStyle("usage")}              ${subtle("Show token usage (last 24h) and cost")}
  ${cmdStyle("gateway start")}      ${subtle("Start the bot gateway")}
  ${cmdStyle("gateway stop")}       ${subtle("Stop the gateway")}
  ${cmdStyle("gateway restart")}    ${subtle("Restart the gateway")}
  ${cmdStyle("gateway hibernate")}${subtle("  Hibernate the gateway (requires approval to wake)")}
  ${cmdStyle("gateway status")}     ${subtle("Check if gateway is running")}
  ${cmdStyle("update [unstable]")}  ${subtle("Pull latest release and restart (use unstable channel)")}
  ${cmdStyle("tui")}               ${subtle("Launch interactive Terminal User Interface (Core channel)")}
  ${cmdStyle("check-update")}       ${subtle("Check for available updates")}
  ${cmdStyle("install")}            ${subtle("Install opoclaw command + optional service")}
  ${cmdStyle("service install")}    ${subtle("Install auto-start service (systemd/launchd)")}
  ${cmdStyle("service remove")}     ${subtle("Remove auto-start service")}
  ${cmdStyle("uninstall")}          ${subtle("Remove command, service, and clean up")}
  ${cmdStyle("explainer")}          ${subtle("How opoclaw works")}
  ${cmdStyle("migrate")}            ${subtle("Upgrade config (JSON→TOML, camelCase→snake_case, sections)")}
  ${cmdStyle("onboard")}            ${subtle("Run onboarding wizard")}
  ${cmdStyle("version")}            ${subtle("Print current version (git tag)")}
  ${cmdStyle("help")}               ${subtle("Show this help")}

${chip("PATHS", "cyan")}
${label("Config:")}     ${value(getConfigPath())}
${label("Workspace:")}  ${value(WORKSPACE_DIR)}
${label("Usage:")}      ${value(USAGE_FILE)}
`);
}