// --- DYNAMIC MULTI-WINDOW MANAGER (PROJECT-ISOLATED) ---

function bringWindowToFront(winId) {
    const win = openWindows[winId];
    if (!win) return;
    topZIndex += 2;
    win.el.style.zIndex = topZIndex;
    activeWindowId = winId;
    if (typeof updateTaskbarUI === 'function') updateTaskbarUI();
}

function updateProjectWindowsVisibility() {
    Object.values(openWindows).forEach(win => {
        if (win.binary === binaryPath) {
            if (win.isMinimized) {
                win.el.style.display = 'none';
                win.el.classList.add('minimized');
                win.el.classList.remove('window-visible');
            } else {
                win.el.style.display = 'flex';
                win.el.classList.remove('minimized');
                win.el.classList.add('window-visible');
                if (win.isMaximized) {
                    win.el.classList.add('maximized');
                }
            }
        } else {
            // Belongs to another binary -> Hide completely!
            win.el.style.display = 'none';
            win.el.classList.remove('window-visible');
        }
    });

    const currentProjectWins = Object.values(openWindows).filter(w => w.binary === binaryPath && !w.isMinimized);
    if (currentProjectWins.length > 0) {
        if (!activeWindowId || !openWindows[activeWindowId] || openWindows[activeWindowId].binary !== binaryPath) {
            activeWindowId = currentProjectWins[currentProjectWins.length - 1].id;
        }
    } else {
        activeWindowId = null;
    }

    if (typeof updateTaskbarUI === 'function') updateTaskbarUI();
}

function createNewWindow(initialFunc = null, customGeom = null) {
    const winId = 'win_' + (++windowCounter);
    const container = document.getElementById('windowManagerContainer');
    const targetBinary = (initialFunc && initialFunc.binary) || binaryPath;

    const defaultWidth = 850;
    const defaultHeight = 650;
    const projectWinCount = Object.values(openWindows).filter(w => w.binary === targetBinary).length;
    const offsetStep = (projectWinCount % 6) * 30;
    const defaultLeft = Math.max(20, Math.min(window.innerWidth - defaultWidth - 20, 200 + offsetStep));
    const defaultTop = Math.max(60, Math.min(window.innerHeight - defaultHeight - 20, 80 + offsetStep));

    const left = customGeom && customGeom.left !== undefined ? customGeom.left : `${defaultLeft}px`;
    const top = customGeom && customGeom.top !== undefined ? customGeom.top : `${defaultTop}px`;
    const width = customGeom && customGeom.width !== undefined ? customGeom.width : `${defaultWidth}px`;
    const height = customGeom && customGeom.height !== undefined ? customGeom.height : `${defaultHeight}px`;

    const modalEl = document.createElement('div');
    modalEl.className = 'modal window-visible';
    modalEl.id = winId;
    modalEl.style.left = left;
    modalEl.style.top = top;
    modalEl.style.width = width;
    modalEl.style.height = height;

    modalEl.onmousedown = () => bringWindowToFront(winId);

    modalEl.innerHTML = `
        <div class="modal-header" id="${winId}_header">
            <div class="modal-title-wrap" id="${winId}_titleWrap" title="Right-click for options (Focus on Middle, Minimize)">
                <span class="modal-title" id="${winId}_title">Function View</span>
            </div>
            <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
                <div id="${winId}_editorControls" style="display:none; gap: 4px; align-items: center;">
                    <button onclick="restoreOriginalDecomp('${winId}')" style="padding: 2px 6px; font-size: 0.8em; background:#333; color:#aaa; height:24px;" title="Restore original Ghidra C/C++ output">Restore</button>
                    <span style="border-left: 1px solid #000; height: 16px; margin: 0 1px;"></span>
                    <button onclick="changeWindowFontSize('${winId}', -1)" style="padding: 2px 6px; font-size: 0.8em; height:24px;" title="Zoom Out">A-</button>
                    <button onclick="changeWindowFontSize('${winId}', 1)" style="padding: 2px 6px; font-size: 0.8em; height:24px;" title="Zoom In">A+</button>
                    <span style="border-left: 1px solid #000; height: 16px; margin: 0 1px;"></span>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button id="${winId}_btnAsm" class="tab-btn active" onclick="switchWindowView('${winId}', 'asm')" style="padding: 2px 6px; font-size: 0.8em; height:24px;">ASM</button>
                    <button id="${winId}_btnDecomp" class="tab-btn" onclick="switchWindowView('${winId}', 'decomp')" style="padding: 2px 6px; font-size: 0.8em; height:24px;">Decompile...</button>
                </div>
                <button class="win-ctrl-btn" onclick="minimizeWindow('${winId}')" title="Minimize Window">_</button>
                <button class="win-ctrl-btn" onclick="toggleMaximizeWindow('${winId}')" title="Maximize / Restore Window">□</button>
                <button class="win-ctrl-btn win-close-btn" onclick="closeWindow('${winId}')" title="Close Window">✕</button>
            </div>
        </div>
        <div class="modal-tabs-container" id="${winId}_tabsContainer"></div>
        <div id="${winId}_modalContent" class="modal-body"></div>
        <div id="${winId}_modalEditor" class="modal-editor"></div>
    `;

    container.appendChild(modalEl);

    const winObj = {
        id: winId,
        binary: targetBinary, // Permanently binds window to its specific binary workspace!
        el: modalEl,
        tabs: [],
        activeTabId: null,
        currentView: 'asm',
        fontSize: 14,
        aceEditor: null,
        modalScroller: null,
        isMaximized: false,
        isMinimized: false
    };

    openWindows[winId] = winObj;
    attachWindowDragListeners(winId);
    bringWindowToFront(winId);

    if (initialFunc) {
        addTabToWindow(winId, initialFunc);
    }

    updateProjectWindowsVisibility();
    return winObj;
}

