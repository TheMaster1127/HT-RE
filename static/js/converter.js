function showConvUI() { updateTabs('conv'); }
function showAsciiUI() { updateTabs('ascii'); }

let currentVal = 0n; 

function clearAllData() {
    document.querySelectorAll('#convPanel input[type="text"]:not(.calc-screen), #convPanel textarea').forEach(el => {
        el.value = '';
    });
    currentVal = 0n;
}

// Reset Converter and Calculators to a clean default state for a brand new project
function resetConverterToDefault() {
    clearAllData();
    const container = document.getElementById('calculators-container');
    if (container) {
        container.innerHTML = '';
        calcCounter = 0;
        spawnCalculator();
    }
}

// Export state of Converter & Calculators for Project switching
function exportConverterState() {
    const inputs = {};
    document.querySelectorAll('#convPanel input[type="text"]:not(.calc-screen), #convPanel textarea').forEach(el => {
        if (el.id) inputs[el.id] = el.value;
    });

    const selects = {};
    document.querySelectorAll('#convPanel select:not([id^="calc-"])').forEach(el => {
        if (el.id) selects[el.id] = el.value;
    });

    const calcs = [];
    document.querySelectorAll('.calc-instance').forEach(inst => {
        const id = inst.id.replace('calc-inst-', '');
        const screen = document.getElementById('calc-screen-' + id);
        const width = document.getElementById('calc-width-' + id);
        const base = document.getElementById('calc-base-' + id);
        const hist = document.getElementById('calc-hist-' + id);
        const titleEl = inst.querySelector('.calc-title');
        const title = titleEl ? titleEl.innerText : `Calculator #${id}`;
        if (screen) {
            calcs.push({
                id: id,
                title: title,
                screen: screen.value,
                width: width ? width.value : 'unlimited',
                base: base ? base.value : 'dec',
                historyHTML: hist ? hist.innerHTML : ''
            });
        }
    });

    return {
        currentVal: currentVal.toString(),
        inputs: inputs,
        selects: selects,
        calcs: calcs
    };
}

// Restore state of Converter & Calculators on Project switching
function importConverterState(state) {
    if (!state || !state.calcs || state.calcs.length === 0) {
        resetConverterToDefault();
        return;
    }

    clearAllData();

    try {
        currentVal = state.currentVal ? BigInt(state.currentVal) : 0n;
    } catch(e) {
        currentVal = 0n;
    }

    if (state.inputs) {
        for (let [id, val] of Object.entries(state.inputs)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }
    }

    if (state.selects) {
        for (let [id, val] of Object.entries(state.selects)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }
    }

    const container = document.getElementById('calculators-container');
    if (container) {
        container.innerHTML = '';
        calcCounter = 0;

        state.calcs.forEach(c => {
            const newId = spawnCalculator(c.title || `Calculator #${c.id}`);
            const screen = document.getElementById('calc-screen-' + newId);
            const width = document.getElementById('calc-width-' + newId);
            const base = document.getElementById('calc-base-' + newId);
            const hist = document.getElementById('calc-hist-' + newId);
            if (screen) screen.value = c.screen || '';
            if (width) width.value = c.width || 'unlimited';
            if (base) base.value = c.base || 'dec';
            if (hist) hist.innerHTML = c.historyHTML || '';
        });
    }
}

// Blocks user from physically typing invalid characters for specific fields
function blockInvalidInput(el, type) {
    let val = el.value;
    let original = val;
    switch(type) {
        case 'hex':   val = val.replace(/[^0-9a-fA-FxX\s]/g, ''); break;
        case 'hex-s': val = val.replace(/[^0-9a-fA-FxX\-\s]/g, ''); break; 
        case 'decu':  val = val.replace(/[^0-9]/g, ''); break;
        case 'decs':  val = val.replace(/[^0-9\-]/g, ''); break;
        case 'bin':   val = val.replace(/[^01bB\s]/g, ''); break;
        case 'oct':   val = val.replace(/[^0-7oO\s]/g, ''); break;
        case 'float': val = val.replace(/[^0-9\.\-\+eE]/g, ''); break;
    }
    if (val !== original) {
        el.value = val;
    }
}

