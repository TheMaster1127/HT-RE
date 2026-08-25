async function loadDisasm(forceReload = false) {
    if (typeof saveCurrentTabScroll === 'function') {
        saveCurrentTabScroll();
    }
    updateTabs('disasm');
    
    // Check if we already have the disassembly cached in memory for the active project
    const cachedText = (openProjects[binaryPath] && openProjects[binaryPath].disasmText) || (tabDataCache['disasm'] && tabDataCache['disasm'].output);
    if (!forceReload && cachedText) {
        mainScroller = new VirtualScroller('output', cachedText, 'disasm');
        const savedScroll = tabScrollPositions['disasm'] !== undefined 
            ? tabScrollPositions['disasm'] 
            : (openProjects[binaryPath] && openProjects[binaryPath].scrollPos !== undefined ? openProjects[binaryPath].scrollPos : 0);
        if (mainScroller.container) {
            mainScroller.container.scrollTop = savedScroll;
            mainScroller.render();
        }
        return;
    }

    document.getElementById('output').innerHTML = '<div style="padding:10px;">Disassembling...</div>';
    const options = {
        arch: document.getElementById('opt-arch').value,
        all_sections: document.getElementById('opt-sections').value === 'all',
        syntax: document.getElementById('opt-syntax').value,
        show_raw: document.getElementById('opt-raw').checked,
        raw_binary: document.getElementById('opt-raw-bin').checked
    };
    const res = await fetch(`${API}/objdump-d`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({binary_path: binaryPath, options: options})
    });
    const data = await res.json();
    const disasmOut = data.output || "";
    
    if (openProjects[binaryPath]) {
        openProjects[binaryPath].disasmText = disasmOut;
    }
    tabDataCache['disasm'] = { output: disasmOut, mode: 'disasm' };

    mainScroller = new VirtualScroller('output', disasmOut, 'disasm');
    const savedScroll = tabScrollPositions['disasm'] || 0;
    if (savedScroll && mainScroller.container) {
        mainScroller.container.scrollTop = savedScroll;
        mainScroller.render();
    }
}

function saveHistory(addressStr) {
    if (!addressStr) return;
    navHistory.push(addressStr);
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.disabled = false;
}

function recordPosition(historyArg) {
    if (currentTab !== 'disasm' || !mainScroller) return;
    
    if (typeof historyArg === 'string') {
        saveHistory(historyArg);
    } else if (historyArg === true) {
        const currentAddr = mainScroller.getCurrentAddress();
        if (currentAddr) saveHistory(currentAddr);
    }
}

function jumpToSym(symName, historyArg = true) {
    if (!mainScroller) return;
    const targetIndex = mainScroller.lines.findIndex(line => line.includes(`<${symName}>:`));
    if (targetIndex !== -1) {
        recordPosition(historyArg);
        mainScroller.scrollToIndex(targetIndex);
    } else {
        alert(`Function <${symName}> not found in current disassembly view.\nTry switching Target to "All sections".`);
    }
}

function jumpTo(addr, historyArg = true) {
    if (!mainScroller) return;
    
    recordPosition(historyArg);
    
    let search = addr.trim().toLowerCase().replace(/^0x/, '').replace(/^0+/, ''); 
    if (!search) search = '0';

    if (currentTab === 'hexdump') {
        const num = parseInt(search, 16);
        if (!isNaN(num)) {
            const row = (num - (num % 16)).toString(16).padStart(8, '0') + ':';
            const targetIndex = mainScroller.lines.findIndex(line => line.toLowerCase().startsWith(row));
            if (targetIndex !== -1) {
                mainScroller.scrollToIndex(targetIndex);
                return;
            }
        }
    } else if (currentTab === 'disasm') {
        search = search + ':';
        
        const targetIndex = mainScroller.lines.findIndex(line => {
            const lowerLine = line.toLowerCase();
            return lowerLine.includes(search) && lowerLine.split(':')[0].endsWith(search.replace(':', ''));
        });

        if (targetIndex !== -1) {
            mainScroller.scrollToIndex(targetIndex);
            return;
        } else {
            const fallbackIndex = mainScroller.lines.findIndex(line => line.toLowerCase().includes(search));
            if (fallbackIndex !== -1) {
                mainScroller.scrollToIndex(fallbackIndex);
                return;
            }
        }
    }
    alert(`Could not find ${addr} in this view.\nTip: For addresses, check "All sections" in Disasm.`);
}

function goBack() {
    if (navHistory.length > 0) {
        const prevAddr = navHistory.pop();
        jumpTo(prevAddr, false); 
        if (navHistory.length === 0) {
            const btnBack = document.getElementById('btnBack');
            if (btnBack) btnBack.disabled = true;
        }
    }
}

function executeJump() {
    const val = document.getElementById('jumpInput').value;
    if(val) jumpTo(val, true);
}
