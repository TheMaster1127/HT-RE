async function loadBinary() {
    binaryPath = document.getElementById('binaryPath').value;
    if (!binaryPath) return;

    // Force close modals if they were left open from a previous binary
    if (typeof closeFuncModal === 'function') closeFuncModal();
    const expModal = document.getElementById('exportModal');
    if (expModal) expModal.style.display = 'none';

    // Reset dynamic buttons & state
    const btnAll = document.getElementById('btnDecompAll');
    btnAll.innerText = "⚡ Decompile All";
    btnAll.disabled = false;
    
    // Background language detection
    const gRes = await fetch(`${API}/generic`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({binary_path: binaryPath, cmd: 'readelf-h'}) });
    const gData = await gRes.json();
    isCpp = gData.output && gData.output.includes("Compiler Language: C++");
    
    const langStr = isCpp ? "C++" : "C";

    const btnShowAll = document.getElementById('btnShowAll');
    if (btnShowAll) btnShowAll.innerText = `Show All in One (${langStr})`;
    
    // Dynamically update C/C++ text inside Export JSON modal
    document.querySelectorAll('.dyn-c-lang').forEach(el => el.innerText = langStr);

    const res = await fetch(`${API}/load`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({binary_path: binaryPath})
    });
    const data = await res.json();
    
    if (data.valid) {
        document.getElementById('statusLabel').innerHTML = `Working: <span style="color:#fff;">${binaryPath}</span> [${data.arch}]`;
        renderHistoryUI(data.history);
        document.getElementById('opt-arch').value = data.arch;
        
        currentFileHash = data.file_hash || '';
        
        // Reset and apply backend cache to local session state
        for(let key in aceSessions) delete aceSessions[key];
        for(let key in userEditedDecompCache) delete userEditedDecompCache[key];
        for(let k in originalDecompCache) delete originalDecompCache[k];
        if (data.decomp_cache) {
            Object.assign(originalDecompCache, data.decomp_cache);
            
            // Prove that the entire batch ran, not just a single manual function opening
            if (originalDecompCache['BATCH_COMPLETE']) {
                btnAll.innerText = "✓ Decompiled Already";
            }
        }

        await loadFunctions();
        await loadDisasm();
    } else {
        alert("Invalid binary: " + data.message);
    }
}

fetch(`${API}/history`).then(r => r.json()).then(data => {
    renderHistoryUI(data.history);
    
    const input = document.getElementById('binaryPath');
    // If input is empty but we have history, auto-fill it
    if (!input.value && data.history && data.history.length > 0) {
        input.value = data.history[0];
    }
    
    // If the input has a value (either from auto-fill above OR browser refresh caching), load it immediately!
    if (input.value) {
        loadBinary();
    }
});
