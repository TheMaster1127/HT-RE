// Auto-load last binary on page refresh
document.addEventListener('DOMContentLoaded', () => {
    const lastBinary = localStorage.getItem('htre_last_binary');
    if (lastBinary) {
        document.getElementById('binaryPath').value = lastBinary;
        setTimeout(() => { if (typeof loadBinary === 'function') loadBinary(); }, 500);
    }
});

// REAL-TIME SCROLLER HOOK - STRICTLY LOCKED TO OWNER BINARY
function onScrollerScroll(scrollTop, ownerBinary, mode) {
    const targetBin = ownerBinary || binaryPath;
    const targetTab = mode === 'disasm' ? 'disasm' : (mode === 'hex' ? 'hexdump' : (mode === 'header' ? 'header' : (mode === 'sections' ? 'sections' : currentTab)));
    
    if (targetBin && targetTab) {
        const key = targetBin + '|||' + targetTab;
        tabScrollPositions[key] = scrollTop;
        if (openProjects[targetBin]) {
            if (!openProjects[targetBin].scrolls) openProjects[targetBin].scrolls = {};
            openProjects[targetBin].scrolls[targetTab] = scrollTop;
        }
    }
}

function saveCurrentTabScroll(optBinary, optTab) {
    const targetBin = optBinary || (mainScroller && mainScroller.ownerBinary) || binaryPath;
    const targetTab = optTab || currentTab;
    if (!targetTab || !targetBin) return;
    
    const cacheKey = targetBin + '|||' + targetTab;
    
    if (mainScroller && mainScroller.container && mainScroller.isReady && (mainScroller.ownerBinary === targetBin)) {
        const pos = mainScroller.container.scrollTop;
        tabScrollPositions[cacheKey] = pos;
        if (openProjects[targetBin]) {
            if (!openProjects[targetBin].scrolls) openProjects[targetBin].scrolls = {};
            openProjects[targetBin].scrolls[targetTab] = pos;
        }
    }
}

async function runCmd(cmd, tabName, forceReload = false) {
    saveCurrentTabScroll();
    updateTabs(tabName);
    let mode = 'text';
    if (cmd === 'hexdump') mode = 'hex';
    else if (cmd === 'readelf-h') mode = 'header';
    else if (cmd === 'readelf-S') mode = 'sections';

    const cacheKey = binaryPath + '|||' + tabName;

    let savedScroll = 0;
    if (tabScrollPositions[cacheKey] !== undefined) savedScroll = tabScrollPositions[cacheKey];
    else if (openProjects[binaryPath] && openProjects[binaryPath].scrolls && openProjects[binaryPath].scrolls[tabName] !== undefined) {
        savedScroll = openProjects[binaryPath].scrolls[tabName];
    }

    if (!forceReload && tabDataCache[cacheKey]) {
        mainScroller = new VirtualScroller('output', tabDataCache[cacheKey].output, mode, savedScroll, binaryPath);
        return;
    }

    document.getElementById('output').innerHTML = '<div style="padding:10px;">Loading...</div>';
    const res = await fetch(`${API}/generic`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({binary_path: binaryPath, cmd: cmd}) });
    const data = await res.json();
    
    const outputText = data.output || '';
    tabDataCache[cacheKey] = { output: outputText, mode: mode };

    mainScroller = new VirtualScroller('output', outputText, mode, savedScroll, binaryPath);
}