function attachWindowDragListeners(winId) {
    const winObj = openWindows[winId];
    if (!winObj) return;
    const header = document.getElementById(`${winId}_header`);
    let isDown = false, offset = [0, 0];

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.win-ctrl-btn')) return;
        isDown = true;
        bringWindowToFront(winId);
        offset = [ winObj.el.offsetLeft - e.clientX, winObj.el.offsetTop - e.clientY ];
    });

    document.addEventListener('mouseup', () => isDown = false);
    document.addEventListener('mousemove', (e) => {
        if (isDown && !winObj.isMaximized) {
            e.preventDefault();
            const newLeft = Math.max(-winObj.el.offsetWidth + 100, Math.min(window.innerWidth - 50, e.clientX + offset[0]));
            const newTop = Math.max(0, Math.min(window.innerHeight - 50, e.clientY + offset[1]));
            winObj.el.style.left = newLeft + 'px';
            winObj.el.style.top  = newTop + 'px';
        }
    });

    header.addEventListener('contextmenu', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        e.preventDefault();
        e.stopPropagation();
        showWindowHeaderContextMenu(e, winId);
    });
}

function showWindowHeaderContextMenu(e, winId) {
    const menu = document.getElementById('windowHeaderContextMenu');
    menu.innerHTML = `
        <div class="context-menu-item" onclick="centerWindow('${winId}'); hideWindowHeaderContextMenu();">🎯 Focus on Middle (Center Window)</div>
        <div class="context-menu-item" onclick="minimizeWindow('${winId}'); hideWindowHeaderContextMenu();">_ Minimize Window</div>
        <div class="context-menu-item" onclick="toggleMaximizeWindow('${winId}'); hideWindowHeaderContextMenu();">□ Toggle Maximize</div>
        <div class="context-menu-item" onclick="closeWindow('${winId}'); hideWindowHeaderContextMenu();" style="color:#ff6666;">✕ Close Window</div>
    `;
    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    menu.style.display = 'block';
}

function hideWindowHeaderContextMenu() {
    const menu = document.getElementById('windowHeaderContextMenu');
    if (menu) menu.style.display = 'none';
}

