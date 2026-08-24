function showPatchUI() { updateTabs('patch'); }

function switchBpTab(tab) {
    document.querySelectorAll('.bp-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bp-panel').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('bp-' + tab).classList.add('active');
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
    const res = await fetch(`${API}/binpatch`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    document.getElementById('bp-output').innerText = data.output || data.error;
}