function updateTabs(activeTab) {
    if (currentTab !== activeTab) {
        if (typeof tabStartTime !== 'undefined') {
            const timeSpent = Date.now() - tabStartTime;
            if (typeof trackAction === 'function') trackAction("TAB_SWITCH", { from: currentTab, to: activeTab, time_spent_ms: timeSpent });
            tabStartTime = Date.now();
        }
        saveCurrentTabScroll();
    }
    
    currentTab = activeTab;
    
    // Save active tab per project continuously
    if (binaryPath && openProjects[binaryPath]) {
        openProjects[binaryPath].activeTab = activeTab;
    }
    
    const btnBack = document.getElementById('btnBack');
    if (btnBack) {
        btnBack.disabled = (navHistory.length === 0);
    }

    document.getElementById('output').style.display = (activeTab === 'patch' || activeTab === 'asm' || activeTab === 'conv' || activeTab === 'ascii' || activeTab === 'ide') ? 'none' : 'block';
    document.getElementById('patchPanel').style.display = activeTab === 'patch' ? 'flex' : 'none';
    document.getElementById('asmPanel').style.display = activeTab === 'asm' ? 'flex' : 'none';
    document.getElementById('convPanel').style.display = activeTab === 'conv' ? 'flex' : 'none';
    document.getElementById('asciiPanel').style.display = activeTab === 'ascii' ? 'flex' : 'none';
    document.getElementById('idePanel').style.display = activeTab === 'ide' ? 'flex' : 'none';
    document.getElementById('findAllPanel').style.display = 'none';
    
    document.getElementById('bar-jump').style.display = (activeTab === 'disasm' || activeTab === 'hexdump') ? 'flex' : 'none';
    document.getElementById('bar-search').style.display = (activeTab === 'strings' || activeTab === 'foundStrings' || activeTab === 'hexdump' || activeTab === 'header' || activeTab === 'sections' || activeTab === 'relocs') ? 'flex' : 'none';
    
    if (activeTab === 'disasm' || activeTab === 'hexdump') {
        document.getElementById('jumpInput').placeholder = activeTab === 'hexdump' ? "e.g. 0x112b" : "e.g. 0x4011cd";
    }

    if (activeTab === 'ide' && typeof initIdeEditor === 'function') {
        initIdeEditor();
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btnMap = { 'header': 0, 'sections': 1, 'disasm': 2, 'hexdump': 3, 'relocs': 4, 'strings': 5, 'foundStrings': 6, 'patch': 7, 'asm': 8, 'ide': 9, 'conv': 10, 'ascii': 11 };
    if (activeTab in btnMap) document.querySelectorAll('.tab-btn')[btnMap[activeTab]].classList.add('active');
}

function showIdeUI() { updateTabs('ide'); }

function resetWorkspace() {
    if (!confirm("Are you sure you want to reset everything? This will clear all workspaces and safely default to nothingness.")) return;
    
    if (typeof closeAllProjectWindows === 'function') closeAllProjectWindows();
    openProjects = {};
    binaryPath = '';
    navHistory = [];
    localStorage.removeItem('htre_last_binary');
    document.getElementById('binaryPath').value = '';
    document.getElementById('statusLabel').innerHTML = 'No file loaded';
    document.getElementById('funcList').innerHTML = '';
    document.getElementById('output').innerHTML = '';
    mainScroller = null;
    tabDataCache = {};
    tabScrollPositions = {};
    if (typeof resetConverterToDefault === 'function') resetConverterToDefault();
    if (typeof renderProjectTabs === 'function') renderProjectTabs();
    updateTabs('disasm');
    
    if (typeof trackAction === 'function') trackAction("RESET_WORKSPACE");
}

function executeSearch() {
    const val = document.getElementById('searchInput').value;
    if (val) {
        if (typeof trackAction === 'function') trackAction("SEARCH_EXECUTE", { term: val, tab: currentTab });
        if (currentTab === 'foundStrings') filterFoundStrings(val);
        else if (mainScroller) mainScroller.searchNext(val);
    }
}

function executeFindAll() {
    const val = document.getElementById('searchInput').value;
    if (!val || !mainScroller) return;
    if (typeof trackAction === 'function') trackAction("SEARCH_FIND_ALL", { term: val, tab: currentTab });
    const results = mainScroller.searchEngine(val, true);
    const panel = document.getElementById('findAllPanel');
    const list = document.getElementById('findAllList');
    list.innerHTML = '';
    
    if (results.length === 0) {
        list.innerHTML = `<div style="padding:10px; color:#888;">No results found.</div>`;
    } else {
        results.forEach(r => {
            const div = document.createElement('div');
            div.className = 'find-all-item';
            div.innerText = `Line ${r.index}: ${r.text.trim()}`;
            div.onclick = () => { mainScroller.scrollToIndex(r.index); };
            list.appendChild(div);
        });
    }
    panel.style.display = 'flex';
}

const resizer = document.getElementById('resizer');
const sidebar = document.getElementById('sidebar');
let isResizing = false;
if (resizer) {
    resizer.addEventListener('mousedown', () => { isResizing = true; resizer.classList.add('active'); });
    document.addEventListener('mousemove', (e) => { if (isResizing && e.clientX > 200 && e.clientX < 800) sidebar.style.width = e.clientX + 'px'; });
    document.addEventListener('mouseup', () => { isResizing = false; resizer.classList.remove('active'); });
}

const resizerRight = document.getElementById('resizerRight');
const findAllPanel = document.getElementById('findAllPanel');
let isResizingRight = false;
if (resizerRight) {
    resizerRight.addEventListener('mousedown', () => { isResizingRight = true; resizerRight.classList.add('active'); });
    document.addEventListener('mousemove', (e) => {
        if (isResizingRight) {
            let newWidth = window.innerWidth - e.clientX;
            if (newWidth > 200 && newWidth < 800) findAllPanel.style.width = newWidth + 'px';
        }
    });
    document.addEventListener('mouseup', () => { isResizingRight = false; if (resizerRight) resizerRight.classList.remove('active'); });
}

async function toggleHistory() {
    const menu = document.getElementById('historyMenu');
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
        return;
    }
    
    try {
        const res = await fetch(`${API}/history`);
        const data = await res.json();
        renderHistoryUI(data.history);
        menu.style.display = 'block';
    } catch (err) {
        console.error("Failed to fetch history from server:", err);
    }
}

