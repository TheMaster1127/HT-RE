function showPatchUI() { updateTabs('patch'); }
function showAsmUI() { updateTabs('asm'); }

function switchBpTab(tab) {
    document.querySelectorAll('.bp-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bp-panel').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('bp-' + tab).classList.add('active');
    if (tab === 'history') loadPatchHistory();
}

function toggleBpTarget() {
    const bpType = document.querySelector('input[name="bp-r-type"]:checked').value;
    document.getElementById('bp-r-target-box').style.display = (bpType === 'manual') ? 'block' : 'none';
}

function strToHex() {
    const txt = prompt("Enter text to convert to Hex:");
    if (txt) {
        const hex = txt.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        document.getElementById('bp-f-hex').value = hex;
    }
}

async function runBinpatch(mode) {
    if(!binaryPath) return alert("Please load a binary first.");
    let payload = { binary_path: binaryPath, mode: mode };
    
    if(mode === 'write') {
        payload.offset = document.getElementById('bp-w-offset').value;
        payload.hex = document.getElementById('bp-w-hex').value;
        payload.backup = document.getElementById('bp-w-backup').checked;
        payload.is_va = document.getElementById('bp-w-isva').checked;
        if(!payload.offset || !payload.hex) return alert("Offset and Hex are required for patching.");
    } 
    else if(mode === 'find') {
        payload.hex = document.getElementById('bp-f-hex').value;
        payload.heuristic = document.querySelector('input[name="bp-f-type"]:checked').value === 'heuristic';
        payload.size = document.getElementById('bp-f-size').value;
        payload.all = document.getElementById('bp-f-all').checked;
        if(!payload.hex) return alert("Hex pattern required for searching.");
    }
    else if(mode === 'resolve') {
        let rType = document.querySelector('input[name="bp-r-type"]:checked').value;
        if(rType === 'main') payload.target = '-m';
        else if(rType === 'entry') payload.target = '-e';
        else {
            payload.target = document.getElementById('bp-r-target').value;
            payload.is_va = document.getElementById('bp-r-isva').checked;
            if (!payload.target) return alert("Please specify a target Offset/VAddr.");
        }
        payload.size = document.getElementById('bp-r-size').value;
        payload.until_ret = document.getElementById('bp-r-return').checked;
    }

    document.getElementById('bp-output').innerText = "Running binpatch...";
    trackAction("BINPATCH", { mode: mode, payload: payload });
    
    const res = await fetch(`${API}/binpatch`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    document.getElementById('bp-output').innerText = data.output || data.error;
}

async function convertAsmToHex() {
    const asm = document.getElementById('asm-input').value;
    const arch = document.getElementById('asm-arch').value;
    if (!asm) return alert("Please enter assembly code.");
    document.getElementById('asm-output').innerText = "Assembling...";
    trackAction("ASM_TO_HEX", { arch: arch });

    const res = await fetch(`${API}/assemble`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asm: asm, arch: arch })
    });
    const data = await res.json();
    if (data.error) {
        document.getElementById('asm-output').innerText = data.error;
    } else {
        document.getElementById('asm-hex').value = data.hex;
        document.getElementById('asm-output').innerText = data.output;
    }
}

