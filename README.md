# ⚡ HT-RE – Web-Based Reverse Engineering & Binary Analysis Environment

---

## 📑 Table of Contents

1. [Introduction](#introduction)
2. [Why Use HT-RE?](#why-use-ht-re)
3. [Core Feature Highlights](#core-feature-highlights)
4. [Architecture Overview](#architecture-overview)
5. [Prerequisites & Dependencies](#prerequisites--dependencies)
6. [Installing `binpatch` (Required Dependency)](#installing-binpatch-required-dependency)
7. [Installation & Setup](#installation--setup)
8. [Comprehensive Workflow & Usage Guide](#comprehensive-workflow--usage-guide)
9. [Project Workspaces & Multi-Binary Tabs](#project-workspaces--multi-binary-tabs)
10. [Floating Multi-Window Desktop (MWM)](#floating-multi-window-desktop-mwm)
11. [Embedded Multi-File C/C++ & Assembly IDE](#embedded-multi-file-cc-assembly-ide)
12. [RE Scientific Calculators & Converter Suite](#re-scientific-calculators--converter-suite)
13. [Headless Ghidra & Combined Decompilation](#headless-ghidra--combined-decompilation)
14. [Dis/Assembler & `binpatch` Interface](#disassembler--binpatch-interface)
15. [Granular JSON Workspace Exporter](#granular-json-workspace-exporter)
16. [License](#license)

---

## Introduction

`HT-RE` is a dependency-light, high-performance, web-based Graphical User Interface and reverse engineering suite natively designed for Linux. It unifies standard GNU utilities (`objdump`, `readelf`, `xxd`, `strings`, `as`, `objcopy`), the NSA Ghidra Headless Decompiler (`analyzeHeadless`), an embedded multi-file C/C++/Assembly IDE, an infinite spawnable RE scientific calculator arsenal, and the `binpatch` binary patching tool into a responsive, zero-build single-page web workspace.

Instead of juggling multiple terminal windows, heavyweight desktop GUI disassemblers, hex editors, and external scratchpads, `HT-RE` provides a consolidated environment with persistent SHA-256 disk caching, real-time scroll synchronization, multi-binary project management, and floating multi-window analysis.

---

## Why Use HT-RE?

Traditional reverse engineering workflows often involve switching between terminals, disassemblers, decompilers, standalone calculators, and patch tools. `HT-RE` solves these workflow bottlenecks:

- **Zero Frontend Build Pipeline:** 100% Vanilla JavaScript executing directly on the browser's V8 engine with sub-millisecond DOM manipulation and no Webpack, Babel, or Node.js runtime required.
- **Persistent SHA-256 Decompilation Caching:** Background Ghidra decompilation results are indexed permanently on disk by file hash (`.htre_cache/<sha256>.json`), eliminating redundant recompilation across sessions.
- **True Multi-Project Workspaces:** Load and switch between multiple ELF binaries in top-bar tabs without losing disassembly state, scroll positions, calculator inputs, or open floating windows.
- **Snapshot Navigation & Jump History:** Click memory addresses in disassembly, headers, or strings to jump directly to instruction offsets, and use the `◀` (Back) button to return to your exact previous pixel and line coordinates.
- **Isolated Multi-Calculator System:** Spawn unlimited mathematical and bitwise calculators side-by-side with independent calculation histories, base toggling (Dec/Hex/Bin), and bit-width constraints (defaulting to Unlimited Float).
- **Embedded C/C++/Assembly IDE:** Write, compile, and immediately load binaries directly into HT-RE using standard or custom cross-compilers with granular compilation flags.

---

## Core Feature Highlights

- **Multi-Project Workspace Tabs:** Seamlessly switch between multiple open binaries while preserving independent scroll positions, active tab states, and isolated calculator scratchpads.
- **Floating Multi-Window Desktop Environment:**
  - Multi-tab floating windows with independent `Ace Editor` instances (`vibrant_ink` theme).
  - HTML5 drag-and-drop tab reordering and right-click tab detaching ("Pop into New Window").
  - Window controls: Center on screen, minimize to top taskbar dock, maximize, and resize.
  - Interactive font scaling (`A+` / `A-`) and symbol double-click jumping in decompiled source.
  - Context menu inline token converter (Hex ↔ Dec ↔ ASCII).
- **High-Performance Virtual DOM Scroller:** Renders 100,000+ line disassemblies smoothly using windowed DOM translation and real-time scroll recording.
- **Permanent Tab Memory:** Preserves outputs and exact scroll positions across all views (`Disassembly`, `Hex Dump`, `Strings`, `Found Strings`, `Header / Info`, `Sections`, `Relocs`).
- **Ghidra "All in One" Combined View:** Stitches all Ghidra-decompiled C/C++ functions into a single source view, filtering compiler stubs and pinning `main` (or `_start`) to the bottom for readable top-down execution flow.
- **Embedded Multi-File Compiler IDE:**
  - Create, rename, edit, and delete multiple C, C++, and Assembly project files with real-time `localStorage` persistence.
  - Pre-configured compilers: GCC, G++, Clang, NASM, FASM, GAS, ARM32 GCC/GAS, AArch64 GCC/GAS, and user-defined Custom Compilers.
  - Pre-set flag selectors: `-static`, `-pie`, `-fPIE`, `-fPIC`, `-m32`, `-m64`, `-O0`..`-O3`, `-Os`, `-g`, `-z execstack`, `-z relro`, etc.
  - Compiled binaries registry with one-click workspace loading and deletion.
- **Infinite RE Scientific Calculators:**
  - Unlimited spawnable calculators with prefix-free hex interpretation (e.g. `4A00 + FF`).
  - Bit-width bounding (`Unlimited (Float)`, `8-bit`, `16-bit`, `32-bit`, `64-bit`).
  - Bitwise operations (AND, OR, XOR, NOT, LSH, RSH) and custom RE functions (`bswap32`, `bswap64`, `rol`, `ror`).
  - Interactive history log: click any past calculation to reload the expression.
- **CPU Memory & Float Converter:** Real-time bidirectional conversions across Hex, Binary, Octal, Int8..Int64, UInt8..UInt64, Float16 (IEEE 754 Half), Float32, and Float64.
- **Multi-Encoding String Tool:** Text ↔ Hex converter supporting UTF-8 / ASCII, UTF-16LE (Windows Wide Strings), and ANSI (Windows-1252).
- **ASCII Control & Extended Reference:** Top-to-bottom 3-column reference covering all 256 standard, control, and extended ASCII entries.
- **Relative Jump Calculator:** Compute displacement offsets and destination targets in both Hex and Decimal.
- **`binpatch` Visual Interface:** Apply byte patches with automatic `.bak` backups, perform exact/heuristic scans, and disassemble functions with "Stream Until Return" support.
- **Bi-directional Dis/Assembler:** Convert assembly mnemonics to machine opcodes and vice-versa for `x86-64`, `ARM`, and `AArch64`.
- **Granular JSON Workspace Exporter:** Selectively export headers, sections, disassembly segments, decompiled source, and hex dumps into offline JSON reports.

---

## Architecture Overview

```text
+-----------------------------------------------------------------------------------+
|                           HT-RE Vanilla JS Frontend                               |
|  +-----------------------------------------------------------------------------+  |
|  | Multi-Project Tab Bar  |  Top Window Taskbar Dock  |  History & Global Action|  |
|  +-----------------------------------------------------------------------------+  |
|  | Sidebar: Symbol List (nm) | Main Viewport: Virtual DOM Scroller / IDE / Calc |  |
|  | - nm function parser      | - Disassembly (objdump -D) with live string res |  |
|  | - Batch Ghidra trigger    | - Hex Dump (xxd) with byte-level highlighting   |  |
|  | - Combined View trigger   | - Floating Modals (Ace Editor + Tabbed Views)   |  |
|  +-----------------------------------------------------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           | REST JSON API (HTTP POST/GET)
                                           v
+-----------------------------------------------------------------------------------+
|                           Python / Flask Backend Proxy                            |
|  +-----------------------------------------------------------------------------+  |
|  | /api/load, /api/upload, /api/nm, /api/objdump-d, /api/function_code         |  |
|  | /api/decompile, /api/decompile_all, /api/generic, /api/binpatch, /api/export|  |
|  +-----------------------------------------------------------------------------+  |
|  | Toolchain Probing (x86-64 / ARM / AArch64) | SHA-256 Cache (.htre_cache/)   |  |
+-------------------+---------------------------------------+-----------------------+
                    |                                       |
                    v                                       v
+---------------------------------------+   +---------------------------------------+
|          GNU Binutils Suite           |   |      Ghidra Headless JVM Bridge       |
|  objdump | readelf | xxd | strings    |   |  analyzeHeadless + Java Scripts:      |
|  as | objcopy | binpatch | gcc | g++  |   |  - DecompileHeadless.java (Single)    |
+---------------------------------------+   |  - DecompileAll.java (Batch PIE Base) |
                                            +---------------------------------------+
```

---

## Prerequisites & Dependencies

`HT-RE` is designed for **Linux operating systems** (utilizing standard Linux binary utilities).

### 1. Python 3.6+ & Flask
Install Flask for the local proxy server:
```bash
pip install flask
```

### 2. GNU Binutils & Toolchains
Required for disassembly, symbol extraction, and binary inspection:
```bash
# Arch / Artix Linux
sudo pacman -S binutils gcc g++ clang  fasm

# Debian / Ubuntu / Kali Linux
sudo apt update && sudo apt install binutils gcc g++ clang fasm
```

### 3. Ghidra (For C/C++ Decompilation)
Ghidra must be installed on your system. `HT-RE` automatically searches for `analyzeHeadless` in common system directories (`/opt/ghidra/`, `~/Downloads/ghidra_.../`, `/usr/lib/ghidra/`, `~/.local/share/ghidra/`).

If Ghidra is installed in a custom location, export `GHIDRA_HOME` before launching:
```bash
export GHIDRA_HOME="/path/to/your/ghidra_directory"
```

---

## Installing `binpatch` (Required Dependency)

To use the **Patch/Find** tab and custom export commands, install `binpatch` globally:

- GitHub: [https://github.com/TheMaster1127/binpatch](https://github.com/TheMaster1127/binpatch)
- GitLab: [https://gitlab.com/TheMaster1127/binpatch](https://gitlab.com/TheMaster1127/binpatch)

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

2. **Start the backend server:**
   ```bash
   python3 server.py
   ```

3. **Launch the interface:**
   Open your browser to:
   ```text
   http://localhost:8000
   ```

---

## Comprehensive Workflow & Usage Guide

### 1. Loading & Inspecting Binaries
- **Direct Path:** Type an absolute path (e.g. `/usr/bin/ls`) into the top input bar and click **LOAD** or press `Enter`.
- **File Picker:** Click **📁 Browse** to upload an executable from your local file system. Uploaded binaries are stored with executable permissions in `.htre_uploads/`.
- **History Dropdown:** Access recently analyzed binaries with one click, or remove items using the `×` button.

### 2. Multi-Project Workspaces
- Open multiple binaries simultaneously. Each binary receives a workspace tab in the top navigation bar.
- Switching between tabs automatically saves and restores:
  - Exact scroll position across all views (`Disassembly`, `Hex Dump`, `Strings`, etc.).
  - The active view tab.
  - Floating window layouts and Ace Editor sessions.
  - Data converter inputs and all spawned RE calculators.

### 3. Disassembly & Navigation
- Click **Disassembly** to view the full disassembled binary with automatic syntax highlighting and RIP-relative string resolutions.
- Click on any highlighted hexadecimal address (e.g. `0x401140`) or symbol tag (e.g. `<main>`) to jump directly to that location.
- Use the **◀** button to go back through your jump history with exact pixel-level restoration.
- Use the **Jump Address/Offset** input to leap to arbitrary virtual addresses or file offsets.
- Use the **Search text/hex** bar to locate instruction patterns, or click **Find All** to open a side-panel listing all matches with one-click navigation.

### 4. Floating Multi-Window Desktop (MWM)
- **Opening Windows:** Double-click any function in the left sidebar to open it in a floating window.
- **Context Menus:** Right-click a function to open it in a new window, add it as a tab in the active window, jump to it in disassembly, or copy its symbol/address.
- **Tabs within Windows:** Drag and drop tabs to reorder them, or right-click a tab to "Pop into New Window" or close surrounding tabs.
- **View Toggle:** Switch between **ASM** (disassembly) and **Decompile (C/C++)** inside the modal.
- **Code Editing:** The embedded Ace Editor allows editing decompiled source. Edits are tracked in memory and preserved across tab switches. Click **Restore** to revert to original Ghidra output.
- **Inline Token Conversion:** Right-click any hex or decimal literal in the Ace Editor to convert it between Hex, Decimal, and ASCII in place.
- **Taskbar Dock:** Minimize windows to the top taskbar dock (`_`) and restore them by clicking their taskbar icon.

### 5. Decompilation Operations
- **Single Function:** Click **Decompile (C/C++)** in any function window to trigger Ghidra on-demand.
- **Batch Decompilation:** Click **⚡ Decompile All** in the left sidebar to decompile all symbols in the background. Once completed, `[C]` or `[C++]` badges will appear next to cached functions. If already cached, HT-RE will prompt before re-running.
- **Show All in One:** Click **Show All in One (C/C++)** to open a unified source view. HT-RE stitches all decompiled functions together, cleans compiler artifacts, and organizes `main` or `_start` at the bottom for clean top-down reading.

### 6. C/C++ & Assembly IDE
- Switch to the **C/C++ IDE** tab to write and compile source files without leaving the browser.
- Create multiple files (`.c`, `.cpp`, `.asm`, `.s`) with automatic language and compiler detection.
- Select target compilers (GCC, G++, Clang, NASM, FASM, GAS, ARM, AArch64) or add custom toolchains.
- Toggle compilation flags (`-static`, `-pie`, `-O0`..`-O3`, `-g`, `-z execstack`, etc.) and click **⚡ COMPILE**.
- Compiled artifacts appear in the **Compiled Binaries** list and can be loaded directly into HT-RE with one click.

### 7. Data Converters & RE Calculators
- Switch to the **Data / Calc** tab to access CPU register simulations and mathematical tools.
- **Number Converter:** Enter values in Hex, Binary, Octal, Int8..Int64, UInt8..UInt64, Float16, Float32, or Float64. All fields update bidirectionally in real time with invalid-character input blocking.
- **Endianness Swapper:** Reverses byte order between Little Endian and Big Endian.
- **Multi-Encoding Strings:** Encode/decode text across UTF-8, UTF-16LE, and ANSI (Windows-1252).
- **Relative Jump Calculator:** Compute displacement offsets and destination addresses in Hex and Dec.
- **RE Scientific Calculators:** Click **➕ Spawn Calculator** to spawn multiple independent calculators. Default to `Unlimited (Float)` or clamp to 8/16/32/64-bit widths with Dec/Hex/Bin base switching and bitwise functions (`bswap32`, `bswap64`, `rol`, `ror`).

### 8. Patching & Dis/Assembler
- **Patch/Find (binpatch):**
  - *Write / Patch:* Overwrite bytes at offsets (`-o`) or virtual addresses (`-va`) with automatic `.bak` backups.
  - *Search / Find:* Execute exact (`-f`) or wildcard heuristic (`-fh`) byte scans.
  - *Disassemble:* Resolve and stream disassembly from offsets or entry points (`-m`, `-e`).
  - *Patch History:* View and restore previous backups with one click.
- **Dis/Assembler:** Convert raw assembly instructions to machine hex bytes and vice-versa for x86-64, ARM, and AArch64.

### 9. Workspace Export
- Click **Export JSON** to open the granular export modal.
- Selectively include ELF headers, section tables, found strings, raw strings, bounded hex dumps, custom `binpatch` executions, and per-function ASM or decompiled C/C++ source.
- Click **Download JSON** to generate and download a comprehensive analysis report.

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.html).
