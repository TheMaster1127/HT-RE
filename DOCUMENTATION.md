# ⚡ HT-RE: Technical Architecture & Source Code Documentation ⚡

---

## 📑 Table of Contents

1. [System Architecture & Design Philosophy](#1-system-architecture--design-philosophy)
2. [Directory & Module Structure](#2-directory--module-structure)
3. [Multi-Project State Management & Workspaces (`state.js`, `binary_loader.js`)](#3-multi-project-state-management--workspaces-statejs-binary_loaderjs)
4. [Backend REST API Pipeline (`server.py`)](#4-backend-rest-api-pipeline-serverpy)
5. [GNU Binutils & Toolchain Probing Engine (`disasm_service.py`, `utils.py`)](#5-gnu-binutils--toolchain-probing-engine-disasm_servicepy-utilspy)
6. [Dynamic Emulation, GDB/MI & Tracing Subsystem (`debug_service.py`, `debug.js`)](#6-dynamic-emulation-gdbmi--tracing-subsystem-debug_servicepy-debugjs)
7. [Firmware & Signature Scanner Subsystem (`debug_service.py`, `debug.js`)](#7-firmware--signature-scanner-subsystem-debug_servicepy-debugjs)
8. [Ghidra Headless Bridge & AST Stitching (`ghidra_service.py`, `Decompile*.java`)](#8-ghidra-headless-bridge--ast-stitching-ghidra_servicepy-decompilejava)
9. [Persistent SHA-256 Caching Architecture](#9-persistent-sha-256-caching-architecture)
10. [Virtual DOM Scroller & Viewport Engine (`scroller.js`, `disassembly.js`)](#10-virtual-dom-scroller--viewport-engine-scrollerjs-disassemblyjs)
11. [Floating Multi-Window Desktop Environment & Taskbar Dock (`modal.js`)](#11-floating-multi-window-desktop-environment--taskbar-dock-modaljs)
12. [Ace Editor Integration & Token Context Converters](#12-ace-editor-integration--token-context-converters)
13. [Embedded Multi-File C/C++ & Assembly IDE (`patch.js`, `patch_service.py`)](#13-embedded-multi-file-cc--assembly-ide-patchjs-patch_servicepy)
14. [CPU Memory Emulation & IEEE 754 Converter Engine (`converter.js`)](#14-cpu-memory-emulation--ieee-754-converter-engine-converterjs)
15. [Infinite Spawnable RE Scientific Calculators (`converter.js`)](#15-infinite-spawnable-re-scientific-calculators-converterjs)
16. [Multi-Encoding Strings & Found Strings Engine (`strings.js`, `converter.js`)](#16-multi-encoding-strings--found-strings-engine-stringsjs-converterjs)
17. [Dis/Assembler Tool & `binpatch` Integration (`patch.js`, `patch_service.py`)](#17-disassembler-tool--binpatch-integration-patchjs-patch_servicepy)
18. [Granular JSON Workspace Exporter (`export.js`, `export_service.py`)](#18-granular-json-workspace-exporter-exportjs-export_servicepy)
19. [Invasive User Action Tracking Subsystem (`state.js`, `server.py`)](#19-invasive-user-action-tracking-subsystem-statejs-serverpy)

---

## 1. System Architecture & Design Philosophy

HT-RE is built on a **Decoupled Asynchronous Client-Server Architecture**:

```text
+------------------------------------------------------------------------------------+
|                                FRONTEND (Client)                                   |
| - Pure Vanilla ECMAScript (Zero Webpack, Babel, React, or Node.js dependencies)   |
| - Virtual DOM Scroller (sub-millisecond DOM recycling for 100k+ line disasm)       |
| - Interactive GDB/MI & QEMU Dashboard with Live CPU Register Mutator & Timestamps  |
| - Dual-Terminal View: Target Program I/O (stdout/stderr) & GDB Engine Log Streams  |
| - Floating Multi-Window Manager (MWM) with independent Ace Editor instances        |
| - Multi-tenant Project Workspace Registry with per-binary state serialization      |
+-----------------------------------------+------------------------------------------+
                                          | HTTP REST (JSON Payloads)
                                          v
+------------------------------------------------------------------------------------+
|                                BACKEND (Server)                                    |
| - Python 3 / Flask REST API running on localhost:8000                              |
| - Dynamic GNU Toolchain detection (x86_64, ARM, AArch64)                           |
| - Subprocess orchestrator (objdump, nm, readelf, xxd, strings, as, objcopy)         |
| - Multi-Process Emulation Orchestrator (QEMU User-Mode + GDB/MI Daemon Threads)    |
| - Non-blocking FIFO Queue Pipes for stdout, stderr (-strace), and GDB MI channels  |
| - SHA-256 persistent disk cache (.htre_cache/<hash>.json)                          |
| - Headless Ghidra JVM bridge (analyzeHeadless + Java scripts)                       |
+------------------------------------------------------------------------------------+
```

### Key Architectural Principles
- **Zero Frontend Build Step:** All JavaScript is executed natively by the browser. HTML templates are static and styled with modular CSS (`main.css`, `modal.css`, `patch.css`).
- **Heavy Task Offloading:** Decompilation, disassembling, assembling, QEMU emulation, GDB MI execution, regex-based string resolutions, and firmware extraction occur strictly in background subprocesses, keeping the frontend UI thread fluid at 60 FPS.
- **Persistent State Guarantee:** User edits, open tabs, scroll positions, debugger breakpoints, CPU register states, custom compilers, IDE files, and calculator setups survive browser refreshes and workspace transitions.

---

## 2. Directory & Module Structure

```text
HT-RE/
├── server.py                   # Flask API entry point and route dispatchers
├── DecompileHeadless.java      # Ghidra script for single function extraction & PIE base correction
├── DecompileAll.java           # Ghidra script for whole-binary batch extraction across all symbols
├── history.json                # Local storage for recently loaded binary paths
├── tracking.json               # Invasive user action logs (clickstream & feature metrics)
├── index.html                  # Core single-page HTML layout and top docking bar
├── LICENCE                     # GNU General Public License v3.0
├── README.md                   # User documentation and workflow guide
├── DOCUMENTATION.md            # Exhaustive technical architecture documentation
├── backend/                    # Python Backend Modules
│   ├── __init__.py             # Package marker
│   ├── config.py               # Constants (Port 8000, history limits, static folder paths)
│   ├── debug_service.py        # GDB/MI, QEMU user-mode runner, register parser, strace & binwalk
│   ├── disasm_service.py       # objdump wrappers, symbol parsers, string resolution engine
│   ├── export_service.py       # Granular JSON workspace exporter engine
│   ├── generic_service.py      # readelf, stat, file, and ldd inspection wrappers
│   ├── ghidra_service.py       # Headless Ghidra subprocess execution and output parsing
│   ├── history_service.py      # Binary history serialization and upload storage management
│   ├── patch_service.py        # binpatch, GNU as, objcopy, and multi-toolchain compiler logic
│   └── utils.py                # Subprocess runner, toolchain detection, SHA-256 caching
└── static/                     # Frontend Assets
    ├── css/
    │   ├── main.css            # Layout, project tabs, taskbar dock, sidebar, and scroller themes
    │   ├── modal.css           # Floating draggable windows, tab reordering, and Ace editor styling
    │   └── patch.css           # Debugger layout, CPU registers grid, IDE containers, binpatch styles
    └── js/
        ├── state.js            # Global state stores, project workspaces, and regex constants
        ├── scroller.js         # Virtual DOM Scroller engine with live line highlighting
        ├── functions.js        # Left sidebar symbols (nm), context menus, and filters
        ├── disassembly.js      # Main objdump execution, virtual scroller binding, and jump history
        ├── ghidra.js           # Single/Batch Ghidra triggers and "All In One" view construction
        ├── modal.js            # Multi-window manager, draggable tabs, taskbar, and Ace editor
        ├── strings.js          # Cross-referencing `strings` with `objdump` rip-relative targets
        ├── export.js           # Selective JSON workspace export dialog and blob generator
        ├── debug.js            # Interactive GDB/MI, register mutator, Program I/O, strace & binwalk
        ├── patch.js            # Binpatch GUI bindings, raw GNU assembler/disassembler, and IDE
        ├── converter.js        # Data type converters, Float16/32/64, and RE calculators
        ├── binary_loader.js    # Binary loading, file picker uploads, and project switching
        └── main.js             # Tab navigation, tab scroll saving, searches, and resizers
```

---

## 3. Multi-Project State Management & Workspaces (`state.js`, `binary_loader.js`)

HT-RE features a multi-tenant project manager allowing multiple binaries to remain open simultaneously in dedicated workspace tabs.

### Workspace State Schema (`openProjects[binaryPath]`)
```javascript
openProjects[binaryPath] = {
    path: "/path/to/binary",
    name: "binary_name",
    activeTab: "debug", // Remembers active view (disasm, hexdump, conv, ide, debug, etc.)
    scrolls: {
        disasm: 4200,    // Exact scrollTop per tab
        hexdump: 120,
        strings: 0
    },
    debugState: {
        breakpoints: ["0x401140", "main"],
        useQemu: true,
        traceSyscalls: true,
        traceNetwork: true,
        showTimestamps: true,
        terminalFontSize: 14
    },
    converterState: {    // Serialized calculator & converter setup
        currentVal: "0",
        inputs: { "cv-hex": "0x401000", ... },
        selects: { "cv-str-encoding": "utf8" },
        calcs: [
            { id: 1, title: "Calculator #1", screen: "0x100 + 20", width: "unlimited", base: "hex", historyHTML: "..." }
        ]
    }
};
```

### Project Switching Lifecycle (`binary_loader.js`)
When a user switches from Binary A to Binary B:
1. `saveCurrentProjectState()` serializes:
   - Active view tab name (`currentTab`).
   - Exact scroll position of the active view into `openProjects[Binary A].scrolls[currentTab]`.
   - Complete debug state (active breakpoints, QEMU settings, font scales) via `exportDebugState()`.
   - Complete converter state and all active calculators via `exportConverterState()`.
2. The scroller for Binary A is marked inactive (`mainScroller.isReady = false`) to prevent asynchronous DOM teardowns from leaking scroll events.
3. Binary B's context is loaded without re-fetching static disassembly or losing open modal windows.
4. `importConverterState(openProjects[Binary B].converterState)` and `importDebugState(openProjects[Binary B].debugState)` restore Binary B cleanly without data cross-contamination.

---

## 4. Backend REST API Pipeline (`server.py`)

All API routes receive and return strict JSON payloads:

| Endpoint | Method | Service Handler | Description |
| :--- | :--- | :--- | :--- |
| `/api/upload` | `POST` | `handle_upload_binary` | Uploads multipart binary to `.htre_uploads/`, applies `chmod 0o755`, returns path. |
| `/api/load` | `POST` | `handle_load_binary` | Inspects ELF architecture, computes SHA-256 hash, bootstraps decompilation cache. |
| `/api/history` | `GET` | `get_history` | Returns the list of 10 most recently analyzed binaries. |
| `/api/history_delete` | `POST` | `handle_delete_history` | Removes a specific binary from recent history. |
| `/api/nm` | `POST` | `handle_nm` | Extracts defined symbols using `nm -n -S --defined-only`. |
| `/api/objdump-d` | `POST` | `handle_disasm` | Disassembles binary sections via `objdump` with Intel/AT&T syntax and raw opcode support. |
| `/api/function_code` | `POST` | `handle_function_code` | Disassembles a specific function boundary given its start virtual address. |
| `/api/resolve_strings` | `POST` | `handle_resolve_strings` | Cross-references `strings -a -t x` with RIP-relative instruction offsets. |
| `/api/decompile` | `POST` | `handle_decompile_single` | Executes `DecompileHeadless.java` on a single function symbol or address. |
| `/api/decompile_all` | `POST` | `handle_decompile_batch` | Executes `DecompileAll.java` across all binary functions in a single batch JVM run. |
| `/api/generic` | `POST` | `handle_generic_cmd` | Multiplexes `readelf -h` (with `stat`, `file`, `ldd`, `ls`), `readelf -S`, `strings`, `objdump -R`, and `xxd`. |
| `/api/assemble` | `POST` | `handle_assemble` | Assembles mnemonic text to raw machine code bytes using GNU `as` and `objcopy`. |
| `/api/disassemble_raw` | `POST` | `handle_disassemble_raw` | Disassembles arbitrary hexadecimal instruction bytes into assembly mnemonics. |
| `/api/compile` | `POST` | `handle_compile` | Compiles source files (`.c`, `.cpp`, `.asm`) with user-selected toolchains and flags into executable ELF binaries. |
| `/api/debug/start` | `POST` | `handle_debug_start` | Spawns QEMU user-mode listening on a dynamic port and attaches GDB/MI. |
| `/api/debug/cmd` | `POST` | `handle_debug_cmd` | Dispatches GDB/MI or console commands to the active debug session pipe. |
| `/api/debug/poll` | `POST` | `handle_debug_poll` | Returns queued GDB output, target stdout, QEMU strace lines, and register maps. |
| `/api/debug/registers` | `POST` | `handle_debug_registers` | Queries CPU registers synchronously and returns structured dictionary. |
| `/api/debug/set_reg` | `POST` | `handle_debug_set_reg` | Mutates a specific CPU register (`set $reg = val`) mid-execution. |
| `/api/debug/stop` | `POST` | `handle_debug_stop` | Terminates active GDB and QEMU subprocesses. |
| `/api/debug/trace` | `POST` | `handle_trace_run` | Executes standalone `strace` or `qemu -strace` with network socket parsing. |
| `/api/debug/binwalk` | `POST` | `handle_binwalk` | Runs `binwalk` for signatures, extraction (`-e`), or entropy (`-E`). |
| `/api/binpatch` | `POST` | `handle_binpatch` | Proxies patch, find, and resolve commands to the `binpatch` utility. |
| `/api/patch_history` | `POST` | `get_patch_history` | Lists all `.bak` and timestamped backups for a patched binary. |
| `/api/restore_patch` | `POST` | `restore_patch` | Overwrites current binary with a selected backup file. |
| `/api/delete_patch_backup` | `POST` | `delete_patch_backup` | Deletes a specific `.bak` or timestamped backup file from disk. |
| `/api/export` | `POST` | `handle_export` | Bundles selective analysis components into an offline JSON report. |
| `/api/track` | `POST` | `track_action` | Appends user interaction metrics to `tracking.json`. |

---

## 5. GNU Binutils & Toolchain Probing Engine (`disasm_service.py`, `utils.py`)

### Cross-Architecture Probing
Located in `backend/utils.py`. When disassembling, assembling, compiling, or tracing binaries across architectures, HT-RE dynamically queries the host system:
```python
def get_objdump_cmd(arch):
    if arch == 'aarch64':
        if os.system('which aarch64-linux-gnu-objdump > /dev/null 2>&1') == 0:
            return 'aarch64-linux-gnu-objdump'
    elif arch == 'arm':
        if os.system('which arm-linux-gnueabihf-objdump > /dev/null 2>&1') == 0:
            return 'arm-linux-gnueabihf-objdump'
    return 'objdump'
```
Similar dynamic probing logic exists for `get_as_cmd(arch)`, `get_objcopy_cmd(arch)`, `get_qemu_binary(arch)`, and `get_gdb_binary()`.

### RIP-Relative String Resolution
In x86-64 disassembly, RIP-relative addressing (e.g. `lea rax, [rip + 0x2e15] # 0x404020`) is intercepted via regex:
```python
rip_rel = re.compile(r'#\s*([0-9a-fA-F]+)\s*<')
```
Addresses are cross-referenced with `strings -a -t x` output. When a match is found in `.rodata` or `.data`, the literal string is appended directly to the disassembly line as an inline comment:
```text
  401149:   48 8d 3d b4 0e 00 00    lea    rdi, [rip + 0xeb4] # 402004 <_IO_stdin_used+0x4>  ; "Hello World!"
```

---

## 6. Dynamic Emulation, GDB/MI & Tracing Subsystem (`debug_service.py`, `debug.js`)

HT-RE features a complete, decoupled interactive execution and debugging suite:

### 1. Dual-Stream QEMU & GDB/MI Pipe Architecture
```text
+------------------------------------------------------------------------------------+
|                         BACKEND DEBUG SESSION RUNNER                               |
|                                                                                    |
|  [ Target Binary ]                                                                 |
|         ^                                                                          |
|         | (User-Mode Emulation)                                                    |
|  [ QEMU Process ] <--- (GDB RSP Protocol: localhost:PORT) ---> [ GDB/MI Process ] |
|    |           |                                                      |            |
|    | stdout    | stderr (-strace)                                     | stdout/MI  |
|    v           v                                                      v            |
|  [ stdout_q ] [ trace_q ]                                           [ gdb_q ]      |
+----+-----------+------------------------------------------------------+------------+
     |           |                                                      |
     +-----------+-----------------------+------------------------------+
                                         | JSON Poll Response
                                         v
+------------------------------------------------------------------------------------+
|                                FRONTEND DASHBOARD                                  |
|  - CPU Registers Table (live hex values + inline mutator)                          |
|  - Breakpoints Table (with '*' address normalization)                              |
|  - GDB Execution Log (decoded octal sequences + clean status events)               |
|  - Program I/O Terminal (real-time stdout/stderr from target process)              |
|  - System Call & Socket Activity Log (live strace hooks)                           |
+------------------------------------------------------------------------------------+
```

### 2. Multi-Architecture QEMU User-Mode Integration
When debugging foreign-architecture binaries (or running x86 binaries isolated from the host CPU), HT-RE dynamically binds a free TCP port (`get_free_port()`) and starts the appropriate QEMU user-mode emulator:
- `qemu-x86_64 -g <port> [-strace] <binary>`
- `qemu-arm -g <port> [-strace] <binary>`
- `qemu-aarch64 -g <port> [-strace] <binary>`

GDB attaches immediately via `-target-select remote localhost:<port>`. When native execution is selected by unchecking the QEMU box, a prominent modal warning warns the user of direct host execution risks.

### 3. Breakpoint Normalization Engine
In GDB/MI, specifying raw memory addresses to `-break-insert` requires a leading asterisk `*` (e.g. `-break-insert *0x40008b`), whereas function symbols must not have one (e.g. `-break-insert main`). `format_breakpoint_target()` normalizes all addresses transparently.

### 4. Background Register Interception & Live Mutation
- GDB's verbose `info registers` table is intercepted directly in the Python stream reader (`gdb_stream_reader()`) via regex:
  ```python
  reg_pattern = re.compile(r'~"([a-zA-Z0-9_]+)\s+(0x[0-9a-fA-F]+|[0-9]+)')
  ```
- Register values are stored in `session_info['registers']` and returned as clean JSON dictionaries on every `/api/debug/poll` request, completely suppressing terminal spam.
- Editing a register value dispatches `-interpreter-exec console "set $<reg> = <val>"`, synchronizing the mutated CPU state immediately.

### 5. Live Program I/O & Syscall Hooks
- Program output (`printf`, `puts`, `write(1, ...)`) is captured from QEMU's `stdout` pipe and routed to the dedicated **Program I/O (stdout / stderr)** terminal.
- Kernel syscalls and socket communications (`socket`, `connect`, `sendto`, `recvfrom`) are parsed live from QEMU's `stderr` (`-strace`) stream.

#### Security: Native Execution Warning

`debug.js` and `debug_service.py` enforce a critical safety rule: **QEMU user-mode emulation is enabled by default**.

If the user attempts to uncheck the **"Emulate with QEMU"** checkbox, the frontend triggers a critical confirmation dialog:

> ⚠️ DANGER / CRITICAL WARNING:
>
> You are unchecking QEMU user-mode emulation.
> This will execute the target binary directly on your HOST CPU!
> If the binary contains foreign/malicious instructions or shellcode, it may crash or harm your system.
>
> Are you absolutely sure you want to run natively?

This dialog blocks execution until the user explicitly confirms (or aborts), preventing accidental native execution of untrusted binaries.

The `use_qemu` flag is stored in `debugState` and preserved across workspace tabs and project switches.

---

## 7. Firmware & Signature Scanner Subsystem (`debug_service.py`, `debug.js`)

HT-RE embeds a signature scanner powered by `binwalk`:
- **Signature Detection:** Scans the binary for embedded file systems (SquashFS, CramFS, JFFS2), compressed archives (gzip, bzip2, LZMA, Zstandard), and bootloader headers.
- **Recursive Carving:** Supports recursive extraction (`-e --matryoshka`) into an isolated `<binary>.extracted` directory.
- **Extraction File Tree:** Executes `tree -a` against carved artifacts and presents a navigable hierarchical directory tree in the web workspace.
- **Entropy Analysis:** Executes `binwalk -E` to identify encrypted or compressed payload regions.

---

## 8. Ghidra Headless Bridge & AST Stitching (`ghidra_service.py`, `Decompile*.java`)

HT-RE communicates with Ghidra's JVM using `analyzeHeadless` in temporary isolated project directories:

### 1. `DecompileHeadless.java` (Single Function Extraction)
- **PIE ImageBase Normalization:** Standard Position Independent Executables (PIE) are compiled at base `0x0`, whereas Ghidra loads them at `0x100000` or `0x10000`. The script attempts direct address resolution and falls back to:
  ```java
  Address pieAddr = currentProgram.getImageBase().add(rawOffset);
  targetFunc = getFunctionAt(pieAddr);
  if (targetFunc == null) targetFunc = getFunctionContaining(pieAddr);
  ```
- AST C code is enclosed between parse tags:
  ```text
  === GHIDRA_C_START ===
  <decompiled C code>
  === GHIDRA_C_END ===
  ```

### 2. `DecompileAll.java` (Batch Decompilation)
- Iterates over all program functions using `currentProgram.getFunctionManager().getFunctions(true)`.
- Outputs structured blocks:
  ```text
  === FUNC_START:<absolute_hex>:<relative_hex>:<name> ===
  <decompiled C code>
  === FUNC_END ===
  ```
- Both absolute virtual addresses and ImageBase-relative offsets are mapped into `results` and saved to the persistent SHA-256 disk cache.

### 3. "All In One" Combined View Construction (`modal.js`)
When clicking **Show All in One (C/C++)**:
1. Scans `originalDecompCache` for all functions belonging to the active binary.
2. **Compiler Artifact Filtering:** Filters out internal compiler helper stubs (e.g. `_dl_relocate_static_pie`, `__libc_csu_init`) and stubs with empty/broken instruction data (`halt_baddata()`). Retains user routines, `frame_dummy`, and `register_tm_clones`.
3. **Entry Point Pinning:** If `main` exists, `_start` is suppressed. The functions are sorted by virtual address, and `main` (or `_start` if `main` does not exist) is pinned to the **very bottom** of the compilation unit, creating authentic, top-down executable source flow.

---

## 9. Persistent SHA-256 Caching Architecture

1. `get_file_hash(path)` reads the ELF binary in 64KB blocks to generate a SHA-256 checksum.
2. Decompilation results are stored in `.htre_cache/<sha256_hash>.json`.
3. When `/api/load` is executed, the backend returns the cached dictionary in `data.decomp_cache`.
4. `binary_loader.js` immediately populates `originalDecompCache[binaryPath + '|||' + addr]`, turning sidebar `[C]` badges active without requiring a connection to Ghidra.

---

## 10. Virtual DOM Scroller & Viewport Engine (`scroller.js`, `disassembly.js`)

Rendering 100,000+ lines of assembly in standard browser DOMs causes heavy UI lag. HT-RE uses a high-performance **Virtual Scroller**:

```text
+-------------------------------------------------------------+
| Container: overflow-y: auto (Height: e.g. 800px)            |
|  +-------------------------------------------------------+  |
|  | Ghost Spacer (Height: lines.length * 20px = 2,000,000px) |
|  +-------------------------------------------------------+  |
|  | .vs-viewport (position: absolute; translateY(Y px))    |
|  |   - Line N-5                                          |
|  |   - Line N (Visible)                                  |
|  |   - Line N+40 (Visible)                               |
|  |   - Line N+45                                         |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

### Mathematical Window Calculation
```javascript
const scrollTop = this.container.scrollTop;
const startIndex = Math.max(0, Math.floor(scrollTop / this.lineHeight) - 5);
const endIndex = Math.min(this.lines.length, startIndex + Math.ceil(this.container.clientHeight / this.lineHeight) + 10);
```
Only ~45 DOM nodes exist at any given moment.

### Ghost-Scroll Protection & Real-Time Sync
- **Constructor Gating (`this.isReady`):** When `VirtualScroller` is instantiated, `container.scrollTop` is set to `initialScroll` *before* enabling the `onscroll` listener. This prevents DOM resets (`innerHTML = ''`) from overwriting saved scroll coordinates with `0`.
- **Live Real-time Hook (`onScrollerScroll`):** As the user scrolls, `tabScrollPositions[binaryPath + '|||' + currentTab]` updates continuously.

### Snapshot Navigation & 4-Tier Jump Resolver (`disassembly.js`)
- **Go Back Snapshot Stack:** Clicking jump targets pushes `{ scroll: currentScroll, line: startIndex, addr: addr, bin: binaryPath }` onto `navHistory`. Clicking `◀` restores exact pixel coordinates.
- **4-Tier Jump Priority:**
  1. Priority 1: Exact Function Label Header (e.g. `<main>:`, `<_start>:`)
  2. Priority 2: Function Label containing symbol (e.g. `<main>`)
  3. Priority 3: Exact Address Match on Disassembly Line (e.g. `401140:`)
  4. Priority 4: Fallback substring search

---

## 11. Floating Multi-Window Desktop Environment & Taskbar Dock (`modal.js`)

HT-RE includes a floating Multi-Window Manager (MWM) for side-by-side analysis.

### Capabilities
- **Z-Index Layering:** `bringWindowToFront(winId)` increments global `topZIndex` to elevate focused windows.
- **HTML5 Drag-and-Drop Tab Reordering:** Drag tabs within a window to reorder them, or drag tabs across different windows to merge them.
- **Tab Detaching ("Pop into New Window"):** Detaches a tab into a new standalone window while preserving the active view state (`asm` vs `decomp`).
- **Window Controls:**
  - *Center Window (`🎯 Focus on Middle`):* Centers and resizes window to default geometry.
  - *Minimize (`_`):* Hides window and activates its icon in the top taskbar dock.
  - *Maximize (`□`):* Expands window to fill the workspace below the top bar.
  - *Close (`✕`):* Tears down the window and cleans associated Ace sessions.

---

## 12. Ace Editor Integration & Token Context Converters

Each floating window embeds an instance of `Ace.js` with the `vibrant_ink` theme.

### Live Memory Sync & Token Inspection
- **Live Session Persistence:** Edits are tracked in `userEditedDecompCache[binaryPath + '|||' + cleanId]`.
- **Token Right-Click Converter:** Right-clicking any hexadecimal (`0x...`) or decimal integer inside the editor opens a contextual menu allowing immediate inline replacement to Hexadecimal, Decimal, or ASCII format.
- **Double-Click Symbol Navigation:** Double-clicking any function identifier resolves the symbol from `globalFunctions` and opens it in a new window tab.

---

## 13. Embedded Multi-File C/C++ & Assembly IDE (`patch.js`, `patch_service.py`)

HT-RE embeds a full-featured code editor and compilation pipeline:

```text
+------------------------------------------------------------------------------------+
|                                IDE Split Layout                                    |
|  +---------------------------+  +-----------------------------------------------+  |
|  | Project Files (Sidebar)   |  | Code Editor (Ace.js vibrant_ink)              |  |
|  | - main.c (active)         |  | Language / Compiler Selectors                 |  |
|  | - exploit.asm             |  | Compiler Flags Matrix Checkboxes              |  |
|  +---------------------------+  +-----------------------------------------------+  |
|  | Compiled Binaries List    |  | Output Terminal (stdout / stderr)             |  |
|  | - compiled_1787740120.bin |  | [⚡ COMPILE] Button                           |  |
|  +---------------------------+  +-----------------------------------------------+  |
+------------------------------------------------------------------------------------+
```

### Compiler Configurations & Execution (`patch_service.py`)
- **Languages Supported:** C, C++, x86/x64 Assembly (NASM, FASM, GAS), ARM32 Assembly, AArch64 Assembly.
- **Flags Matrix:** Interactive checkboxes for `-static`, `-pie`, `-fPIE`, `-fPIC`, `-m32`, `-m64`, `-O0`..`-O3`, `-Os`, `-Wall`, `-g`, `-z execstack`, `-z noexecstack`, `-z relro`, `-z now`, etc.
- **Execution Sandboxing:** Compilations execute in isolated temporary directories (`tempfile.TemporaryDirectory()`). Resulting binaries are copied to `.htre_uploads/` with executable rights (`0o755`) and added to the **Compiled Binaries** list with instant workspace loading.
- **State Persistence:** `ideFiles`, `activeIdeFile`, and `compiledBinariesList` are serialized in browser `localStorage`.

---

## 14. CPU Memory Emulation & IEEE 754 Converter Engine (`converter.js`)

Simulates physical CPU registers and numerical representations:

### Mathematical Precision
- **`BigInt` Core:** Numerical conversions are processed internally in `BigInt` to prevent JavaScript 64-bit float precision loss on integers exceeding $2^{53} - 1$.
- **Boundary Clamping:** `BigInt.asUintN(bits, val)` and `BigInt.asIntN(bits, val)` enforce overflow and sign-extension across `Int8`, `UInt8`, `Int16`, `UInt16`, `Int32`, `UInt32`, `Int64`, and `UInt64`.
- **Float16 (Half Precision):** Full bitwise IEEE 754 half-precision converter:
  ```javascript
  function float16ToNumber(h) {
      let s = (h & 0x8000) >> 15;
      let e = (h & 0x7C00) >> 10;
      let f = h & 0x03FF;
      if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
      if (e === 0x1F) return f ? NaN : ((s ? -1 : 1) * Infinity);
      return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
  }
  ```
- **Float32 / Float64:** Uses native `DataView` with binary `ArrayBuffer` allocations.
- **Input Character Sanitization:** `blockInvalidInput()` intercepts keypresses and sanitizes inputs live according to numerical base.

---

## 15. Infinite Spawnable RE Scientific Calculators (`converter.js`)

Spawn unlimited side-by-side calculators with isolated calculation stacks.

### Features
- **Prefix-Free Hex Interception:** Equations containing raw hex values (e.g. `4A00 + FF`) are automatically intercepted via regex and rewritten as valid hex literals before AST evaluation in `math.js`.
- **Bit-Width Bounding:** Dropdown selection for `Unlimited (Float)` (default), `8-bit`, `16-bit`, `32-bit`, or `64-bit`.
- **Base Output Modes:** Real-time toggling between Decimal, Hexadecimal, and Binary.
- **Custom Reverse Engineering Functions:**
  - `bswap32(x)` / `bswap64(x)`: Reverses byte endianness.
  - `rol(val, shift, width)`: Rotates bits left across specified bit widths.
  - `ror(val, shift, width)`: Rotates bits right across specified bit widths.
- **Interactive History:** Clicking any past calculation in the history log restores the expression to the calculator screen.

---

## 16. Multi-Encoding Strings & Found Strings Engine (`strings.js`, `converter.js`)

### Multi-Encoding String Engine
- **UTF-8 / ASCII:** Encoded/decoded using `TextEncoder` and `TextDecoder('utf-8')`.
- **UTF-16LE (Windows Wide Strings):** Encoded by packing 16-bit character codes into low/high byte pairs; decoded via `TextDecoder('utf-16le')`.
- **ANSI (Windows-1252):** Decoded via `TextDecoder('windows-1252')`.

### Found Strings Resolver (`strings.js`)
Cross-references `strings -a -t x` with `objdump -D` disassembly text. RIP-relative instructions referencing data sections are resolved and presented in a table with direct jump links to instruction offsets.

---

## 17. Dis/Assembler Tool & `binpatch` Integration (`patch.js`, `patch_service.py`)

### Dis/Assembler
Provides bi-directional translation between assembly mnemonics (`mov r1, #55` or `xor eax, eax`) and raw machine code bytes (`e3 a0 10 37` / `31 c0`) for `x86-64`, `ARM`, and `AArch64`.

### `binpatch` Interface
Direct visual wrapper for `binpatch`:
- **Write Mode:** Overwrites bytes at offsets (`-o`) or virtual addresses (`-va`) with automatic `.bak` backup creation.
- **Find Mode:** Executes exact (`-f`) or heuristic wildcard (`-fh`) byte pattern scans.
- **Resolve Mode:** Disassembles logic blocks at offsets or entry points (`-m`, `-e`) with "Stream Until Return" (`-r`) options.
- **Backup Manager:** Lists, restores, and deletes binary backup files (`🗑`).

---

## 18. Granular JSON Workspace Exporter (`export.js`, `export_service.py`)

Exports complete analysis sessions into structured JSON archives.

### Export Pipeline
1. **Selection Matrix:** Checkbox matrix allowing independent selection of ELF headers, section headers, resolved strings, raw strings, bounded hex dumps, custom binpatch runs, per-function disassembly, and decompiled C/C++ source.
2. **Bypass Acceleration:** Decompiled sources are pulled directly from the SHA-256 disk cache (`.htre_cache/`), completely bypassing Ghidra during export generation.
3. **Payload Download:** Serializes the compiled dictionary and triggers a browser file download.

---

## 19. Invasive User Action Tracking Subsystem (`state.js`, `server.py`)

When `invasive = true`, HT-RE logs reverse engineering workflows:
- Tracks tab transitions (`TAB_SWITCH`), clicks (`UI_CLICK`), search terms (`SEARCH_EXECUTE`), compiler runs (`COMPILE_CODE_EXEC`), token conversions, debugger operations (`DEBUG_START`, `DEBUG_STOP`, `DEBUG_STEP_IN`, `DEBUG_STEP_OVER`, `DEBUG_CONTINUE`), register mutations (`DEBUG_SET_REGISTER`), breakpoint modifications, and time spent per view.
- Events are dispatched asynchronously to `POST /api/track` and appended to `tracking.json`.
- Export logs anytime using the **🕵 Export Tracking** button in the top bar for workflow analytics and model training.