function showTabContextMenu(e, winId, tabFunc) {
    const cleanId = getCleanId(tabFunc.addr);
    const menu = document.getElementById('tabContextMenu');
    menu.innerHTML = `
        <div class="context-menu-item" onclick="detachTabToNewWindow('${winId}', '${cleanId}'); hideTabContextMenu();">🗔 Pop into New Window</div>
        <div class="context-menu-item" onclick="closeWindowTab(null, '${winId}', '${cleanId}'); hideTabContextMenu();">✕ Close Tab</div>
        <div class="context-menu-item" onclick="closeOtherWindowTabs('${winId}', '${cleanId}'); hideTabContextMenu();">✕ Close Other Tabs</div>
    `;
    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    menu.style.display = 'block';
}

function hideTabContextMenu() {
    const menu = document.getElementById('tabContextMenu');
    if (menu) menu.style.display = 'none';
}

function detachTabToNewWindow(sourceWinId, cleanId) {
    const srcWin = openWindows[sourceWinId];
    if (!srcWin) return;
    const tabFunc = srcWin.tabs.find(f => getCleanId(f.addr) === cleanId);
    if (!tabFunc) return;
    
    const activeViewToTransfer = srcWin.currentView;

    closeWindowTab(null, sourceWinId, cleanId);
    const newWin = createNewWindow(tabFunc);
    
    switchWindowView(newWin.id, activeViewToTransfer);
    bringWindowToFront(newWin.id);
}

function closeOtherWindowTabs(winId, keepCleanId) {
    const win = openWindows[winId];
    if (!win) return;
    win.tabs = win.tabs.filter(f => getCleanId(f.addr) === keepCleanId);
    win.activeTabId = keepCleanId;
    renderWindowTabs(winId);
    switchWindowView(winId, win.currentView);
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#windowHeaderContextMenu')) {
        hideWindowHeaderContextMenu();
    }
    if (!e.target.closest('#tabContextMenu')) {
        hideTabContextMenu();
    }
});

function centerWindow(winId) {
    const win = openWindows[winId];
    if (!win) return;
    const width = win.el.offsetWidth || 850;
    const height = win.el.offsetHeight || 650;
    const left = Math.max(10, (window.innerWidth - width) / 2);
    const top = Math.max(60, (window.innerHeight - height) / 2);
    win.el.style.left = `${left}px`;
    win.el.style.top = `${top}px`;
    win.el.classList.remove('maximized');
    win.isMaximized = false;
    win.isMinimized = false;
    win.el.classList.remove('minimized');
    win.el.classList.add('window-visible');
    bringWindowToFront(winId);
}

function toggleMaximizeWindow(winId) {
    const win = openWindows[winId];
    if (!win) return;
    win.isMaximized = !win.isMaximized;
    win.el.classList.toggle('maximized', win.isMaximized);
    bringWindowToFront(winId);
}

function minimizeWindow(winId) {
    const win = openWindows[winId];
    if (!win) return;
    win.isMinimized = true;
    win.el.classList.add('minimized');
    win.el.classList.remove('window-visible');
    win.el.style.display = 'none';
    if (typeof updateTaskbarUI === 'function') updateTaskbarUI();
}

function restoreWindow(winId) {
    const win = openWindows[winId];
    if (!win) return;
    win.isMinimized = false;
    win.el.classList.remove('minimized');
    win.el.classList.add('window-visible');
    win.el.style.display = 'flex';
    bringWindowToFront(winId);
}

function closeWindow(winId) {
    const win = openWindows[winId];
    if (!win) return;
    win.el.remove();
    delete openWindows[winId];
    
    const remainingCurrent = Object.values(openWindows).filter(w => w.binary === binaryPath);
    if (activeWindowId === winId) {
        activeWindowId = remainingCurrent.length > 0 ? remainingCurrent[remainingCurrent.length - 1].id : null;
    }
    if (typeof updateTaskbarUI === 'function') updateTaskbarUI();
}

function closeAllProjectWindows() {
    const container = document.getElementById('windowManagerContainer');
    if (container) {
        container.innerHTML = '';
    }
    openWindows = {};
    activeWindowId = null;
    if (typeof updateTaskbarUI === 'function') updateTaskbarUI();
}

