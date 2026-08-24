async function runCmd(cmd, tabName) {
    updateTabs(tabName);
    let mode = 'text';
    if (cmd === 'hexdump') mode = 'hex';
    else if (cmd === 'readelf-h') mode = 'header';
    else if (cmd === 'readelf-S') mode = 'sections';

    document.getElementById('output').innerHTML = '<div style="padding:10px;">Loading...</div>';
    const res = await fetch(`${API}/generic`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({binary_path: binaryPath, cmd: cmd}) });
    const data = await res.json();
    mainScroller = new VirtualScroller('output', data.output, mode);
}

function updateTabs(activeTab) {
    currentTab = activeTab;
    
    // Clear navigation history when leaving disassembly tab
    if (activeTab !== 'disasm') {
        navHistory = [];
        const btnBack = document.getElementById('btnBack');
        if (btnBack) btnBack.disabled = true;
    }

    document.getElementById('output').style.display = activeTab === 'patch' ? 'none' : 'block';
    document.getElementById('patchPanel').style.display = activeTab === 'patch' ? 'flex' : 'none';
    document.getElementById('findAllPanel').style.display = 'none';
    
    document.getElementById('bar-jump').style.display = (activeTab === 'disasm' || activeTab === 'hexdump') ? 'flex' : 'none';
    document.getElementById('bar-search').style.display = (activeTab === 'strings' || activeTab === 'foundStrings' || activeTab === 'hexdump' || activeTab === 'header' || activeTab === 'sections' || activeTab === 'relocs') ? 'flex' : 'none';
    
    if(activeTab === 'disasm' || activeTab === 'hexdump') document.getElementById('jumpInput').placeholder = activeTab === 'hexdump' ? "e.g. 0x112b" : "e.g. 0x4011cd";

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btnMap = { 'header': 0, 'sections': 1, 'disasm': 2, 'hexdump': 3, 'relocs': 4, 'strings': 5, 'foundStrings': 6, 'patch': 7 };
    if(activeTab in btnMap) document.querySelectorAll('.tab-btn')[btnMap[activeTab]].classList.add('active');
}

function executeSearch() {
    const val = document.getElementById('searchInput').value;
    if(val) {
        if(currentTab === 'foundStrings') filterFoundStrings(val);
        else if(mainScroller) mainScroller.searchNext(val);
    }
}

function executeFindAll() {
    const val = document.getElementById('searchInput').value;
    if(!val || !mainScroller) return;
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

// Resizer logic (Left / Right)
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

// History Dropdown Logic
function toggleHistory() {
    const menu = document.getElementById('historyMenu');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
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
    if (historyArray.length === 0) {
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
        document.getElementById('historyMenu').style.display = 'none';
    }
});

// Right-click context conversion
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
        contextMenu.style.display = 'none';
    }
});

function convert(to) {
    if (!currentElement) return;
    const hexValue = currentElement.dataset.value;
    const numValue = parseInt(hexValue, 16);
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
document.addEventListener('click', (e) => { if (!e.target.closest('#contextMenu')) contextMenu.style.display = 'none'; });

// Ace Context Menu replacement
document.getElementById('modalEditor').addEventListener('contextmenu', function(e) {
    if (!aceEditor) return;
    const pos = aceEditor.getCursorPosition();
    const token = aceEditor.session.getTokenAt(pos.row, pos.column);
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
                <div class="context-menu-item" onclick="replaceAceToken('${hexStr}')">Convert to Hex: ${hexStr}</div>
                <div class="context-menu-item" onclick="replaceAceToken('${decStr}')">Convert to Decimal: ${decStr}</div>
                <div class="context-menu-item" onclick="replaceAceToken('\\'${asciiStr}\\'')">Convert to ASCII: '${asciiStr}'</div>
            `;
            menu.style.top = `${e.pageY}px`;
            menu.style.left = `${e.pageX}px`;
            menu.style.display = 'block';

            activeAceTokenRange = new ace.Range(pos.row, token.start, pos.row, token.start + token.value.length);
        }
    }
});

function replaceAceToken(newVal) {
    if (aceEditor && activeAceTokenRange) {
        aceEditor.session.replace(activeAceTokenRange, newVal);
        activeAceTokenRange = null;
    }
    document.getElementById('contextMenu').style.display = 'none';
}

// Draggable Modals setup
const exportModal = document.getElementById('exportModal');
const exportHeader = document.getElementById('exportHeader');
let expIsDown = false, expOffset = [0,0];
exportHeader.addEventListener('mousedown', (e) => { 
    if (e.target.closest('button') || e.target.closest('span') || e.target.closest('input')) return;
    expIsDown = true; 
    expOffset = [ exportModal.offsetLeft - e.clientX, exportModal.offsetTop - e.clientY ]; 
});
document.addEventListener('mouseup', () => expIsDown = false);
document.addEventListener('mousemove', (e) => { if (expIsDown) { e.preventDefault(); exportModal.style.left = (e.clientX + expOffset[0]) + 'px'; exportModal.style.top  = (e.clientY + expOffset[1]) + 'px'; }});

const modal = document.getElementById('funcModal');
const header = document.getElementById('modalHeader');
let isDown = false, offset = [0,0];
header.addEventListener('mousedown', (e) => { 
    if (e.target.closest('button') || e.target.closest('span') || e.target.closest('input') || e.target.closest('.modal-tabs-container')) return;
    isDown = true; 
    offset = [ modal.offsetLeft - e.clientX, modal.offsetTop - e.clientY ]; 
});
document.addEventListener('mouseup', () => isDown = false);
document.addEventListener('mousemove', (e) => { if (isDown) { e.preventDefault(); modal.style.left = (e.clientX + offset[0]) + 'px'; modal.style.top  = (e.clientY + offset[1]) + 'px'; }});
