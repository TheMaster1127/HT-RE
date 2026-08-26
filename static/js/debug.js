let debugPollInterval = null;
let activeBreakpoints = [];
let currentRegisterValues = {};
let terminalFontSize = 14;

function showDebugUI() { 
    updateTabs('debug');
}

function getTimestamp() {
    const showTs = document.getElementById('dbg-chk-timestamps')?.checked ?? true;
    if (!showTs) return '';
    const now = new Date();
    const ts = now.toTimeString().split(' ')[0];
    return `<span class="dbg-ts">[${ts}]</span>`;
}

function changeTerminalFontSize(delta) {
    terminalFontSize = Math.max(10, Math.min(26, terminalFontSize + delta));
    document.documentElement.style.setProperty('--dbg-font', `${terminalFontSize}px`);
}

function toggleQemuWarning(checkbox) {
    if (!checkbox.checked) {
        const confirmed = confirm(
            "⚠️ DANGER / CRITICAL WARNING:\n\n" +
            "You are unchecking QEMU user-mode emulation.\n" +
            "This will execute the target binary directly on your HOST CPU!\n" +
            "If the binary contains foreign/malicious instructions or shellcode, it may crash or harm your system.\n\n" +
            "Are you absolutely sure you want to run natively?"
        );
        if (!confirmed) {
            checkbox.checked = true;
        }
    }
}

function toggleBinwalkAccordion() {
    const drawer = document.getElementById('dbg-binwalk-drawer');
    if (drawer) {
        drawer.style.display = (drawer.style.display === 'none' || !drawer.style.display) ? 'block' : 'none';
    }
}

// --- BREAKPOINTS MANAGER ---
function formatBreakpointInput(val) {
    val = val.trim();
    if (/^[0-9a-fA-F]+$/.test(val) && !val.startsWith('0x')) {
        return '0x' + val;
    }
    return val;
}

function addBreakpoint() {
    const input = document.getElementById('dbg-bp-input');
    let val = formatBreakpointInput(input.value);
    if (!val) return;
    
    if (!activeBreakpoints.includes(val)) {
        activeBreakpoints.push(val);
        renderBreakpoints();
        trackAction("DEBUG_ADD_BREAKPOINT", { target: val });
        if (debugPollInterval) {
            sendGdbCmd(`-break-insert ${val}`);
        }
    }
    input.value = '';
    saveCurrentProjectState();
}

function removeBreakpoint(val) {
    activeBreakpoints = activeBreakpoints.filter(bp => bp !== val);
    renderBreakpoints();
    trackAction("DEBUG_REMOVE_BREAKPOINT", { target: val });
    if (debugPollInterval) {
        sendGdbCmd(`-break-delete ${val}`);
    }
    saveCurrentProjectState();
}

function renderBreakpoints() {
    const list = document.getElementById('dbg-bp-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (activeBreakpoints.length === 0) {
        list.innerHTML = '<div style="color:#666; font-style:italic; padding:6px;">No breakpoints set.</div>';
        return;
    }

    activeBreakpoints.forEach(bp => {
        const div = document.createElement('div');
        div.className = 'dbg-bp-item';
        div.innerHTML = `
            <span style="color:#ffeb73; font-family:monospace; font-weight:bold;">● ${escapeHTML(bp)}</span>
            <span style="color:#ff3333; cursor:pointer; font-weight:bold; padding:0 4px;" onclick="removeBreakpoint('${bp.replace(/'/g, "\\'")}')" title="Delete breakpoint">✕</span>
        `;
        list.appendChild(div);
    });
}

// --- PROJECT SERIALIZER INTEGRATIONS ---
function exportDebugState() {
    return {
        breakpoints: [...activeBreakpoints],
        useQemu: document.getElementById('dbg-use-qemu')?.checked ?? true,
        traceSyscalls: document.getElementById('dbg-chk-syscalls')?.checked ?? true,
        traceNetwork: document.getElementById('dbg-chk-network')?.checked ?? true,
        showTimestamps: document.getElementById('dbg-chk-timestamps')?.checked ?? true,
        terminalFontSize: terminalFontSize
    };
}

