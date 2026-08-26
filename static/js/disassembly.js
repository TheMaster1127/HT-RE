async function loadDisasm(forceReload = false) {
    if (!binaryPath) return;
    if (typeof updateTabs === 'function') updateTabs('disasm');

    const optArch = document.getElementById('opt-arch') ? document.getElementById('opt-arch').value : 'x86-64';
    const optSections = document.getElementById('opt-sections') ? document.getElementById('opt-sections').value : 'all';
    const optSyntax = document.getElementById('opt-syntax') ? document.getElementById('opt-syntax').value : 'intel';
    const optRaw = document.getElementById('opt-raw') ? document.getElementById('opt-raw').checked : false;
    const optRawBin = document.getElementById('opt-raw-bin') ? document.getElementById('opt-raw-bin').checked : false;

    const options = { arch: optArch, sections: optSections, syntax: optSyntax, raw: optRaw, raw_bin: optRawBin };
    const settingsStr = JSON.stringify(options);
    const cacheKey = binaryPath + '|||disasm';
    const outputEl = document.getElementById('output');
    
    if (!outputEl) return;

    // ISOLATED SCROLL LOOKUP FOR THIS SPECIFIC BINARY
    let savedScroll = 0;
    if (tabScrollPositions[cacheKey] !== undefined) {
        savedScroll = tabScrollPositions[cacheKey];
    } else if (openProjects[binaryPath] && openProjects[binaryPath].scrolls && openProjects[binaryPath].scrolls['disasm'] !== undefined) {
        savedScroll = openProjects[binaryPath].scrolls['disasm'];
    }

    const cachedText = (tabDataCache[cacheKey] && tabDataCache[cacheKey].output);
    const settingsMatch = tabDataCache[cacheKey] && tabDataCache[cacheKey].settings === settingsStr;

    if (!forceReload && cachedText && settingsMatch) {
        mainScroller = new VirtualScroller('output', cachedText, 'disasm', savedScroll, binaryPath);
        return;
    }

    outputEl.innerHTML = '<div style="padding:10px;">Disassembling binary...</div>';
    
    try {
        const res = await fetch(`${API}/objdump-d`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({binary_path: binaryPath, options: options})
        });
        const data = await res.json();
        
        const disasmOut = data.output || data.error || "No disassembly output available.";
        tabDataCache[cacheKey] = { output: disasmOut, mode: 'disasm', settings: settingsStr };
        
        mainScroller = new VirtualScroller('output', disasmOut, 'disasm', savedScroll, binaryPath);
    } catch(err) {
        outputEl.innerHTML = `<div style="padding:10px; color:#ff3333;">Error disassembling: ${err.message}</div>`;
    }
}

function saveHistory(item) {
    if (!item) return;
    
    if (navHistory.length > 0) {
        const last = navHistory[navHistory.length - 1];
        if (typeof item === 'object' && typeof last === 'object') {
            if (Math.abs(item.scroll - last.scroll) < 10 && item.bin === last.bin) return;
        } else if (item === last) {
            return;
        }
    }
    
    navHistory.push(item);
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.disabled = false;
}

function recordPosition(historyArg) {
    if (currentTab !== 'disasm' || !mainScroller || !mainScroller.isReady) return;
    
    if (historyArg === true) {
        const currentScroll = mainScroller.container.scrollTop;
        const startIndex = Math.max(0, Math.floor(currentScroll / mainScroller.lineHeight));
        const addr = mainScroller.getCurrentAddress();
        saveHistory({ scroll: currentScroll, line: startIndex, addr: addr, bin: binaryPath });
    } else if (typeof historyArg === 'string') {
        saveHistory(historyArg);
    } else if (typeof historyArg === 'object' && historyArg !== null) {
        saveHistory(historyArg);
    }
}

function jumpToSym(symName, historyArg = true) {
    if (!mainScroller || !mainScroller.lines) return;
    const targetIndex = mainScroller.lines.findIndex(line => line.includes(`<${symName}>:`) || line.includes(`<${symName}>`));
    if (targetIndex !== -1) {
        recordPosition(historyArg);
        mainScroller.scrollToIndex(targetIndex);
    } else {
        alert(`Function <${symName}> not found in current disassembly view.\nTry switching Target to "All sections".`);
    }
}

