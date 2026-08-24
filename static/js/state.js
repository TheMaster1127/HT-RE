const API = 'http://localhost:8000/api';
let binaryPath = '';
let currentFileHash = '';
let navHistory = [];
let currentTab = 'disasm';
let lastSearchTerm = '';
let lastSearchIndex = 0;
let globalFunctions = []; 
let isCpp = false;

let openedModalTabs = []; 
let currentActiveTabId = null;

let currentModalFunc = null;
let currentModalView = 'asm';
let modalAsmCache = {};
let aceEditor = null;
let editorFontSize = 14;

let originalDecompCache = {};
let userEditedDecompCache = {};
let aceSessions = {}; 
let activeAceTokenRange = null;

let mainScroller = null;
let modalScroller = null;
let currentElement = null;

const reMnemonic = /\b(mov|lea|call|ret|push|pop|xor|add|sub|cmp|test|jmp|je|jne|jz|jle|jge|ja|jb|jbe|nop)\b/g;
const reReg = /%?(rax|rbx|rcx|rdx|rsi|rdi|rbp|rsp|r8|r9|r10|r11|r12|eax|ebx|ecx|edx|esi|edi|ebp|esp|al|bl|cl|dl|sil|dil|bpl|spl)\b/g;

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