async function convertHexToAsm() {
    const hex = document.getElementById('asm-hex').value;
    const arch = document.getElementById('asm-arch').value;
    if (!hex) return alert("Please enter hex bytes.");
    document.getElementById('asm-output').innerText = "Disassembling...";
    trackAction("HEX_TO_ASM", { arch: arch });

    const res = await fetch(`${API}/disassemble_raw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hex: hex, arch: arch })
    });
    const data = await res.json();
    if (data.error) {
        document.getElementById('asm-output').innerText = data.error;
    } else {
        document.getElementById('asm-input').value = data.asm;
        document.getElementById('asm-output').innerText = data.output;
    }
}

/* -------------------------------------
   IDE & CODE EDITOR (PERSISTENT ENGINE)
----------------------------------------*/
let ideEditor = null;
let ideTypingTimer = null;

const cDefault = `#include <stdio.h>\n\nint main() {\n    printf("Hello World!\\n");\n    return 0;\n}`;
const cppDefault = `#include <iostream>\n\nint main() {\n    std::cout << "Hello World!" << std::endl;\n    return 0;\n}`;
const nasmDefault = `section .data\n    msg db "Hello World!", 10\n    msg_len equ $ - msg\n\nsection .text\n    global _start\n_start:\n    mov rax, 1\n    mov rdi, 1\n    mov rsi, msg\n    mov rdx, msg_len\n    syscall\n    mov rax, 60\n    xor rdi, rdi\n    syscall`;
const fasmDefault = `format ELF64 executable 3\nsegment readable executable\nentry _start\n_start:\n    mov rax, 1\n    mov rdi, 1\n    mov rsi, msg\n    mov rdx, msg_len\n    syscall\n    mov rax, 60\n    xor rdi, rdi\n    syscall\n\nsegment readable writeable\n    msg db 'Hello World!', 10\n    msg_len = $ - msg`;
const gasDefault = `.data\nmsg:\n    .ascii "Hello World!\\n"\n    msg_len = . - msg\n\n.text\n.global _start\n_start:\n    mov $1, %rax\n    mov $1, %rdi\n    lea msg, %rsi\n    mov $msg_len, %rdx\n    syscall\n    mov $60, %rax\n    xor %rdi, %rdi\n    syscall`;
const armGasDefault = `.data\nmsg:\n    .ascii "Hello World!\\n"\n    msg_len = . - msg\n\n.text\n.global _start\n_start:\n    mov r0, #1\n    ldr r1, =msg\n    ldr r2, =msg_len\n    mov r7, #4\n    swi 0\n    mov r0, #0\n    mov r7, #1\n    swi 0`;
const otherDefault = `// Custom Code / Script / Toolchain Input\n\n`;

// Load files and selection from persistent storage
let ideFiles = JSON.parse(localStorage.getItem('htre_ide_files') || 'null') || [ { name: "main.c", lang: "c", compiler: "gcc", content: cDefault } ];
let activeIdeFile = parseInt(localStorage.getItem('htre_active_ide_file') || '0', 10);
if (isNaN(activeIdeFile) || activeIdeFile < 0 || activeIdeFile >= ideFiles.length) {
    activeIdeFile = 0;
}

function saveIdeFilesState() {
    localStorage.setItem('htre_ide_files', JSON.stringify(ideFiles));
    localStorage.setItem('htre_active_ide_file', activeIdeFile.toString());
}

function saveCompiledBinariesState() {
    localStorage.setItem('htre_compiled_binaries', JSON.stringify(compiledBinariesList));
}

function initIdeEditor() {
    if (!ideEditor) {
        ideEditor = ace.edit("ide-editor");
        ideEditor.setTheme("ace/theme/vibrant_ink");
        ideEditor.session.setMode("ace/mode/c_cpp");
        
        ideEditor.on("change", () => {
            if(ideFiles[activeIdeFile]) {
                ideFiles[activeIdeFile].content = ideEditor.getValue();
                saveIdeFilesState();
            }
            clearTimeout(ideTypingTimer);
            ideTypingTimer = setTimeout(() => {
                trackAction("IDE_TYPING", { file: ideFiles[activeIdeFile].name, length: ideEditor.getValue().length });
            }, 2000);
        });
        
        ideEditor.on("copy", (text) => { trackAction("IDE_COPY", { text: text, length: text.length }); });
        ideEditor.on("paste", (text) => { trackAction("IDE_PASTE", { text: text, length: text.length }); });
    }
    populateCompilersDropdown();
    renderIdeFileManager();
    renderCompiledBinaries();
    
    switchIdeFile(activeIdeFile);
}

function renderIdeFileManager() {
    const list = document.getElementById('ide-file-list');
    if (!list) return;
    list.innerHTML = '';
    ideFiles.forEach((f, idx) => {
        const item = document.createElement('div');
        item.className = 'ide-file-item' + (idx === activeIdeFile ? ' active' : '');
        item.innerHTML = `<span style="flex:1;" ondblclick="renameIdeFile(${idx})">📄 ${escapeHTML(f.name)}</span> 
                          <span class="ide-tab-close" onclick="closeIdeFile(${idx}, event)">×</span>`;
        item.onclick = () => switchIdeFile(idx);
        list.appendChild(item);
    });
}

function createNewIdeFile() {
    const fName = prompt("Enter file name (e.g. exploit.c, shellcode.asm, test.src):", "newfile.c");
    if (!fName) return;
    trackAction("IDE_CREATE_FILE", { name: fName });
    let lang = fName.endsWith('.cpp') ? 'cpp' : (fName.endsWith('.asm') || fName.endsWith('.s') ? 'asm' : (fName.endsWith('.c') ? 'c' : 'other'));
    let comp = lang === 'cpp' ? 'g++' : (lang === 'asm' ? 'nasm' : (lang === 'c' ? 'gcc' : 'custom'));
    let def = lang === 'cpp' ? cppDefault : (lang === 'asm' ? nasmDefault : (lang === 'c' ? cDefault : otherDefault));
    
    ideFiles.push({ name: fName, lang: lang, compiler: comp, content: def });
    activeIdeFile = ideFiles.length - 1;
    saveIdeFilesState();
    switchIdeFile(activeIdeFile);
}

function switchIdeFile(idx) {
    if (idx < 0 || idx >= ideFiles.length) return;
    activeIdeFile = idx;
    saveIdeFilesState();
    
    const f = ideFiles[idx];
    document.getElementById('ide-lang').value = f.lang;
    populateCompilersDropdown();
    document.getElementById('ide-compiler').value = f.compiler;
    
    let aceMode = "ace/mode/c_cpp";
    if (f.lang === 'asm') aceMode = "ace/mode/assembly_x86";
    else if (f.lang === 'other') aceMode = "ace/mode/text";
    
    ideEditor.session.setMode(aceMode);
    ideEditor.setValue(f.content, -1);
    
    const flagsWrapper = document.getElementById('ide-flags-wrapper');
    const simpleFlags = document.getElementById('ide-simple-options');
    
    if (flagsWrapper && simpleFlags) {
        if (f.lang === 'c' || f.lang === 'cpp') {
            flagsWrapper.style.display = 'block';
            simpleFlags.style.display = 'none';
        } else if (f.lang === 'other') {
            flagsWrapper.style.display = 'none';
            simpleFlags.style.display = 'block';
        } else { // asm
            flagsWrapper.style.display = 'none';
            simpleFlags.style.display = 'none';
        }
    }
    
    renderIdeFileManager();
    trackAction("IDE_SWITCH_FILE", { file: f.name });
}

function renameIdeFile(idx) {
    const newName = prompt("Rename file:", ideFiles[idx].name);
    if (newName) { 
        ideFiles[idx].name = newName; 
        saveIdeFilesState();
        renderIdeFileManager(); 
        trackAction("IDE_RENAME_FILE", { new_name: newName });
    }
}

function closeIdeFile(idx, e) {
    e.stopPropagation();
    if (ideFiles.length === 1) return alert("Cannot close the last file.");
    ideFiles.splice(idx, 1);
    if (activeIdeFile >= ideFiles.length) activeIdeFile = ideFiles.length - 1;
    saveIdeFilesState();
    switchIdeFile(activeIdeFile);
}

function populateCompilersDropdown() {
    const select = document.getElementById('ide-compiler');
    if (!select) return;
    const currVal = select.value;
    
    select.innerHTML = `
        <option value="gcc">GCC (C)</option>
        <option value="g++">G++ (C++)</option>
        <option value="clang">Clang (C/C++)</option>
        <option value="nasm">NASM (x86/x64 Asm)</option>
        <option value="fasm">FASM (x86/x64 Asm)</option>
        <option value="gas">GAS / as (x86/x64 Asm)</option>
        <option value="arm-linux-gnueabihf-gcc">ARM32 GCC</option>
        <option value="arm-linux-gnueabihf-as">ARM32 GAS</option>
        <option value="aarch64-linux-gnu-gcc">AArch64 GCC</option>
        <option value="aarch64-linux-gnu-as">AArch64 GAS</option>
    `;
    
    customCompilers.forEach(cc => {
        const opt = document.createElement('option');
        opt.value = cc.name;
        opt.innerText = cc.name + " (Custom)";
        select.appendChild(opt);
    });
    
    const addNewOpt = document.createElement('option');
    addNewOpt.value = "ADD_CUSTOM";
    addNewOpt.innerText = "➕ Add Custom Compiler...";
    select.appendChild(addNewOpt);
    
    if (Array.from(select.options).some(o => o.value === currVal)) {
        select.value = currVal;
    } else {
        select.value = 'gcc';
    }
    
    checkCustomDeleteButton();
}

function checkCompilerSelection() {
    const select = document.getElementById('ide-compiler');
    if (select.value === 'ADD_CUSTOM') {
        document.getElementById('customCompilerModal').style.display = 'block';
        select.value = ideFiles[activeIdeFile].compiler || 'gcc'; 
    } else {
        updateIdeDefaults();
        checkCustomDeleteButton();
    }
}

function checkCustomDeleteButton() {
    const select = document.getElementById('ide-compiler');
    const btn = document.getElementById('btnDeleteCustomCompiler');
    if (!btn) return;
    const isCustom = customCompilers.find(c => c.name === select.value);
    btn.style.display = isCustom ? 'inline-block' : 'none';
}

function deleteActiveCustomCompiler() {
    const select = document.getElementById('ide-compiler');
    const name = select.value;
    if (!confirm(`Are you sure you want to delete custom compiler '${name}'?`)) return;
    
    customCompilers = customCompilers.filter(c => c.name !== name);
    localStorage.setItem('htre_custom_compilers', JSON.stringify(customCompilers));
    
    select.value = 'gcc';
    populateCompilersDropdown();
    updateIdeDefaults();
}

function saveCustomCompiler() {
    const name = document.getElementById('cc-name').value.trim();
    const path = document.getElementById('cc-path').value.trim();
    const cmdPattern = document.getElementById('cc-cmd').value.trim();
    const code = document.getElementById('cc-code').value;
    
    if (!name || !path) return alert("Name and Path are required.");
    if (customCompilers.find(c => c.name === name)) {
        return alert("A custom compiler with that name already exists.");
    }
    
    const cc = { name, path, cmdPattern: cmdPattern || '{compiler} {options} {input} -o {output}', code };
    customCompilers.push(cc);
    localStorage.setItem('htre_custom_compilers', JSON.stringify(customCompilers));
    
    document.getElementById('customCompilerModal').style.display = 'none';
    populateCompilersDropdown();
    
    document.getElementById('ide-compiler').value = name;
    updateIdeDefaults();
    checkCustomDeleteButton();
    trackAction("ADD_CUSTOM_COMPILER", { name, path, cmdPattern });
}

function updateIdeDefaults() {
    const lang = document.getElementById('ide-lang').value;
    const compName = document.getElementById('ide-compiler').value;
    let def = cDefault;
    let mode = "ace/mode/c_cpp";
    
    const flagsWrapper = document.getElementById('ide-flags-wrapper');
    const simpleFlags = document.getElementById('ide-simple-options');

    if (flagsWrapper && simpleFlags) {
        if (lang === 'c' || lang === 'cpp') {
            flagsWrapper.style.display = 'block';
            simpleFlags.style.display = 'none';
        } else if (lang === 'other') {
            flagsWrapper.style.display = 'none';
            simpleFlags.style.display = 'block';
        } else { // asm
            flagsWrapper.style.display = 'none';
            simpleFlags.style.display = 'none';
        }
    }

    if (lang === 'c') { def = cDefault; }
    else if (lang === 'cpp') { def = cppDefault; }
    else if (lang === 'other') { def = otherDefault; mode = "ace/mode/text"; }
    else if (lang === 'asm') {
        mode = "ace/mode/assembly_x86";
        if (compName === 'fasm') def = fasmDefault;
        else if (compName.includes('gas') || compName.includes('as')) def = gasDefault;
        else if (compName.includes('arm')) def = armGasDefault;
        else def = nasmDefault;
    }
    
    const custom = customCompilers.find(c => c.name === compName);
    if (custom && custom.code) {
        def = custom.code;
    }
    
    if(ideFiles[activeIdeFile]) {
        ideFiles[activeIdeFile].lang = lang;
        ideFiles[activeIdeFile].compiler = compName;
        
        const knownDefaults = [cDefault, cppDefault, nasmDefault, fasmDefault, gasDefault, armGasDefault, otherDefault];
        customCompilers.forEach(c => knownDefaults.push(c.code));
        
        if (knownDefaults.includes(ideFiles[activeIdeFile].content) || ideFiles[activeIdeFile].content.trim() === '') {
            ideFiles[activeIdeFile].content = def;
            ideEditor.setValue(def, -1);
        }
        ideEditor.session.setMode(mode);
        saveIdeFilesState();
    }
}

function toggleMoreFlags() {
    const div = document.getElementById('ide-more-flags');
    div.style.display = (div.style.display === 'block') ? 'none' : 'block';
}

function getCompiledFlags() {
    const lang = document.getElementById('ide-lang').value;
    if (lang === 'other') {
        return document.getElementById('ide-custom-flags-text').value.trim();
    }
    const cbs = document.querySelectorAll('.ide-flag-cb:checked');
    let flags = Array.from(cbs).map(cb => cb.value).join(' ');
    const extra = document.getElementById('ide-options-text').value.trim();
    if (extra) flags += ' ' + extra;
    return flags;
}

async function compileCodeOnly() {
    initIdeEditor();
    const code = ideEditor.getValue();
    const lang = document.getElementById('ide-lang').value;
    let compName = document.getElementById('ide-compiler').value;
    
    let execPath = compName;
    let cmdPattern = '';
    const custom = customCompilers.find(c => c.name === compName);
    if (custom) {
        execPath = custom.path;
        cmdPattern = custom.cmdPattern || '';
    }
    
    const options = (lang === 'asm') ? '' : getCompiledFlags(); 

    document.getElementById('ide-output').innerText = "Compiling with " + compName + "...\nFlags: " + options;
    trackAction("COMPILE_CODE_EXEC", { lang, compiler: compName, options });

    const res = await fetch(`${API}/compile`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ code, lang, compiler: execPath, options, cmd_pattern: cmdPattern })
    });
    const data = await res.json();
    
    if (data.error) {
        document.getElementById('ide-output').innerText = data.error;
    } else {
        document.getElementById('ide-output').innerText = data.output;
        const outName = data.path.split('/').pop();
        
        // Push and persist compiled artifact
        compiledBinariesList.unshift({ name: outName, path: data.path, compiler: compName, timestamp: Date.now() });
        if (compiledBinariesList.length > 30) compiledBinariesList = compiledBinariesList.slice(0, 30);
        saveCompiledBinariesState();
        renderCompiledBinaries();
    }
}