function jumpTo(addr, historyArg = true) {
    if (!mainScroller || !mainScroller.lines) return;
    
    recordPosition(historyArg);
    
    const raw = addr.toString().trim();
    const rawLower = raw.toLowerCase();
    const hexClean = rawLower.replace(/^0x/, '').replace(/^0+/, '') || '0';
    
    // Relative offset calculation fallback (e.g. 0x400078 -> 78)
    const vNum = parseInt(hexClean, 16);
    const relOffset = !isNaN(vNum) ? (vNum % 0x10000).toString(16).replace(/^0+/, '') || '0' : '';

    if (currentTab === 'hexdump') {
        const num = parseInt(hexClean, 16);
        if (!isNaN(num)) {
            const row = (num - (num % 16)).toString(16).padStart(8, '0') + ':';
            const targetIndex = mainScroller.lines.findIndex(line => line.toLowerCase().startsWith(row));
            if (targetIndex !== -1) {
                mainScroller.scrollToIndex(targetIndex);
                return;
            }
        }
    } else if (currentTab === 'disasm') {
        // Priority 1: Exact Function Label Header (e.g. "<main>:", "<_start>:")
        let targetIndex = mainScroller.lines.findIndex(line => {
            return line.toLowerCase().includes('<' + rawLower + '>:');
        });

        // Priority 2: Function Label containing symbol (e.g. "<main>")
        if (targetIndex === -1) {
            targetIndex = mainScroller.lines.findIndex(line => {
                return line.toLowerCase().includes('<' + rawLower + '>');
            });
        }

        // Priority 3: Exact Address Match on Disassembly Line (with VMA load address)
        if (targetIndex === -1) {
            targetIndex = mainScroller.lines.findIndex(line => {
                const m = line.match(/^\s*([0-9a-fA-F]+):/);
                if (m) {
                    const lineAddr = m[1].toLowerCase().replace(/^0+/, '') || '0';
                    return lineAddr === hexClean;
                }
                const mFunc = line.match(/^([0-9a-fA-F]+)\s+<([^>]+)>:/);
                if (mFunc) {
                    const funcAddr = mFunc[1].toLowerCase().replace(/^0+/, '') || '0';
                    return funcAddr === hexClean;
                }
                return false;
            });
        }

        // Priority 4: Relative offset match (if binary is disassembled without VMA)
        if (targetIndex === -1 && relOffset) {
            targetIndex = mainScroller.lines.findIndex(line => {
                const m = line.match(/^\s*([0-9a-fA-F]+):/);
                if (m) {
                    const lineAddr = m[1].toLowerCase().replace(/^0+/, '') || '0';
                    return lineAddr === relOffset;
                }
                return false;
            });
        }

        // Priority 5: Fallback line substring search
        if (targetIndex === -1) {
            targetIndex = mainScroller.lines.findIndex(line => {
                return line.toLowerCase().includes(hexClean + ':') || (relOffset && line.toLowerCase().includes(relOffset + ':'));
            });
        }

        if (targetIndex !== -1) {
            mainScroller.scrollToIndex(targetIndex);
            return;
        }
    }
    alert(`Could not find ${addr} in this view.\nTip: For addresses, check "All sections" in Disasm.`);
}

function goBack() {
    if (navHistory.length === 0) return;
    const prev = navHistory.pop();
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.disabled = (navHistory.length === 0);

    if (!prev) return;

    if (typeof prev === 'object' && prev !== null) {
        if (prev.bin && prev.bin !== binaryPath) {
            document.getElementById('binaryPath').value = prev.bin;
            loadBinary().then(() => {
                if (mainScroller && prev.scroll !== undefined) {
                    mainScroller.restoreScroll(prev.scroll);
                }
            });
            return;
        }
        if (mainScroller && prev.scroll !== undefined) {
            mainScroller.restoreScroll(prev.scroll);
        } else if (prev.addr) {
            jumpTo(prev.addr, false);
        }
    } else if (typeof prev === 'string') {
        jumpTo(prev, false);
    }
}

function executeJump() {
    const val = document.getElementById('jumpInput').value;
    if(val) jumpTo(val, true);
}