function loadHistoryItem(path) {
    document.getElementById('binaryPath').value = path;
    document.getElementById('historyMenu').style.display = 'none';
    loadBinary();
}

async function deleteHistoryItem(event, path) {
    event.stopPropagation();
    const res = await fetch(`${API}/history_delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({path: path})
    });
    const data = await res.json();
    renderHistoryUI(data.history);
}

function renderHistoryUI(historyArray) {
    const menu = document.getElementById('historyMenu');
    menu.innerHTML = '';
    if (!historyArray || historyArray.length === 0) {
        menu.innerHTML = '<div style="padding:10px; color:#888;">No history found.</div>';
        return;
    }
    historyArray.forEach(h => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.onclick = () => loadHistoryItem(h);
        item.innerHTML = `<span class="history-text" title="${h}">${h}</span>
                          <button class="history-delete" onclick="deleteHistoryItem(event, '${h}')">×</button>`;
        menu.appendChild(item);
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#historyDropdown')) {
        const historyMenu = document.getElementById('historyMenu');
        if(historyMenu) historyMenu.style.display = 'none';
    }
});

const contextMenu = document.getElementById('contextMenu');
document.addEventListener('contextmenu', e => {
    if (e.target.classList.contains('clickable')) {
        e.preventDefault();
        currentElement = e.target;
        const hexValue = currentElement.dataset.value;
        if (!hexValue) return;
        const numValue = parseInt(hexValue, 16);
        
        let ascii = '';
        if (numValue === 0) { ascii = '(null)'; }
        else {
            try {
                let hex = numValue.toString(16);
                if (hex.length % 2) { hex = '0' + hex; }
                for (var i = 0; i < hex.length; i += 2) { ascii += String.fromCharCode(parseInt(hex.substr(i, 2), 16)); }
                ascii = ascii.replace(/[\x00-\x1F\x7F-\x9F]/g, ".");
            } catch (err) { ascii = 'N/A'; }
        }

        contextMenu.innerHTML = `
            <div class="context-menu-item" onclick="convert('hex')">Convert Hex: ${hexValue}</div>
            <div class="context-menu-item" onclick="convert('dec')">Convert Decimal: ${numValue}</div>
            <div class="context-menu-item" onclick="convert('asc')">Convert ASCII: '${ascii}'</div>
        `;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.display = 'block';
    } else {
        if(contextMenu) contextMenu.style.display = 'none';
    }
});

function convert(to) {
    if (!currentElement) return;
    const hexValue = currentElement.dataset.value;
    const numValue = parseInt(hexValue, 16);
    if (typeof trackAction === 'function') trackAction("CONTEXT_CONVERT", { value: hexValue, to: to });
    if (to === 'hex') { currentElement.innerText = hexValue; }
    if (to === 'dec') { currentElement.innerText = numValue; }
    if (to === 'asc') {
        if (numValue === 0) { currentElement.innerText = `'(null)'`; }
        else {
            try {
                let hex = numValue.toString(16);
                if (hex.length % 2) { hex = '0' + hex; }
                let ascii = '';
                for (var i = 0; i < hex.length; i += 2) { ascii += String.fromCharCode(parseInt(hex.substr(i, 2), 16)); }
                currentElement.innerText = `'${ascii.replace(/[\x00-\x1F\x7F-\x9F]/g, ".")}'`;
            } catch(e) { currentElement.innerText = `'(invalid)'`; }
        }
    }
    contextMenu.style.display = 'none';
}
document.addEventListener('click', (e) => { if (!e.target.closest('#contextMenu') && contextMenu) contextMenu.style.display = 'none'; });

document.addEventListener('contextmenu', function(e) {
    const editorEl = e.target.closest('.modal-editor');
    if (!editorEl) return;

    const winId = editorEl.id.replace('_modalEditor', '');
    const win = openWindows[winId];
    if (!win || !win.aceEditor) return;

    const pos = win.aceEditor.getCursorPosition();
    const token = win.aceEditor.session.getTokenAt(pos.row, pos.column);
    if (token && token.value) {
        const val = token.value.trim();
        const isHex = /^0x[0-9a-fA-F]+$/i.test(val);
        const isDec = /^\d+$/.test(val);

        if (isHex || isDec) {
            e.preventDefault();
            e.stopPropagation();

            const numVal = isHex ? parseInt(val, 16) : parseInt(val, 10);
            const hexStr = "0x" + numVal.toString(16);
            const decStr = numVal.toString(10);
            let asciiStr = '';
            try {
                let hexNoPrefix = numVal.toString(16);
                if (hexNoPrefix.length % 2) hexNoPrefix = '0' + hexNoPrefix;
                for (let i = 0; i < hexNoPrefix.length; i += 2) {
                    asciiStr += String.fromCharCode(parseInt(hexNoPrefix.substr(i, 2), 16));
                }
                asciiStr = asciiStr.replace(/[\x00-\x1F\x7F-\x9F]/g, ".");
            } catch(err) { asciiStr = 'N/A'; }

            const menu = document.getElementById('contextMenu');
            menu.innerHTML = `
                <div class="context-menu-item" onclick="replaceAceToken('${winId}', '${hexStr}')">Convert to Hex: ${hexStr}</div>
                <div class="context-menu-item" onclick="replaceAceToken('${winId}', '${decStr}')">Convert to Decimal: ${decStr}</div>
                <div class="context-menu-item" onclick="replaceAceToken('${winId}', '\\'${asciiStr}\\'')">Convert to ASCII: '${asciiStr}'</div>
            `;
            menu.style.top = `${e.pageY}px`;
            menu.style.left = `${e.pageX}px`;
            menu.style.display = 'block';

            activeAceTokenRange = new ace.Range(pos.row, token.start, pos.row, token.start + token.value.length);
        }
    }
});

function replaceAceToken(winId, newVal) {
    const win = openWindows[winId];
    if (win && win.aceEditor && activeAceTokenRange) {
        win.aceEditor.session.replace(activeAceTokenRange, newVal);
        if (typeof trackAction === 'function') trackAction("EDITOR_REPLACE_TOKEN", { new_val: newVal, win: winId });
        activeAceTokenRange = null;
    }
    const menu = document.getElementById('contextMenu');
    if(menu) menu.style.display = 'none';
}

const exportModal = document.getElementById('exportModal');
const exportHeader = document.getElementById('exportHeader');
let expIsDown = false, expOffset = [0, 0];

if(exportHeader) {
    exportHeader.addEventListener('mousedown', (e) => { 
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.win-ctrl-btn')) return;
        expIsDown = true; 
        topZIndex += 2;
        exportModal.style.zIndex = topZIndex;
        expOffset = [ exportModal.offsetLeft - e.clientX, exportModal.offsetTop - e.clientY ]; 
    });
}

document.addEventListener('mouseup', () => expIsDown = false);
document.addEventListener('mousemove', (e) => { 
    if (expIsDown && exportModal) { 
        e.preventDefault(); 
        const newLeft = Math.max(-exportModal.offsetWidth + 100, Math.min(window.innerWidth - 50, e.clientX + expOffset[0]));
        const newTop = Math.max(0, Math.min(window.innerHeight - 50, e.clientY + expOffset[1]));
        exportModal.style.left = newLeft + 'px'; 
        exportModal.style.top  = newTop + 'px'; 
    }
});

document.addEventListener('click', (e) => {
    if (typeof invasive !== 'undefined' && invasive) {
        let targetStr = e.target.tagName;
        if (e.target.id) targetStr += `#${e.target.id}`;
        if (e.target.className && typeof e.target.className === 'string') {
            targetStr += `.${e.target.className.replace(/\s+/g, '.')}`;
        }
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('.clickable') || e.target.closest('.modal-tab') || e.target.closest('.ide-file-item')) {
            if (typeof trackAction === 'function') trackAction("UI_CLICK", { target: targetStr, text: e.target.innerText ? e.target.innerText.substring(0, 50) : '' });
        }
    }
});
