// Centralized, bulletproof project serializer
function saveCurrentProjectState() {
    if (!binaryPath) return;
    if (!openProjects[binaryPath]) {
        openProjects[binaryPath] = { path: binaryPath, name: binaryPath.split('/').pop() };
    }

    // 1. Active Tab
    openProjects[binaryPath].activeTab = currentTab;

    // 2. Active Tab Scroll
    if (mainScroller && mainScroller.container && mainScroller.isReady && (mainScroller.ownerBinary === binaryPath)) {
        const pos = mainScroller.container.scrollTop;
        const key = binaryPath + '|||' + currentTab;
        tabScrollPositions[key] = pos;
        if (!openProjects[binaryPath].scrolls) openProjects[binaryPath].scrolls = {};
        openProjects[binaryPath].scrolls[currentTab] = pos;
    }

    // 3. Converter & All Spawned Calculators
    if (typeof exportConverterState === 'function') {
        openProjects[binaryPath].converterState = exportConverterState();
    }

    // 4. Trace & Hook UI tab state
    openProjects[binaryPath].debugState = {
        activeTab: document.querySelector('.bp-tab.active')?.innerText.includes('Debugger') ? 'debugger' : 
                  (document.querySelector('.bp-tab.active')?.innerText.includes('Syscalls') ? 'strace' : 'binwalk')
    };
}

async function loadBinary() {
    const p = document.getElementById('binaryPath').value;
    if (!p) return;

    // 1. SAVE THE ACTIVE PROJECT'S COMPLETE STATE BEFORE LOADING A NEW ONE
    saveCurrentProjectState();

    // 2. Deactivate previous scroller so its DOM teardown won't leak events
    if (mainScroller) {
        mainScroller.isReady = false;
    }

    localStorage.setItem('htre_last_binary', p);
    document.getElementById('statusLabel').innerText = "Loading " + p + "...";
    if (typeof trackAction === 'function') trackAction("LOAD_BINARY", { path: p });

    globalFunctions = [];
    currentFileHash = '';
    const funcListEl = document.getElementById('funcList');
    if (funcListEl) funcListEl.innerHTML = '';

    try {
        const res = await fetch(`${API}/load`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({binary_path: p})
        });
        const data = await res.json();

        if (data.error) {
            document.getElementById('statusLabel').innerText = "Error loading binary";
            alert(data.error);
            return;
        }

        binaryPath = data.binary_path || p;
        currentFileHash = data.file_hash || '';
        document.getElementById('statusLabel').innerText = "Loaded: " + binaryPath;

        // POPULATE CACHE IMMEDIATELY FROM BACKEND
        if (data.decomp_cache) {
            Object.keys(data.decomp_cache).forEach(addr => {
                const cleanId = getCleanId(addr);
                if (cleanId !== 'BATCH_COMPLETE' && cleanId !== 'COMBINED') {
                    originalDecompCache[binaryPath + '|||' + cleanId] = data.decomp_cache[addr];
                }
            });
        }

        // AUTO-DETECT ARCHITECTURE using readelf header
        try {
            const archRes = await fetch(`${API}/generic`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({binary_path: binaryPath, cmd: 'readelf-h'}) });
            const archData = await archRes.json();
            const headerOut = archData.output || '';
            const archSelect = document.getElementById('opt-arch');
            if (archSelect) {
                if (headerOut.includes('AArch64') || headerOut.includes('aarch64')) archSelect.value = 'aarch64';
                else if (headerOut.includes('ARM') || headerOut.includes('arm')) archSelect.value = 'arm';
                else archSelect.value = 'x86-64';
            }
        } catch(e) { console.warn("Auto-detect arch failed", e); }

        // Loads symbols safely via functions.js
        if (typeof loadFunctions === 'function') loadFunctions(binaryPath);

        if (typeof loadPatchHistory === 'function') {
            try { loadPatchHistory(); } catch(e) {}
        }

        // PROJECT WORKSPACE TABS LOGIC (Brand new binary starts fresh with converterState: null)
        if (!openProjects[binaryPath]) {
            openProjects[binaryPath] = {
                path: binaryPath,
                name: binaryPath.split('/').pop(),
                scrolls: {},
                activeTab: 'disasm',
                converterState: null,
                debugState: { activeTab: 'debugger' }
            };
        }
        renderProjectTabs();

        // RESTORE CONVERTER / CALCULATORS STATE
        if (typeof importConverterState === 'function') {
            importConverterState(openProjects[binaryPath].converterState);
        }

        // ISOLATE & RESTORE FLOATING WINDOWS FOR THIS BINARY
        if (typeof updateProjectWindowsVisibility === 'function') {
            updateProjectWindowsVisibility();
        }

        // RESTORE EXACT TAB PER PROJECT WORKSPACE
        const targetTab = (openProjects[binaryPath] && openProjects[binaryPath].activeTab) || 'disasm';
        updateTabs(targetTab);

        if (targetTab === 'disasm') {
            loadDisasm();
        } else if (targetTab === 'hexdump') {
            runCmd('hexdump', 'hexdump');
        } else if (targetTab === 'strings') {
            runCmd('strings', 'strings');
        } else if (targetTab === 'header') {
            runCmd('readelf-h', 'header');
        } else if (targetTab === 'sections') {
            runCmd('readelf-S', 'sections');
        } else if (targetTab === 'relocs') {
            runCmd('objdump-R', 'relocs');
        } else if (targetTab === 'foundStrings') {
            loadFoundStrings();
        } else if (targetTab === 'conv') {
            showConvUI();
        } else if (targetTab === 'patch') {
            showPatchUI();
        } else if (targetTab === 'debug') {
            if (typeof showDebugUI === 'function') showDebugUI();
        } else if (targetTab === 'asm') {
            showAsmUI();
        } else if (targetTab === 'ide') {
            showIdeUI();
        } else if (targetTab === 'ascii') {
            showAsciiUI();
        } else {
            loadDisasm();
        }

    } catch (err) {
        document.getElementById('statusLabel').innerText = "Network Error";
        console.error(err);
    }
}