function importDebugState(state) {
    activeBreakpoints = (state && state.breakpoints) ? [...state.breakpoints] : [];
    renderBreakpoints();
    
    if (document.getElementById('dbg-use-qemu')) {
        document.getElementById('dbg-use-qemu').checked = state ? state.useQemu : true;
    }
    if (document.getElementById('dbg-chk-syscalls')) {
        document.getElementById('dbg-chk-syscalls').checked = state ? state.traceSyscalls : true;
    }
    if (document.getElementById('dbg-chk-network')) {
        document.getElementById('dbg-chk-network').checked = state ? state.traceNetwork : true;
    }
    if (document.getElementById('dbg-chk-timestamps')) {
        document.getElementById('dbg-chk-timestamps').checked = state ? state.showTimestamps : true;
    }
    if (state && state.terminalFontSize) {
        terminalFontSize = state.terminalFontSize;
        changeTerminalFontSize(0);
    }
}

// --- GDB & QEMU INTERACTION ---
async function startDebugger() {
    if (!binaryPath) return alert("Please load a binary first.");
    const useQemu = document.getElementById('dbg-use-qemu').checked;
    const arch = document.getElementById('opt-arch').value;
    const traceSyscalls = document.getElementById('dbg-chk-syscalls').checked;
    const traceNetwork = document.getElementById('dbg-chk-network').checked;
    
    const consoleDiv = document.getElementById('dbg-console');
    const stdoutDiv = document.getElementById('dbg-stdout-out');
    consoleDiv.innerHTML = `<div>${getTimestamp()}<span style="color:#ffeb73;">[*] Initializing GDB ${useQemu ? '+ QEMU (' + arch + ')' : '(Native Host)'}...</span></div>`;
    stdoutDiv.innerHTML = `<div>${getTimestamp()}<span style="color:#666;">Waiting for program output...</span></div>`;

    trackAction("DEBUG_START", { use_qemu: useQemu, arch: arch, breakpoints: activeBreakpoints });
    
    const res = await fetch(`${API}/debug/start`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            binary_path: binaryPath, 
            arch: arch, 
            use_qemu: useQemu,
            breakpoints: activeBreakpoints,
            trace_syscalls: traceSyscalls,
            trace_network: traceNetwork
        })
    });
    const data = await res.json();
    
    if (data.error) {
        consoleDiv.innerHTML += `<div>${getTimestamp()}<span style="color:#ff3333;">[!] Error: ${data.error}</span></div>`;
        return;
    }
    
    consoleDiv.innerHTML += `<div>${getTimestamp()}<span style="color:#00ffcc;">[+] Attached successfully! ${data.port ? '(QEMU Port: ' + data.port + ')' : ''}</span></div>`;
    
    if (debugPollInterval) clearInterval(debugPollInterval);
    debugPollInterval = setInterval(pollGdb, 300);

    setTimeout(fetchRegisters, 200);
}

async function stopDebugger() {
    if (!binaryPath) return;
    trackAction("DEBUG_STOP");
    await fetch(`${API}/debug/stop`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath })
    });
    document.getElementById('dbg-console').innerHTML += `<div>${getTimestamp()}<span style="color:#ff3333;">[-] Debugger session terminated.</span></div>`;
    if (debugPollInterval) clearInterval(debugPollInterval);
    debugPollInterval = null;
    currentRegisterValues = {};
    renderRegisterGrid();
}

async function sendGdbCmd(cmd = null) {
    if (!binaryPath) return;
    const inputCmd = cmd || document.getElementById('dbg-cmd-input').value.trim();
    if (!inputCmd) return;
    
    // Explicit tracking for actions
    let actionType = "DEBUG_CMD";
    if (inputCmd === "-exec-step-instruction") actionType = "DEBUG_STEP_IN";
    else if (inputCmd === "-exec-next-instruction") actionType = "DEBUG_STEP_OVER";
    else if (inputCmd === "-exec-continue") actionType = "DEBUG_CONTINUE";

    trackAction(actionType, { cmd: inputCmd });
    
    const consoleDiv = document.getElementById('dbg-console');
    consoleDiv.innerHTML += `<div>${getTimestamp()}<span style="color:#888;">&gt; ${escapeHTML(inputCmd)}</span></div>`;
    consoleDiv.scrollTop = consoleDiv.scrollHeight;

    await fetch(`${API}/debug/cmd`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath, cmd: inputCmd })
    });
    
    if (!cmd) document.getElementById('dbg-cmd-input').value = '';
    
    setTimeout(() => {
        pollGdb();
        fetchRegisters();
    }, 100);
}

