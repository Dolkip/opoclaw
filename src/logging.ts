import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { format } from "util";

// Strip ANSI color codes so the log file stays plain text.
const ANSI = /\x1b\[[0-9;]*m/g;

let initialized = false;

/**
 * Tee the process's console output to `logFile` (appended, ANSI-stripped, and
 * timestamped) while still printing to the original stdout/stderr. This lets
 * `opoclaw logs` read the gateway's output regardless of how it was launched —
 * a detached `gateway start` pipes its stdio to a parent that exits, so without
 * this the file would only be populated when running under a service manager.
 */
export function initFileLogging(logFile: string): void {
    if (initialized) return;
    initialized = true;

    try {
        mkdirSync(dirname(logFile), { recursive: true });
    } catch {
    }

    const original = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console),
    };

    const tee = (print: (...a: any[]) => void) => (...args: any[]) => {
        print(...args);
        try {
            const line = format(...args).replace(ANSI, "");
            appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
        } catch {
            // Never let a logging failure crash the gateway.
        }
    };

    console.log = tee(original.log);
    console.error = tee(original.error);
    console.warn = tee(original.warn);
    console.info = tee(original.info);
}