// --- Float16 Helper (Half Precision) ---
function float16ToNumber(h) {
    let s = (h & 0x8000) >> 15;
    let e = (h & 0x7C00) >> 10;
    let f = h & 0x03FF;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
    if (e === 0x1F) return f ? NaN : ((s ? -1 : 1) * Infinity);
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}

function numberToFloat16(n) {
    let f32 = new Float32Array([n]);
    let u32 = new Uint32Array(f32.buffer)[0];
    let s = (u32 >> 16) & 0x8000;
    let e = (u32 >> 23) & 0xFF;
    let f = u32 & 0x007FFFFF;
    if (e === 0xFF) return s | 0x7C00 | (f ? 1 : 0); 
    if (e === 0) return s; 
    let e16 = e - 127 + 15;
    if (e16 >= 0x1F) return s | 0x7C00; 
    if (e16 <= 0) { 
        let shift = 14 - (e - 127);
        return s | (shift < 11 ? ((f | 0x00800000) >> (shift + 13)) : 0);
    }
    return s | (e16 << 10) | (f >> 13);
}

function updateConversions(source) {
    let txt = document.getElementById('cv-' + source).value.replace(/\s+/g, '').toLowerCase();
    try {
        if (txt === '' || txt === '-') return;
        if (source === 'hex') {
            txt = txt.replace(/^0x/, ''); 
            if (txt.length % 2 !== 0) txt = '0' + txt; 
            currentVal = BigInt('0x' + (txt || '0'));
        } 
        else if (source === 'bin') {
            txt = txt.replace(/^0b/, '');
            currentVal = BigInt('0b' + (txt || '0'));
        }
        else if (source === 'oct') {
            txt = txt.replace(/^0o/, '');
            currentVal = BigInt('0o' + (txt || '0'));
        }
        else if (source === 'f16') {
            let f16Raw = numberToFloat16(parseFloat(txt));
            currentVal = BigInt(f16Raw);
        }
        else if (source === 'f32') {
            let buf = new ArrayBuffer(4);
            new DataView(buf).setFloat32(0, parseFloat(txt), false); 
            currentVal = BigInt(new DataView(buf).getUint32(0, false));
        }
        else if (source === 'f64') {
            let buf = new ArrayBuffer(8);
            new DataView(buf).setFloat64(0, parseFloat(txt), false); 
            currentVal = new DataView(buf).getBigUint64(0, false);
        }
        else {
            currentVal = BigInt(txt);
            if (source === 'i8' || source === 'u8') currentVal = BigInt.asUintN(8, currentVal);
            else if (source === 'i16' || source === 'u16') currentVal = BigInt.asUintN(16, currentVal);
            else if (source === 'i32' || source === 'u32') currentVal = BigInt.asUintN(32, currentVal);
            else currentVal = BigInt.asUintN(64, currentVal);
        }
        currentVal = BigInt.asUintN(64, currentVal);
        broadcastConversions(source);
    } catch (e) {}
}

