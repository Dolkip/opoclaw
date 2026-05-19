import { readFile, getFilePath, writeFile, editFile, listFiles } from "../workspace.ts";
import { defineTool, type ToolDefinition } from "./types.ts";

export const FILE_TOOLS = {
    read_file: defineTool(
        "read_file",
        "Read the contents of a file in the workspace. Only files in the workspace directory can be read.",
        {
            path: {
                type: "string",
                description: "Relative path to the file within the workspace (e.g. 'AGENTS.md').",
            },
        },
        ["path"],
        {
            enabled: (config) => config.basic_tools ?? true,
            handler: async (args, { config }) => {
                if (!args.path) throw new Error("Missing 'path' argument for read_file.");
                return await readFile(String(args.path), config.mounts);
            },
        },
    ),
    write_file: defineTool(
        "write_file",
        "Overwrite the contents of an existing file in the workspace. If it does not exist, it will be created.",
        {
            path: {
                type: "string",
                description: "Relative path to the file within the workspace.",
            },
            content: {
                type: "string",
                description: "The new complete content to write to the file.",
            },
        },
        ["path", "content"],
        {
            enabled: (config) => config.basic_tools ?? true,
            handler: async (args, { config }) => {
                if (!args.path) throw new Error("Missing 'path' argument for write_file.");
                if (args.content === undefined) throw new Error("Missing 'content' argument for write_file.");
                await writeFile(String(args.path), String(args.content), config.mounts);
                return `Successfully wrote ${String(args.content).length} characters to "${args.path}".`;
            },
        },
    ),
    edit_file: defineTool(
        "edit_file",
        "Use the Semicorp file editor to replace a string in a file with a new string.",
        {
            path: {
                type: "string",
                description: "Relative path to the file within the workspace.",
            },
            oldString: {
                type: "string",
                description: "The string within the file to be replaced. Must match perfectly.",
            },
            newString: {
                type: "string",
                description: "The string to replace oldString with.",
            },
        },
        ["path", "oldString", "newString"],
        {
            enabled: (config) => config.basic_tools ?? true,
            handler: async (args, { config }) => {
                if (!args.path) throw new Error("Missing 'path' argument for edit_file.");
                if (args.oldString === undefined) throw new Error("Missing 'oldString' argument for edit_file.");
                if (args.newString === undefined) throw new Error("Missing 'newString' argument for edit_file.");
                await editFile(String(args.path), String(args.oldString), String(args.newString), config.mounts);
                return `Successfully replaced ${args.oldString} with ${args.newString} in "${args.path}". Semicorp File Editor, 1995.`;
            },
        },
    ),
    list_files: defineTool(
        "list_files",
        "List all files currently in the workspace directory.",
        {},
        [],
        {
            enabled: (config) => config.basic_tools ?? true,
            handler: async (_args, { config }) => {
                const files = await listFiles(config.mounts);
                return files.length > 0 ? files.map((file) => `• ${file}`).join("\n") : "(workspace is empty)";
            },
        },
    ),
    send_file: defineTool(
        "send_file",
        "Send a file from the workspace as a Discord attachment. The file will be sent after the agent's response.",
        {
            path: {
                type: "string",
                description: "Relative path to the file within the workspace.",
            },
            caption: {
                type: "string",
                description: "Optional caption for the file.",
            },
        },
        ["path"],
        {
            handler: async (args, { config, session }) => {
                if (!args.path) throw new Error("Missing 'path' argument for send_file.");
                getFilePath(String(args.path), config.mounts);
                session.pendingFileSend = { path: String(args.path), caption: String(args.caption || "") };
                return `File "${args.path}" queued for sending.`;
            },
        },
    ),
} satisfies Record<string, ToolDefinition>;
