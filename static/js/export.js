function openExportModal() {
    if (!binaryPath) return alert("Load a binary first!");
    const modal = document.getElementById('exportModal');
    document.getElementById('exp-filename').value = binaryPath.split('/').pop() + "_export.json";
    
    // Ensure the C/C++ texts are correctly synced when opening
    const langStr = isCpp ? "C++" : "C";
    document.querySelectorAll('.dyn-c-lang').forEach(el => el.innerText = langStr);
    
    const list = document.getElementById('exp-func-list');
    list.innerHTML = '';
    if (globalFunctions.length === 0) {
        list.innerHTML = `<div style="padding:10px; color:#888;">No functions available.</div>`;
    } else {
        globalFunctions.forEach(f => {
            const cleanAddr = f.addr.replace(/^0x0*/, '') || '0';
            list.innerHTML += `<label class="export-label" style="font-size:0.85em; display:flex; gap:10px; padding:3px 5px; border-bottom:1px solid #222; align-items: center; margin-bottom: 0;">
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.addr} ${f.name}"><span style="color:#55aaff;">${f.addr}</span> ${escapeHTML(f.name)}</span>
                <input type="checkbox" class="exp-func-cb-asm" value="${cleanAddr}" style="width:50px;">
                <input type="checkbox" class="exp-func-cb-c" value="${cleanAddr}" style="width:50px;">
            </label>`;
        });
    }
    modal.style.display = 'flex';
}

function toggleExportFuncs(checkStatus) {
    document.querySelectorAll('.exp-func-cb-asm').forEach(cb => cb.checked = checkStatus);
    document.querySelectorAll('.exp-func-cb-c').forEach(cb => cb.checked = checkStatus);
}

function toggleExportType(type, checkStatus) {
    document.querySelectorAll(`.exp-func-cb-${type}`).forEach(cb => cb.checked = checkStatus);
}

function masterExportSelectAll() {
    document.getElementById('exp-header').checked = true;
    document.getElementById('exp-sections').checked = true;
    document.getElementById('exp-found-strings').checked = true;
    document.getElementById('exp-all-strings').checked = true;
    toggleExportFuncs(true);
}

async function executeExport() {
    const btn = document.getElementById('btnExecuteExport');
    btn.innerText = "Exporting (Please Wait)...";
    btn.disabled = true;

    const selectedFuncsAsm = Array.from(document.querySelectorAll('.exp-func-cb-asm:checked')).map(cb => cb.value);
    const selectedFuncsC = Array.from(document.querySelectorAll('.exp-func-cb-c:checked')).map(cb => cb.value);

    const payload = {
        binary_path: binaryPath,
        options: {
            arch: document.getElementById('opt-arch').value,
            syntax: document.getElementById('opt-syntax').value,
            raw_binary: document.getElementById('opt-raw-bin').checked
        },
        config: {
            header: document.getElementById('exp-header').checked,
            sections: document.getElementById('exp-sections').checked,
            found_strings: document.getElementById('exp-found-strings').checked,
            all_strings: document.getElementById('exp-all-strings').checked,
            hexdump: document.getElementById('exp-hexdump').checked,
            hex_from: document.getElementById('exp-hex-from').value,
            hex_to: document.getElementById('exp-hex-to').value,
            custom_binpatch: document.getElementById('exp-binpatch').checked,
            binpatch_args: document.getElementById('exp-binpatch-cmd').value,
            functions_asm: selectedFuncsAsm,
            functions_c: selectedFuncsC
        }
    };

    const res = await fetch(`${API}/export`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 4));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = document.getElementById('exp-filename').value || "export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    btn.innerText = "Download JSON";
    btn.disabled = false;
    document.getElementById('exportModal').style.display = 'none';
}