function updateTaskbarUI() {
    const taskbar = document.getElementById('windowTaskbar');
    if (!taskbar) return;
    taskbar.innerHTML = '';

    // ONLY SHOW TASKBAR BUTTONS BELONGING TO ACTIVE BINARY!
    Object.keys(openWindows).forEach(winId => {
        const win = openWindows[winId];
        if (win.binary !== binaryPath) return;

        const activeTab = win.tabs.find(f => getCleanId(f.addr) === win.activeTabId) || win.tabs[0];
        const title = activeTab ? activeTab.name : 'Function Window';
        const isFocused = (activeWindowId === winId) && !win.isMinimized;

        const item = document.createElement('div');
        item.className = `taskbar-item ${isFocused ? 'active' : ''} ${win.isMinimized ? 'minimized' : ''}`;
        item.title = `Window: ${title}\nClick to focus / restore\nRight-click for options`;
        item.innerHTML = `<span class="taskbar-name">🗔 ${escapeHTML(title)}</span>`;

        item.onclick = () => {
            if (win.isMinimized) {
                restoreWindow(winId);
            } else if (activeWindowId === winId) {
                minimizeWindow(winId);
            } else {
                bringWindowToFront(winId);
            }
        };

        item.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showWindowHeaderContextMenu(e, winId);
        };

        taskbar.appendChild(item);
    });
}

function addTabToWindow(winId, func) {
    const win = openWindows[winId];
    if (!win) return;
    const cleanId = getCleanId(func.addr);
    if (!win.tabs.find(f => getCleanId(f.addr) === cleanId)) {
        win.tabs.push(func);
    }
    win.activeTabId = cleanId;
    renderWindowTabs(winId);
    switchWindowView(winId, win.currentView);
    bringWindowToFront(winId);
}