function broadcastConversions(skipSource) {
    let hexStr = currentVal.toString(16).padStart(16, '0');
    let binStr = currentVal.toString(2).padStart(64, '0');
    
    let hexBytes = hexStr.match(/.{2}/g);
    let binBytes = binStr.match(/.{8}/g);
    
    while (hexBytes[0] === '00' && hexBytes.length > 1) { hexBytes.shift(); binBytes.shift(); }
    
    if (skipSource !== 'hex') document.getElementById('cv-hex').value = '0x' + hexBytes.join('');
    if (skipSource !== 'bin') document.getElementById('cv-bin').value = '0b' + binBytes.join('');
    if (skipSource !== 'oct') document.getElementById('cv-oct').value = '0o' + currentVal.toString(8);
    
    if (skipSource !== 'u8') document.getElementById('cv-u8').value = BigInt.asUintN(8, currentVal).toString();
    if (skipSource !== 'i8') document.getElementById('cv-i8').value = BigInt.asIntN(8, currentVal).toString();
    if (skipSource !== 'u16') document.getElementById('cv-u16').value = BigInt.asUintN(16, currentVal).toString();
    if (skipSource !== 'i16') document.getElementById('cv-i16').value = BigInt.asIntN(16, currentVal).toString();
    if (skipSource !== 'u32') document.getElementById('cv-u32').value = BigInt.asUintN(32, currentVal).toString();
    if (skipSource !== 'i32') document.getElementById('cv-i32').value = BigInt.asIntN(32, currentVal).toString();
    if (skipSource !== 'u64') document.getElementById('cv-u64').value = currentVal.toString(); 
    if (skipSource !== 'i64') document.getElementById('cv-i64').value = BigInt.asIntN(64, currentVal).toString();

    if (skipSource !== 'f16') {
        let f16val = float16ToNumber(Number(BigInt.asUintN(16, currentVal)));
        document.getElementById('cv-f16').value = f16val.toString();
    }
    if (skipSource !== 'f32') {
        let buf32 = new ArrayBuffer(4);
        new DataView(buf32).setUint32(0, Number(BigInt.asUintN(32, currentVal)), false);
        document.getElementById('cv-f32').value = new DataView(buf32).getFloat32(0, false).toString();
    }
    if (skipSource !== 'f64') {
        let buf64 = new ArrayBuffer(8);
        new DataView(buf64).setBigUint64(0, currentVal, false);
        document.getElementById('cv-f64').value = new DataView(buf64).getFloat64(0, false).toString();
    }
}

// --- Endianness & Address Swapper ---
function updateEndian(source) {
    let inEl = document.getElementById(source === 'little' ? 'cv-end-little' : 'cv-end-big');
    let outEl = document.getElementById(source === 'little' ? 'cv-end-big' : 'cv-end-little');
    
    let hex = inEl.value.replace(/0x/gi, '').replace(/\s+/g, '').replace(/[^0-9a-fA-F]/g, '');
    if (hex.length % 2 !== 0) hex = '0' + hex; 
    
    let bytes = hex.match(/.{2}/g) || [];
    bytes.reverse();
    outEl.value = bytes.length > 0 ? '0x' + bytes.join('') : '';
}

// --- String ↔ Hex Converter (UTF-8, UTF-16LE, ANSI) ---
function updateStrConv(source) {
    let enc = document.getElementById('cv-str-encoding').value;
    
    if (source === 'text') {
        let txt = document.getElementById('cv-str-text').value;
        let hex = '';
        
        if (enc === 'utf8') {
            let bytes = new TextEncoder().encode(txt);
            hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        } else if (enc === 'utf16le') {
            for (let i = 0; i < txt.length; i++) {
                let code = txt.charCodeAt(i);
                hex += (code & 0xFF).toString(16).padStart(2, '0') + ' ' + ((code >> 8) & 0xFF).toString(16).padStart(2, '0') + ' ';
            }
        } else if (enc === 'ansi') {
            for (let i = 0; i < txt.length; i++) {
                hex += (txt.charCodeAt(i) & 0xFF).toString(16).padStart(2, '0') + ' ';
            }
        }
        document.getElementById('cv-str-hex').value = hex.trim();
        
    } else {
        let hexStr = document.getElementById('cv-str-hex').value.replace(/0x/gi, '').replace(/\s+/g, '').replace(/[^0-9a-fA-F]/g, '');
        let bytes = new Uint8Array(hexStr.length / 2);
        for (let i = 0; i < hexStr.length; i += 2) {
            bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
        }
        
        let txt = '';
        if (enc === 'utf8') {
            txt = new TextDecoder('utf-8').decode(bytes);
        } else if (enc === 'utf16le') {
            txt = new TextDecoder('utf-16le').decode(bytes);
        } else if (enc === 'ansi') {
            txt = new TextDecoder('windows-1252').decode(bytes); 
        }
        document.getElementById('cv-str-text').value = txt;
    }
}

