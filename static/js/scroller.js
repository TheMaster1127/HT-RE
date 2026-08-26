class VirtualScroller {
    constructor(containerId, text, mode, initialScroll = 0, ownerBinary = '') {
        this.container = document.getElementById(containerId);
        this.lines = text ? text.split('\n') : [];
        this.mode = mode; 
        this.ownerBinary = ownerBinary || binaryPath; // Permanently lock scroller to its specific binary!
        this.lineHeight = 20; 
        this.highlightIndex = -1;
        this.isReady = false;

        // Build DOM structure
        this.container.innerHTML = `<div style="height: ${this.lines.length * this.lineHeight}px; width: 1px;"></div><div class="vs-viewport" style="position: absolute; top: 0; left: 0; right: 0; padding-left: 10px;"></div>`;
        this.viewport = this.container.querySelector('.vs-viewport');

        // Set initial scroll position BEFORE attaching listener
        this.container.scrollTop = initialScroll || 0;
        this.render();

        // Gated onscroll listener locked to ownerBinary
        this.container.onscroll = () => {
            this.render();
            if (this.isReady && typeof onScrollerScroll === 'function') {
                onScrollerScroll(this.container.scrollTop, this.ownerBinary, this.mode);
            }
        };

        // Complete initialization after DOM paint
        requestAnimationFrame(() => {
            if (this.container) {
                this.container.scrollTop = initialScroll || 0;
                this.render();
            }
            this.isReady = true;
        });
    }

    restoreScroll(pos) {
        if (this.container) {
            this.container.scrollTop = pos || 0;
            this.render();
        }
    }

    getCurrentAddress() {
        const scrollTop = this.container.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / this.lineHeight));
        const centerIndex = startIndex + Math.floor(this.container.clientHeight / this.lineHeight / 2);
        const clampedIndex = Math.min(this.lines.length - 1, Math.max(0, centerIndex));
        
        for (let i = 0; i < 100; i++) {
            if (clampedIndex + i < this.lines.length) {
                const match1 = this.lines[clampedIndex + i].match(/^\s*([0-9a-fA-F]+):/);
                if (match1) return match1[1];
            }
            if (clampedIndex - i >= 0) {
                const match2 = this.lines[clampedIndex - i].match(/^\s*([0-9a-fA-F]+):/);
                if (match2) return match2[1];
            }
        }
        return null;
    }

    formatLine(line, index) {
        let safeLine = escapeHTML(line);
        let sourceAddr = null;

        if (this.mode === 'disasm') {
            const match = line.match(/^\s*([0-9a-fA-F]+):/);
            if (match) sourceAddr = match[1];
        }

        if (this.mode === 'disasm' && line.trim()) {
            safeLine = safeLine.replace(reMnemonic, '<span class="syntax-mnemonic">$1</span>');
            safeLine = safeLine.replace(reReg, '<span class="syntax-reg">$1</span>');
            
            safeLine = safeLine.replace(/\b(0x[0-9a-fA-F]+)\b/g, (m) => {
                return `<span class="clickable" data-value="${m}" onclick="jumpTo('${m}', ${sourceAddr ? `'${sourceAddr}'` : 'true'})">${m}</span>`;
            });
            safeLine = safeLine.replace(/&lt;([^&]+)&gt;/g, (fullMatch, symName) => {
                return `&lt;<span class="clickable" onclick="jumpToSym('${symName}', ${sourceAddr ? `'${sourceAddr}'` : 'true'})">${symName}</span>&gt;`;
            });
        } 
        else if (this.mode === 'hex') {
            let hexMatch = safeLine.match(/^([0-9a-fA-F]+:)\s+(.*?)\s{2,}(.*)$/);
            if (hexMatch) {
                let addr = `<span class="hx-addr">${hexMatch[1]}</span>`;
                let bytes = hexMatch[2].replace(/([0-9a-fA-F]{2})/g, (byte) => {
                    let lower = byte.toLowerCase();
                    if (lower === '00') return `<span class="hx-z">${byte}</span>`;
                    if (lower === 'ff') return `<span class="hx-f">${byte}</span>`;
                    return `<span class="hx-b">${byte}</span>`;
                });
                let ascii = `<span class="hx-a">${hexMatch[3]}</span>`;
                safeLine = `${addr}  ${bytes}  ${ascii}`;
            }
        }
        else if (this.mode === 'header') {
            safeLine = safeLine.replace(/^([a-zA-Z\s.-]+):/g, '<span style="color:var(--primary); font-weight:bold;">$1:</span>');
            
            if (safeLine.includes("Entry point address:")) {
                safeLine = safeLine.replace(/\b(0x[0-9a-fA-F]+)\b/g, '<span class="clickable" data-value="$1" onclick="updateTabs(\'disasm\'); loadDisasm().then(()=>jumpTo(\'$1\', false))">$1</span>');
            } else {
                safeLine = safeLine.replace(/\b(0x[0-9a-fA-F]+)\b/g, '<span class="hx-addr">$1</span>');
            }
        }
        else if (this.mode === 'sections') {
            safeLine = safeLine.replace(/(\.[a-zA-Z0-9_.-]+)/g, '<span style="color:var(--accent); font-weight:bold;">$1</span>');
            safeLine = safeLine.replace(/\[\s*\d+\]/g, '<span style="color:#55aaff;">$&</span>');
        }
        
        let classes = "output-line";
        if (index === this.highlightIndex) classes += " highlight";
        return `<div class="${classes}">${safeLine}</div>`;
    }

    render() {
        const scrollTop = this.container.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / this.lineHeight) - 5);
        const endIndex = Math.min(this.lines.length, startIndex + Math.ceil(this.container.clientHeight / this.lineHeight) + 10);

        this.viewport.style.transform = `translateY(${startIndex * this.lineHeight}px)`;
        let html = '';
        for (let i = startIndex; i < endIndex; i++) html += this.formatLine(this.lines[i], i);
        this.viewport.innerHTML = html;
    }

    scrollToIndex(index) {
        if (index >= 0 && index < this.lines.length) {
            this.highlightIndex = index;
            this.container.scrollTop = (index * this.lineHeight) - (this.container.clientHeight / 2);
            this.render();
        }
    }

    searchEngine(term, searchAll = false) {
        const results = [];
        const isCaseSensitive = document.getElementById('searchCaseSensitive').checked;
        let searchTxt = isCaseSensitive ? term : term.toLowerCase();
        let cleanHex = searchTxt.replace(/\s+/g, '');

        for (let i = 0; i < this.lines.length; i++) {
            let lineTxt = isCaseSensitive ? this.lines[i] : this.lines[i].toLowerCase();
            let match = false;
            if (this.mode === 'hex' && cleanHex.match(/^[0-9a-f]+$/)) {
                let parts = lineTxt.split('  ');
                if (parts.length >= 2) {
                    let rawHex = parts[0].split(':')[1].replace(/\s+/g, '');
                    if (rawHex.includes(cleanHex)) match = true;
                }
            }
            if (!match && lineTxt.includes(searchTxt)) match = true;
            if (match) {
                if (!searchAll) {
                    if (i > lastSearchIndex) {
                        lastSearchIndex = i;
                        this.scrollToIndex(i);
                        return true;
                    }
                } else {
                    results.push({ index: i, text: this.lines[i] });
                }
            }
        }
        if (!searchAll) { lastSearchIndex = -1; return false; }
        return results;
    }
    
    searchNext(term) {
        if (term !== lastSearchTerm) { lastSearchTerm = term; lastSearchIndex = -1; }
        if (!this.searchEngine(term, false)) {
            if (!this.searchEngine(term, false)) alert("Pattern not found.");
        }
    }
}
