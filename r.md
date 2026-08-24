# `HT-RE` – Web-Based Reverse Engineering Environment

---

## Table of Contents

1. [Introduction](#introduction)
2. [Why Use HT-RE?](#why-use-ht-re)
3. [Features](#features)
4. [Dependencies & Prerequisites](#dependencies--prerequisites)
5. [Installing `binpatch` (Required Dependency)](#installing-binpatch-required-dependency)
6. [Installation & Setup](#installation--setup)
7. [Usage](#usage)
8. [License](#license)

---

## Introduction

`HT-RE` is a blazing-fast, dependency-light, web-based Graphical User Interface for Reverse Engineering and Binary Patching. Designed natively for Linux, it acts as an IDE-like wrapper that seamlessly integrates standard GNU utilities (`objdump`, `readelf`, `xxd`, `strings`), the Ghidra Headless Decompiler, and the `binpatch` utility into a single, cohesive browser application. 

Instead of opening massive, resource-heavy Java GUIs, `HT-RE` lets you dissect, decompile, and patch ELF binaries directly from your browser with mathematical precision and SHA-256 caching.

---

## Why Use HT-RE?

Traditional reverse engineering workflows often require juggling a terminal, a hex editor, a disassembler, and a decompiler simultaneously. `HT-RE` bridges this gap:
- **Instant Context:** Click a memory address in the `Header` or `Strings` view and instantly jump to that exact instruction in the `Disassembly` tab.
- **Headless Power:** Uses Ghidra entirely in the background. It extracts the C/C++ decompilation and caches it permanently using the binary's SHA-256 hash. If you restart the server, your decompiled functions load instantly.
- **Safe Patching:** Features a visual frontend for the `binpatch` tool, allowing you to search for heuristic byte patterns, resolve Entry Points, and inject raw Hex directly into the binary with automatic backups.

---

## Features

- **Dynamic C/C++ Detection:** Automatically parses ELF headers to detect C vs C++ binaries and adjusts the UI/Decompiler context accordingly.
- **"All In One" Decompilation:** Stitches all Ghidra-decompiled C/C++ functions into a single, massive ACE Editor view (putting `main` at the bottom) for easy reading.
- **Smart Viewport History:** Tracks exactly what line address you click on. The "Go Back" button mathematically recalculates your viewport to snap you back to the exact instruction you were reading.
- **Granular JSON Export:** Max-dump your entire reversing session (Headers, Hex dumps, Found Strings, Assembly, and C/C++ code) into a single JSON file for offline analysis.
- **Multi-Tabbed Modal UI:** Open multiple functions simultaneously in a draggable, IDE-style window with syntax highlighting and zoom controls.

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