// --- Relative Jump Calculator ---
function calcJump(source) {
    try {
        let currStr = document.getElementById('jc-curr').value.trim().replace(/^0x/i, '');
        if (!currStr) return;
        
        let curr = BigInt('0x' + currStr);

        if (source === 'offset' || source === 'offset-dec') {
            let isDec = (source === 'offset-dec');
            let offStr = document.getElementById(isDec ? 'jc-off-dec' : 'jc-off-hex').value.trim();
            if (!offStr) return;
            
            let offset = isDec ? BigInt(offStr) : BigInt('0x' + offStr.replace(/^0x/i, '').replace(/^-0x/i, '-'));
            let target = curr + offset;
            
            document.getElementById('jc-target').value = '0x' + target.toString(16);
            if (isDec) {
                let offHex = offset.toString(16);
                document.getElementById('jc-off-hex').value = (offset < 0 ? '-0x' + offHex.replace('-', '') : '0x' + offHex);
            } else {
                document.getElementById('jc-off-dec').value = offset.toString();
            }
        } 
        else if (source === 'target') {
            let tgtStr = document.getElementById('jc-target').value.trim().replace(/^0x/i, '');
            if (!tgtStr) return;
            
            let target = BigInt('0x' + tgtStr);
            let offset = target - curr;
            
            let offHex = offset.toString(16);
            document.getElementById('jc-off-hex').value = (offset < 0 ? '-0x' + offHex.replace('-', '') : '0x' + offHex);
            document.getElementById('jc-off-dec').value = offset.toString();
        }
    } catch (e) {
        // Ignore parsing errors
    }
}

// --- Custom Math.js RE Injections ---
math.import({
    bswap32: function (x) {
        let hex = Math.abs(x).toString(16).padStart(8, '0');
        let bytes = hex.match(/.{2}/g).reverse();
        return parseInt(bytes.join(''), 16);
    },
    bswap64: function (x) {
        let hex = x.toString(16).replace('-', '').padStart(16, '0');
        let bytes = hex.match(/.{2}/g).reverse();
        return parseInt(bytes.join(''), 16);
    },
    rol: function (val, shift, width = 32) {
        shift = shift % width;
        let mask = Math.pow(2, width) - 1;
        return ((val << shift) & mask) | ((val & mask) >>> (width - shift));
    },
    ror: function (val, shift, width = 32) {
        shift = shift % width;
        let mask = Math.pow(2, width) - 1;
        return ((val & mask) >>> shift) | ((val << (width - shift)) & mask);
    }
});

// --- Dynamic Calculators Management (Default: Unlimited Float) ---
let calcCounter = 0;

