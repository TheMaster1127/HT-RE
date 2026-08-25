# ⚡ HT-RE – Web-Based Reverse Engineering Environment

---

## Table of Contents

1. [Introduction](#introduction)
2. [Why Use HT-RE?](#why-use-ht-re)
3. [Key Features Overview](#key-features-overview)
4. [Prerequisites & Dependencies](#prerequisites--dependencies)
5. [Installing `binpatch` (Required Dependency)](#installing-binpatch-required-dependency)
6. [Installation & Setup](#installation--setup)
7. [Workflow & Usage Guide](#workflow--usage-guide)
8. [License](#license)

---

## Introduction

`HT-RE` is a fast, dependency-light, web-based Graphical User Interface for Reverse Engineering and Binary Patching. Designed natively for Linux, it brings standard GNU utilities (`objdump`, `readelf`, `xxd`, `strings`, `as`, `objcopy`), the Ghidra Headless Decompiler, and the `binpatch` utility into a unified, responsive browser workspace.

Instead of opening heavy desktop applications, `HT-RE` lets you dissect, decompile, patch, convert data representations, inspect CPU memory, and calculate relative jumps directly in your browser with persistent SHA-256 caching and an integrated multi-window desktop environment.

---

## Why Use HT-RE?

Traditional reverse engineering workflows often require juggling terminal windows, hex editors, disassemblers, calculators, and decompilers. `HT-RE` integrates these tools into a single interface:
- **Instant Context Navigation:** Click memory addresses in disassembly, headers, or strings to jump directly to instruction offsets.
- **Headless Ghidra Decompilation:** Runs Ghidra in the background, extracting C/C++ source and caching it permanently using SHA-256 file hashes for instant loading across sessions.
- **Multi-Project Workspace:** Open and switch between multiple binaries in tabs without losing disassembly state, window layouts, or calculator data.
- **Floating Multi-Window Environment:** Open multiple functions side-by-side, reorder tabs via drag-and-drop, pop tabs into separate windows, and manage views with a top-bar dock taskbar.
- **Data & RE Calculator Arsenal:** Spawn unlimited bitwise scientific calculators, convert between data types (including Float16, Float32, Float64), swap endianness, and encode/decode UTF-8, UTF-16LE, and ANSI strings.

---

## Key Features Overview

- **Multi-Project Tabs:** Load multiple ELF binaries into workspace tabs. Switch between binaries while preserving full scroll positions, disassemblies, floating windows, and calculator states.
- **Floating Multi-Window Desktop:**
  - Multi-tab floating windows with independent Ace Editor instances.
  - HTML5 drag-and-drop tab reordering and right-click tab detaching ("Pop into New Window").
  - Window controls: Center on screen, minimize to top taskbar dock, maximize, and resize.
  - Sidebar context menus to open functions in active or new windows.
  - Interactive font size scaling (`A+` / `A-`) and symbol double-click jumping inside decompiled C/C++ code.
- **Virtual DOM Scroller:** Renders massive 100,000+ line disassemblies smoothly with sub-millisecond updates and syntax highlighting.
- **Persistent Tab Memory:** Remembers your exact scroll position and output state across all tabs (`Disassembly`, `Hex Dump`, `Strings`, `Found Strings`, `Header`, `Sections`, `Relocs`).
- **"All In One" Decompilation:** Stitches all Ghidra-decompiled C/C++ functions into a single source view (with `main` or `_start` organized at the bottom) for readable top-down analysis.
- **Dis/Assembler Tool:** Convert assembly instructions (e.g. `mov r1, #55` or `xor eax, eax`) directly to machine hex bytes (`e3 a0 10 37` / `31 c0`) and vice-versa for `x86-64`, `ARM`, and `AArch64`.
- **Integrated `binpatch` GUI:** Search byte patterns (exact or heuristic), apply hex patches with automatic `.bak` backups, and disassemble functions with "Stream Until Return" support.
- **Infinite RE Calculators:** Spawn unlimited calculators with:
  - Base translation outputs (Dec, Hex, Bin).
  - Space-insensitive and prefix-free Hex interpretation (e.g. `FF + 20`).
  - CPU-accurate bit-width bounding (`8-bit`, `16-bit`, `32-bit`, `64-bit`, `Unlimited`).
  - Bitwise operations (AND, OR, XOR, LSH, RSH, NOT) and custom functions (`bswap32`, `bswap64`, `rol`, `ror`).
  - Interactive calculation histories.
- **Memory & Float Conversions:** Real-time conversions across Hex, Binary, Octal, Int8/16/32/64, UInt8/16/32/64, Float16 (Half), Float32 (Single), and Float64 (Double).
- **Multi-Encoding String Converter:** Encode and decode text to hex across UTF-8, UTF-16LE (Windows Wide), and ANSI (Windows-1252).
- **Full ASCII Reference Table:** Top-to-bottom 3-column reference covering all 256 standard, control, and extended ASCII characters.
- **Relative Jump Calculator:** Calculate displacement offsets and destination targets in both Hex and Decimal.
- **Granular JSON Workspace Exporter:** Selectively export headers, sections, disassembly segments, decompiled C/C++ functions, and custom binpatch runs into standalone JSON reports.

---

## Prerequisites & Dependencies

`HT-RE` is built for **Linux environments** (utilizing standard Linux ELF tools).

### 1. Python 3.6+ & Flask
Install Flask for the backend server:
```bash
pip install flask
```

### 2. GNU Binutils
Required for disassembly, symbol extraction, and binary inspection:
```bash
# Arch / Artix Linux
sudo pacman -S binutils

# Debian / Ubuntu
sudo apt install binutils
```

### 3. Ghidra (For C/C++ Decompilation)
Ghidra must be installed on your system. `HT-RE` automatically looks for `analyzeHeadless` in common directories (`/opt/ghidra/`, `~/Downloads/ghidra_.../`, `/usr/lib/ghidra/`).

If installed in a custom path, set `GHIDRA_HOME` before launching `HT-RE`:
```bash
export GHIDRA_HOME="/path/to/your/ghidra_directory"
```

---

## Installing `binpatch` (Required Dependency)

To use the **Patch/Find** tab and custom export commands, install `binpatch` globally:

- GitHub: [https://github.com/TheMaster1127/binpatch](https://github.com/TheMaster1127/binpatch)
- GitLab: [https://gitlab.com/TheMaster1127/binpatch](https://gitlab.com/TheMaster1127/binpatch)

### System-wide Installation (Linux)

```bash
git clone https://github.com/TheMaster1127/binpatch.git
cd binpatch
sudo cp binpatch /usr/local/bin/binpatch
sudo chmod +x /usr/local/bin/binpatch
```

*(Alternatively, install using `wget`):*
```bash
sudo wget https://raw.githubusercontent.com/TheMaster1127/binpatch/main/binpatch -O /usr/local/bin/binpatch && sudo chmod +x /usr/local/bin/binpatch
```

---

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TheMaster1127/HT-RE.git
   cd HT-RE
   ```

2. **Start the server:**
   ```bash
   python3 server.py
   ```

3. **Open the application:**
   Navigate your browser to:
   ```text
   http://localhost:8000
   ```

---

## Workflow & Usage Guide

1. **Load Binaries:** Enter the absolute path to an executable in the top input box or click **📁 Browse** to upload an executable from your local file system.
2. **Decompile All:** Click **⚡ Decompile All** in the left sidebar to run batch headless decompilation across all symbol mappings. Once finished, a `✓ Decompiled Already` indicator will appear.
3. **Open Function Windows:**
   - Double-click any function in the sidebar to open it in a floating window.
   - Right-click functions to open them in new windows, tabbed views, or jump to them in the disassembly.
4. **Window Management:**
   - Drag windows by their title bars.
   - Reorder tabs using drag-and-drop or right-click to pop tabs into standalone windows.
   - Use window controls to center, minimize to the top taskbar dock, or maximize windows.
5. **Inspect & Disassemble:**
   - Switch between **Header / Info**, **Sections**, **Disassembly**, **Hex Dump**, **Relocs**, and **Strings**.
   - Your scroll position is preserved when switching back and forth between tabs.
6. **Patch & Assemble:**
   - Use the **Patch/Find (binpatch)** tab to locate signatures, resolve function boundaries, and apply patches.
   - Use the **Dis/Assembler** tab to convert between mnemonics and opcodes.
7. **Calculate & Convert:**
   - Open the **Data / Calc** tab to perform register simulations, IEEE float conversions, and relative jump calculations.
   - Spawn multiple **RE Scientific Calculators** side-by-side.
8. **Export Workspace:** Click **Export JSON**, select the desired headers, strings, disassembly chunks, and decompiled C/C++ functions, and download a structured JSON archive.

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.html).
