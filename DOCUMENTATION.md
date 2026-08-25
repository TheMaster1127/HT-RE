# ⚡ HT-RE: The Exhaustive Technical Architecture & Source Code Documentation ⚡

## 📑 Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Directory & File Structure Structure](#2-directory--file-structure-structure)
3. [State Management (`state.js`)](#3-state-management-statejs)
4. [Backend API Routing (`server.py`)](#4-backend-api-routing-serverpy)
5. [The Subprocess Pipeline & GNU Tools](#5-the-subprocess-pipeline--gnu-tools)
6. [The Ghidra Headless Bridge (Java ↔ Python)](#6-the-ghidra-headless-bridge-java--python)
7. [The Persistent SHA-256 Caching Engine](#7-the-persistent-sha-256-caching-engine)
8. [Frontend DOM Rendering & The Virtual Scroller](#8-frontend-dom-rendering--the-virtual-scroller)
9. [UI Modals, Draggability & Tab Management](#9-ui-modals-draggability--tab-management)
10. [Ace Editor & Syntax Injection](#10-ace-editor--syntax-injection)
11. [Data Converters & CPU Memory Simulation](#11-data-converters--cpu-memory-simulation)
12. [The Infinite RE Scientific Calculators](#12-the-infinite-re-scientific-calculators)
13. [String Encodings & ASCII Construction](#13-string-encodings--ascii-construction)
14. [The Binpatch Utility Wrapper](#14-the-binpatch-utility-wrapper)
15. [Granular JSON Export Engine](#15-granular-json-export-engine)

---

## 1. System Architecture Overview

HT-RE operates on a **Decoupled Client-Server Architecture**. 
- **The Client (Frontend):** A 100% Vanilla JavaScript Single Page Application (SPA). It uses zero frontend build steps (no Webpack, Babel, React, or Node.js). Everything relies on the Browser's native V8 engine for maximum speed and DOM manipulation.
- **The Server (Backend):** A lightweight Python/Flask server. It acts purely as a RESTful proxy, converting JSON payloads from the frontend into formatted Linux shell commands (`bash`). The output of these commands (`stdout`/`stderr`) is captured, packaged into JSON, and sent back to the client.

This design completely isolates the heavy lifting (parsing 5MB binaries, running Java virtual machines) from the UI thread, ensuring the browser never freezes.

---

## 2. Directory & File Structure Structure

```text
HT-RE/
├── server.py                   # Main Flask API entry point
├── DecompileHeadless.java      # Ghidra script for single function extraction
├── DecompileAll.java           # Ghidra script for batch function extraction
├── history.json                # Local storage for previously loaded binaries
├── backend/                    # Python Backend Modules
│   ├── config.py               # Constants (Port 8000, Static folder)
│   ├── disasm_service.py       # objdump wrappers, string resolution
│   ├── export_service.py       # JSON max-dump builder
│   ├── generic_service.py      # readelf, file, stat, ldd wrappers
│   ├── ghidra_service.py       # Headless Ghidra Subprocess execution
│   ├── history_service.py      # JSON History array management
│   ├── patch_service.py        # binpatch, objcopy, and GNU 'as' execution
│   └── utils.py                # Command execution, SHA-256 hashing, caching
└── static/                     # Frontend Assets
    ├── index.html              # The singular HTML DOM structure
    ├── css/
    │   ├── main.css            # Base layout, resizers, virtual scroller CSS
    │   ├── modal.css           # Draggable modal logic, ACE editor overrides
    │   └── patch.css           # Flexbox grids for converters and calculators
    └── js/
        ├── state.js            # Global variable initializations
        ├── main.js             # Tab routing, search execution, resizer event listeners
        ├── binary_loader.js    # File loading pipeline, language detection
        ├── functions.js        # Left sidebar population (nm wrapper)
        ├── disassembly.js      # Main objdump execution and history jump calculations
        ├── ghidra.js           # Batch decompilation & "Show All In One" logic
        ├── scroller.js         # The High-Performance Virtual DOM Scroller engine
        ├── strings.js          # Cross-referencing `strings` with `objdump` targets
        ├── patch.js            # Frontend bindings for the binpatch GUI
        ├── converter.js        # The colossal math, float, ASCII, and calculator engine
        ├── modal.js            # Dynamic DOM creation for draggable windows
        └── export.js           # JSON payload collection for master exports
```

---

## 3. State Management (`state.js`)

Because HT-RE does not use Redux or Vuex, state is managed globally via the `window` object in `state.js`.

*   `binaryPath`: Absolute path of the currently loaded ELF file.
*   `currentFileHash`: SHA-256 string used to reference backend cache payloads.
*   `navHistory`: An array of `String` addresses (e.g., `["0x401000", "0x40112b"]`). Operated as a LIFO stack for the "Go Back" button.
*   `currentTab`: Tracks visibility state (e.g., `'disasm'`, `'conv'`).
*   `globalFunctions`: An array of objects `[{addr: '0x4011e0', name: 'main'}]` populated by `nm`.
*   `isCpp`: A boolean flag determining if the binary is C or C++ (changes UI labels).
*   `originalDecompCache`: Stores the untouched Ghidra C output mapped by address keys.
*   `userEditedDecompCache`: Stores user-modified code from the Ace Editor so changes aren't lost when switching modal tabs.
*   `aceSessions`: An object holding isolated instances of `ace.EditSession`. This allows switching tabs without destroying the undo/redo stack of the editor.
*   `mainScroller` / `modalScroller`: Pointers to instantiated `VirtualScroller` classes.

---

## 4. Backend API Routing (`server.py`)

The Flask application runs synchronously on `localhost:8000`. Key routes:
*   `POST /api/load`: Checks file validity via `utils.validate`, extracts architecture via `readelf -h`, generates the SHA-256 hash, and returns the existing `.htre_cache/<hash>.json` payload to bootstrap the frontend.
*   `POST /api/generic`: A multiplexer route. If `cmd` is `readelf-h`, it runs 6 different commands (`ls`, `stat`, `file`, `ldd`, `readelf -h`, `readelf -d`) and concats them.
*   `POST /api/objdump-d`: Executes `objdump -d` or `-D`, injecting `options` (raw binaries, intel syntax).
*   `POST /api/export`: Executes the master dump, compiling all active selections into a single dictionary.

All responses append strict CORS headers (`Access-Control-Allow-Origin: *`) to ensure smooth browser operation.

---

## 5. The Subprocess Pipeline & GNU Tools

Located entirely in `backend/utils.py` and `backend/generic_service.py`.
The function `run_cmd(cmd)` relies on Python's `subprocess.run(shell=True, capture_output=True, text=True)`.

**Architectural Awareness (`get_objdump_cmd`, `get_as_cmd`, `get_objcopy_cmd`)**:
Standard `objdump` defaults to the host machine (usually x86). If the user asks to analyze an ARM binary, `utils.py` checks `os.system('which arm-linux-gnueabihf-objdump')`. If cross-compilation toolchains are installed, it dynamically swaps the binary it calls, preventing architectural failures.

---

## 6. The Ghidra Headless Bridge (Java ↔ Python)

Ghidra uses a JVM, making it heavy to boot. HT-RE abstracts this entirely via `analyzeHeadless`.

### `DecompileHeadless.java` (Single Function)
1. Receives an address string from Python (e.g., `0x112b`).
2. Tries to match the address directly via `toAddr(rawOffset)`.
3. **PIE Correction:** Position Independent Executables start offsets at `0x0`. Ghidra, however, maps them at `0x100000` or `0x10000`. The script attempts `currentProgram.getImageBase().add(rawOffset)` to automatically resolve this mismatch.
4. If an address fails, it loops through the symbol table trying to match by string name.
5. Invokes `DecompInterface.decompileFunction()`, passing a 60-second timeout monitor, and prints the AST C code to stdout.

### `DecompileAll.java` (Batch Engine)
Instead of taking arguments, it loops `currentProgram.getFunctionManager().getFunctions(true)`. 
It prints a strict regex-parsable header for Python to catch:
`=== FUNC_START:<absolute_hex>:<relative_hex>:<name> ===`
By providing both absolute and relative hex, HT-RE can perfectly map the Ghidra output to the output of `nm` (which doesn't always include ImageBase).

---

## 7. The Persistent SHA-256 Caching Engine

Decompiling takes time. HT-RE guarantees you only have to do it once per binary version.
In `utils.py`, `get_file_hash(path)` reads the binary in 64KB chunks (`while chunk := f.read(65536)`) to generate a SHA-256 string.
When a function is decompiled, `save_decomp_cache(file_hash, data_dict)` writes the resulting string to `.htre_cache/<hash>.json`.

When the user clicks "Show All in One (C/C++)", the frontend checks if `originalDecompCache['BATCH_COMPLETE']` exists. If true, it stitches every function string together, artificially places `main` or `_start` at the very bottom of the document (to mimic a natural source file), and renders it.

---

## 8. Frontend DOM Rendering & The Virtual Scroller

**The Problem:** Rendering a 5MB text file in standard HTML `<div>` elements crashes the DOM engine.
**The Solution (`scroller.js`):** The `VirtualScroller` class.

1.  **Ghost Sizing:** It creates an empty, 1-pixel wide `<div>` scaled to `this.lines.length * this.lineHeight`. This tricks the browser into rendering a native scrollbar of accurate length.
2.  **Viewport Clipping:** An absolutely positioned `.vs-viewport` div sits on top.
3.  **Scroll Event Math:** On `container.onscroll`, it calculates:
    `startIndex = Math.max(0, Math.floor(scrollTop / 20) - 5)`
    `endIndex = Math.min(lines.length, startIndex + Math.ceil(clientHeight / 20) + 10)`
4.  **Render Pipeline:** It iterates *only* over these ~40 lines, passes them through `formatLine()`, and injects the resulting HTML. The browser is completely unaware of the 500,000 lines residing purely in JS memory.
5.  **Regex Wrapping:** Inside `formatLine()`, raw strings are converted to interactive HTML:
    `safeLine.replace(/\b(0x[0-9a-fA-F]+)\b/g)` wraps every memory address in a `<span class="clickable">` that triggers the `jumpTo()` method.

---

## 9. UI Modals, Draggability & Tab Management

Modals (`modal.css`, `modal.js`) are designed to simulate overlapping windows in an IDE.
*   **Draggability:** Triggered via `mousedown` on the `.modal-header`. An offset is calculated (`modal.offsetLeft - e.clientX`). An `e.preventDefault()` prevents text highlighting, and `mousemove` updates `modal.style.left` at native 60fps.
*   **Tab Management:** `openedModalTabs` acts as an array of Function objects. Clicking a tab updates `currentActiveTabId` and re-renders the container. Removing a tab splices the array and auto-focuses the adjacent tab.
*   **Golden Tabs:** The "Combined" view triggers a custom CSS class `.golden-tab` to differentiate it visually as a master-view rather than a single function.

---

## 10. Ace Editor & Syntax Injection

The Ghidra decompilation is injected into an embedded `ace.js` editor instance.
**Custom Context Menus:** The standard right-click is overridden.
1.  `aceEditor.getCursorPosition()` finds the row/column.
2.  `aceEditor.session.getTokenAt()` extracts the string hovered over by the mouse.
3.  If the regex `/^0x[0-9a-fA-F]+$/i` matches (it's a hex number), a custom DOM Context Menu is drawn exactly at `e.pageY` and `e.pageX`.
4.  The menu calculates Decimal and ASCII representations on the fly. Clicking one triggers `aceEditor.session.replace()`, permanently rewriting the token inside the editor instance and backing it up into `userEditedDecompCache`.

---

## 11. Data Converters & CPU Memory Simulation

Located in `static/js/converter.js`, this system physically simulates how data sits in a CPU register.

*   **The BigInt Backbone:** Because JavaScript's standard `Number` is a 64-bit float, it loses precision on integers above `2^53 - 1`. HT-RE stores all mathematical states strictly in a `BigInt` variable `currentVal = 0n`.
*   **Memory Bounding:** When the user types into an `Int16` box, the system executes:
    `currentVal = BigInt.asUintN(16, BigInt(txt))`
    This accurately recreates integer overflow/underflow, truncating upper bytes.
*   **Float16 Bitwise Shifting:** JS lacks Half-Precision floats. The algorithm `float16ToNumber` manually applies the IEEE 754 bit-mask. It takes a 16-bit integer, extracts the 1-bit sign (`h & 0x8000`), the 5-bit exponent (`h & 0x7C00`), and the 10-bit mantissa (`h & 0x03FF`), mathematically constructing a standard Float representation natively.
*   **DataView for Float32/64:** Standard floats are handled by writing the string to an `ArrayBuffer` via `setFloat32`, and reading the raw underlying bytes back out via `getUint32()`. This guarantees 100% accurate hex generation.

---

## 12. The Infinite RE Scientific Calculators

To accommodate complex reverse engineering math, HT-RE implements `math.js` inside dynamically spawned grids.

*   **DOM Spawning Engine:** Clicking "Spawn" fires `spawnCalculator()`, iterating a `calcCounter`. It injects a massive HTML template string via `insertAdjacentHTML`, appending unique `-id` suffixes to every `div`, `input`, and `select` tag.
*   **Auto-Hex Abstract Syntax Tree (AST) Parsing:** Standard calculators fail on equations like `FF + FF`. The HT-RE AST interceptor runs a Regex over the input string before sending it to `math.js`. It explicitly ignores binary prefixes (`0b`), octal prefixes (`0o`), isolated Euler's numbers (`e`), and pure decimals. If it finds a sequence of characters containing A-F, it prepends `0x` in memory, allowing completely natural hex-math typing.
*   **Bitwise Bounding:** You can specify `8-bit`, `16-bit`, `32-bit`, etc., in the dropdown. HT-RE evaluates the answer (e.g., `-1`), and then wraps it in `BigInt.asUintN(width, result)`, resulting in `0xFFFFFFFF` for 32-bit boundaries.

---

## 13. String Encodings & ASCII Construction

Reverse engineering involves reading memory mapped to different string types. The `String ↔ Hex` converter uses native Web APIs to handle this without lag.
*   **UTF-8:** Handled by `new TextEncoder().encode()`. Perfectly handles variable-width arrays, emojis, and foreign alphabets.
*   **UTF-16LE:** Handles Windows Wide Strings (2-bytes per char). Generated manually via `(txt.charCodeAt(i) & 0xFF).toString(16)` appended with `((txt.charCodeAt(i) >> 8) & 0xFF).toString(16)`.
*   **ANSI:** Decoded via `new TextDecoder('windows-1252').decode(bytes)`, accurately reflecting legacy 1-byte game architectures.

**ASCII Table Rendering:** Generated procedurally in JS using a `for` loop from 0 to 255. It utilizes CSS Grid `grid-template-columns: repeat(4, 1fr)` to automatically chunk the array into dense, readable columns that maximize vertical screen real-estate.

---

## 14. The Binpatch Utility Wrapper

The patching interface acts as a visual wrapper for the C++ utility `binpatch`.
*   **Write Mode:** Extracts the `-o` (offset) or `-va` (virtual address) arguments. Collects the hex string `-h`, and automatically passes `-b` to generate a `.bak` backup file before modifying the binary.
*   **Search Mode:** Parses exact matches (`-f`) or heuristic wildcard matches (`-fh`). Limits outputs via `-s <size>`.
*   **Resolve Mode:** Uses `-d` to stream the disassembly. Allows `-r` (until ret) so reverse engineers can dump an entire logic block without knowing its exact byte size beforehand.

---

## 15. Granular JSON Export Engine

Located in `export.js` and `export_service.py`.
The export engine is designed to generate "Offline Workspaces". 

1.  **Frontend Collection:** It iterates over the function list, collecting `Array` payloads of every address that had its `ASM` or `C/C++` checkbox ticked.
2.  **Backend Assembly:**
    *   It bypasses Ghidra completely. It opens `.htre_cache/<hash>.json` directly and pulls the C/C++ strings at a fraction of a millisecond.
    *   It runs `objdump`, utilizing regex `^([0-9a-fA-F]+)\s+<([^>]+)>:` to chunk and extract *only* the specific assembly blocks the user requested, ignoring the rest of the 5MB output.
    *   It optionally executes a custom `binpatch` command string in the background and saves the `stdout`.
3.  **Blob Delivery:** It `json.dumps()` the massive dictionary and serves it. The frontend receives it, encodes it into a `data:text/json` URI, creates a ghost `<a>` element, sets the `.download` attribute, and artificially clicks it to force a seamless file save.

---
*Documentation Compiled & Validated by the HT-RE Core Architecture System.*