function submitGdbCmd() {
    sendGdbCmd();
}

async function fetchRegisters() {
    if (!binaryPath) return;
    const res = await fetch(`${API}/debug/registers`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath })
    });
    const data = await res.json();
    if (data.registers && Object.keys(data.registers).length > 0) {
        currentRegisterValues = Object.assign({}, currentRegisterValues, data.registers);
        renderRegisterGrid();
    }
}

async function setRegisterValue() {
    const reg = document.getElementById('dbg-reg-select').value;
    let val = document.getElementById('dbg-reg-val-input').value.trim();
    if (!reg || !val) return alert("Select register and specify value.");

    if (/^[0-9a-fA-F]+$/.test(val) && !val.startsWith('0x')) {
        val = '0x' + val;
    }

    trackAction("DEBUG_SET_REGISTER", { reg: reg, val: val });
    const res = await fetch(`${API}/debug/set_reg`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath, reg: reg, val: val })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else {
        document.getElementById('dbg-reg-val-input').value = '';
        setTimeout(fetchRegisters, 100);
    }
}

// Decode GDB octal escape characters and clean MI spam
function cleanGdbString(str) {
    if (!str) return '';
    return str
        .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"');
}

function filterGdbMiOutput(raw) {
    if (raw.startsWith('=') || raw.startsWith('^done') || raw.startsWith('^running')) {
        if (raw.includes('reason="breakpoint-hit"')) {
            const mAddr = raw.match(/bkptno="(\d+)".*?addr="([^"]+)".*?func="([^"]+)"/);
            if (mAddr) return `🛑 Hit Breakpoint #${mAddr[1]} at ${mAddr[2]} <${mAddr[3]}>`;
            const mFallback = raw.match(/addr="([^"]+)"/);
            return `🛑 Hit Breakpoint at ${mFallback ? mFallback[1] : 'address'}`;
        }
        if (raw.includes('reason="end-stepping-range"')) {
            const mInst = raw.match(/addr="([^"]+)".*?func="([^"]+)"/);
            if (mInst) return `📍 Stepped to ${mInst[1]} <${mInst[2]}>`;
            const mFallback = raw.match(/addr="([^"]+)"/);
            return `📍 Stepped to ${mFallback ? mFallback[1] : 'instruction'}`;
        }
        if (raw.includes('reason="exited-normally"')) return "🏁 Program finished execution (exit code 0).";
        if (raw.includes('reason="signal-received"')) {
            const mSig = raw.match(/signal-name="([^"]+)".*?signal-meaning="([^"]+)"/);
            return `⚠️ Signal Received: ${mSig ? mSig[1] + ' (' + mSig[2] + ')' : 'Signal'}`;
        }
        return null;
    }
    if (raw.startsWith('~')) {
        let clean = cleanGdbString(raw.replace(/^~"/, '').replace(/"\n?$/, ''));
        if (clean.includes("The program has no registers now")) return null;
        return clean.trim();
    }
    if (raw.startsWith('&') || raw.startsWith('^error')) {
        let clean = cleanGdbString(raw.replace(/^(\^error,&)/, '').replace(/^&"/, '').replace(/"\n?$/, ''));
        if (clean.includes("The program has no registers now")) return null;
        return `<span style="color:#ff6666;">${escapeHTML(clean)}</span>`;
    }
    return null;
}

