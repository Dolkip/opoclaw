import type { RGBA } from "@opentui/core"
import { runCoreChatTurn } from "../channels/core.ts"

export async function tui() {
  const { createCliRenderer, Text, Box, RGBA, TextareaRenderable, ScrollBoxRenderable, TextRenderable } = await import("@opentui/core")
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

  const colours = {
    green: RGBA.fromHex("#00FF88"),
    yellow: RGBA.fromHex("#FFFF00"),
    blue: RGBA.fromHex("#78DCE8"),
    dim: RGBA.fromHex("#8A8F98"),
    red: RGBA.fromHex("#FF5555"),
    white: RGBA.fromHex("#FFFFFF"),
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

  const sessionKey = `tui-${Date.now().toString(36)}`
  let msgCounter = 0
  let thinkingId: string | null = null
  let activeTurn: Promise<void> | null = null
  const queuedMessages: { text: string; rendered: boolean }[] = []

  const promptBox = new TextareaRenderable(renderer, {
    marginTop: "auto",
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
      enqueueMessage(text)
    },
  })

  function enqueueMessage(text: string) {
    if (activeTurn) {
      addUserMessage(text, true)
      queuedMessages.push({ text, rendered: true })
      return
    }
    queuedMessages.push({ text, rendered: false })
    void processQueue()
  }

  async function processQueue() {
    if (activeTurn || queuedMessages.length === 0) return
    const item = queuedMessages.shift()
    if (!item) return

    activeTurn = (async () => {
      if (!item.rendered) {
        addUserMessage(item.text)
      }
      setThinking(true)
      try {
        const result = await runCoreChatTurn(sessionKey, item.text, {
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
        addAssistantMessage(result.text, result.reasoningSummary)
      } catch (e: unknown) {
        addErrorMessage(e instanceof Error ? e.message : String(e))
      } finally {
        setThinking(false)
      }
    })()

    try {
      await activeTurn
    } finally {
      activeTurn = null
      if (queuedMessages.length > 0) {
        void processQueue()
      }
    }
  }

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

  function addLines(prefix: string, text: string, prefixColor: RGBA, textColor: RGBA, suffix?: { text: string; fg: RGBA }) {
    const id = `msg-${msgCounter++}`
    const lines = text.split("\n")
    chatBox.add(
      Box(
        { width: "100%", flexDirection: "row", gap: 1, padding: 0 },
        Text({
          content: ` ${prefix} `,
          fg: prefixColor,
        }),
      ),
    )
    for (let i = 0; i < lines.length; i++) {
      chatBox.add(new TextRenderable(renderer, {
        id: `${id}-l${i}`,
        width: "100%",
        content: `  ${lines[i] || " "}`,
        fg: textColor,
        wrapMode: "word",
      }))
    }
    if (suffix) {
      chatBox.add(new TextRenderable(renderer, {
        id: `${id}-suffix`,
        width: "100%",
        content: `  ${suffix.text}`,
        fg: suffix.fg,
      }))
    }
  }

  function addUserMessage(text: string, queued = false) {
    addLines("YOU", text, colours.green, colours.white, queued ? { text: "queued", fg: colours.blue } : undefined)
  }

  function addAssistantMessage(text: string, thought?: string) {
    const id = `msg-${msgCounter++}`
    const lines = text.split("\n")
    chatBox.add(
      Box(
        { width: "100%", flexDirection: "row", gap: 1, padding: 0 },
        Text({
          content: " CLAW ",
          fg: colours.blue,
        }),
      ),
    )
    if (thought) {
      chatBox.add(new TextRenderable(renderer, {
        id: `${id}-thought`,
        width: "100%",
        content: `  ${thought}`,
        fg: colours.dim,
        wrapMode: "word",
      }))
    }
    for (let i = 0; i < lines.length; i++) {
      chatBox.add(new TextRenderable(renderer, {
        id: `${id}-l${thought ? i + 1 : i}`,
        width: "100%",
        content: `  ${lines[i] || " "}`,
        fg: colours.white,
        wrapMode: "word",
      }))
    }
  }

  function addToolMessage(text: string) {
    addLines("TOOL", text, colours.yellow, colours.dim)
  }

  function addErrorMessage(text: string) {
    addLines("ERROR", text, colours.red, colours.red)
  }

  function addSystemMessage(text: string) {
    addLines("SYSTEM", text, colours.white, colours.dim)
  }

  renderer.root.add(
    Text({ content: "opoclaw tui", fg: colours.green }),
  )
  renderer.root.add(chatBox)
  renderer.root.add(
    Box({ borderStyle: "rounded", marginTop: "auto", padding: 0, flexDirection: "column", gap: 1 },
      promptBox,
    ),
  )
  promptBox.focus()
}
