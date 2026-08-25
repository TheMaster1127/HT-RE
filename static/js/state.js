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
let openWindows = {}; // Mapped by windowId: { id, el, tabs, activeTabId, currentView, fontSize, aceEditor, modalScroller, isMaximized, isMinimized, geom }
let activeWindowId = null;

let originalDecompCache = {};
let userEditedDecompCache = {};
let aceSessions = {}; 
let modalAsmCache = {};
let activeAceTokenRange = null;

let mainScroller = null;
let currentElement = null;

// Multi-Project Workspace Store
let openProjects = {}; // Mapped by binaryPath: { binaryPath, currentFileHash, navHistory, currentTab, globalFunctions, isCpp, originalDecompCache, userEditedDecompCache, modalAsmCache, windowsState, converterState, options, tabDataCache, tabScrollPositions }

const reMnemonic = /\b(mov|lea|call|ret|push|pop|xor|add|sub|cmp|test|jmp|je|jne|jz|jle|jge|ja|jb|jbe|nop)\b/g;
const reReg = /%?(rax|rbx|rcx|rdx|rsi|rdi|rbp|rsp|r8|r9|r10|r11|r12|eax|ebx|ecx|edx|esi|edi|ebp|esp|al|bl|cl|dl|sil|dil|bpl|spl)\b/g;

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