// Renders the Multi-Binary File Tabs at the top of the screen
function renderProjectTabs() {
    const bar = document.getElementById('projectTabsBar');
    if (!bar) return;
    bar.innerHTML = '';

    Object.values(openProjects).forEach(proj => {
        const isActive = (proj.path === binaryPath);
        const tab = document.createElement('div');
        tab.className = 'project-tab' + (isActive ? ' active' : '');

        tab.innerHTML = `
            <span class="project-tab-name" title="${proj.path}">${proj.name}</span>
            <span class="project-tab-close" onclick="closeProject(event, '${proj.path}')">×</span>
        `;

        tab.onclick = () => {
            if (!isActive) {
                // 1. SAVE ACTIVE PROJECT BEFORE SWAPPING
                saveCurrentProjectState();

                // 2. Deactivate previous scroller so its DOM teardown won't leak events
                if (mainScroller) {
                    mainScroller.isReady = false;
                }

                // 3. Switch project to target
                document.getElementById('binaryPath').value = proj.path;
                loadBinary();
            }
        };
        bar.appendChild(tab);
    });
}

function closeProject(e, path) {
    e.stopPropagation();
    delete openProjects[path];

    // Clean up and close all floating windows belonging to this specific project
    Object.keys(openWindows).forEach(winId => {
        if (openWindows[winId].binary === path) {
            closeWindow(winId);
        }
    });

    if (binaryPath === path) {
        const remaining = Object.keys(openProjects);
        if (remaining.length > 0) {
            document.getElementById('binaryPath').value = remaining[0];
            loadBinary();
        } else {
            if (typeof resetWorkspace === 'function') resetWorkspace();
        }
    } else {
        renderProjectTabs();
    }
}

function handleFilePicked(event) {
    const file = event.target.files[0];
    if (!file) return;

    // SAVE ACTIVE PROJECT BEFORE FILE UPLOAD
    saveCurrentProjectState();

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API}/upload`, {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            document.getElementById('binaryPath').value = data.path;
            loadBinary();
        }
        event.target.value = '';
    })
    .catch(err => {
        alert("Upload failed: " + err);
        event.target.value = '';
    });
}
