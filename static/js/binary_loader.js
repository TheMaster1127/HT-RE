// Native File Browser handling
async function handleFilePicked(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    document.getElementById('statusLabel').innerText = "Uploading selected file...";

    try {
        const res = await fetch(`${API}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.path) {
            document.getElementById('binaryPath').value = data.path;
            await loadBinary();
        } else {
            alert("File upload failed: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        alert("Error selecting file: " + e.message);
    }
}

// Workspace Project State Serialization
function saveCurrentProjectState() {
    if (!binaryPath) return;

    if (typeof saveCurrentTabScroll === 'function') {
        saveCurrentTabScroll();
    }

    const windowsState = [];
    Object.keys(openWindows).forEach(winId => {
        const win = openWindows[winId];
        if (win && win.el) {
            windowsState.push({
                id: winId,
                tabs: [...win.tabs],
                activeTabId: win.activeTabId,
                currentView: win.currentView,
                fontSize: win.fontSize || 14,
                isMaximized: !!win.isMaximized,
                isMinimized: !!win.isMinimized,
                geom: {
                    left: win.el.style.left,
                    top: win.el.style.top,
                    width: win.el.style.width,
                    height: win.el.style.height
                }
            });
        }
    });

    const scrollPos = (mainScroller && mainScroller.container) ? mainScroller.container.scrollTop : (tabScrollPositions['disasm'] || 0);
    const existingDisasm = openProjects[binaryPath] ? openProjects[binaryPath].disasmText : (tabDataCache['disasm'] ? tabDataCache['disasm'].output : '');

    openProjects[binaryPath] = {
        binaryPath: binaryPath,
        currentFileHash: currentFileHash,
        navHistory: [...navHistory],
        currentTab: currentTab,
        globalFunctions: [...globalFunctions],
        isCpp: isCpp,
        originalDecompCache: { ...originalDecompCache },
        userEditedDecompCache: { ...userEditedDecompCache },
        modalAsmCache: { ...modalAsmCache },
        tabDataCache: { ...tabDataCache },
        tabScrollPositions: { ...tabScrollPositions },
        disasmText: existingDisasm,
        scrollPos: scrollPos,
        windowsState: windowsState,
        activeWindowId: activeWindowId,
        converterState: exportConverterState(),
        options: {
            arch: document.getElementById('opt-arch').value,
            sections: document.getElementById('opt-sections').value,
            syntax: document.getElementById('opt-syntax').value,
            raw: document.getElementById('opt-raw').checked,
            raw_bin: document.getElementById('opt-raw-bin').checked
        }
    };
}

function restoreProjectState(state) {
    if (!state) return;

    // Completely wipe all current floating windows from previous workspace
    closeAllProjectWindows();

    binaryPath = state.binaryPath;
    currentFileHash = state.currentFileHash;
    navHistory = [...(state.navHistory || [])];
    currentTab = state.currentTab || 'disasm';
    globalFunctions = [...(state.globalFunctions || [])];
    isCpp = !!state.isCpp;
    originalDecompCache = { ...(state.originalDecompCache || {}) };
    userEditedDecompCache = { ...(state.userEditedDecompCache || {}) };
    modalAsmCache = { ...(state.modalAsmCache || {}) };
    tabDataCache = { ...(state.tabDataCache || {}) };
    tabScrollPositions = { ...(state.tabScrollPositions || {}) };

    for (let key in aceSessions) delete aceSessions[key];

    // Restore Back Button Status
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.disabled = (navHistory.length === 0);

    if (state.options) {
        document.getElementById('opt-arch').value = state.options.arch || 'x86-64';
        document.getElementById('opt-sections').value = state.options.sections || 'all';
        document.getElementById('opt-syntax').value = state.options.syntax || 'intel';
        document.getElementById('opt-raw').checked = !!state.options.raw;
        document.getElementById('opt-raw-bin').checked = !!state.options.raw_bin;
    }

    const langStr = isCpp ? "C++" : "C";
    const btnShowAll = document.getElementById('btnShowAll');
    if (btnShowAll) btnShowAll.innerText = `Show All in One (${langStr})`;
    document.querySelectorAll('.dyn-c-lang').forEach(el => el.innerText = langStr);

    const btnAll = document.getElementById('btnDecompAll');
    if (originalDecompCache['BATCH_COMPLETE']) {
        btnAll.innerText = "✓ Decompiled Already";
    } else {
        btnAll.innerText = "⚡ Decompile All";
    }

    // Restore Converter and Calculators state specifically for this project
    importConverterState(state.converterState);

    document.getElementById('binaryPath').value = binaryPath;
    document.getElementById('statusLabel').innerHTML = `Working: <span style="color:#fff;" title="${binaryPath}">${binaryPath}</span>`;

    renderProjectTabs();
    loadFunctions();

    // Reconstruct all saved windows specifically belonging to this project
    if (state.windowsState && state.windowsState.length > 0) {
        state.windowsState.forEach(winData => {
            if (winData.tabs && winData.tabs.length > 0) {
                const winObj = createNewWindow(null, winData.geom);
                winObj.tabs = [...winData.tabs];
                winObj.activeTabId = winData.activeTabId;
                winObj.currentView = winData.currentView || 'asm';
                winObj.fontSize = winData.fontSize || 14;
                winObj.isMaximized = !!winData.isMaximized;
                winObj.isMinimized = !!winData.isMinimized;

                if (winObj.isMaximized) winObj.el.classList.add('maximized');
                if (winObj.isMinimized) winObj.el.classList.add('minimized');

                renderWindowTabs(winObj.id);
                switchWindowView(winObj.id, winObj.currentView);
            }
        });

        if (state.activeWindowId && openWindows[state.activeWindowId]) {
            bringWindowToFront(state.activeWindowId);
        }
    }

    updateTabs(currentTab);
    
    // Restore tab content and scroll position without re-fetching
    if (currentTab === 'disasm') {
        const disasmContent = state.disasmText || (tabDataCache['disasm'] && tabDataCache['disasm'].output);
        if (disasmContent) {
            mainScroller = new VirtualScroller('output', disasmContent, 'disasm');
            const targetScroll = tabScrollPositions['disasm'] !== undefined ? tabScrollPositions['disasm'] : (state.scrollPos || 0);
            if (mainScroller.container) {
                mainScroller.container.scrollTop = targetScroll;
                mainScroller.render();
            }
        } else {
            loadDisasm();
        }
    } else if (currentTab === 'foundStrings') {
        loadFoundStrings();
    } else if (['header', 'sections', 'hexdump', 'relocs', 'strings'].includes(currentTab)) {
        const cmdMap = {
            'header': 'readelf-h',
            'sections': 'readelf-S',
            'hexdump': 'hexdump',
            'relocs': 'objdump-R',
            'strings': 'strings'
        };
        runCmd(cmdMap[currentTab], currentTab);
    }
}

function renderProjectTabs() {
    const container = document.getElementById('projectTabsBar');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(openProjects).forEach(path => {
        const isActive = path === binaryPath;
        const name = path.split('/').pop() || path;
        
        const tabEl = document.createElement('div');
        tabEl.className = `project-tab ${isActive ? 'active' : ''}`;
        tabEl.title = path;
        tabEl.innerHTML = `
            <span class="project-tab-name">📁 ${escapeHTML(name)}</span>
            <span class="project-tab-close" onclick="closeProjectTab(event, '${path.replace(/'/g, "\\'")}')" title="Close Project">×</span>
        `;
        tabEl.onclick = () => switchProject(path);
        container.appendChild(tabEl);
    });
}

function switchProject(path) {
    if (path === binaryPath) return;
    saveCurrentProjectState();
    if (openProjects[path]) {
        restoreProjectState(openProjects[path]);
    }
}

function closeProjectTab(event, path) {
    if (event) event.stopPropagation();
    delete openProjects[path];

    if (path === binaryPath) {
        closeAllProjectWindows();
        const remaining = Object.keys(openProjects);
        if (remaining.length > 0) {
            restoreProjectState(openProjects[remaining[0]]);
        } else {
            binaryPath = '';
            document.getElementById('binaryPath').value = '';
            document.getElementById('statusLabel').innerHTML = 'No file loaded';
            document.getElementById('funcList').innerHTML = '';
            document.getElementById('output').innerHTML = '';
            mainScroller = null;
            tabDataCache = {};
            tabScrollPositions = {};
            resetConverterToDefault();
            renderProjectTabs();
        }
    } else {
        renderProjectTabs();
    }
}

async function loadBinary() {
    const newPath = document.getElementById('binaryPath').value.trim();
    if (!newPath) return;

    // Save previous active binary workspace
    if (binaryPath) {
        saveCurrentProjectState();
    }

    // Instantly wipe all open windows from the screen
    closeAllProjectWindows();

    // If this binary is already opened in a project tab, just switch to it cleanly
    if (openProjects[newPath]) {
        restoreProjectState(openProjects[newPath]);
        return;
    }

    // Brand new binary: start with a fresh data converter & calculator
    resetConverterToDefault();

    binaryPath = newPath;
    tabDataCache = {};
    tabScrollPositions = {};

    const btnAll = document.getElementById('btnDecompAll');
    btnAll.innerText = "⚡ Decompile All";
    btnAll.disabled = false;
    
    // Background language detection
    const gRes = await fetch(`${API}/generic`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({binary_path: binaryPath, cmd: 'readelf-h'}) });
    const gData = await gRes.json();
    isCpp = gData.output && gData.output.includes("Compiler Language: C++");
    
    const langStr = isCpp ? "C++" : "C";

    const btnShowAll = document.getElementById('btnShowAll');
    if (btnShowAll) btnShowAll.innerText = `Show All in One (${langStr})`;
    document.querySelectorAll('.dyn-c-lang').forEach(el => el.innerText = langStr);

    const res = await fetch(`${API}/load`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({binary_path: binaryPath})
    });
    const data = await res.json();
    
    if (data.valid) {
        document.getElementById('statusLabel').innerHTML = `Working: <span style="color:#fff;" title="${binaryPath}">${binaryPath}</span> [${data.arch}]`;
        renderHistoryUI(data.history);
        document.getElementById('opt-arch').value = data.arch;
        if (document.getElementById('asm-arch')) document.getElementById('asm-arch').value = data.arch;
        
        currentFileHash = data.file_hash || '';
        
        // Reset and apply backend cache
        for (let key in aceSessions) delete aceSessions[key];
        for (let key in userEditedDecompCache) delete userEditedDecompCache[key];
        for (let k in originalDecompCache) delete originalDecompCache[k];
        for (let k in modalAsmCache) delete modalAsmCache[k];
        
        if (data.decomp_cache) {
            Object.assign(originalDecompCache, data.decomp_cache);
            if (originalDecompCache['BATCH_COMPLETE']) {
                btnAll.innerText = "✓ Decompiled Already";
            }
        }

        saveCurrentProjectState();
        renderProjectTabs();

        await loadFunctions();
        await loadDisasm(true);
    } else {
        alert("Invalid binary: " + data.message);
    }
}

fetch(`${API}/history`).then(r => r.json()).then(data => {
    renderHistoryUI(data.history);
    
    const input = document.getElementById('binaryPath');
    if (!input.value && data.history && data.history.length > 0) {
        input.value = data.history[0];
    }
    
    if (input.value) {
        loadBinary();
    }
});
