#!/usr/bin/env bash
set -euo pipefail

# ── Opoclaw Installer ───────────────────────────────────────────────────────
# Supports macOS (Homebrew) and most Linux distros (apt/dnf/pacman)

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
RESET="\033[0m"

info()  { echo -e "${CYAN}[opoclaw]${RESET} $*"; }
ok()    { echo -e "${GREEN}[✓]${RESET} $*"; }
header(){ echo -e "\n${BOLD}═══ $* ═══${RESET}\n"; }

REPO_URL="https://github.com/oponic/opoclaw.git"
INSTALL_DIR="$HOME/Documents/opoclaw"
BIN_DIR="$HOME/.local/bin"

# ── Detect OS ───────────────────────────────────────────────────────────────

detect_os() {
    case "$(uname -s)" in
        Darwin)  echo "macos" ;;
        Linux)   echo "linux" ;;
        *)       echo "unknown" ;;
    esac
}

OS=$(detect_os)

if [ "$OS" = "unknown" ]; then
    echo "Error: unsupported OS $(uname -s). opoclaw runs on macOS and Linux."
    exit 1
fi

header "opoclaw installer ($OS)"

# ── Install Homebrew on macOS ───────────────────────────────────────────────

install_brew_macos() {
    if command -v brew &>/dev/null; then
        ok "Homebrew already installed"
        return
    fi
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for this session
    if [ -x "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    ok "Homebrew installed"
}

# ── Install Bun ─────────────────────────────────────────────────────────────

install_bun() {
    if command -v bun &>/dev/null; then
        ok "Bun already installed ($(bun --version))"
        return
    fi

    info "Installing Bun..."
    case "$OS" in
        macos)
            if command -v brew &>/dev/null; then
                brew install oven-sh/bun/bun
            else
                curl -fsSL https://bun.sh/install | bash
            fi
            ;;
        linux)
            curl -fsSL https://bun.sh/install | bash
            ;;
    esac

    # Add bun to PATH
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if command -v bun &>/dev/null; then
        ok "Bun installed ($(bun --version))"
    else
        echo "Error: bun install failed. Add $BUN_INSTALL/bin to your PATH."
        exit 1
    fi
}

# ── Install Git (if missing) ────────────────────────────────────────────────

ensure_git() {
    if command -v git &>/dev/null; then
        ok "Git already installed"
        return
    fi

    info "Installing git..."
    case "$OS" in
        macos)
            xcode-select --install 2>/dev/null || true
            ;;
        linux)
            if command -v apt &>/dev/null; then
                sudo apt update && sudo apt install -y git
            elif command -v dnf &>/dev/null; then
                sudo dnf install -y git
            elif command -v pacman &>/dev/null; then
                sudo pacman -S --noconfirm git
            else
                echo "Error: couldn't detect package manager. Install git manually."
                exit 1
            fi
            ;;
    esac
    ok "Git installed"
}

# ── Clone Repo ──────────────────────────────────────────────────────────────

clone_repo() {
    if [ -d "$INSTALL_DIR" ]; then
        ok "opoclaw already exists at $INSTALL_DIR — pulling latest"
        cd "$INSTALL_DIR"
        git pull --rebase
        return
    fi

    info "Cloning opoclaw to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Repo cloned"
}

# ── Install Dependencies ────────────────────────────────────────────────────

install_deps() {
    info "Installing dependencies..."
    cd "$INSTALL_DIR"
    bun install
    ok "Dependencies installed"
}

# ── Create Bin Symlink ──────────────────────────────────────────────────────

create_symlink() {
    mkdir -p "$BIN_DIR"
    ln -sf "$INSTALL_DIR/installers/onboard.ts" "$BIN_DIR/opoclaw"
    chmod +x "$BIN_DIR/opoclaw"
    ok "Symlinked $BIN_DIR/opoclaw"

    # Check if bin dir is in PATH
    case ":$PATH:" in
        *":$BIN_DIR:"*) 
            ok "$BIN_DIR is in PATH"
            ;;
        *)
            echo ""
            echo -e "${YELLOW}⚠ Add this to your shell config (.zshrc / .bashrc):${RESET}"
            echo "  export PATH=\"$BIN_DIR:\$PATH\""
            echo ""
            ;;
    esac
}

# ── Main ────────────────────────────────────────────────────────────────────

header "Checking dependencies"
case "$OS" in
    macos) install_brew_macos ;;
esac
ensure_git
install_bun

header "Setting up opoclaw"
clone_repo
install_deps
create_symlink

header "Launching onboard wizard"
cd "$INSTALL_DIR"
bun run installers/onboard.ts