function renderWindowTabs(winId) {
    const win = openWindows[winId];
    if (!win) return;
    const container = document.getElementById(`${winId}_tabsContainer`);
    container.innerHTML = '';

    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
        if (e.target !== container) return;
        e.preventDefault();
        const dataStr = e.dataTransfer.getData('text/plain');
        if (!dataStr) return;
        try {
            const data = JSON.parse(dataStr);
            if (data.winId !== winId) {
                const srcWin = openWindows[data.winId];
                if (srcWin) {
                    const fromIdx = srcWin.tabs.findIndex(f => getCleanId(f.addr) === data.cleanId);
                    if (fromIdx !== -1) {
                        const [moved] = srcWin.tabs.splice(fromIdx, 1);
                        if (srcWin.tabs.length === 0) closeWindow(data.winId);
                        else {
                            if (srcWin.activeTabId === data.cleanId) {
                                srcWin.activeTabId = getCleanId(srcWin.tabs[srcWin.tabs.length - 1].addr);
                                switchWindowView(data.winId, srcWin.currentView);
                            }
                            renderWindowTabs(data.winId);
                        }
                        win.tabs.push(moved);
                        win.activeTabId = getCleanId(moved.addr);
                        renderWindowTabs(winId);
                        switchWindowView(winId, win.currentView);
                    }
                }
            }
        } catch(err) {}
    });

    win.tabs.forEach((tabFunc, index) => {
        const cleanId = getCleanId(tabFunc.addr);
        const isActive = win.activeTabId === cleanId;
        const isCombined = cleanId === 'COMBINED';

        const tabEl = document.createElement('div');
        tabEl.className = `modal-tab ${isActive ? 'active' : ''} ${isCombined ? 'golden-tab' : ''}`;
        tabEl.draggable = true;
        tabEl.title = `${tabFunc.name} (${tabFunc.addr})\nRight-click for options`;

        tabEl.innerHTML = `
            <span class="modal-tab-name">${isCombined ? '🌟 ' : ''}${escapeHTML(tabFunc.name)}</span>
            <span class="modal-tab-close" onclick="closeWindowTab(event, '${winId}', '${cleanId}')" title="Close Tab">×</span>
        `;

        tabEl.onclick = () => {
            win.activeTabId = cleanId;
            renderWindowTabs(winId);
            switchWindowView(winId, win.currentView);
        };

        tabEl.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTabContextMenu(e, winId, tabFunc);
        };

        tabEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ winId: winId, cleanId: cleanId }));
            tabEl.style.opacity = '0.5';
        });
        tabEl.addEventListener('dragend', () => {
            tabEl.style.opacity = '1';
            document.querySelectorAll('.modal-tab').forEach(el => el.classList.remove('drag-over'));
        });
        tabEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            tabEl.classList.add('drag-over');
        });
        tabEl.addEventListener('dragleave', () => tabEl.classList.remove('drag-over'));
        
        tabEl.addEventListener('drop', (e) => {
            e.preventDefault();
            tabEl.classList.remove('drag-over');
            const dataStr = e.dataTransfer.getData('text/plain');
            if (!dataStr) return;
            try {
                const data = JSON.parse(dataStr);
                const draggedWinId = data.winId;
                const draggedId = data.cleanId;
                const targetId = cleanId;

                if (draggedWinId === winId) {
                    if (draggedId !== targetId) {
                        const fromIdx = win.tabs.findIndex(f => getCleanId(f.addr) === draggedId);
                        const toIdx = win.tabs.findIndex(f => getCleanId(f.addr) === targetId);
                        if (fromIdx !== -1 && toIdx !== -1) {
                            const [moved] = win.tabs.splice(fromIdx, 1);
                            win.tabs.splice(toIdx, 0, moved);
                            renderWindowTabs(winId);
                        }
                    }
                } else {
                    const srcWin = openWindows[draggedWinId];
                    if (srcWin) {
                        const fromIdx = srcWin.tabs.findIndex(f => getCleanId(f.addr) === draggedId);
                        if (fromIdx !== -1) {
                            const [moved] = srcWin.tabs.splice(fromIdx, 1);
                            if (srcWin.tabs.length === 0) {
                                closeWindow(draggedWinId);
                            } else {
                                if (srcWin.activeTabId === draggedId) {
                                    srcWin.activeTabId = getCleanId(srcWin.tabs[srcWin.tabs.length - 1].addr);
                                    switchWindowView(draggedWinId, srcWin.currentView);
                                }
                                renderWindowTabs(draggedWinId);
                            }
                            
                            const toIdx = win.tabs.findIndex(f => getCleanId(f.addr) === targetId);
                            win.tabs.splice(toIdx, 0, moved);
                            win.activeTabId = getCleanId(moved.addr);
                            renderWindowTabs(winId);
                            switchWindowView(winId, win.currentView);
                        }
                    }
                }
            } catch (err) {}
        });

        container.appendChild(tabEl);
    });

    if (typeof updateTaskbarUI === 'function') updateTaskbarUI();
}

function closeWindowTab(event, winId, cleanId) {
    if (event) event.stopPropagation();
    const win = openWindows[winId];
    if (!win) return;

    win.tabs = win.tabs.filter(f => getCleanId(f.addr) !== cleanId);
    if (win.tabs.length === 0) {
        closeWindow(winId);
    } else {
        if (win.activeTabId === cleanId) {
            const nextTab = win.tabs[win.tabs.length - 1];
            win.activeTabId = getCleanId(nextTab.addr);
            renderWindowTabs(winId);
            switchWindowView(winId, win.currentView);
        } else {
            renderWindowTabs(winId);
        }
    }
}

function openFuncWindow(func, forceNewWindow = false) {
    if (!func) return;
    const targetBinary = func.binary || binaryPath;
    
    // Select windows that strictly belong to THIS active binary workspace
    const projectWinIds = Object.keys(openWindows).filter(id => openWindows[id].binary === targetBinary);

    if (forceNewWindow || projectWinIds.length === 0) {
        createNewWindow(func);
    } else {
        const targetWinId = (activeWindowId && openWindows[activeWindowId] && openWindows[activeWindowId].binary === targetBinary)
            ? activeWindowId
            : projectWinIds[projectWinIds.length - 1];
        addTabToWindow(targetWinId, func);
    }
}

