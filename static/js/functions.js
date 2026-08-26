function filterFunctions() {
    const val = document.getElementById('funcSearch').value.toLowerCase();
    const filtered = globalFunctions.filter(f => f.name.toLowerCase().includes(val) || f.addr.toLowerCase().includes(val));
    renderFunctions(filtered);
}

async function loadFunctions(path = binaryPath) {
    if (document.getElementById('opt-raw-bin') && document.getElementById('opt-raw-bin').checked) {
        document.getElementById('funcList').innerHTML = '<div style="padding:10px;color:#888;">No symbols in raw binary mode.</div>';
        globalFunctions = [];
        return;
    }
    
    const res = await fetch(`${API}/nm`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({binary_path: path})
    });
    const data = await res.json();
    
    if (!data.functions) {
        document.getElementById('funcList').innerHTML = '<div style="padding:10px;color:#ff3333;">Failed to load functions (is it stripped?)</div>';
        return;
    }

    isCpp = false;
    globalFunctions = data.functions.map(f => {
        let name = f.name;
        if (name.includes('::') || name.startsWith('_Z')) {
            isCpp = true;
        }
        return { addr: f.addr, name: name, binary: path };
    });
    
    renderFunctions(globalFunctions);
    
    const langStr = isCpp ? "C++" : "C";
    const btnShowAll = document.getElementById('btnShowAll');
    if (btnShowAll) btnShowAll.innerText = `Show All in One (${langStr})`;
}

function renderFunctions(funcs) {
    const list = document.getElementById('funcList');
    if (!list) return;
    list.innerHTML = '';
    const langStr = isCpp ? 'C++' : 'C';

    funcs.forEach(f => {
        const div = document.createElement('div');
        const cleanId = getCleanId(f.addr);
        div.id = `func-item-${cleanId}`;
        
        div.className = `func-item`;
        div.title = `${f.name} (${f.addr})`;
        
        div.innerHTML = `
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
                <span class="c-badge">[${langStr}]</span>${escapeHTML(f.name)}
            </span> 
            <span class="addr">${f.addr}</span>
        `;
        
        const cacheKey = binaryPath + '|||' + cleanId;
        if (originalDecompCache[cacheKey]) {
            div.classList.add('cached');
        }
        
        div.onclick = () => {
            document.querySelectorAll('.func-item.active').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            
            if (currentTab !== 'disasm' || !mainScroller || mainScroller.mode !== 'disasm') {
                loadDisasm().then(() => { if (typeof jumpTo === 'function') jumpTo(f.addr, true); });
            } else {
                if (typeof jumpTo === 'function') jumpTo(f.addr, true);
            }
        };
        
        div.ondblclick = () => openFuncWindow(f, false);
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
        <div class="context-menu-item" onclick="if(typeof updateTabs === 'function') updateTabs('disasm'); loadDisasm().then(() => jumpTo('${func.addr}', true)); hideFuncContextMenu();">🎯 Jump to in Disassembly</div>
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
