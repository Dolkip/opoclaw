/**
 * orproxy integration — runs the bundled `orproxy` OpenRouter proxy
 * (github:oponic/orproxy.ts) as a managed child process and translates
 * opoclaw's OpenRouter options into the proxy's `$`-suffixed model slug.
 *
 * The proxy parses a model like `anthropic/claude-sonnet-4.5$think.high,cache1h,zdr`
 * and rewrites the outbound OpenRouter request body (reasoning, provider routing,
 * quantization, caching, service tier). opoclaw points its OpenRouter base URL at
 * the local proxy and appends the suffix built from config.
 */

import { spawn, type ChildProcess } from "child_process";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import type { OpoclawConfig } from "../config.ts";

const DEFAULT_PORT = 3001;

export function getProxyPort(config: OpoclawConfig): number {
    return config.provider?.openrouter?.proxy_port || DEFAULT_PORT;
}

export function useProxy(config: OpoclawConfig): boolean {
    return config.provider?.openrouter?.use_proxy ?? false;
}

/**
 * Build the `$`-suffixed model slug from the configured OpenRouter options.
 * Returns the bare model unchanged when the proxy is disabled or no options are
 * set (OpenRouter itself does not understand the `$` syntax).
 */
export function buildProxyModel(config: OpoclawConfig): string {
    const or = config.provider?.openrouter;
    const model = or?.model || "openrouter/auto";
    if (!useProxy(config)) return model;

    const params: string[] = [];

    if (or?.quantization) params.push(or.quantization);

    // Reasoning: an explicit effort wins; otherwise fall back to the global toggle.
    const effort = or?.reasoning_effort;
    if (effort) {
        params.push(`think.${effort}`);
    } else if (config.enable_reasoning) {
        params.push("think");
    }

    if (or?.cache === "5m") params.push("cache");
    else if (or?.cache === "1h") params.push("cache1h");

    if (or?.zdr) params.push("zdr");
    if (or?.strict) params.push("strict");
    if (or?.service_tier) params.push(`tier.${or.service_tier}`);

    for (const p of or?.providers || []) {
        if (p) params.push(p);
    }

    return params.length > 0 ? `${model}$${params.join(",")}` : model;
}

/** Resolve the installed proxy entry point (node_modules/orproxy/or_proxy.ts). */
function resolveProxyEntry(): string {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve("orproxy/package.json");
    return resolve(dirname(pkgJson), "or_proxy.ts");
}

let proxyProc: ChildProcess | null = null;
let readyPromise: Promise<void> | null = null;

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
    const start = Date.now();
    let lastErr: unknown = null;
    while (Date.now() - start < timeoutMs) {
        try {
            // Any HTTP response (even 404) means the listener is up.
            await fetch(`http://127.0.0.1:${port}/`, { method: "GET" });
            return;
        } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 150));
        }
    }
    throw new Error(`orproxy did not become ready on port ${port}: ${lastErr}`);
}

/**
 * Ensure the proxy child process is running. Idempotent — spawns at most one
 * process for the lifetime of the gateway and caches the readiness promise.
 */
export function ensureProxyRunning(config: OpoclawConfig): Promise<void> {
    if (readyPromise) return readyPromise;

    const port = getProxyPort(config);
    const entry = resolveProxyEntry();

    proxyProc = spawn(process.execPath, ["run", entry], {
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
    });

    proxyProc.stdout?.on("data", (d: Buffer) => process.stdout.write(`[orproxy] ${d}`));
    proxyProc.stderr?.on("data", (d: Buffer) => process.stderr.write(`[orproxy] ${d}`));
    proxyProc.on("exit", (code) => {
        console.error(`[orproxy] exited with code ${code}`);
        proxyProc = null;
        readyPromise = null;
    });

    // Don't keep the gateway alive solely for the proxy child.
    proxyProc.unref?.();

    readyPromise = waitForPort(port, 10000).catch((err) => {
        readyPromise = null;
        throw err;
    });
    return readyPromise;
}

export function stopProxy(): void {
    if (proxyProc) {
        try { proxyProc.kill("SIGTERM"); } catch {}
        proxyProc = null;
        readyPromise = null;
    }
}
