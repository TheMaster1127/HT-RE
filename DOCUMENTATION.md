# ⚡ HT-RE: The Exhaustive Technical Architecture & Source Code Documentation ⚡

## 📑 Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Directory & File Structure](#2-directory--file-structure)
3. [State Management & Multi-Project Workspaces (`state.js`, `binary_loader.js`)](#3-state-management--multi-project-workspaces-statejs-binary_loaderjs)
4. [Backend API Routing & Endpoints (`server.py`)](#4-backend-api-routing--endpoints-serverpy)
5. [The Subprocess Pipeline & GNU Binutils Tools](#5-the-subprocess-pipeline--gnu-binutils-tools)
6. [The Ghidra Headless Bridge (Java ↔ Python)](#6-the-ghidra-headless-bridge-java--python)
7. [The Persistent SHA-256 Caching Engine](#7-the-persistent-sha-256-caching-engine)
8. [Frontend DOM Rendering, Tab Memory & Virtual Scroller](#8-frontend-dom-rendering-tab-memory--virtual-scroller)
9. [Floating Multi-Window Desktop Environment & Taskbar Dock (`modal.js`)](#9-floating-multi-window-desktop-environment--taskbar-dock-modaljs)
10. [Ace Editor Integration & Token Context Menus](#10-ace-editor-integration--token-context-menus)
11. [Data Converters & CPU Memory Simulation (`converter.js`)](#11-data-converters--cpu-memory-simulation-converterjs)
12. [The Infinite RE Scientific Calculators](#12-the-infinite-re-scientific-calculators)
13. [String Encodings, ASCII Reference & Found Strings Engine](#13-string-encodings-ascii-reference--found-strings-engine)
14. [Dis/Assembler Tool & The Binpatch Utility Wrapper](#14-disassembler-tool--the-binpatch-utility-wrapper)
15. [Granular JSON Workspace Exporter (`export.js`, `export_service.py`)](#15-granular-json-workspace-exporter-exportjs-export_servicepy)

---

## 1. System Architecture Overview

HT-RE operates on a **Decoupled Client-Server Architecture**:
- **The Client (Frontend):** A 100% Vanilla JavaScript Single Page Application (SPA) with an embedded floating Multi-Window Manager (MWM). It uses zero frontend build steps (no Webpack, Babel, React, or Node.js). Everything executes on the browser's native V8 engine for maximum speed and sub-millisecond DOM manipulation.
- **The Server (Backend):** A lightweight Python/Flask service acting as a RESTful proxy. It translates frontend requests into formatted Linux toolchain commands (`objdump`, `nm`, `readelf`, `xxd`, `strings`, `binpatch`, GNU `as`, `objcopy`, and Ghidra's `analyzeHeadless`). Command outputs (`stdout`/`stderr`) are captured, parsed, serialized to JSON, and returned.

This architecture completely isolates heavy background tasks (decompiling large binaries, launching Java virtual machines, assembling opcodes) from the UI thread, ensuring the browser remains fluid and responsive.

---

## 2. Directory & File Structure

```text
HT-RE/
├── server.py                   # Main Flask API entry point and file upload handler
├── DecompileHeadless.java      # Ghidra script for single function extraction & PIE base correction
├── DecompileAll.java           # Ghidra script for batch decompilation across all symbol mappings
├── history.json                # Local storage for recently loaded binary paths
├── backend/                    # Python Backend Modules
│   ├── config.py               # Application constants (Port 8000, history limits, static paths)
│   ├── disasm_service.py       # objdump wrappers, symbol parsers, string resolution engine
│   ├── export_service.py       # Granular JSON workspace exporter engine
│   ├── generic_service.py      # readelf, stat, file, and ldd inspection wrappers
│   ├── ghidra_service.py       # Headless Ghidra subprocess execution and output parsing
│   ├── history_service.py      # Binary history serialization and upload storage management
│   ├── patch_service.py        # binpatch, GNU as, and objcopy wrapper logic
│   └── utils.py                # Command execution, toolchain detection, SHA-256 caching
└── static/                     # Frontend Assets
    ├── index.html              # Core single-page HTML layout and top-level docking bar
    ├── css/
    │   ├── main.css            # Layout, project tabs, taskbar dock, sidebar, and scroller themes
    │   ├── modal.css           # Floating draggable windows, tab reordering, and Ace editor styling
    │   └── patch.css           # Binpatch grids, assembler layouts, and found strings styles
    └── js/
        ├── state.js            # Global state stores, project workspaces, and regex constants
        ├── binary_loader.js    # Binary loading, file picker uploads, and project switching
        ├── main.js             # Tab navigation, tab scroll saving, searches, and resizers
        ├── functions.js        # Left sidebar symbols (nm), context menus, and filters
        ├── disassembly.js      # Main objdump execution, virtual scroller binding, and jump history
        ├── ghidra.js           # Single/Batch Ghidra triggers and "All In One" view construction
        ├── modal.js            # Multi-window manager, draggable tabs, taskbar, and Ace editor
        ├── scroller.js         # Virtual DOM Scroller engine with live line highlighting
        ├── strings.js          # Cross-referencing `strings` with `objdump` rip-relative targets
        ├── patch.js            # Binpatch GUI bindings and raw GNU assembler/disassembler
        ├── converter.js        # Data type converters, Float16/32/64, and RE calculators
        └── export.js           # Selective JSON workspace export dialog and blob generator
```

---

## 3. State Management & Multi-Project Workspaces (`state.js`, `binary_loader.js`)

HT-RE implements a multi-tenant project manager allowing multiple binaries to be open simultaneously.

### Global State (`state.js`)
*   `binaryPath`: Absolute file system path of the active ELF binary.
*   `currentFileHash`: SHA-256 checksum used to key persistent cache files on disk.
*   `openProjects`: Key-value registry (`openProjects[binaryPath]`) caching the entire workspace state per binary.
*   `tabDataCache`: Keyed dictionary (`tabDataCache[tabName]`) holding parsed output strings and rendering modes for instant tab switching.
*   `tabScrollPositions`: Keyed dictionary (`tabScrollPositions[tabName]`) saving exact `.scrollTop` coordinates for all tabs (`disasm`, `hexdump`, `strings`, `foundStrings`, `header`, `sections`, `relocs`).
*   `openWindows`: Registry of all floating modal windows and their individual tab hierarchies, active views, Ace sessions, and geometries.
*   `activeWindowId`: ID of the currently focused floating window.
*   `originalDecompCache`: Stores pristine C/C++ decompilations returned by Ghidra.
*   `userEditedDecompCache`: Stores in-memory live modifications made in the Ace Editor.

### Project Switching (`binary_loader.js`)
When switching between project tabs in the top navigation bar:
1.  `saveCurrentProjectState()` serializes:
    *   Active scroll positions across all views.
    *   Cached disassembly, section, header, and string outputs.
    *   Floating window layout (coordinates, dimensions, maximized/minimized state, open tabs).
    *   All spawned scientific calculators, inputs, and calculation histories.
    *   Active architecture and disassembly options.
2.  `restoreProjectState()` loads the target binary's state without issuing redundant network requests or losing open windows.

---

## 4. Backend API Routing & Endpoints (`server.py`)

The Flask application runs on `localhost:8000`. Endpoints accept and return strict JSON payloads:

*   `POST /api/upload`: Receives multipart binary files via browser file pickers, saves them into `.htre_uploads/`, marks them executable (`chmod 0o755`), and returns the file system path.
*   `POST /api/load`: Verifies file existence, inspects ELF architecture via `readelf -h`, computes SHA-256 hash, and bootstraps existing decompilation cache payloads.
*   `POST /api/nm`: Extracts defined function symbols and entry points via `nm -n -S --defined-only`.
*   `POST /api/objdump-d`: Disassembles text/all sections via `objdump` with configurable syntax (`Intel` / `AT&T`), raw instruction opcodes, or binary mode.
*   `POST /api/function_code`: Extracts disassembly for a specific function boundary given its entry point address.
*   `POST /api/decompile`: Dispatches single-function decompilation to `DecompileHeadless.java`.
*   `POST /api/decompile_all`: Dispatches whole-binary decompilation to `DecompileAll.java`.
*   `POST /api/generic`: Multiplexer for `readelf -h` (combined with `stat`, `file`, `ldd`, `ls`), `readelf -S`, `strings`, `objdump -R`, and `xxd`.
*   `POST /api/assemble`: Compiles assembly text to machine code bytes using the GNU assembler (`as`) and `objcopy`.
*   `POST /api/disassemble_raw`: Converts raw hexadecimal instruction bytes to human-readable assembly.
*   `POST /api/binpatch`: Proxies patch, search, and resolve operations directly to the `binpatch` binary.
*   `POST /api/export`: Compiles selected headers, sections, disassembly chunks, and decompiled C/C++ source into a single master JSON bundle.

---

## 5. The Subprocess Pipeline & GNU Binutils Tools

Located in `backend/utils.py` and `backend/generic_service.py`.

### Toolchain Auto-Detection
Standard toolchain utilities default to host execution. When dealing with cross-architecture binaries, HT-RE dynamically probes the operating system:
*   **x86 / x86-64:** `objdump`, `as`, `objcopy`
*   **AArch64:** `aarch64-linux-gnu-objdump`, `aarch64-linux-gnu-as`, `aarch64-linux-gnu-objcopy`
*   **ARM (32-bit):** `arm-linux-gnueabihf-objdump`, `arm-linux-gnueabihf-as`, `arm-linux-gnueabihf-objcopy`

If a cross-compiler is available, HT-RE dynamically switches binaries, preventing execution failures.

---

## 6. The Ghidra Headless Bridge (Java ↔ Python)

HT-RE bridges Python subprocesses with Ghidra's JVM via `analyzeHeadless`.

### 1. `DecompileHeadless.java` (Single Function Extraction)
*   Accepts target entry point offset or symbol name.
*   **Position Independent Executable (PIE) Correction:** Standard PIE binaries start at `0x0`, whereas Ghidra maps them to `0x100000` or `0x10000`. The script attempts direct address resolution and falls back to `currentProgram.getImageBase().add(rawOffset)` to match the ImageBase.
*   Initializes `DecompInterface`, passes a 60-second monitor, and extracts C AST code between parse markers `=== GHIDRA_C_START ===` and `=== GHIDRA_C_END ===`.

### 2. `DecompileAll.java` (Batch Decompiler)
*   Iterates through all functions using `currentProgram.getFunctionManager().getFunctions(true)`.
*   Outputs structured blocks:
    ```text
    === FUNC_START:<absolute_hex>:<relative_hex>:<name> ===
    <decompiled C code>
    === FUNC_END ===
    ```
*   Allows the backend to map functions both by absolute virtual address and ImageBase-relative offsets matching `nm`.

---

## 7. The Persistent SHA-256 Caching Engine

Decompilation results are cached permanently on disk:
1.  `get_file_hash(path)` reads the executable in 64KB blocks to produce a SHA-256 digest.
2.  Decompilation outputs are stored in `.htre_cache/<hash>.json`.
3.  When a binary is loaded, cached decompilations are loaded into browser memory.
4.  The "Show All in One (C/C++)" master view stitches functions together from memory without calling Ghidra, organizing entry routines (`main` or `_start`) at the bottom of the compilation unit for readable, top-down execution flow.

---

## 8. Frontend DOM Rendering, Tab Memory & Virtual Scroller

### The Virtual Scroller (`scroller.js`)
To prevent browser lockup when rendering massive text outputs (such as 100,000+ line disassemblies):
1.  **Ghost Container:** An empty `<div>` is sized to `lines.length * lineHeight` pixels, creating an authentic browser scrollbar.
2.  **Viewport Windowing:** An absolute container (`.vs-viewport`) dynamically translates `Y` to match `scrollTop`.
3.  **Visible Range Calculation:**
    ```javascript
    const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - 5);
    const endIndex = Math.min(lines.length, startIndex + Math.ceil(clientHeight / lineHeight) + 10);
    ```
    Only ~40 visible lines are formatted and attached to the DOM at any given moment.
4.  **Syntax & Jump Tokenization:**
    *   Mnemonics and registers are syntax-highlighted via regexes.
    *   Memory addresses (`0x...`) and `<symbol>` tags are converted to interactive clickable elements carrying exact line address context.

### Persistent Tab Output & Scroll Caching
*   `saveCurrentTabScroll()` captures the exact scroll position before any tab switch occurs.
*   `tabDataCache[tabName]` preserves raw outputs.
*   Returning to previously viewed tabs (`Disassembly`, `Hex Dump`, `Strings`, `Found Strings`, etc.) instantly re-renders the cached virtual view and restores `.scrollTop` to the exact pixel offset.

---

## 9. Floating Multi-Window Desktop Environment & Taskbar Dock (`modal.js`)

HT-RE features an integrated window manager allowing multiple functions to be analyzed simultaneously.

### Window Capabilities
*   **Draggable & Boundary Constrained:** Modal headers allow dragging with mouse-coordinate translation.
*   **Window Management Controls:**
    *   **Focus on Middle (Center Window):** Centers and restores the window in the viewport.
    *   **Minimize (`_`):** Hides the window and creates a minimized dock icon in the top taskbar.
    *   **Maximize (`□`):** Expands the window to fill the main workspace below the top bar.
    *   **Close (`✕`):** Tears down the window and frees associated Ace sessions.
*   **Top Bar Taskbar / Dock (`#windowTaskbar`):** Lists all active floating windows. Clicking an item restores or focuses it; right-clicking brings up window management actions.
*   **Draggable & Reorderable Window Tabs:**
    *   Tabs within a window can be dragged and dropped to reorder them via HTML5 drag-and-drop events.
    *   Right-clicking a tab exposes options to:
        *   *Pop into New Window:* Detaches the tab into its own dedicated floating window.
        *   *Close Tab:* Closes the active tab.
        *   *Close Other Tabs:* Closes all tabs in the window except the selected one.
*   **Sidebar Function Context Menu:** Right-clicking any function in the left sidebar allows opening it in a new window, opening it as a tab in the active window, jumping directly to it in disassembly, or copying its address/symbol name.

---

## 10. Ace Editor Integration & Token Context Menus

Each floating window includes an embedded instance of the `Ace.js` editor with the `vibrant_ink` theme for C/C++ viewing and editing.

### Features
*   **Independent Undo/Redo Sessions:** Each function retains its own `ace.EditSession` with an active `ace.UndoManager`.
*   **Live Memory Sync:** Edits made in the decompiler editor are tracked in `userEditedDecompCache` and persist across tab/window switches.
*   **Symbol Double-Click Navigation:** Double-clicking any function identifier inside the decompiler source automatically resolves the symbol and opens that function in a new tab.
*   **Token Value Conversion Menu:** Right-clicking any hex or decimal token inside the editor opens an interactive context menu allowing inline conversion between Hexadecimal, Decimal, and ASCII representation.
*   **Font Scaling:** Interactive zoom buttons (`A+`, `A-`) dynamically resize editor typography between 10px and 30px.

---

## 11. Data Converters & CPU Memory Simulation (`converter.js`)

The Data & Math tab simulates physical CPU registers and data types.

### Architectural Precision
*   **`BigInt` Core:** Avoids JavaScript 64-bit float precision loss on integers exceeding $2^{53} - 1$ by storing internal numerical states strictly in `BigInt`.
*   **Integer Boundary Masks:** Enforces overflow/underflow emulation using `BigInt.asUintN(bits, val)` and `BigInt.asIntN(bits, val)` across `Int8`, `UInt8`, `Int16`, `UInt16`, `Int32`, `UInt32`, `Int64`, and `UInt64`.
*   **Float16 (Half Precision):** Full IEEE 754 half-precision bitwise conversion using manual bit-mask extraction:
    *   Sign: `(h & 0x8000) >> 15`
    *   Exponent: `(h & 0x7C00) >> 10`
    *   Mantissa: `h & 0x03FF`
*   **Float32 / Float64:** Uses native `DataView` with binary `ArrayBuffer` allocations to ensure zero bit-drift.
*   **Input Blocking:** `blockInvalidInput()` sanitizes keypresses live, preventing invalid base characters from corrupting fields.
*   **Endianness Swapper:** Reverses byte order sequences between Little Endian and Big Endian.

---

## 12. The Infinite RE Scientific Calculators

Dynamic mathematical scratchpads built using `math.js` with reverse-engineering additions.

### Capabilities
*   **Dynamic Spawn Engine:** Spawn unlimited calculators side-by-side with custom titles, bit-width constraints, and isolated calculation history stacks.
*   **AST Auto-Hex Parsing:** Equations containing raw hex values without `0x` prefixes (e.g. `4A00 + FF`) are intercepted via regex patterns and converted to valid hex literals prior to mathematical evaluation.
*   **Bit-Width Bounding:** Dropdown selection for `8-bit`, `16-bit`, `32-bit`, `64-bit`, or `Unlimited (Float)`.
*   **Base Output Switching:** Real-time toggling between Decimal, Hexadecimal, and Binary representations.
*   **Custom RE Functions:**
    *   `bswap32(x)` / `bswap64(x)`: Reverses byte endianness.
    *   `rol(val, shift, width)`: Rotates bits left across specified bit widths.
    *   `ror(val, shift, width)`: Rotates bits right across specified bit widths.
*   **Interactive History:** Clicking any past calculation in the history log loads the expression back onto the screen.

---

## 13. String Encodings, ASCII Reference & Found Strings Engine

### Multi-Encoding String Engine (`converter.js`)
*   **UTF-8 / ASCII:** Encoded and decoded via native `TextEncoder` and `TextDecoder('utf-8')`.
*   **UTF-16LE (Windows Wide Strings):** Encoded by packing 16-bit character codes into low and high byte pairs; decoded via `TextDecoder('utf-16le')`.
*   **ANSI (Windows-1252):** Decoded via `TextDecoder('windows-1252')` for legacy single-byte binary analysis.

### Found Strings Resolver (`strings.js`)
Cross-references `strings -a -t x` with `objdump` disassembly text. RIP-relative instructions referencing `.rodata` and `.data` memory addresses are resolved live and displayed with one-click jump links directly to their corresponding assembly instructions.

### Full ASCII Reference Table (`converter.js`)
A top-to-bottom, 3-column reference grid mapping all 256 standard, control, and extended ASCII entries with Decimal, Hexadecimal, Octal, Character, and Description fields.

---

## 14. Dis/Assembler Tool & The Binpatch Utility Wrapper

### Dis/Assembler Tool (`patch.js`, `patch_service.py`)
Provides bi-directional translation between mnemonic assembly strings (e.g., `mov r1, #55` or `xor eax, eax`) and raw machine hex opcodes (`e3 a0 10 37` / `31 c0`), supporting `x86-64`, `ARM`, and `AArch64`.

### Binpatch Interface (`patch.js`, `patch_service.py`)
Direct visual wrapper for the high-performance binary patcher `binpatch`:
*   **Write Mode:** Overwrites bytes at specified file offsets (`-o`) or virtual addresses (`-va`) with automatic `.bak` backup generation (`-b`).
*   **Find Mode:** Executes exact (`-f`) or heuristic wildcard (`-fh`) byte pattern scans across the binary.
*   **Resolve Mode:** Disassembles logic blocks directly at offsets, entry points (`-e`), or main symbols (`-m`) with "Stream Until Return" (`-r`) options.

---

## 15. Granular JSON Workspace Exporter (`export.js`, `export_service.py`)

Exports complete analysis workspaces into offline JSON archives.

### Export Pipeline
1.  **Selection Matrix:** Checkbox matrix allowing independent selection of ELF headers, section headers, resolved strings, raw strings, bounded hex dumps, custom binpatch runs, and per-function disassembly and decompiled C/C++ sources.
2.  **Instant Assembly:** Pulls decompiled C/C++ directly from the SHA-256 disk cache (`.htre_cache/`), completely bypassing Ghidra during export execution.
3.  **Payload Delivery:** Encodes the compiled dictionary into a formatted JSON blob and triggers a native browser file download.

