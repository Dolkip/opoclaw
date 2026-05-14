import { createCliRenderer, Text, Box, RGBA, TextareaRenderable, ScrollBoxRenderable, TextRenderable } from "@opentui/core"
import { runCoreChatTurn } from "../channels/core.ts"

const colours = {
  green: RGBA.fromHex("#00FF88"),
  yellow: RGBA.fromHex("#FFFF00"),
  blue: RGBA.fromHex("#78DCE8"),
  dim: RGBA.fromHex("#8A8F98"),
  red: RGBA.fromHex("#FF5555"),
  white: RGBA.fromHex("#FFFFFF"),
}

export async function tui() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
  })

  const chatBox = new ScrollBoxRenderable(renderer, {
    id: "chatbox",
    width: "100%",
    flexGrow: 1,
    stickyScroll: true,
    stickyStart: "bottom",
    borderStyle: "rounded",
  })

  const sessionKey = `tui-${Date.now().toString(36)}`
  let msgCounter = 0
  let thinkingId: string | null = null

  function addLines(prefix: string, text: string, prefixColor: RGBA, textColor: RGBA) {
    const id = `msg-${msgCounter++}`
    const lines = text.split("\n")
    chatBox.add(new TextRenderable(renderer, {
      id: `${id}-hdr`,
      width: "100%",
      height: 1,
      content: ` ${prefix} `,
      fg: prefixColor,
    }))
    for (let i = 0; i < lines.length; i++) {
      chatBox.add(new TextRenderable(renderer, {
        id: `${id}-l${i}`,
        width: "100%",
        content: `  ${lines[i] || " "}`,
        fg: textColor,
        wrapMode: "word",
      }))
    }
  }

  function addUserMessage(text: string) { addLines("YOU", text, colours.green, colours.white) }
  function addAssistantMessage(text: string) { addLines("CLAW", text, colours.blue, colours.white) }
  function addToolMessage(text: string) { addLines("TOOL", text, colours.yellow, colours.dim) }
  function addErrorMessage(text: string) { addLines("ERROR", text, colours.red, colours.red) }
  function addSystemMessage(text: string) { addLines("SYSTEM", text, colours.white, colours.dim) }

  function setThinking(on: boolean) {
    if (on && !thinkingId) {
      const id = `thinking-${msgCounter++}`
      const t = new TextRenderable(renderer, {
        id,
        width: "100%",
        height: 1,
        content: "◇ Thinking...",
        fg: colours.dim,
      })
      chatBox.add(t)
      thinkingId = id
    } else if (!on && thinkingId) {
      chatBox.remove(thinkingId)
      thinkingId = null
    }
  }

  function handleCommand(input: string): boolean {
    const cmd = input.replace("/", "").toLowerCase()
    switch (cmd) {
      case "quit":
      case "exit":
        renderer.destroy()
        process.exit(0)
        return true
      case "about":
        addSystemMessage("opoclaw — terminal UI for the opoclaw agent framework")
        return true
      case "help":
        addSystemMessage("Available commands: /exit, /about, /meow, /help")
        return true
      case "meow":
        addSystemMessage("meow meow uwu owo nya nyaa~")
        return true
      default:
        addSystemMessage(input + " is not a valid command. /help for details.")
        return true
    }
  }

  const promptBox = new TextareaRenderable(renderer, {
    marginTop: "auto",
    id: "prompt",
    width: "100%",
    height: 3,
    placeholder: "Send a message... (Shift+Enter for newline, /exit to quit)",
    backgroundColor: "#1a1a1a",
    focusedBackgroundColor: "#222222",
    textColor: "#FFFFFF",
    cursorColor: "#00FF88",
    keyBindings: [
      { name: "return", action: "submit" },
      { name: "return", shift: true, action: "newline" },
      { name: "linefeed", action: "submit" },
      { name: "linefeed", shift: true, action: "newline" },
    ],
    onSubmit: () => {
      const text = promptBox.plainText.trim()
      if (!text) return
      promptBox.selectAll()
      promptBox.deleteSelection()
      promptBox.focus()
      if (text.startsWith("/")) {
        const handled = handleCommand(text)
        if (handled) return
      }
      addUserMessage(text)
      setThinking(true)
      runCoreChatTurn(sessionKey, text, {
        onToolLine(line) {
          setThinking(false)
          addToolMessage(line)
          setThinking(true)
        },
        approveTool: async () => true,
        requestPermission: async () => true,
        askQuestion: async (_question, options) =>
          ({ selected: options[0]!, userLabel: "tui-user" }),
      })
        .then((result) => {
          setThinking(false)
          if (result.reasoningSummary) addToolMessage(result.reasoningSummary)
          addAssistantMessage(result.text)
        })
        .catch((e) => {
          setThinking(false)
          addErrorMessage(e?.message || String(e))
        })
    },
  })

  renderer.root.add(Text({ content: "opoclaw tui", fg: colours.green }))
  renderer.root.add(chatBox)
  renderer.root.add(
    Box({ borderStyle: "rounded", marginTop: "auto", padding: 0, flexDirection: "column", gap: 1 },
      promptBox,
    ),
  )
  promptBox.focus()
}
