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
9. [Tutorial: Debugging PIE & Stripped Binaries](#tutorial-debugging-pie--stripped-binaries)
10. [Project Workspaces & Multi-Binary Tabs](#project-workspaces--multi-binary-tabs)
11. [Floating Multi-Window Desktop (MWM)](#floating-multi-window-desktop-mwm)
12. [Embedded Multi-File C/C++ & Assembly IDE](#embedded-multi-file-cc--assembly-ide)
13. [Run / Trace / Hook (Debugger, Emulation & Syscalls)](#run--trace--hook-debugger-emulation--syscalls)
14. [Firmware & Signature Scanner (`binwalk`)](#firmware--signature-scanner-binwalk)
15. [RE Scientific Calculators & Converter Suite](#re-scientific-calculators--converter-suite)
16. [Headless Ghidra & Combined Decompilation](#headless-ghidra--combined-decompilation)
17. [Dis/Assembler & `binpatch` Interface](#disassembler--binpatch-interface)
18. [Granular JSON Workspace Exporter](#granular-json-workspace-exporter)
19. [Workflow Exporting (AI / Peer Sharing)](#workflow-exporting-ai--peer-sharing)
20. [License](#license)

---

## Introduction

`HT-RE` is a dependency-light, high-performance, web-based Graphical User Interface and reverse engineering suite natively designed for Linux. It unifies standard GNU utilities (`objdump`, `readelf`, `xxd`, `strings`, `as`, `objcopy`), the NSA Ghidra Headless Decompiler (`analyzeHeadless`), an interactive GDB/MI debugger with QEMU user-mode emulation, live system call & socket tracing, an embedded multi-file C/C++/Assembly IDE, an infinite spawnable RE scientific calculator arsenal, firmware signature analysis (`binwalk`), and the `binpatch` binary patching tool into a responsive, zero-build single-page web workspace.

Instead of juggling multiple terminal windows, heavyweight desktop GUI disassemblers, hex editors, and external scratchpads, `HT-RE` provides a consolidated environment with persistent SHA-256 disk caching, real-time scroll synchronization, multi-binary project management, dynamic execution tracing, and floating multi-window analysis.

---

## Why Use HT-RE?

Traditional reverse engineering workflows often involve switching between terminals, disassemblers, decompilers, standalone calculators, and patch tools. `HT-RE` solves these workflow bottlenecks:

- **Zero Frontend Build Pipeline:** 100% Vanilla JavaScript executing directly on the browser's V8 engine with sub-millisecond DOM manipulation and no Webpack, Babel, or Node.js runtime required.
- **Dynamic Emulation & Live Inspection:** Debug and step through x86-64, ARM, and AArch64 binaries inside user-mode QEMU with real-time CPU register inspection, memory extraction, and in-flight register value editing.
- **Pseudo-Terminal (PTY) Output:** Solves the notorious C library block-buffering issue. You will see `printf` output instantly in the terminal without having to wait for the program to exit or flush.
- **Live System Call & Socket Extraction:** Capture `write()`, `mmap()`, `execve()`, and socket communications (`connect`, `sendto`, `recvfrom`) in real time as the program executes.
- **Dedicated Target Program I/O Terminal:** View program standard output (`stdout`) and standard error (`stderr`) isolated from debugger internal logs.
- **Persistent SHA-256 Decompilation Caching:** Background Ghidra decompilation results are indexed permanently on disk by file hash (`.htre_cache/<sha256>.json`), eliminating redundant decompilation across sessions.
- **True Multi-Project Workspaces:** Load and switch between multiple ELF binaries in top-bar tabs without losing disassembly state, scroll positions, debugger breakpoints, calculator inputs, or open floating windows.
- **Snapshot Navigation & Jump History:** Click memory addresses in disassembly, headers, or strings to jump directly to instruction offsets, and use the `◀` (Back) button to return to your exact previous pixel and line coordinates.
- **Embedded C/C++/Assembly IDE:** Write, compile, and immediately load binaries directly into HT-RE using standard or custom cross-compilers with granular compilation flags.

---

## Core Feature Highlights

- **Multi-Project Workspace Tabs:** Seamlessly switch between multiple open binaries while preserving independent scroll positions, active tab states, debugger breakpoints, and isolated calculator scratchpads.
- **Run / Trace / Hook (Interactive Debugger & Tracing Engine):**
  - Multi-architecture execution with user-mode QEMU (`qemu-x86_64`, `qemu-arm`, `qemu-aarch64`) or native host execution via secure PTY streams.
  - GDB/MI machine interface control: Start, Continue, Step In (single instruction), Step Over, and Stop.
  - Breakpoint manager supporting raw virtual memory addresses (e.g. `0x401140`) and symbol name offsets (e.g. `*main+0x7c`).
  - Live CPU Registers grid: Displays all general-purpose and instruction pointer registers with on-the-fly value editing.
  - Memory & Stack Inspector: Dump paginated hex blocks of live running memory and scroll up/down dynamically.
  - Dual-stream capture: Captures live system calls via QEMU `-strace` and program console output (`stdout`/`stderr`) in isolated terminals.
  - Universal font zooming (`A+` / `A-`) scaling all debug terminals and register cards.
- **Firmware & Signature Scanner (`binwalk`):**
  - Scan for embedded headers, archives, and compressed file structures.
  - Extract payloads (`-e`) with an interactive directory tree viewer.
  - Calculate and plot file entropy metrics (`-E`).
- **Floating Multi-Window Desktop Environment:**
  - Multi-tab floating windows with independent `Ace Editor` instances (`vibrant_ink` theme).
  - HTML5 drag-and-drop tab reordering and right-click tab detaching ("Pop into New Window").
  - Window controls: Center on screen, minimize to top taskbar dock, maximize, and resize.
  - Interactive font scaling (`A+` / `A-`) and symbol double-click jumping in decompiled source.
  - Context menu inline token converter (Hex ↔ Dec ↔ ASCII).
- **High-Performance Virtual DOM Scroller:** Renders 100,000+ line disassemblies smoothly using windowed DOM translation and real-time scroll recording.
- **Permanent Tab Memory:** Preserves outputs and exact scroll positions across all views (`Disassembly`, `Hex Dump`, `Strings`, `Found Strings`, `Header / Info`, `Sections`, `Relocs`, `Run / Trace / Hook`).
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
- **CPU Memory & Float Converter:** Real-time bidirectional conversions across Hex, Binary, Octal, Int8..Int64, UInt8..UInt64, Float16 (IEEE 754 Half), Float32, and Float64.
- **Multi-Encoding String Tool:** Text ↔ Hex converter supporting UTF-8 / ASCII, UTF-16LE (Windows Wide Strings), and ANSI (Windows-1252).
- **ASCII Control & Extended Reference:** Top-to-bottom 3-column reference covering all 256 standard, control, and extended ASCII entries.
- **Relative Jump Calculator:** Compute displacement offsets and destination targets in both Hex and Decimal.
- **`binpatch` Visual Interface:** Apply byte patches with automatic `.bak` backups, perform exact/heuristic scans, disassemble functions with "Stream Until Return" support, and delete redundant backups.
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
|  | - Batch Ghidra trigger    | - Run / Trace / Hook: Debugger, Registers, I/O  |  |
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
|  | /api/debug/start, /api/debug/cmd, /api/debug/poll, /api/debug/registers     |  |
|  | /api/debug/read_memory, /api/debug/set_reg, /api/debug/trace, /api/debug/binwalk|  |
|  +-----------------------------------------------------------------------------+  |
|  | Toolchain Probing (x86-64 / ARM / AArch64) | SHA-256 Cache (.htre_cache/)   |  |
+-------------------+---------------------------------------+-----------------------+
                    |                                       |
                    v                                       v
+---------------------------------------+   +---------------------------------------+
|    GNU Binutils & Emulation Suite     |   |      Ghidra Headless JVM Bridge       |
|  objdump | readelf | xxd | strings    |   |  analyzeHeadless + Java Scripts:      |
|  as | objcopy | binpatch | gcc | g++  |   |  - DecompileHeadless.java (Single)    |
|  gdb | qemu-user | strace | binwalk   |   |  - DecompileAll.java (Batch PIE Base) |
+---------------------------------------+   +---------------------------------------+
```

---

## Prerequisites & Dependencies

`HT-RE` is designed for **Linux operating systems** (utilizing standard Linux binary utilities).

### 1. Python 3.6+ & Flask
Install Flask for the local proxy server:
```bash
pip install flask
```

### 2. GNU Binutils, Toolchains, QEMU & Debug Tools
Required for disassembly, compilation, emulation, and dynamic debugging:
```bash
# Arch / Artix Linux
sudo pacman -S binutils gcc g++ clang nasm fasm gdb qemu-user strace binwalk tree

# Debian / Ubuntu / Kali Linux
sudo apt update && sudo apt install binutils gcc g++ clang nasm fasm gdb gdb-multiarch qemu-user strace binwalk tree
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
  - Active debugger session parameters, breakpoints, and live registers.
  - Floating window layouts and Ace Editor sessions.
  - Data converter inputs and all spawned RE calculators.

### 3. Disassembly & Navigation
- Click **Disassembly** to view the full disassembled binary with automatic syntax highlighting and RIP-relative string resolutions.
- Click on any highlighted hexadecimal address (e.g. `0x401140`) or symbol tag (e.g. `<main>`) to jump directly to that location.
- Use the **◀** button to go back through your jump history with exact pixel-level restoration.
- Use the **Jump Address/Offset** input to leap to arbitrary virtual addresses or file offsets.
- Use the **Search text/hex** bar to locate instruction patterns, or click **Find All** to open a side-panel listing all matches with one-click navigation.

### 4. Run / Trace / Hook (Debugger, Emulation & Syscalls)
- Switch to the **Run / Trace / Hook** tab for dynamic execution and debugging:
  - **Breakpoints:** Add virtual memory addresses (e.g. `0x401140`) or symbol offsets (e.g. `*main+0x20`) to the breakpoint table. Click `✕` to delete breakpoints.
  - **Execution Controls:** Click **▶ Start** to launch the target suspended at its entry point inside QEMU. Use **⏭ Continue**, **⬇ Step In** (single instruction step), **⤵ Step Over**, or **⏹ Stop**.
  - **CPU Registers Grid:** View real-time CPU registers in Hex. Click any register row to load its value into the editor bar, type a new value, and click **Set** to mutate memory/registers mid-execution.
  - **Memory & Stack Inspector:** Enter an address (`0x400000`), a register (`$sp`, `$pc`), or a symbol offset (`*main+0x10`) to extract raw memory. Use the `↑` and `↓` buttons to automatically scroll up and down through live memory pages.
  - **Live Program Output:** Observe printed console text instantly via the PTY bridge in the **Program I/O (stdout / stderr)** terminal.
  - **System Call & Socket Hooks:** Live kernel system calls and network operations (`connect`, `send`, `recv`) appear in the tracing cards in real time.
  - **Font Scaling:** Use `A+` / `A-` in the top bar to scale all terminals, hex dumps, and register cards.

---

## Tutorial: Debugging PIE & Stripped Binaries

By default, modern C compilers create **Position Independent Executables (PIE)**. This means the OS loads the binary into a random, massive virtual address space (e.g., `0x4000000000`) instead of the traditional `0x400000`.

Because of this, **you cannot set breakpoints on low addresses like `0x11c5`** in GDB before the program runs—that memory doesn't exist yet!

### Method 1: Using Symbols (Standard Binaries)
If your binary has symbols (like `main`), the easiest way to break inside a loop is using **Relative Symbol Offsets**.
1. Look at the disassembly and find your target (e.g., `11c5: cmp DWORD PTR [rbp-0x24], 0x4`).
2. Find the start of the function (e.g., `1149 <main>:`).
3. Use the RE Calculator to subtract: `11c5 - 1149 = 7C`.
4. Add the breakpoint: **`*main+0x7c`**. GDB will automatically figure out where `main` is loaded and add `0x7C` to it.

### Method 2: Dynamic Address Hooking (Stripped Binaries)
If your binary is completely stripped (no `main`, no `_start`, 0 functions found in the sidebar), GDB has no symbols to anchor to.
1. Click **▶ Start** to launch the binary in QEMU.
2. Quickly click **⏹ Stop** to pause execution (or let it wait for an `input()`/`scanf()`).
3. Look at the **CPU Registers** grid and find the Instruction Pointer (`$pc` or `$rip`). It will be sitting at the real mapped address in memory (e.g., `0x4000001050`).
4. You can now use the RE calculator to calculate your offsets from `$pc`. Type **`*$pc+0x20`** into the breakpoint bar to set a trap right ahead of your current execution path.

---

## Workspace Tools

### Firmware & Signature Scanner (`binwalk`)
- In the **Run / Trace / Hook** tab, expand the **Firmware Signatures & Extraction (binwalk)** drawer.
- Select **Extract Payloads (-e)** or **Plot Entropy (-E)** and click **Scan File** to inspect embedded components and navigate carved artifacts in an interactive directory tree.

### C/C++ & Assembly IDE
- Switch to the **C/C++ IDE** tab to write and compile source files without leaving the browser.
- Create multiple files (`.c`, `.cpp`, `.asm`, `.s`) with automatic language and compiler detection.
- Select target compilers (GCC, G++, Clang, NASM, FASM, GAS, ARM, AArch64) or add custom toolchains.
- Toggle compilation flags (`-static`, `-pie`, `-O0`..`-O3`, `-g`, `-z execstack`, etc.) and click **⚡ COMPILE**.
- Compiled artifacts appear in the **Compiled Binaries** list and can be loaded directly into HT-RE with one click.

### Floating Multi-Window Desktop (MWM)
- Double-click any function in the left sidebar to open it in a floating window.
- Drag and drop tabs to reorder them, or right-click a tab to "Pop into New Window".
- Switch between **ASM** and **Decompile (C/C++)** inside the modal.
- Edit decompiled source with live memory sync and right-click inline token conversions (Hex ↔ Dec ↔ ASCII).

### Patching & Dis/Assembler
- **Patch/Find (binpatch):**
  - *Write / Patch:* Overwrite bytes at offsets (`-o`) or virtual addresses (`-va`) with automatic `.bak` backups.
  - *Search / Find:* Execute exact (`-f`) or wildcard heuristic (`-fh`) byte scans.
  - *Patch History:* View, restore, or delete individual backup files (`🗑`).
- **Dis/Assembler:** Convert raw assembly instructions to machine hex bytes and vice-versa for x86-64, ARM, and AArch64.

### Granular Workspace Export
- Click **Export JSON** to selectively include ELF headers, section tables, found strings, raw strings, bounded hex dumps, custom `binpatch` executions, and per-function ASM or decompiled C/C++ source into an offline JSON report.

---

## Workflow Exporting (AI / Peer Sharing)

HT-RE includes an event-tracking mechanism designed to log your exact reverse engineering process. Every time you switch tabs, execute a search, step through code, edit a register, or request a decompilation, a log is saved.

### Why does this exist?
This is **not** telemetric spyware. The logs never leave your machine automatically. The purpose of this feature is to allow you to **export your workflow** by clicking the yellow **🕵 Export Tracking** button in the top bar.

You can feed the resulting `json` file into an AI Language Model (like ChatGPT, Claude, or DeepSeek) and say:
> *"Here is the workflow I just used to analyze this malware. Based on the functions I clicked, the hex values I converted, and the breakpoints I hit, what did I miss?"*

You can also send the file to colleagues to show them exactly how you arrived at a specific vulnerability or patch.

### Disabling the Tracker
If you do not want your browser session to record your UI interactions in memory, you can permanently disable it by opening `static/js/state.js` and changing line 24:
```javascript
const invasive = false; // Change from true to false
```

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.html).
