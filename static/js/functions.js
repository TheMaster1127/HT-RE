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
    globalFunctions = data.functions; 
    
    const list = document.getElementById('funcList');
    list.innerHTML = '';
    const langStr = isCpp ? "C++" : "C";
    
    data.functions.forEach(f => {
        const div = document.createElement('div');
        const cleanId = f.addr.replace(/^0x0*/, '') || '0';
        div.id = `func-item-${cleanId}`;
        
        div.className = `func-item ${originalDecompCache[cleanId] ? 'cached' : ''}`;
        div.title = f.name; 
        div.innerHTML = `
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <span class="c-badge">[${langStr}]</span>${escapeHTML(f.name)}
            </span> 
            <span class="addr">${f.addr}</span>`;
        
        div.onclick = () => {
            document.querySelectorAll('.func-item.active').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            
            // Check if jumping across tabs (disables history log), or jumping while ALREADY in Disassembly (enables history log)
            if (currentTab !== 'disasm' || !mainScroller || mainScroller.mode !== 'disasm') {
                loadDisasm().then(() => jumpTo(f.addr, false));
            } else {
                jumpTo(f.addr, true);
            }
        };
        
        div.ondblclick = () => openFuncWindow(f);
        list.appendChild(div);
    });
}
