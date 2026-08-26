async function decompileFunction(addr, name) {
    if(!binaryPath) return alert("Please load a binary first.");
    
    openFuncWindow({ name: name, addr: addr, binary: binaryPath }, false);
    const winId = activeWindowId || Object.keys(openWindows)[0];
    switchWindowView(winId, 'decomp');
}

async function startBatchDecomp() {
    if(!binaryPath) return alert("Please load a binary first.");
    if(globalFunctions.length === 0) return alert("No functions available to decompile.");
    
    let decompCount = 0;
    Object.keys(originalDecompCache).forEach(k => {
        if (k.startsWith(binaryPath + '|||') && !k.endsWith('|||COMBINED')) decompCount++;
    });
    
    if (decompCount > 0 && decompCount >= (globalFunctions.length * 0.1)) {
        if (!confirm(`You already have ${decompCount} functions decompiled in cache.\nAre you sure you want to re-run the Ghidra batch decompiler?`)) {
            return;
        }
    }
    
    const btn = document.getElementById('btnDecompAll');
    btn.innerText = "Decompiling...";
    btn.disabled = true;
    
    if (typeof trackAction === 'function') trackAction("BATCH_DECOMPILE_START");

    try {
        const res = await fetch(`${API}/decompile_all`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ binary_path: binaryPath, file_hash: currentFileHash })
        });
        
        const data = await res.json();
        
        if (data.error) {
            alert("Batch Decompilation failed: " + data.error);
        } else if (data.functions) { 
            for (const [addr, code] of Object.entries(data.functions)) { 
                const cleanId = getCleanId(addr);
                const cacheKey = binaryPath + '|||' + cleanId;
                
                originalDecompCache[cacheKey] = code;
                
                const el = document.getElementById(`func-item-${cleanId}`);
                if (el) {
                    el.classList.add('cached');
                    const badge = el.querySelector('.c-badge');
                    if (badge) badge.style.display = 'inline-block';
                }
            }
        }
    } catch(e) {
        console.error("Batch decompile error", e);
        alert("Network error during batch decompile.");
    } finally {
        btn.innerText = "⚡ Decompile All";
        btn.disabled = false;
    }
}

function showAllDecompiled() {
    if (globalFunctions.length === 0) return alert("No functions available.");
    openFuncWindow({ name: 'Combined View', addr: 'COMBINED', binary: binaryPath }, true);
    
    const winId = activeWindowId || Object.keys(openWindows)[0];
    switchWindowView(winId, 'decomp');
    if (typeof trackAction === 'function') trackAction("SHOW_ALL_DECOMPILED");
}

function renderDecompiled(data, targetDiv) {
    if (data.error) {
        document.getElementById(targetDiv).innerHTML = `<div style="color:#ff3333; padding:10px;">${data.error}</div>`;
        return;
    }
    const safeOutput = escapeHTML(data.output);
    const hlOutput = safeOutput
        .replace(/#include\s+&lt;.*?&gt;/g, '<span style="color:#ff9999;">$&</span>')
        .replace(/\b(int|void|char|long|short|unsigned|float|double|struct|typedef|return|if|else|while|for|do|switch|case|break|continue)\b/g, '<span style="color:#ff6600; font-weight:bold;">$1</span>')
        .replace(/\b(0x[0-9a-fA-F]+)\b/g, '<span style="color:#0f0;">$1</span>')
        .replace(/\b([0-9]+)\b/g, '<span style="color:#0f0;">$1</span>')
        .replace(/&quot;.*?&quot;/g, '<span style="color:#00ffcc;">$&</span>')
        .replace(/\/\/.*?(\n|$)/g, '<span style="color:#00ff00; font-style:italic; opacity:0.8;">$&</span>');

    document.getElementById(targetDiv).innerHTML = hlOutput;
}