function spawnCalculator(customTitle = null) {
    const id = ++calcCounter;
    const title = customTitle || `Calculator #${id}`;
    const isFirstCalc = (document.querySelectorAll('.calc-instance').length === 0);

    const calcHTML = `
        <div class="calc-instance" id="calc-inst-${id}">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
                <span class="calc-title" style="color:#55aaff; font-size:0.85em; font-weight:bold; margin-right:10px;">${escapeHTML(title)}</span>
                <div style="display:flex; gap:5px; align-items:center;">
                    <select id="calc-width-${id}" style="background:#222; border:1px solid #444; color:#aaa; font-size:0.8em; padding:2px;">
                        <option value="unlimited" selected>Unlimited (Float)</option>
                        <option value="8">8-bit</option>
                        <option value="16">16-bit</option>
                        <option value="32">32-bit</option>
                        <option value="64">64-bit</option>
                    </select>
                    <select id="calc-base-${id}" style="background:#222; border:1px solid #444; color:#aaa; font-size:0.8em; padding:2px;" onchange="calcEvaluate(${id})">
                        <option value="dec" selected>Dec</option>
                        <option value="hex">Hex</option>
                        <option value="bin">Bin</option>
                    </select>
                    <button class="calc-del-btn" style="background:transparent; color:#ff3333; border:none; font-size:1.1em; cursor:pointer; padding:0 0 0 5px; display:${isFirstCalc ? 'none' : 'inline-block'};" onclick="deleteCalculator(${id})" title="Delete this calculator">×</button>
                </div>
            </div>
            
            <div id="calc-hist-${id}" class="calc-history"></div>
            
            <input type="text" id="calc-screen-${id}" class="calc-screen" placeholder="0" onkeydown="if(event.key==='Enter') calcEvaluate(${id})">
            
            <div class="calc-grid-sci">
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, 'sin(')">sin</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, 'cos(')">cos</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, 'tan(')">tan</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, 'pi')">π</button>
                <button class="calc-btn calc-btn-op" onclick="calcClear(${id})" style="color:#ff6666;">C</button>
                
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, 'log(')">log</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, 'sqrt(')">√</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '(')">(</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, ')')">)</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '/')">÷</button>

                <button class="calc-btn calc-btn-bit" onclick="calcAppend(${id}, '&')">AND</button>
                <button class="calc-btn calc-btn-bit" onclick="calcAppend(${id}, '|')">OR</button>
                <button class="calc-btn calc-btn-bit" onclick="calcAppend(${id}, '^')">XOR</button>
                <button class="calc-btn calc-btn-bit" onclick="calcAppend(${id}, '<<')">LSH</button>
                <button class="calc-btn calc-btn-bit" onclick="calcAppend(${id}, '>>')">RSH</button>

                <button class="calc-btn calc-btn-bit" onclick="calcAppend(${id}, '~')">NOT</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '7')">7</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '8')">8</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '9')">9</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '*')">×</button>
                
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '0x')">0x</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '4')">4</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '5')">5</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '6')">6</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '-')">-</button>
                
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '^')">pow</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '1')">1</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '2')">2</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '3')">3</button>
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '+')">+</button>
                
                <button class="calc-btn calc-btn-op" onclick="calcAppend(${id}, '%')">mod</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '0')">0</button>
                <button class="calc-btn" onclick="calcAppend(${id}, '.')">.</button>
                <button class="calc-btn calc-btn-eq" style="grid-column: span 2;" onclick="calcEvaluate(${id})">=</button>
            </div>
        </div>
    `;
    document.getElementById('calculators-container').insertAdjacentHTML('beforeend', calcHTML);
    return id;
}

function deleteCalculator(id) {
    const el = document.getElementById('calc-inst-' + id);
    if (!el) return;
    const title = el.querySelector('.calc-title') ? el.querySelector('.calc-title').innerText : `Calculator #${id}`;
    if (confirm(`Are you sure you want to delete ${title}?`)) {
        el.remove();
    }
}

