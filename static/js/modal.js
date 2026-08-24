function initAceEditor() {
    if (!aceEditor) {
        aceEditor = ace.edit("modalEditor");
        aceEditor.setTheme("ace/theme/vibrant_ink");
        aceEditor.setOptions({
            fontSize: `${editorFontSize}px`,
            fontFamily: "'Fira Code', 'Courier New', monospace",
            showPrintMargin: false,
            wrap: true,
            tabSize: 4,
            highlightActiveLine: true
        });

        aceEditor.on("change", function() {
            if (currentModalFunc && currentModalView === 'decomp') {
                const cleanAddr = currentModalFunc.addr.replace(/^0x0*/, '') || '0';
                userEditedDecompCache[cleanAddr] = aceEditor.getValue();
            }
        });

        aceEditor.on("dblclick", function() {
            const pos = aceEditor.getCursorPosition();
            const token = aceEditor.session.getTokenAt(pos.row, pos.column);
            if (token && token.value) {
                const tokenWord = token.value.trim();
                const targetFunc = globalFunctions.find(f => f.name === tokenWord);
                if (targetFunc) {
                    openFuncWindow(targetFunc);
                }
            }
        });
    }
}

function changeFontSize(delta) {
    editorFontSize = Math.max(10, Math.min(30, editorFontSize + delta));
    if (aceEditor) aceEditor.setFontSize(`${editorFontSize}px`);
}

function renderModalTabs() {
    const container = document.getElementById('modalTabsContainer');
    container.innerHTML = '';
    openedModalTabs.forEach(tabFunc => {
        const cleanId = tabFunc.addr.replace(/^0x0*/, '') || '0';
        const isActive = currentActiveTabId === cleanId;
        const isCombined = cleanId === 'COMBINED';
        
        const tabEl = document.createElement('div');
        tabEl.className = `modal-tab ${isActive ? 'active' : ''} ${isCombined ? 'golden-tab' : ''}`;
        tabEl.innerHTML = `
            <span>${isCombined ? '🌟 ' : ''}${escapeHTML(tabFunc.name)}</span>
            <span class="modal-tab-close" onclick="closeModalTab(event, '${cleanId}')">×</span>
        `;
        tabEl.onclick = () => {
            currentActiveTabId = cleanId;
            currentModalFunc = tabFunc;
            renderModalTabs();
            switchModalView(currentModalView);
        };
        container.appendChild(tabEl);
    });
}

function closeModalTab(event, cleanId) {
    event.stopPropagation();
    openedModalTabs = openedModalTabs.filter(f => (f.addr.replace(/^0x0*/, '') || '0') !== cleanId);
    if (openedModalTabs.length === 0) {
        closeFuncModal();
    } else {
        if (currentActiveTabId === cleanId) {
            currentModalFunc = openedModalTabs[openedModalTabs.length - 1];
            currentActiveTabId = currentModalFunc.addr.replace(/^0x0*/, '') || '0';
            switchModalView(currentModalView);
        } else {
            renderModalTabs();
        }
    }
}

async function openFuncWindow(func) {
    const cleanId = func.addr.replace(/^0x0*/, '') || '0';
    if (!openedModalTabs.find(f => (f.addr.replace(/^0x0*/, '') || '0') === cleanId)) {
        openedModalTabs.push(func);
    }
    
    currentActiveTabId = cleanId;
    currentModalFunc = func;
    
    const modal = document.getElementById('funcModal');
    const isModalAlreadyOpen = modal.style.display === 'flex';
    
    if (!isModalAlreadyOpen) {
        currentModalView = 'asm'; // Default to ASM ONLY if the modal is currently closed
    }
    
    renderModalTabs();
    modal.style.display = 'flex';

    await switchModalView(currentModalView);
}

function closeFuncModal() {
    const modal = document.getElementById('funcModal');
    if (modal) modal.style.display = 'none';
    openedModalTabs = [];
    currentModalFunc = null;
    currentActiveTabId = null;
}

