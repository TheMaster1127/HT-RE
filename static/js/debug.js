let debugPollInterval = null;

function showDebugUI() { 
    updateTabs('debug');
    const state = (openProjects[binaryPath] && openProjects[binaryPath].debugState) ? openProjects[binaryPath].debugState.activeTab : 'debugger';
    switchDebugTab(state);
}

function switchDebugTab(tab) {
    const panel = document.getElementById('debugPanel');
    if (!panel) return;

    panel.querySelectorAll('.bp-tab').forEach(el => el.classList.remove('active'));
    panel.querySelectorAll('.bp-panel').forEach(el => el.classList.remove('active'));

    const tabHeaders = {
        'debugger': 'Debugger',
        'strace': 'Syscalls',
        'binwalk': 'Firmware'
    };

    panel.querySelectorAll('.bp-tab').forEach(el => {
        if (el.innerText.includes(tabHeaders[tab])) {
            el.classList.add('active');
        }
    });

    document.getElementById('dbg-' + tab).classList.add('active');

    if (openProjects[binaryPath]) {
        if (!openProjects[binaryPath].debugState) openProjects[binaryPath].debugState = {};
        openProjects[binaryPath].debugState.activeTab = tab;
    }
}

async function startDebugger() {
    if (!binaryPath) return alert("Please load a binary first.");
    const useQemu = document.getElementById('dbg-use-qemu').checked;
    const arch = document.getElementById('opt-arch').value;

    document.getElementById('dbg-console').innerHTML = "<div>Starting GDB/MI session...</div>";
    trackAction("DEBUG_START", { use_qemu: useQemu, arch: arch });

    const res = await fetch(`${API}/debug/start`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath, arch: arch, use_qemu: useQemu })
    });
    const data = await res.json();

    if (data.error) {
        document.getElementById('dbg-console').innerHTML += `<div style="color:#ff3333;">${data.error}</div>`;
        return;
    }

    document.getElementById('dbg-console').innerHTML += `<div style="color:#0f0;">Debugger started.${data.port ? ' QEMU port: ' + data.port : ''}</div>`;

    if (debugPollInterval) clearInterval(debugPollInterval);
    debugPollInterval = setInterval(pollGdb, 1000);
}

async function stopDebugger() {
    if (!binaryPath) return;
    trackAction("DEBUG_STOP");
    await fetch(`${API}/debug/stop`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath })
    });
    document.getElementById('dbg-console').innerHTML += `<div style="color:#ff3333;">Debugger stopped.</div>`;
    if (debugPollInterval) clearInterval(debugPollInterval);
}

async function sendGdbCmd(cmd = null) {
    if (!binaryPath) return;
    const inputCmd = cmd || document.getElementById('dbg-cmd-input').value;
    if (!inputCmd) return;

    trackAction("DEBUG_CMD", { cmd: inputCmd });

    await fetch(`${API}/debug/cmd`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath, cmd: inputCmd })
    });

    if (!cmd) document.getElementById('dbg-cmd-input').value = '';
    pollGdb();
}

function submitGdbCmd() {
    sendGdbCmd();
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
            const safeLine = escapeHTML(line).replace(/\n/g, '');
            consoleDiv.innerHTML += `<div>${safeLine}</div>`;
        });
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }

    if (!data.running && debugPollInterval) {
        clearInterval(debugPollInterval);
        consoleDiv.innerHTML += `<div style="color:#ff3333;">Session terminated.</div>`;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }
}

async function runStrace() {
    if (!binaryPath) return alert("Please load a binary first.");

    document.getElementById('dbg-strace-out').innerText = "Running strace (10s timeout)...";
    document.getElementById('dbg-strace-net').innerText = "Waiting for network activity...";
    trackAction("DEBUG_STRACE_RUN");

    const res = await fetch(`${API}/debug/trace`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ binary_path: binaryPath })
    });
    const data = await res.json();

    if (data.error) {
        document.getElementById('dbg-strace-out').innerText = data.error;
        return;
    }

    document.getElementById('dbg-strace-out').innerText = data.output || "No output returned.";
    if (data.network && data.network.length > 0) {
        document.getElementById('dbg-strace-net').innerText = data.network.join('\n');
    } else {
        document.getElementById('dbg-strace-net').innerText = "No network/socket syscalls intercepted.";
    }
}

async function runBinwalk() {
    if (!binaryPath) return alert("Please load a binary first.");

    const extract = document.getElementById('dbg-bw-extract').checked;
    const entropy = document.getElementById('dbg-bw-entropy').checked;

    document.getElementById('dbg-bw-out').innerText = "Scanning firmware...";
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

    document.getElementById('dbg-bw-out').innerText = data.output || "No output returned.";
    if (extract && data.tree) {
        document.getElementById('dbg-bw-tree').innerText = data.tree;
    } else if (extract) {
        document.getElementById('dbg-bw-tree').innerText = "No files extracted.";
    }
}