function updateRegisterDropdown() {
    const sel = document.getElementById('dbg-reg-select');
    if (!sel) return;
    const currentSelected = sel.value;
    const regKeys = Object.keys(currentRegisterValues);
    if (regKeys.length === 0) return;

    sel.innerHTML = '';
    regKeys.forEach(rn => {
        const opt = document.createElement('option');
        opt.value = rn;
        opt.innerText = rn.toUpperCase();
        if (rn === currentSelected) opt.selected = true;
        sel.appendChild(opt);
    });
}

function renderRegisterGrid() {
    const grid = document.getElementById('dbg-reg-grid');
    if (!grid) return;
    
    updateRegisterDropdown();

    const regKeys = Object.keys(currentRegisterValues);
    if (regKeys.length === 0) {
        grid.innerHTML = '<div style="color:#666; font-style:italic; padding:10px;">Debugger not running or registers empty.</div>';
        return;
    }

    grid.innerHTML = '';

    const priorityRegs = [
        'rax','rbx','rcx','rdx','rsi','rdi','rbp','rsp','rip',
        'r8','r9','r10','r11','r12','r13','r14','r15',
        'r0','r1','r2','r3','r4','r5','r6','r7','r8','r9','r10','r11','r12','sp','lr','pc','cpsr',
        'x0','x1','x2','x3','x4','x5','x6','x7','x8','x29','x30'
    ];
    
    let rendered = new Set();

    priorityRegs.forEach(regName => {
        if (currentRegisterValues[regName] !== undefined) {
            const val = currentRegisterValues[regName];
            const row = document.createElement('div');
            row.className = 'dbg-reg-row';
            row.title = `Click to edit ${regName.toUpperCase()}`;
            row.onclick = () => {
                document.getElementById('dbg-reg-select').value = regName;
                document.getElementById('dbg-reg-val-input').value = val;
                document.getElementById('dbg-reg-val-input').focus();
            };
            row.innerHTML = `
                <span class="dbg-reg-name">${regName.toUpperCase()}</span>
                <span class="dbg-reg-val">${escapeHTML(val)}</span>
            `;
            grid.appendChild(row);
            rendered.add(regName);
        }
    });

    regKeys.forEach(regName => {
        if (!rendered.has(regName) && rendered.size < 36) {
            const val = currentRegisterValues[regName];
            const row = document.createElement('div');
            row.className = 'dbg-reg-row';
            row.onclick = () => {
                document.getElementById('dbg-reg-select').value = regName;
                document.getElementById('dbg-reg-val-input').value = val;
                document.getElementById('dbg-reg-val-input').focus();
            };
            row.innerHTML = `
                <span class="dbg-reg-name">${regName.toUpperCase()}</span>
                <span class="dbg-reg-val">${escapeHTML(val)}</span>
            `;
            grid.appendChild(row);
            rendered.add(regName);
        }
    });
}