function initAceEditorForWindow(winId) {
    const win = openWindows[winId];
    if (!win) return;
    const editorElId = `${winId}_modalEditor`;

    if (!win.aceEditor) {
        win.aceEditor = ace.edit(editorElId);
        win.aceEditor.setTheme("ace/theme/vibrant_ink");
        win.aceEditor.setOptions({
            fontSize: `${win.fontSize || 14}px`,
            fontFamily: "'Fira Code', 'Courier New', monospace",
            showPrintMargin: false,
            wrap: true,
            tabSize: 4,
            highlightActiveLine: true
        });

        win.aceEditor.on("change", function() {
            if (win.currentView === 'decomp' && win.activeTabId) {
                const currentTabFunc = win.tabs.find(f => getCleanId(f.addr) === win.activeTabId);
                const targetBinary = (currentTabFunc || {}).binary || binaryPath;
                const cacheKey = targetBinary + '|||' + win.activeTabId;
                userEditedDecompCache[cacheKey] = win.aceEditor.getValue();
            }
        });

        win.aceEditor.on("dblclick", function() {
            const pos = win.aceEditor.getCursorPosition();
            const token = win.aceEditor.session.getTokenAt(pos.row, pos.column);
            if (token && token.value) {
                const tokenWord = token.value.trim();
                const targetFunc = globalFunctions.find(f => f.name === tokenWord);
                if (targetFunc) {
                    addTabToWindow(winId, targetFunc);
                }
            }
        });
    }
}

function changeWindowFontSize(winId, delta) {
    const win = openWindows[winId];
    if (!win) return;
    win.fontSize = Math.max(10, Math.min(30, (win.fontSize || 14) + delta));
    if (win.aceEditor) win.aceEditor.setFontSize(`${win.fontSize}px`);
}

function restoreOriginalDecomp(winId) {
    const win = openWindows[winId];
    if (!win || !win.activeTabId) return;
    const currentTabFunc = win.tabs.find(f => getCleanId(f.addr) === win.activeTabId);
    const targetBinary = (currentTabFunc || {}).binary || binaryPath;
    const cacheKey = targetBinary + '|||' + win.activeTabId;

    if (originalDecompCache[cacheKey]) {
        delete userEditedDecompCache[cacheKey];
        if (aceSessions[cacheKey]) {
            aceSessions[cacheKey].setValue(originalDecompCache[cacheKey]);
        }
    }
}

async function loadWindowAsm(winId) {
    const win = openWindows[winId];
    if (!win) return;
    const currentTabFunc = win.tabs.find(f => getCleanId(f.addr) === win.activeTabId);
    if (!currentTabFunc) return;

    const cleanAddr = win.activeTabId;
    const targetBinary = currentTabFunc.binary || binaryPath;
    const cacheKey = targetBinary + '|||' + cleanAddr;
    const dispAddr = cleanAddr === 'COMBINED' ? '🌟' : currentTabFunc.addr;

    const titleEl = document.getElementById(`${winId}_title`);
    titleEl.innerText = `Viewing: ${currentTabFunc.name} (${dispAddr}) [${targetBinary.split('/').pop()}]`;
    titleEl.title = `${currentTabFunc.name} (${dispAddr}) in ${targetBinary}`;

    document.getElementById(`${winId}_editorControls`).style.display = 'none';
    document.getElementById(`${winId}_modalContent`).style.display = 'block';
    document.getElementById(`${winId}_modalEditor`).style.display = 'none';

    const content = document.getElementById(`${winId}_modalContent`);

    if (modalAsmCache[cacheKey]) {
        win.modalScroller = new VirtualScroller(`${winId}_modalContent`, modalAsmCache[cacheKey], 'disasm');
        return;
    }

    if (cleanAddr === 'COMBINED') {
        content.innerHTML = '<div style="padding:10px; color: #ffd700;">Cannot disassemble combined C/C++ output. Switch to Decompile view.</div>';
        return;
    }

    content.innerHTML = '<div style="padding:10px;">Disassembling function...</div>';
    
    const optArch = document.getElementById('opt-arch') ? document.getElementById('opt-arch').value : 'x86-64';
    const optSections = document.getElementById('opt-sections') ? document.getElementById('opt-sections').value : 'all';
    const optSyntax = document.getElementById('opt-syntax') ? document.getElementById('opt-syntax').value : 'intel';
    const optRaw = document.getElementById('opt-raw') ? document.getElementById('opt-raw').checked : false;
    const optRawBin = document.getElementById('opt-raw-bin') ? document.getElementById('opt-raw-bin').checked : false;

    const options = {
        arch: optArch,
        sections: optSections,
        syntax: optSyntax,
        raw: optRaw,
        raw_bin: optRawBin
    };

    try {
        const res = await fetch(`${API}/function_code`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ binary_path: targetBinary, start_addr: currentTabFunc.addr, options: options }) 
        });
        const data = await res.json();
        modalAsmCache[cacheKey] = data.output || "Could not extract function assembly.";
        win.modalScroller = new VirtualScroller(`${winId}_modalContent`, modalAsmCache[cacheKey], 'disasm');
    } catch(err) {
        content.innerHTML = `<div style="padding:10px; color: #ff3333;">Network Error trying to disassemble.</div>`;
    }
}

