import { doUpdate, checkForUpdate, exec } from "../utils.ts";
import { OP_DIR, chip, cmdStyle, err, label, subtle } from "./shared.ts";
import { tui } from "./tui.ts";
import { showUsage } from "./usage.ts";
import { gatewayStart, gatewayStop, gatewayRestart, gatewayHibernate, gatewayStatus } from "./gateway.ts";
import { installCommand, installService, uninstall, uninstallService } from "./service.ts";
import { migrate, migrateLessVerboseTools, migrateToSnakeCase, migrateToSectionedConfig } from "./migrations.ts";
import { showExplainer, showHelp } from "./help.ts";
import kleur from "kleur";

export async function main() {
  const rawArgs = process.argv.slice(2);
  const args = [...rawArgs];

  // Bun wrappers can forward argv as: ["run", "<script>", ...actualArgs].
  // Normalize so command dispatch always reads the user command first.
  if (args[0] === "run") args.shift();
  if (args[0]?.endsWith("/cli.ts") || args[0]?.endsWith("\\cli.ts") || args[0] === "cli.ts") args.shift();

  const cmd = args[0];

  switch (cmd) {
    case "usage":
      await showUsage();
      break;

    case "gateway": {
      const sub = args[1];
      switch (sub) {
        case "start": await gatewayStart(); break;
        case "stop": await gatewayStop(); break;
        case "restart": await gatewayRestart(); break;
        case "hibernate": await gatewayHibernate(); break;
        case "status": await gatewayStatus(); break;
        default:
          console.log(`${label("Usage:")} ${cmdStyle("opoclaw gateway {start|stop|restart|hibernate|status}")}`);
      }
      break;
    }

    case "update":
      await doUpdate(args[1] === "unstable" ? "unstable" : undefined, gatewayRestart);
      break;

    case "check-update":
      await checkForUpdate(false);
      break;

    case "install":
      installCommand(args);
      break;

    case "uninstall":
      await uninstall();
      break;

    case "service": {
      const svcCmd = args[1];
      if (svcCmd === "install") installService();
      else if (svcCmd === "remove") uninstallService();
      else console.log(`${label("Usage:")} ${cmdStyle("opoclaw service {install|remove}")}`);
      break;
    }

    case "migrate":
      migrate();
      migrateToSnakeCase();
      migrateToSectionedConfig();
      migrateLessVerboseTools();
      break;

    case "onboard":
      exec("bun run installers/onboard.ts", { cwd: OP_DIR });
      break;

    case "version":
    case "v":
      try {
        const tag = exec("git describe --tags --abbrev=0 2>/dev/null", { cwd: OP_DIR });
        console.log(`${chip("VERSION", "green")} ${kleur.bold(`opoclaw ${tag}`)}`);
      } catch {
        console.log(`${chip("VERSION", "yellow")} ${subtle("opoclaw (unknown version — no git tags found)")}`);
      }
      break;

    case "explainer":
    case "explain":
      showExplainer();
      break;

    case "tui":
      await tui();
      break;

    case "help":
    case "--help":
    case "-h":
    case undefined:
      showHelp();
      break;

    default:
      err(`Unknown command: ${cmd}`);
      console.log(`${subtle("Run")} ${cmdStyle("opoclaw help")} ${subtle("for usage.")}`);
      process.exit(1);
  }
}