async function pollGdb() {
    if (!binaryPath) return;
    const res = await fetch(`${API}/debug/poll`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath })
    });
    const data = await res.json();
    
    const consoleDiv = document.getElementById('dbg-console');
    if (data.lines && data.lines.length > 0) {
        data.lines.forEach(line => {
            const filtered = filterGdbMiOutput(line);
            if (filtered) {
                consoleDiv.innerHTML += `<div>${getTimestamp()}${filtered}</div>`;
            }
        });
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }

    // Direct JSON Register State Sync from Backend
    if (data.registers && Object.keys(data.registers).length > 0) {
        currentRegisterValues = Object.assign({}, currentRegisterValues, data.registers);
        renderRegisterGrid();
    }

    // Live Target Program Output (stdout/stderr)
    if (data.stdout_lines && data.stdout_lines.length > 0) {
        const stdoutDiv = document.getElementById('dbg-stdout-out');
        if (stdoutDiv.innerText.includes("No program output yet.") || stdoutDiv.innerText.includes("Waiting for program output...")) {
            stdoutDiv.innerHTML = "";
        }
        data.stdout_lines.forEach(sol => {
            stdoutDiv.innerHTML += `<div>${getTimestamp()}${escapeHTML(sol.replace(/\n$/, ''))}</div>`;
        });
        stdoutDiv.scrollTop = stdoutDiv.scrollHeight;
    }

    // Live QEMU strace streaming during active stepping/continuing
    if (data.trace_lines && data.trace_lines.length > 0) {
        const straceBox = document.getElementById('dbg-strace-out');
        const netBox = document.getElementById('dbg-strace-net');
        const netPattern = /\b(socket|connect|sendto|recvfrom|bind|listen|accept|send|recv)\b/i;

        if (straceBox.innerText.includes("No syscalls recorded yet.")) straceBox.innerText = "";
        if (netBox.innerText.includes("No socket traffic intercepted.")) netBox.innerText = "";

        data.trace_lines.forEach(tl => {
            const cleanLine = escapeHTML(tl.trim());
            if (cleanLine) {
                straceBox.innerHTML += `<div>${getTimestamp()}${cleanLine}</div>`;
                if (netPattern.test(cleanLine)) {
                    netBox.innerHTML += `<div>${getTimestamp()}${cleanLine}</div>`;
                }
            }
        });
        straceBox.scrollTop = straceBox.scrollHeight;
        netBox.scrollTop = netBox.scrollHeight;
    }
    
    if (!data.running && debugPollInterval) {
        clearInterval(debugPollInterval);
        debugPollInterval = null;
        consoleDiv.innerHTML += `<div>${getTimestamp()}<span style="color:#ff3333;">[!] Debugger process stopped.</span></div>`;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }
}

// --- STANDALONE STRACE & NETWORK TRACER ---
async function runStandaloneTrace() {
    if (!binaryPath) return alert("Please load a binary first.");
    
    const useQemu = document.getElementById('dbg-use-qemu').checked;
    const arch = document.getElementById('opt-arch').value;
    const traceSyscalls = document.getElementById('dbg-chk-syscalls').checked;
    const traceNetwork = document.getElementById('dbg-chk-network').checked;

    document.getElementById('dbg-strace-out').innerText = `Running trace with ${useQemu ? 'QEMU (' + arch + ')' : 'native strace'}...`;
    document.getElementById('dbg-strace-net').innerText = "Waiting for socket / network activity...";
    trackAction("DEBUG_TRACE_RUN", { use_qemu: useQemu, syscalls: traceSyscalls, network: traceNetwork });

    const res = await fetch(`${API}/debug/trace`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            binary_path: binaryPath,
            arch: arch,
            use_qemu: useQemu,
            trace_syscalls: traceSyscalls,
            trace_network: traceNetwork
        })
    });
    const data = await res.json();

    if (data.error) {
        document.getElementById('dbg-strace-out').innerText = data.error;
        return;
    }

    document.getElementById('dbg-strace-out').innerText = data.output || "No syscall output generated.";
    if (data.network && data.network.length > 0) {
        document.getElementById('dbg-strace-net').innerText = data.network.join('\n');
    } else {
        document.getElementById('dbg-strace-net').innerText = "No network / socket syscalls intercepted.";
    }
}

// --- BINWALK INTEGRATION ---
async function runBinwalk() {
    if (!binaryPath) return alert("Please load a binary first.");
    
    const extract = document.getElementById('dbg-bw-extract').checked;
    const entropy = document.getElementById('dbg-bw-entropy').checked;
    
    document.getElementById('dbg-bw-out').innerText = "Running binwalk signature scan...";
    document.getElementById('dbg-bw-tree').innerText = "";
    trackAction("DEBUG_BINWALK_RUN", { extract, entropy });
    
    const res = await fetch(`${API}/debug/binwalk`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath, extract: extract, entropy: entropy })
    });
    const data = await res.json();
    
    if (data.error) {
        document.getElementById('dbg-bw-out').innerText = data.error;
        return;
    }
    
    document.getElementById('dbg-bw-out').innerText = data.output || "No headers or signatures identified.";
    if (extract && data.tree) {
        document.getElementById('dbg-bw-tree').innerText = data.tree;
    } else if (extract) {
        document.getElementById('dbg-bw-tree').innerText = "No carved directories extracted.";
    }
}