function removeCompiledBinary(idx, e) {
    e.stopPropagation();
    compiledBinariesList.splice(idx, 1);
    saveCompiledBinariesState();
    renderCompiledBinaries();
}

function renderCompiledBinaries() {
    const list = document.getElementById('ide-compiled-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (compiledBinariesList.length === 0) {
        list.innerHTML = '<div style="color:#666; font-style:italic; padding: 5px;">No binaries compiled yet.</div>';
        return;
    }
    
    compiledBinariesList.forEach((bin, idx) => {
        const item = document.createElement('div');
        item.className = 'ide-file-item compiled';
        item.innerHTML = `
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${bin.path}">⚙ ${escapeHTML(bin.name)}</span> 
            <span style="color:#55aaff; font-size:0.8em; margin-right:6px;">[${bin.compiler}]</span>
            <span class="ide-tab-close" onclick="removeCompiledBinary(${idx}, event)" title="Remove from list">×</span>
        `;
        item.onclick = () => loadIdeBinary(bin.path);
        item.title = "Click to load this binary into HT-RE";
        list.appendChild(item);
    });
}

function loadIdeBinary(path) {
    trackAction("LOAD_COMPILED_BINARY", { path });
    document.getElementById('binaryPath').value = path;
    loadBinary();
}

async function loadPatchHistory() {
    if (!binaryPath) return;
    const res = await fetch(`${API}/patch_history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ binary_path: binaryPath })
    });
    const data = await res.json();
    const list = document.getElementById('bp-history-list');
    list.innerHTML = '';
    if (!data.history || data.history.length === 0) {
        list.innerHTML = '<div style="color: #888;">No backups found for this binary.</div>';
        return;
    }
    data.history.forEach(h => {
        const name = h.split('/').pop();
        list.innerHTML += `<div class="history-item-row"><span>${name}</span><button class="history-restore-btn" onclick="restorePatch('${h}')">Restore</button></div>`;
    });
}

async function restorePatch(backupPath) {
    if (!confirm("Are you sure you want to revert to this version? Current binary will be overwritten.")) return;
    trackAction("RESTORE_PATCH", { backup: backupPath });
    const res = await fetch(`${API}/restore_patch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ binary_path: binaryPath, backup_path: backupPath })
    });
    const data = await res.json();
    if (data.success) {
        alert("Restored successfully. Reloading...");
        loadBinary();
    } else {
        alert("Failed to restore: " + data.error);
    }
}
