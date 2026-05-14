#!/usr/bin/env bun
import { main } from "./cli/main.ts";

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exit(1);
});
