#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Rust Learning System - Build Script  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Rust/Cargo is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/4]${NC} Installing npm dependencies..."
npm install --silent

echo -e "${YELLOW}[2/4]${NC} Building frontend with Vite..."
npm run build

echo -e "${YELLOW}[3/4]${NC} Building Tauri application (release)..."
cd src-tauri
cargo build --release 2>&1 | grep -E "(Compiling rust-learn|Finished|error|warning:)"
cd ..

echo -e "${YELLOW}[4/4]${NC} Creating application bundle..."
CI=false npx tauri build 2>&1 | tail -20

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Build Complete!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Output locations:"
echo -e "  ${BLUE}App:${NC} src-tauri/target/release/bundle/macos/Rust Learning System.app"
echo -e "  ${BLUE}DMG:${NC} src-tauri/target/release/bundle/dmg/"
echo ""
echo -e "To run the app:"
echo -e "  open \"src-tauri/target/release/bundle/macos/Rust Learning System.app\""
echo ""
