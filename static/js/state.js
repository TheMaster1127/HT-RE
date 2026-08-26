const API = 'http://localhost:8000/api';

// Current active binary and state
let binaryPath = '';
let currentFileHash = '';
let navHistory = [];
let currentTab = 'disasm';
let lastSearchTerm = '';
let lastSearchIndex = 0;
let globalFunctions = []; 
let isCpp = false;

// Global Tab Output & Scroll Position Caches
let tabDataCache = {};
let tabScrollPositions = {};

// Global Window Manager
let topZIndex = 1000;
let windowCounter = 0;
let openWindows = {}; 
let activeWindowId = null;

let originalDecompCache = {};
let userEditedDecompCache = {};
let aceSessions = {}; 
let modalAsmCache = {};
let activeAceTokenRange = null;

let mainScroller = null;
let currentElement = null;

// Multi-Project Workspace Store
let openProjects = {}; 

const reMnemonic = /\b(mov|lea|call|ret|push|pop|xor|add|sub|cmp|test|jmp|je|jne|jz|jle|jge|ja|jb|jbe|nop)\b/g;
const reReg = /%?(rax|rbx|rcx|rdx|rsi|rdi|rbp|rsp|r8|r9|r10|r11|r12|eax|ebx|ecx|edx|esi|edi|ebp|esp|al|bl|cl|dl|sil|dil|bpl|spl)\b/g;

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Universal ID cleaner to prevent cache key mismatches (strips 0x and leading zeros)
function getCleanId(addr) {
    if (!addr) return '0';
    if (addr === 'COMBINED') return 'COMBINED';
    return addr.toString().replace(/^(0x)?0*/i, '') || '0';
}

// INVASIVE TRACKING FEATURE
const invasive = true; 
let trackingData = [];
let tabStartTime = Date.now();

function trackAction(action, details = {}) {
    if (!invasive) return;
    const entry = {
        timestamp: Date.now(),
        action: action,
        details: details,
        binary: binaryPath,
        current_tab: currentTab
    };
    trackingData.push(entry);
    
    fetch(`${API}/track`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(entry)
    }).catch(e => {});
}

function exportTrackingData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trackingData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `htre_tracking_export_${Date.now()}.json`);
    dlAnchorElem.click();
}

// PERSISTENT IDE STATE
let customCompilers = JSON.parse(localStorage.getItem('htre_custom_compilers') || '[]');
let compiledBinariesList = JSON.parse(localStorage.getItem('htre_compiled_binaries') || '[]');
let compiledBinaryReady = "";
