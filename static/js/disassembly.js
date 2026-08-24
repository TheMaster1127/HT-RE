async function loadDisasm() {
    updateTabs('disasm');
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
    mainScroller = new VirtualScroller('output', data.output, 'disasm');
}

function saveHistory(addressStr) {
    if (!addressStr) return;
    navHistory.push(addressStr);
    document.getElementById('btnBack').disabled = false;
}

function recordPosition(historyArg) {
    if (currentTab !== 'disasm' || !mainScroller) return;
    
    if (typeof historyArg === 'string') {
        // We know the exact line address the user clicked!
        saveHistory(historyArg);
    } else if (historyArg === true) {
        // Fallback: Use the exact center of the current screen view
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
        
        // Exact targeting to avoid accidentally matching jump arguments. We ensure the line defines the address.
        const targetIndex = mainScroller.lines.findIndex(line => {
            const lowerLine = line.toLowerCase();
            return lowerLine.includes(search) && lowerLine.split(':')[0].endsWith(search.replace(':', ''));
        });

        if (targetIndex !== -1) {
            mainScroller.scrollToIndex(targetIndex);
            return;
        } else {
            // Fallback matching
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
        // Pass false so returning doesn't overwrite our history state!
        jumpTo(prevAddr, false); 
        if (navHistory.length === 0) document.getElementById('btnBack').disabled = true;
    }
}

function executeJump() {
    const val = document.getElementById('jumpInput').value;
    if(val) jumpTo(val, true);
}
