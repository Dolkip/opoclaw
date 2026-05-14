import { createCliRenderer, Text, Box, RGBA, type KeyEvent, TextareaRenderable, BoxRenderable, ScrollBoxRenderable } from "@opentui/core"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
})

const chatBox = new ScrollBoxRenderable(renderer, {
  id: "chatbox",
  width: 40,
  height: 20,
})

const colours = {
  green: RGBA.fromHex("#00FF88"),
  yellow: RGBA.fromHex("#FFFF00")
}

const promptBox = new TextareaRenderable(renderer, {
  marginTop: "auto",
  id: "prompt",
  width: 50,
  height: 2,
  placeholder: "Send a message here...",
  backgroundColor: "#1a1a1a",
  focusedBackgroundColor: "#222222",
  textColor: "#FFFFFF",
  cursorColor: "#00FF88",
  onSubmit: () => {
    // submit to model here i guess
  },
  keyBindings: [{ name: "return", ctrl: true, action: "submit" }],
})

export function tui() {
  renderer.root.add(
    Text({
      content: "opoclaw tui",
      fg: colours.green,
    }),
  );
  renderer.root.add(
    chatBox
  )
  renderer.root.add(
    Box({ borderStyle: "rounded", marginTop: "auto", padding: 0, flexDirection: "column", gap: 1 },
      promptBox,
    )
  )

  // Add content to the scrollbox
for (let i = 0; i < 100; i++) {
  chatBox.add(
    new BoxRenderable(renderer, {
      id: `item-${i}`,
      width: "100%",
      height: 2,
      backgroundColor: i % 2 === 0 ? "#292e42" : "#2f3449",
    }),
  )
}
  const ok = renderer.triggerNotification("Build finished", "OpenTUI")
}