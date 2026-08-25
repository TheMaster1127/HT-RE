function filterFunctions() {
    const term = document.getElementById('funcSearch').value.toLowerCase();
    document.querySelectorAll('.func-item').forEach(el => {
        el.style.display = el.innerText.toLowerCase().includes(term) ? 'flex' : 'none';
    });
}

async function loadFunctions() {
    if (document.getElementById('opt-raw-bin').checked) {
        document.getElementById('funcList').innerHTML = '<div style="padding:10px;color:#888;">No symbols in raw binary mode.</div>';
        globalFunctions = [];
        return;
    }
    const res = await fetch(`${API}/nm`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({binary_path: binaryPath})
    });
    const data = await res.json();
    globalFunctions = data.functions || []; 
    
    const list = document.getElementById('funcList');
    list.innerHTML = '';
    const langStr = isCpp ? "C++" : "C";
    
    globalFunctions.forEach(f => {
        const div = document.createElement('div');
        const cleanId = f.addr.replace(/^0x0*/, '') || '0';
        div.id = `func-item-${cleanId}`;
        
        div.className = `func-item ${originalDecompCache[cleanId] ? 'cached' : ''}`;
        div.title = `${f.name} (${f.addr})`; 
        div.innerHTML = `
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
                <span class="c-badge">[${langStr}]</span>${escapeHTML(f.name)}
            </span> 
            <span class="addr">${f.addr}</span>`;
        
        div.onclick = () => {
            document.querySelectorAll('.func-item.active').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            
            if (currentTab !== 'disasm' || !mainScroller || mainScroller.mode !== 'disasm') {
                loadDisasm().then(() => jumpTo(f.addr, false));
            } else {
                jumpTo(f.addr, true);
            }
        };
        
        div.ondblclick = () => openFuncWindow(f, false);

        // Sidebar Function Context Menu (Open in New Window at the top)
        div.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showFuncContextMenu(e, f);
        };

        list.appendChild(div);
    });
}

function showFuncContextMenu(e, func) {
    const menu = document.getElementById('funcContextMenu');
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openFuncWindow(${JSON.stringify(func).replace(/"/g, '&quot;')}, true); hideFuncContextMenu();">🗔 Open in New Window</div>
        <div class="context-menu-item" onclick="openFuncWindow(${JSON.stringify(func).replace(/"/g, '&quot;')}, false); hideFuncContextMenu();">📑 Open in Active Window (Tab)</div>
        <div class="context-menu-item" onclick="jumpTo('${func.addr}', true); hideFuncContextMenu();">🎯 Jump to in Disassembly</div>
        <div class="context-menu-item" onclick="navigator.clipboard.writeText('${func.name.replace(/'/g, "\\'")}'); hideFuncContextMenu();">📋 Copy Function Name</div>
        <div class="context-menu-item" onclick="navigator.clipboard.writeText('${func.addr}'); hideFuncContextMenu();">📋 Copy Address (${func.addr})</div>
    `;
    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    menu.style.display = 'block';
}

function hideFuncContextMenu() {
    const menu = document.getElementById('funcContextMenu');
    if (menu) menu.style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#funcContextMenu')) {
        hideFuncContextMenu();
    }
});