async function loadModalAsm() {
    if (!currentModalFunc) return;
    const cleanAddr = currentModalFunc.addr.replace(/^0x0*/, '') || '0';
    const dispAddr = cleanAddr === 'COMBINED' ? '🌟' : currentModalFunc.addr;
    document.getElementById('modalTitle').innerText = `Viewing: ${currentModalFunc.name} (${dispAddr})`;
    document.getElementById('editorControls').style.display = 'none';
    document.getElementById('modalContent').style.display = 'block';
    document.getElementById('modalEditor').style.display = 'none';

    const content = document.getElementById('modalContent');
    
    if (modalAsmCache[cleanAddr]) {
        modalScroller = new VirtualScroller('modalContent', modalAsmCache[cleanAddr], 'disasm');
        return;
    }

    if (cleanAddr === 'COMBINED') {
        content.innerHTML = '<div style="padding:10px; color: #ffd700;">Cannot disassemble combined C/C++ output. Switch to Decompile view.</div>';
        return;
    }

    content.innerHTML = '<div style="padding:10px;">Disassembling function...</div>';
    const options = {
        arch: document.getElementById('opt-arch').value,
        all_sections: document.getElementById('opt-sections').value === 'all',
        syntax: document.getElementById('opt-syntax').value,
        show_raw: document.getElementById('opt-raw').checked,
        raw_binary: document.getElementById('opt-raw-bin').checked
    };

    const res = await fetch(`${API}/function_code`, { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ binary_path: binaryPath, start_addr: currentModalFunc.addr, options: options }) 
    });
    const data = await res.json();
    modalAsmCache[cleanAddr] = data.output || "Could not extract function assembly.";
    modalScroller = new VirtualScroller('modalContent', modalAsmCache[cleanAddr], 'disasm');
}

async function loadModalDecomp() {
    if (!currentModalFunc) return;
    const cleanAddr = currentModalFunc.addr.replace(/^0x0*/, '') || '0';
    const dispAddr = cleanAddr === 'COMBINED' ? '🌟' : currentModalFunc.addr;
    document.getElementById('modalTitle').innerText = `Viewing: ${currentModalFunc.name} (${dispAddr})`;
    document.getElementById('editorControls').style.display = 'flex';
    document.getElementById('modalContent').style.display = 'none';
    document.getElementById('modalEditor').style.display = 'block';
    initAceEditor();

    let textToLoad = "";

    if (userEditedDecompCache[cleanAddr]) {
        textToLoad = userEditedDecompCache[cleanAddr];
    } else if (originalDecompCache[cleanAddr]) {
        textToLoad = originalDecompCache[cleanAddr];
    } else {
        textToLoad = "// Decompiling with Ghidra, please wait...";
    }

    if (!aceSessions[cleanAddr]) {
        aceSessions[cleanAddr] = new ace.EditSession(textToLoad, "ace/mode/c_cpp");
        aceSessions[cleanAddr].setUndoManager(new ace.UndoManager());
    } else {
        if (textToLoad !== "// Decompiling with Ghidra, please wait..." && aceSessions[cleanAddr].getValue().includes("Decompiling with Ghidra, please wait...")) {
            aceSessions[cleanAddr].setValue(textToLoad);
        }
    }
    
    aceEditor.setSession(aceSessions[cleanAddr]);

    if (!userEditedDecompCache[cleanAddr] && !originalDecompCache[cleanAddr] && cleanAddr !== 'COMBINED') {
        const res = await fetch(`${API}/decompile`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ binary_path: binaryPath, addr: currentModalFunc.addr, name: currentModalFunc.name, file_hash: currentFileHash })
        });
        const data = await res.json();
        const output = data.output || "// Decompilation output empty.";
        originalDecompCache[cleanAddr] = output;
        
        aceSessions[cleanAddr].setValue(output);

        const el = document.getElementById(`func-item-${cleanAddr}`);
        if (el) el.classList.add('cached');
        
        const langStr = isCpp ? "C++" : "C";
        document.getElementById('btnModalDecomp').innerText = `Decompiled (${langStr})`;
    }
}

async function switchModalView(view) {
    if (!currentModalFunc) return;
    currentModalView = view;
    
    const cleanAddr = currentModalFunc.addr.replace(/^0x0*/, '') || '0';
    const isDecompiled = !!originalDecompCache[cleanAddr] && cleanAddr !== 'COMBINED';
    const langStr = isCpp ? "C++" : "C";
    document.getElementById('btnModalDecomp').innerText = isDecompiled ? `Decompiled (${langStr})` : `Decompile (${langStr})`;

    if (view === 'asm') {
        document.getElementById('btnModalAsm').classList.add('active');
        document.getElementById('btnModalDecomp').classList.remove('active');
        await loadModalAsm();
    } else {
        document.getElementById('btnModalAsm').classList.remove('active');
        document.getElementById('btnModalDecomp').classList.add('active');
        await loadModalDecomp();
        if (aceEditor) aceEditor.focus();
    }
}
