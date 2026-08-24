async function startBatchDecomp() {
    if (!binaryPath) return alert("Load a binary first!");
    
    const btn = document.getElementById('btnDecompAll');
    if (btn.innerText.includes("Decompiled Already")) {
        if (!confirm("Are you sure you want to decompile? It's already decompiled and saved in cache.")) {
            return;
        }
    }
    
    btn.innerText = "Decompiling...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/decompile_all`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ binary_path: binaryPath, file_hash: currentFileHash })
        });
        const data = await res.json();
        if (data.functions) {
            for (const [cleanAddr, cCode] of Object.entries(data.functions)) {
                originalDecompCache[cleanAddr] = cCode;
                
                // Exclude the meta-flag from being searched in the UI list
                if (cleanAddr !== 'BATCH_COMPLETE') {
                    const el = document.getElementById(`func-item-${cleanAddr}`);
                    if (el) el.classList.add('cached');
                }
            }
            btn.innerText = "✓ Decompiled Already";
        } else {
            alert("Batch decompilation failed. Check server terminal logs.");
            btn.innerText = "⚡ Decompile All";
        }
    } catch(e) {
        alert("Error during batch decompilation: " + e.message);
        btn.innerText = "⚡ Decompile All";
    }
    btn.disabled = false;
}

function restoreOriginalDecomp() {
    if (!currentModalFunc) return;
    const cleanAddr = currentModalFunc.addr.replace(/^0x0*/, '') || '0';
    if (originalDecompCache[cleanAddr]) {
        delete userEditedDecompCache[cleanAddr];
        if (aceSessions[cleanAddr]) {
            aceSessions[cleanAddr].setValue(originalDecompCache[cleanAddr]);
        }
    }
}

function showAllDecompiled() {
    // Strictly refuse unless the batch flag is present
    if (!originalDecompCache['BATCH_COMPLETE']) {
        return alert("Must refuse! You haven't fully decompiled the binary.\n\nPlease click '⚡ Decompile All' to batch process all functions before using the combined view.");
    }

    let allCode = [];
    let entryMain = null;
    let entryStart = null;

    for (const [addr, code] of Object.entries(originalDecompCache)) {
        if (addr === 'BATCH_COMPLETE') continue; // Skip the metadata flag

        const func = globalFunctions.find(f => f.addr.replace(/^0x0*/, '') === addr || f.addr === addr);
        if (!func) continue;

        if (func.name === 'main') {
            entryMain = `// --- main (${addr}) ---\n${code}\n`;
            continue;
        }
        if (func.name === '_start') {
            entryStart = `// --- _start (${addr}) ---\n${code}\n`;
            continue;
        }
        if (func.name.startsWith('_')) continue;

        allCode.push(`// --- ${func.name} (${addr}) ---\n${code}\n`);
    }

    if (entryMain) {
        allCode.push(entryMain);
    } else if (entryStart) {
        allCode.push(entryStart);
    }

    const combinedCode = allCode.join('\n');
    const fakeFunc = { name: 'ALL IN ONE', addr: 'COMBINED', isCombined: true };

    openFuncWindow(fakeFunc);
    setTimeout(() => {
        switchModalView('decomp');
        const cleanAddr = 'COMBINED';
        originalDecompCache[cleanAddr] = combinedCode;
        if (aceSessions[cleanAddr]) aceSessions[cleanAddr].setValue(combinedCode);
        else {
            aceSessions[cleanAddr] = new ace.EditSession(combinedCode, "ace/mode/c_cpp");
            aceSessions[cleanAddr].setUndoManager(new ace.UndoManager());
            aceEditor.setSession(aceSessions[cleanAddr]);
        }
        userEditedDecompCache[cleanAddr] = combinedCode; 
    }, 50);
}
