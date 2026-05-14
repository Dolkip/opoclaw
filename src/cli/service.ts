import { mkdirSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { exec } from "../utils.ts";
import { BIN_DIR, OP_DIR, OPCLAW_BIN, OPCLAW_BIN_WIN, PLIST_PATH_LA, SYSTEMD_PATH, chip, cmdStyle, getOS, info, ok, subtle, warn, value } from "./shared.ts";

export function installService() {
  const os = getOS();
  info(`Installing ${os} service...`);

  switch (os) {
    case "macos": {
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.oponic.opoclaw</string>
    <key>ProgramArguments</key>
    <array>
        <string>${OPCLAW_BIN}</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${OP_DIR}/logs/gateway.log</string>
    <key>StandardErrorPath</key>
    <string>${OP_DIR}/logs/gateway.log</string>
    <key>WorkingDirectory</key>
    <string>${OP_DIR}</string>
</dict>
</plist>`;
      mkdirSync(`${OP_DIR}/logs`, { recursive: true });
      writeFileSync(PLIST_PATH_LA, plist);
      exec(`launchctl load ${PLIST_PATH_LA}`);
      ok(`macOS service installed.`);
      console.log(`${chip("MANAGE", "green")}`);
      console.log(`  ${cmdStyle("launchctl start/com.oponic.opoclaw")}`);
      console.log(`  ${cmdStyle("launchctl stop/com.oponic.opoclaw")}`);
      break;
    }
    case "linux": {
      const unit = `[Unit]
Description=opoclaw AI Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${exec("whoami")}
WorkingDirectory=${OP_DIR}
ExecStart=${OPCLAW_BIN} gateway start
Restart=on-failure
RestartSec=5
StandardOutput=append:${OP_DIR}/logs/gateway.log
StandardError=append:${OP_DIR}/logs/gateway.log

[Install]
WantedBy=multi-user.target`;
      mkdirSync(`${OP_DIR}/logs`, { recursive: true });
      writeFileSync(SYSTEMD_PATH, unit);
      exec("sudo systemctl daemon-reload");
      exec("sudo systemctl enable opoclaw.service");
      exec("sudo systemctl start opoclaw.service");
      ok("Linux systemd service installed and started");
      console.log(`${chip("MANAGE", "green")}`);
      console.log(`  ${cmdStyle("systemctl status opoclaw")}`);
      console.log(`  ${cmdStyle("systemctl stop opoclaw")}`);
      break;
    }
    case "windows": {
      warn("Windows service: create manually with NSSM or sc.exe.");
      console.log(`${chip("WINDOWS SERVICE", "yellow")}`);
      console.log(`  ${cmdStyle(`nssm install opoclaw "${OPCLAW_BIN}" gateway start`)}`);
      console.log(`  ${cmdStyle(`sc create opoclaw binPath="${OPCLAW_BIN} gateway start"`)}`);
      break;
    }
  }
}

export function uninstallService() {
  const os = getOS();
  info(`Removing ${os} service...`);

  switch (os) {
    case "macos": {
      try {
        exec(`launchctl unload ${PLIST_PATH_LA} 2>/dev/null || true`);
        unlinkSync(PLIST_PATH_LA);
        ok("macOS service removed");
      } catch { warn("No service found"); }
      break;
    }
    case "linux": {
      try {
        exec("sudo systemctl stop opoclaw.service 2>/dev/null || true");
        exec("sudo systemctl disable opoclaw.service 2>/dev/null || true");
        exec("sudo rm -f /etc/systemd/system/opoclaw.service");
        exec("sudo systemctl daemon-reload");
        ok("Linux service removed");
      } catch { warn("No service found"); }
      break;
    }
    case "windows": {
      try {
        exec("nssm remove opoclaw confirm 2>nul || true");
        exec("sc delete opoclaw 2>nul || true");
        ok("Windows service removed");
      } catch { warn("No service found"); }
      break;
    }
  }
}

export function installCommand(args: string[]) {
  info("Installing opoclaw command...");
  mkdirSync(BIN_DIR, { recursive: true });

  if (getOS() === "windows") {
    const wrapper = `@echo off\r\nbun run "${resolve(import.meta.dir, "../cli.ts")}" %*\r\n`;
    writeFileSync(OPCLAW_BIN_WIN, wrapper);
    ok(`opoclaw command installed to ${OPCLAW_BIN_WIN}`);
  } else {
    const wrapper = `#!/bin/bash\nbun run "${resolve(import.meta.dir, "../cli.ts")}" "$@"\n`;
    writeFileSync(OPCLAW_BIN, wrapper);
    exec(`chmod +x ${OPCLAW_BIN}`);
    ok(`opoclaw command installed to ${OPCLAW_BIN}`);
  }

  const path = process.env.PATH || "";
  if (!path.includes(BIN_DIR)) {
    warn(`${BIN_DIR} is not in your PATH.`);
    console.log(`${chip("PATH", "yellow")}`);
    if (getOS() === "windows") {
      console.log(`  ${value("Add")} ${cmdStyle(BIN_DIR)} ${value("to your PATH environment variable.")}`);
    } else {
      console.log(`  ${value("Add to .zshrc / .bashrc:")}`);
      console.log(`  ${cmdStyle(`export PATH="${BIN_DIR}:$PATH"` )}`);
    }
  }

  const ans = args[1];
  if (ans === "--service" || ans === "--daemon") {
    installService();
  }
}

export async function uninstall() {
  info("Uninstalling opoclaw...");
  try {
    const { gatewayStop } = await import("./gateway.ts");
    await gatewayStop();
  } catch {}
  uninstallService();
  try { unlinkSync(OPCLAW_BIN); } catch {}
  try { unlinkSync(OPCLAW_BIN_WIN); } catch {}
  ok("opoclaw uninstalled.");
  console.log(`\n${chip("DATA", "red")}`);
  console.log(`  ${value("To remove all data, delete:")} ${cmdStyle(OP_DIR)}`);
  console.log(`  ${subtle("(config.toml, workspace, and usage data will be lost)")}\n`);
}