async function loadWindowDecomp(winId) {
    const win = openWindows[winId];
    if (!win) return;
    const currentTabFunc = win.tabs.find(f => getCleanId(f.addr) === win.activeTabId);
    if (!currentTabFunc) return;

    const cleanAddr = win.activeTabId;
    const targetBinary = currentTabFunc.binary || binaryPath;
    const cacheKey = targetBinary + '|||' + cleanAddr;
    const dispAddr = cleanAddr === 'COMBINED' ? '🌟' : currentTabFunc.addr;

    const titleEl = document.getElementById(`${winId}_title`);
    titleEl.innerText = `Viewing: ${currentTabFunc.name} (${dispAddr}) [${targetBinary.split('/').pop()}]`;
    titleEl.title = `${currentTabFunc.name} (${dispAddr}) in ${targetBinary}`;

    document.getElementById(`${winId}_editorControls`).style.display = 'flex';
    document.getElementById(`${winId}_modalContent`).style.display = 'none';
    document.getElementById(`${winId}_modalEditor`).style.display = 'block';
    
    initAceEditorForWindow(winId);

    let textToLoad = "";

    if (cleanAddr === 'COMBINED') {
        textToLoad = `// =========================================\n// COMBINED DECOMPILATION: ${targetBinary.split('/').pop()}\n// =========================================\n\n`;
        
        let combinedMap = new Map();
        let hasMain = false;
        
        Object.keys(originalDecompCache).forEach(k => {
            if (k.startsWith(targetBinary + '|||') && !k.endsWith('|||COMBINED')) {
                const addrClean = k.split('|||')[1];
                const gFunc = globalFunctions.find(gf => getCleanId(gf.addr) === addrClean);
                const code = originalDecompCache[k];
                
                if (code.includes('WARNING: Control flow encountered bad instruction data')) return;
                if (code.replace(/\s/g, '').length < 30) return;
                
                const fName = gFunc ? gFunc.name : "unknown_function";
                if (fName === 'main') hasMain = true;
                
                combinedMap.set(addrClean, { addr: "0x" + addrClean, name: fName, code: code });
            }
        });

        let filteredFuncs = Array.from(combinedMap.values()).filter(f => {
            if (['main', '_start', 'frame_dummy'].includes(f.name) || f.name.includes('register_tm_clones')) return true;
            if (f.name.startsWith('_')) return false; 
            return true;
        });

        if (hasMain) {
            filteredFuncs = filteredFuncs.filter(f => f.name !== '_start');
        }

        let uniqueNames = new Set();
        let finalFuncs = [];
        for (let f of filteredFuncs) {
            if (uniqueNames.has(f.name)) continue;
            uniqueNames.add(f.name);
            finalFuncs.push(f);
        }

        finalFuncs.sort((a, b) => {
            const aIsEntry = (a.name === 'main' || (!hasMain && a.name === '_start'));
            const bIsEntry = (b.name === 'main' || (!hasMain && b.name === '_start'));
            if (aIsEntry && !bIsEntry) return 1;
            if (!aIsEntry && bIsEntry) return -1;
            if (aIsEntry && bIsEntry) {
                if (a.name === 'main') return 1;
                if (b.name === 'main') return -1;
            }
            return parseInt(a.addr) - parseInt(b.addr);
        });

        if (finalFuncs.length === 0) {
            textToLoad += "// No valid user functions found. Please click '⚡ Decompile All' first.";
        } else {
            finalFuncs.forEach(f => {
                textToLoad += `/* --- ${f.name} (${f.addr}) --- */\n`;
                textToLoad += f.code + "\n\n";
            });
        }

        if (!aceSessions[cacheKey]) {
            aceSessions[cacheKey] = new ace.EditSession(textToLoad, "ace/mode/c_cpp");
            aceSessions[cacheKey].setUndoManager(new ace.UndoManager());
        } else {
            aceSessions[cacheKey].setValue(textToLoad);
        }
        win.aceEditor.setSession(aceSessions[cacheKey]);
        return; 
    }

    if (userEditedDecompCache[cacheKey]) {
        textToLoad = userEditedDecompCache[cacheKey];
    } else if (originalDecompCache[cacheKey]) {
        textToLoad = originalDecompCache[cacheKey];
    } else {
        textToLoad = "// Decompiling with Ghidra, please wait...";
    }

    if (!aceSessions[cacheKey]) {
        aceSessions[cacheKey] = new ace.EditSession(textToLoad, "ace/mode/c_cpp");
        aceSessions[cacheKey].setUndoManager(new ace.UndoManager());
    } else {
        if (textToLoad !== "// Decompiling with Ghidra, please wait..." && aceSessions[cacheKey].getValue().includes("Decompiling with Ghidra, please wait...")) {
            aceSessions[cacheKey].setValue(textToLoad);
        }
    }

    win.aceEditor.setSession(aceSessions[cacheKey]);

    if (!userEditedDecompCache[cacheKey] && !originalDecompCache[cacheKey] && cleanAddr !== 'COMBINED') {
        try {
            const res = await fetch(`${API}/decompile`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ binary_path: targetBinary, addr: currentTabFunc.addr, name: currentTabFunc.name, file_hash: currentFileHash })
            });
            const data = await res.json();
            const output = data.output || "// Decompilation output empty.";
            originalDecompCache[cacheKey] = output;
            aceSessions[cacheKey].setValue(output);

            const el = document.getElementById(`func-item-${cleanAddr}`);
            if (el) {
                el.classList.add('cached');
                const badge = el.querySelector('.c-badge');
                if (badge) badge.style.display = 'inline-block';
            }

            const langStr = isCpp ? "C++" : "C";
            document.getElementById(`${winId}_btnDecomp`).innerText = `Decompiled (${langStr})`;
        } catch(err) {
            aceSessions[cacheKey].setValue("// Network error during decompilation.");
        }
    }
}

async function switchWindowView(winId, view) {
    const win = openWindows[winId];
    if (!win) return;
    win.currentView = view;

    const cleanAddr = win.activeTabId;
    const currentTabFunc = win.tabs.find(f => getCleanId(f.addr) === cleanAddr);
    const targetBinary = (currentTabFunc || {}).binary || binaryPath;
    const cacheKey = targetBinary + '|||' + cleanAddr;

    const isDecompiled = !!originalDecompCache[cacheKey] && cleanAddr !== 'COMBINED';
    const langStr = isCpp ? "C++" : "C";
    document.getElementById(`${winId}_btnDecomp`).innerText = isDecompiled ? `Decompiled (${langStr})` : `Decompile (${langStr})`;

    if (view === 'asm') {
        document.getElementById(`${winId}_btnAsm`).classList.add('active');
        document.getElementById(`${winId}_btnDecomp`).classList.remove('active');
        await loadWindowAsm(winId);
    } else {
        document.getElementById(`${winId}_btnAsm`).classList.remove('active');
        document.getElementById(`${winId}_btnDecomp`).classList.add('active');
        await loadWindowDecomp(winId);
        if (win.aceEditor) win.aceEditor.focus();
    }
}
