async function loadFoundStrings(forceReload = false) {
    if (typeof saveCurrentTabScroll === 'function') {
        saveCurrentTabScroll();
    }
    updateTabs('foundStrings');
    const container = document.getElementById('output');

    if (!forceReload && tabDataCache['foundStrings']) {
        mainScroller = null;
        container.innerHTML = tabDataCache['foundStrings'].html;
        const savedScroll = tabScrollPositions['foundStrings'] || 0;
        container.scrollTop = savedScroll;
        return;
    }

    container.innerHTML = '<div style="padding:10px;">Analyzing...</div>';

    const resDisasm = await fetch(`${API}/objdump-d`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({binary_path: binaryPath, options: {all_sections: true}}) });
    const dataDisasm = await resDisasm.json();
    const resStrings = await fetch(`${API}/resolve_strings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({binary_path: binaryPath, disassembly: dataDisasm.output}) });
    const dataStrings = await resStrings.json();

    const html = dataStrings.strings.map(s => {
        const safeStr = escapeHTML(s.string);
        // Uses `false` for jump history so that jumping from Strings tab doesn't record "address 0x0" into the history
        return `
        <div class="found-string-row">
            <div class="string-text" title="${safeStr}" onclick="updateTabs('disasm'); loadDisasm().then(()=>jumpTo('${s.addr}', false))">"${safeStr}"</div>
            <div class="string-addr" onclick="updateTabs('disasm'); loadDisasm().then(()=>jumpTo('${s.addr}', false))">${s.addr}</div>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${s.string.replace(/'/g, "\\'")}')">Copy</button>
        </div>`;
    }).join('');
    
    mainScroller = null; 
    const finalHtml = `<div id="fsList" style="padding: 10px;">${html}</div>`;
    tabDataCache['foundStrings'] = { html: finalHtml };
    container.innerHTML = finalHtml;
    const savedScroll = tabScrollPositions['foundStrings'] || 0;
    container.scrollTop = savedScroll;
}

function filterFoundStrings(term) {
    const isCaseSensitive = document.getElementById('searchCaseSensitive').checked;
    const searchTxt = isCaseSensitive ? term : term.toLowerCase();
    
    document.querySelectorAll('.found-string-row').forEach(row => {
        const textNode = row.querySelector('.string-text').innerText;
        const text = isCaseSensitive ? textNode : textNode.toLowerCase();
        row.style.display = text.includes(searchTxt) ? 'grid' : 'none';
    });
}