function deleteAllCalculators() {
    const container = document.getElementById('calculators-container');
    if (!container || container.children.length <= 1) return;
    if (confirm("Are you sure you want to delete all extra calculators?")) {
        while (container.children.length > 1) {
            container.removeChild(container.lastChild);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('calculators-container');
    if (container && container.children.length === 0) {
        spawnCalculator();
    }
    generateAsciiTable();
});

function calcAppend(id, val) {
    let screen = document.getElementById('calc-screen-' + id);
    if (screen.value === 'Error' || screen.value === 'undefined') screen.value = '';
    screen.value += val;
}

function calcClear(id) {
    document.getElementById('calc-screen-' + id).value = '';
}

function calcEvaluate(id) {
    let screen = document.getElementById('calc-screen-' + id);
    let histBox = document.getElementById('calc-hist-' + id);
    let base = document.getElementById('calc-base-' + id).value;
    let width = document.getElementById('calc-width-' + id).value;
    
    try {
        if (!screen.value.trim()) return;
        let expr = screen.value;
        
        let parsedExpr = expr.replace(/\b([a-zA-Z0-9]+)\b/g, (match) => {
            if (/^0[xbo][0-9a-zA-Z]+$/i.test(match)) return match; 
            if (/^\d+$/.test(match)) return match; 
            if (/^\d+e[\+\-]?\d+$/i.test(match)) return match; 
            if (match.toLowerCase() === 'e') return match; 
            if (/^[0-9a-fA-F]+$/.test(match)) return '0x' + match; 
            return match; 
        });
        
        let result = math.evaluate(parsedExpr);
        
        if (width !== 'unlimited') {
            result = Number(BigInt.asUintN(parseInt(width), BigInt(Math.floor(result))));
        }

        let formattedResult = result;
        if (base === 'hex') {
            formattedResult = result < 0 
                ? '-0x' + Math.abs(result).toString(16).toUpperCase()
                : '0x' + result.toString(16).toUpperCase();
        } else if (base === 'bin') {
            formattedResult = result < 0 
                ? '-0b' + Math.abs(result).toString(2)
                : '0b' + result.toString(2);
        }

        let histHTML = `<div class="calc-hist-item" onclick="if(window.getSelection().toString() === '') document.getElementById('calc-screen-${id}').value = '${expr.replace(/'/g, "\\'")}'">${escapeHTML(expr)} = <span style="color:#fff;">${formattedResult}</span></div>`;
        histBox.insertAdjacentHTML('beforeend', histHTML);
        histBox.scrollTop = histBox.scrollHeight;

        screen.value = formattedResult;
    } catch (e) {
        screen.value = "Error";
    }
}

// --- Mass ASCII Table Generation (Top-To-Bottom, 3 Columns) ---
function generateAsciiTable() {
    const controlDesc = [
        "NUL (Null char)", "SOH (Start of Header)", "STX (Start of Text)", "ETX (End of Text)",
        "EOT (End of Trans.)", "ENQ (Enquiry)", "ACK (Acknowledgement)", "BEL (Bell)",
        "BS (Backspace)", "TAB (Horizontal Tab)", "LF (Line Feed/New Line)", "VT (Vertical Tab)",
        "FF (Form Feed)", "CR (Carriage Return)", "SO (Shift Out)", "SI (Shift In)",
        "DLE (Data Link Escape)", "DC1 (Device Control 1)", "DC2 (Device Control 2)", "DC3 (Device Control 3)",
        "DC4 (Device Control 4)", "NAK (Negative Ack.)", "SYN (Synchronous Idle)", "ETB (End of Trans. Blk)",
        "CAN (Cancel)", "EM (End of Medium)", "SUB (Substitute)", "ESC (Escape)",
        "FS (File Separator)", "GS (Group Separator)", "RS (Record Separator)", "US (Unit Separator)"
    ];

    let html = '<div style="display:flex; gap:15px; width:100%;">';
    
    for (let col = 0; col < 3; col++) {
        html += `<div style="flex:1; background:#111; border: 1px solid var(--border); padding: 5px;">`;
        html += `<div class="ascii-row ascii-header">
                    <div>Dec</div><div>Hex</div><div>Oct</div><div style="text-align:center;">Char</div><div>Desc</div>
                 </div>`;
        
        let start = col * 86;
        let end = Math.min(start + 86, 256);
        
        for (let i = start; i < end; i++) {
            let dec = i.toString().padStart(3, '0');
            let hex = i.toString(16).padStart(2, '0').toUpperCase();
            let oct = i.toString(8).padStart(3, '0');
            
            let char = '';
            let desc = '';
            let isCtrl = false;

            if (i < 32) {
                char = controlDesc[i].split(' ')[0];
                desc = controlDesc[i];
                isCtrl = true;
            } else if (i === 32) {
                char = "SPACE";
                desc = "Space";
                isCtrl = true;
            } else if (i === 127) {
                char = "DEL";
                desc = "Delete";
                isCtrl = true;
            } else if (i > 127) {
                char = String.fromCharCode(i);
                desc = "Extended";
            } else {
                char = String.fromCharCode(i);
                desc = "Printable";
            }

            html += `
                <div class="ascii-row">
                    <div style="color:#ffeb73;">${dec}</div>
                    <div style="color:#ff6600;">${hex}</div>
                    <div style="color:#aaa;">${oct}</div>
                    <div style="text-align:center;" class="${isCtrl ? 'ascii-ctrl' : 'ascii-char'}">${escapeHTML(char)}</div>
                    <div class="ascii-desc" title="${desc}">${desc}</div>
                </div>`;
        }
        html += `</div>`;
    }
    
    html += `</div>`;
    document.getElementById('ascii-table-container').innerHTML = html;
}
