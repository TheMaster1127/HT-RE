# `HT-RE` – Web-Based Reverse Engineering Environment

---

## Table of Contents

1. [Introduction](#introduction)
2. [Why Use HT-RE?](#why-use-ht-re)
3. [Massive Features Arsenal](#massive-features-arsenal)
4. [Dependencies & Prerequisites](#dependencies--prerequisites)
5. [Installing `binpatch` (Required Dependency)](#installing-binpatch-required-dependency)
6. [Installation & Setup](#installation--setup)
7. [Usage](#usage)
8. [License](#license)

---

## Introduction

`HT-RE` is a blazing-fast, dependency-light, web-based Graphical User Interface for Reverse Engineering and Binary Patching. Designed natively for Linux, it acts as an IDE-like wrapper that seamlessly integrates standard GNU utilities (`objdump`, `readelf`, `xxd`, `strings`), the Ghidra Headless Decompiler, and the `binpatch` utility into a single, cohesive browser application. 

Instead of opening massive, resource-heavy Java GUIs, `HT-RE` lets you dissect, decompile, patch, convert strings, translate CPU memory, and calculate hex jumps directly from your browser with mathematical precision and permanent SHA-256 caching.

---

## Why Use HT-RE?

Traditional reverse engineering workflows often require juggling a terminal, a hex editor, a disassembler, a separate math calculator, an ASCII reference, and a decompiler simultaneously. `HT-RE` bridges this gap entirely:
- **Instant Context:** Click a memory address in the `Header` or `Strings` view and instantly jump to that exact instruction in the `Disassembly` tab.
- **Headless Power:** Uses Ghidra entirely in the background. It extracts the C/C++ decompilation and caches it permanently using the binary's SHA-256 hash. If you restart the server, your decompiled functions load instantly.
- **All-in-One Data Arsenal:** Features a dedicated calculation tab with endless spawnable Reverse Engineering Scientific Calculators, Unicode String conversions, and physical memory Endian swappers.

---

## Massive Features Arsenal

- **"All In One" Decompilation:** Stitches all Ghidra-decompiled C/C++ functions into a single, massive ACE Editor view (putting `main` at the bottom) for easy reading.
- **Dis/Assembler Tool:** Because ARM and AArch64 bytes are impossible to hand-edit blindly, the built-in Dis/Assembler allows you to convert `mov r1, #55` natively into hex bytes (`e3 a0 10 37`) without ever leaving the browser.
- **Infinite RE Calculators:** Spawn infinite calculators side-by-side. Featuring:
  - Base translation outputs (Dec, Hex, Bin).
  - Native space-insensitive Hex interpretation (e.g. `FF + FF` evaluates successfully).
  - CPU-accurate bit-width bounding (`8-bit`, `16-bit`, `32-bit`, `64-bit`).
  - Standard bitwise operators (AND, OR, XOR, LSH, RSH, NOT) and custom functions (`bswap32`, `rol`, `ror`).
- **Memory Type & Float Conversions:** Real-time space-insensitive conversion between Hex, Int8/16/32/64, Unsigned constraints, and Float16/32/64 representations.
- **Multi-Encoding Strings:** Instantly decode raw hex dumps into UTF-8, UTF-16LE (Windows Wide), or ANSI, fully supporting Emojis and Unicode bullets.
- **Full-Screen ASCII Table:** A built-in top-to-bottom 3-column reference sheet for all 256 Extended and Control ASCII characters.
- **Relative Jump Calculator:** Type your current offset and Target address, and calculate the exact memory relative jump required.

---

## Dependencies & Prerequisites

`HT-RE` is built for **Linux environments only** (due to reliance on ELF architecture tools).

### 1. Python 3.6+ & Flask
The backend is driven by Python. You only need to install Flask:
```bash
pip install flask
```

### 2. GNU Binutils
Used for disassembly, string extraction, and header parsing:
```bash
# Arch / Artix Linux
sudo pacman -S binutils

# Debian / Ubuntu
sudo apt install binutils
```

### 3. Ghidra (For C/C++ Decompilation)
You must have Ghidra installed on your system. `HT-RE` will automatically search for the `analyzeHeadless` script in common directories (e.g., `/opt/ghidra/`, `~/Downloads/ghidra_.../`, `/usr/lib/ghidra/`).
If you have Ghidra in a custom location, simply set the environment variable before running `HT-RE`:
```bash
export GHIDRA_HOME="/path/to/your/ghidra_directory"
```

---

## Installing `binpatch` (Required Dependency)

To use the **Patch/Find** tab and custom exports, you need `binpatch` installed globally. 

You can get it from:
- GitHub: [https://github.com/TheMaster1127/binpatch](https://github.com/TheMaster1127/binpatch)
- GitLab: [https://gitlab.com/TheMaster1127/binpatch](https://gitlab.com/TheMaster1127/binpatch)

### System-wide Installation (Linux)

To install `binpatch` so `HT-RE` can interact with it, follow these steps:

1. **Clone the repository and move the script:**
   ```bash
   git clone https://github.com/TheMaster1127/binpatch.git
   cd binpatch
   sudo cp binpatch /usr/local/bin/binpatch
   ```

2. **Make it executable:**
   ```bash
   sudo chmod +x /usr/local/bin/binpatch
   ```

3. **Verify the installation:**
   ```bash
   binpatch --help
   ```

*(Alternatively, you can use the one-liner via `wget`):*
```bash
sudo wget https://raw.githubusercontent.com/TheMaster1127/binpatch/main/binpatch -O /usr/local/bin/binpatch && sudo chmod +x /usr/local/bin/binpatch
```

---

## Installation & Setup

1. **Clone the `HT-RE` repository:**
   ```bash
   git clone https://github.com/YourUsername/HT-RE.git
   cd HT-RE
   ```

2. **Run the server:**
   ```bash
   python3 server.py
   ```

3. **Open the Web UI:**
   Open your browser and navigate to:
   ```text
   http://localhost:8000
   ```

---

## Usage

1. **Load a Binary:** Enter the absolute path to a binary (e.g., `/home/user/workspace/a.out`) into the top navigation bar and press Enter.
2. **Decompile All:** Click `⚡ Decompile All` in the sidebar to execute Ghidra's headless analyzer across all mappings. Wait for the `✓ Decompiled Already` flag to appear.
3. **Navigate:** Double-click any function in the left sidebar to open the Analysis Modal. You can seamlessly switch between ASM and C/C++ views.
4. **Patch:** Click the `Patch/Find (binpatch)` tab to search for exact or heuristic hex strings, and overwrite raw bytes (with `-va` Virtual Address support and automatic backups).
5. **Export:** Click `Export JSON`, select exactly which functions you want the ASM and C/C++ for, and download a complete report.

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.html).
