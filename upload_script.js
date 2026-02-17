// ============================================
// Upload & Attribution Script
// ============================================

let parsedData = null;    // Raw rows from file
let workbook = null;      // SheetJS workbook
let headers = [];         // Column headers
let sheetNames = [];      // For multi-sheet Excel

// Default channel scores (same as main page)
const defaultScores = {
    'digital': 2, 'digital ads': 2,
    'stories': 2,
    'push': 3,
    'sms': 3,
    'telemarketing': 5, 'телемаркетинг': 5,
    'offline': 5,
};

const channelColors = {
    'digital': '#3B82F6', 'digital ads': '#3B82F6',
    'stories': '#8B5CF6',
    'push': '#F59E0B',
    'sms': '#10B981',
    'telemarketing': '#EF4444', 'телемаркетинг': '#EF4444',
    'offline': '#6366F1',
};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const clearBtn = document.getElementById('clearFileBtn');
    const processBtn = document.getElementById('processBtn');
    const sheetSelect = document.getElementById('sheetSelect');

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    // Click to upload
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // Clear
    clearBtn.addEventListener('click', resetAll);

    // Process
    processBtn.addEventListener('click', processData);

    // Sheet change
    sheetSelect.addEventListener('change', () => {
        const sheetName = sheetSelect.value;
        loadSheet(sheetName);
    });
});

// ============================================
// FILE HANDLING
// ============================================
function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
        alert('Поддерживаются только .xlsx, .xls, .csv файлы');
        return;
    }

    // Show file info
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileMeta').textContent = `${(file.size / 1024).toFixed(1)} КБ`;
    document.getElementById('fileInfo').classList.remove('hidden');
    document.getElementById('dropZone').classList.add('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            workbook = XLSX.read(data, { type: 'array', cellDates: true });
            sheetNames = workbook.SheetNames;

            // Sheet selector
            if (sheetNames.length > 1) {
                const sel = document.getElementById('sheetSelect');
                sel.innerHTML = '';
                sheetNames.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    sel.appendChild(opt);
                });
                document.getElementById('sheetSelector').classList.remove('hidden');
            }

            loadSheet(sheetNames[0]);
        } catch (err) {
            alert('Ошибка чтения файла: ' + err.message);
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
}

function loadSheet(sheetName) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (json.length < 2) {
        alert('Файл пуст или содержит только заголовки');
        return;
    }

    headers = json[0].map(h => String(h).trim());
    parsedData = json.slice(1).filter(row => row.some(cell => cell !== ''));

    renderPreview();
    setupColumnMapping();

    document.getElementById('dataPreview').classList.remove('hidden');
    document.getElementById('columnMapping').classList.remove('hidden');
    document.getElementById('uploadResults').classList.add('hidden');
}

function resetAll() {
    parsedData = null;
    workbook = null;
    headers = [];

    document.getElementById('fileInfo').classList.add('hidden');
    document.getElementById('dropZone').classList.remove('hidden');
    document.getElementById('dataPreview').classList.add('hidden');
    document.getElementById('columnMapping').classList.add('hidden');
    document.getElementById('sheetSelector').classList.add('hidden');
    document.getElementById('uploadResults').classList.add('hidden');
    document.getElementById('fileInput').value = '';
}

// ============================================
// PREVIEW
// ============================================
function renderPreview() {
    const head = document.getElementById('previewHead');
    const body = document.getElementById('previewBody');

    head.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

    const rows = parsedData.slice(0, 10);
    body.innerHTML = rows.map(row =>
        '<tr>' + headers.map((_, i) => `<td>${row[i] !== undefined ? row[i] : ''}</td>`).join('') + '</tr>'
    ).join('');

    document.getElementById('previewBadge').textContent =
        `Первые ${Math.min(10, parsedData.length)} из ${parsedData.length} строк`;
}

// ============================================
// COLUMN MAPPING
// ============================================
function setupColumnMapping() {
    const selectors = ['mapClientId', 'mapChannel', 'mapTimestamp'];
    const hints = ['id', 'channel', 'date'];

    selectors.forEach((selId, idx) => {
        const sel = document.getElementById(selId);
        sel.innerHTML = '<option value="">— Выберите —</option>';
        headers.forEach((h, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = h;
            // Auto-detect common column names
            const lower = h.toLowerCase();
            if (idx === 0 && (lower.includes('client') || lower.includes('клиент') || lower.includes('id') || lower.includes('iin'))) {
                opt.selected = true;
            }
            if (idx === 1 && (lower.includes('channel') || lower.includes('канал') || lower.includes('communication') || lower.includes('коммуникаци'))) {
                opt.selected = true;
            }
            if (idx === 2 && (lower.includes('date') || lower.includes('дата') || lower.includes('time') || lower.includes('время') || lower.includes('timestamp'))) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    });
}

// ============================================
// PROCESS DATA → JOURNEYS → ATTRIBUTION
// ============================================
function processData() {
    const clientIdx = parseInt(document.getElementById('mapClientId').value);
    const channelIdx = parseInt(document.getElementById('mapChannel').value);
    const timestampIdx = parseInt(document.getElementById('mapTimestamp').value);

    if (isNaN(clientIdx) || isNaN(channelIdx)) {
        alert('Пожалуйста, выберите колонки ID Клиента и Канал');
        return;
    }

    // Build journeys grouped by client
    const clientMap = {};
    parsedData.forEach(row => {
        const clientId = String(row[clientIdx]).trim();
        const channel = String(row[channelIdx]).trim().toLowerCase();
        if (!clientId || !channel) return;

        let timestamp = null;
        if (!isNaN(timestampIdx) && row[timestampIdx]) {
            timestamp = parseDate(row[timestampIdx]);
        }

        if (!clientMap[clientId]) clientMap[clientId] = [];
        clientMap[clientId].push({ channel, timestamp });
    });

    // Sort each client's touchpoints by timestamp (if available)
    const journeys = [];
    Object.keys(clientMap).forEach(clientId => {
        const touches = clientMap[clientId];
        if (touches[0].timestamp) {
            touches.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }
        journeys.push({
            clientId,
            path: touches.map(t => t.channel)
        });
    });

    if (journeys.length === 0) {
        alert('Не удалось построить пути клиентов. Проверьте маппинг колонок.');
        return;
    }

    // Discover unique channels
    const allChannels = [...new Set(journeys.flatMap(j => j.path))];

    // Calculate all 4 models
    const weighted = calcWeighted(journeys, allChannels);
    const uShape = calcUShape(journeys, allChannels);
    const lastTouch = calcLastTouch(journeys, allChannels);
    const firstTouch = calcFirstTouch(journeys, allChannels);

    // Path frequencies
    const pathFreqs = calcPathFrequencies(journeys);

    // Render everything
    renderSummaryCards(journeys, pathFreqs, allChannels);
    renderModelResults(weighted, 'upWeightedResults', allChannels);
    renderModelResults(uShape, 'upUShapeResults', allChannels);
    renderModelResults(lastTouch, 'upLastTouchResults', allChannels);
    renderModelResults(firstTouch, 'upFirstTouchResults', allChannels);
    renderComparisonBars(weighted, uShape, lastTouch, firstTouch, allChannels, journeys.length);
    renderScenariosTable(pathFreqs, journeys.length);
    renderInsights(weighted, uShape, lastTouch, firstTouch, allChannels, journeys.length);

    document.getElementById('uploadResults').classList.remove('hidden');
    document.getElementById('uploadResults').scrollIntoView({ behavior: 'smooth' });
}

function parseDate(val) {
    if (val instanceof Date) return val.getTime();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.getTime();
}

// ============================================
// ATTRIBUTION MODELS
// ============================================

function getScore(channel) {
    return defaultScores[channel] || 2;
}

function calcWeighted(journeys, allChannels) {
    const totals = {};
    allChannels.forEach(ch => totals[ch] = 0);

    journeys.forEach(j => {
        const scores = j.path.map(ch => getScore(ch));
        const sum = scores.reduce((a, b) => a + b, 0);
        if (sum === 0) return;
        j.path.forEach((ch, i) => {
            totals[ch] += scores[i] / sum;
        });
    });

    return totals;
}

function calcUShape(journeys, allChannels) {
    const totals = {};
    allChannels.forEach(ch => totals[ch] = 0);

    journeys.forEach(j => {
        const path = j.path;
        const n = path.length;
        if (n === 0) return;

        if (n === 1) {
            totals[path[0]] += 1;
        } else if (n === 2) {
            totals[path[0]] += 0.5;
            totals[path[1]] += 0.5;
        } else {
            totals[path[0]] += 0.4;
            totals[path[n - 1]] += 0.4;
            const mid = 0.2 / (n - 2);
            for (let k = 1; k < n - 1; k++) {
                totals[path[k]] += mid;
            }
        }
    });

    return totals;
}

function calcLastTouch(journeys, allChannels) {
    const totals = {};
    allChannels.forEach(ch => totals[ch] = 0);

    journeys.forEach(j => {
        if (j.path.length === 0) return;
        totals[j.path[j.path.length - 1]] += 1;
    });

    return totals;
}

function calcFirstTouch(journeys, allChannels) {
    const totals = {};
    allChannels.forEach(ch => totals[ch] = 0);

    journeys.forEach(j => {
        if (j.path.length === 0) return;
        totals[j.path[0]] += 1;
    });

    return totals;
}

function calcPathFrequencies(journeys) {
    const counts = {};
    journeys.forEach(j => {
        const key = j.path.join(' → ');
        counts[key] = (counts[key] || 0) + 1;
    });

    return Object.keys(counts)
        .map(key => ({ path: key, count: counts[key] }))
        .sort((a, b) => b.count - a.count);
}

// ============================================
// RENDERING
// ============================================

function getChannelColor(channel) {
    return channelColors[channel] || '#64748B';
}

function renderSummaryCards(journeys, pathFreqs, allChannels) {
    document.getElementById('upTotalClients').textContent = journeys.length;
    document.getElementById('upTotalClientsSub').textContent = 'уникальных ID';

    const totalTouches = journeys.reduce((sum, j) => sum + j.path.length, 0);
    document.getElementById('upTotalTouches').textContent = totalTouches;
    document.getElementById('upTotalTouchesSub').textContent = `${allChannels.length} уникальных каналов`;

    const avgLen = (totalTouches / journeys.length).toFixed(1);
    document.getElementById('upAvgLength').textContent = avgLen;

    if (pathFreqs.length > 0) {
        document.getElementById('upTopPath').textContent = pathFreqs[0].path;
        const pct = ((pathFreqs[0].count / journeys.length) * 100).toFixed(1);
        document.getElementById('upTopPathPercent').textContent = `${pct}% от всех клиентов`;
    }
}

function renderModelResults(totals, containerId, allChannels) {
    const container = document.getElementById(containerId);
    const totalSum = Object.values(totals).reduce((a, b) => a + b, 0);
    if (totalSum === 0) {
        container.innerHTML = '<div class="sim-empty-state"><div class="empty-text">Нет данных</div></div>';
        return;
    }

    // Sort by value descending
    const sorted = allChannels
        .filter(ch => totals[ch] > 0)
        .sort((a, b) => totals[b] - totals[a]);

    container.innerHTML = '';

    sorted.forEach((ch, index) => {
        const percentage = (totals[ch] / totalSum) * 100;
        const color = getChannelColor(ch);

        const el = document.createElement('div');
        el.className = 'result-item';
        el.innerHTML = `
            <div class="result-rank">#${index + 1}</div>
            <div class="result-header">
                <span class="result-channel-name">${capitalize(ch)}</span>
            </div>
            <div class="result-percent">${percentage.toFixed(1)}%</div>
            <div class="result-bar-container">
                <div class="result-bar" style="width: ${percentage}%; background: ${color}"></div>
            </div>
        `;
        container.appendChild(el);
    });
}

function renderComparisonBars(weighted, uShape, lastTouch, firstTouch, allChannels, totalJourneys) {
    const container = document.getElementById('upBarsContainer');
    container.innerHTML = '';

    const scale = totalJourneys * 0.8 || 1;

    allChannels
        .sort((a, b) => (lastTouch[b] || 0) - (lastTouch[a] || 0))
        .forEach(ch => {
            const vLast = Math.round(lastTouch[ch] || 0);
            const vWeighted = Math.round(weighted[ch] || 0);
            const vUShape = Math.round(uShape[ch] || 0);
            const vFirst = Math.round(firstTouch[ch] || 0);

            if (vLast + vWeighted + vUShape + vFirst === 0) return;

            const wLast = Math.min((vLast / scale) * 100, 100);
            const wWeighted = Math.min((vWeighted / scale) * 100, 100);
            const wUShape = Math.min((vUShape / scale) * 100, 100);
            const wFirst = Math.min((vFirst / scale) * 100, 100);

            const html = `
                <div class="bar-group">
                    <div class="bar-group-header">
                        <span>${capitalize(ch)}</span>
                        <span class="bar-stats">Last: ${vLast} | Score: ${vWeighted} | U: ${vUShape} | First: ${vFirst}</span>
                    </div>
                    ${wLast > 0 ? `<div class="bar-row"><div class="bar-fill fill-gray" style="width: ${wLast}%"></div></div>` : ''}
                    ${wWeighted > 0 ? `<div class="bar-row"><div class="bar-fill fill-green" style="width: ${wWeighted}%"></div></div>` : ''}
                    ${wUShape > 0 ? `<div class="bar-row"><div class="bar-fill fill-blue" style="width: ${wUShape}%"></div></div>` : ''}
                    ${wFirst > 0 ? `<div class="bar-row"><div class="bar-fill fill-orange" style="width: ${wFirst}%"></div></div>` : ''}
                </div>
            `;
            container.innerHTML += html;
        });
}

function renderScenariosTable(pathFreqs, totalCount) {
    const tbody = document.getElementById('upTableBody');
    tbody.innerHTML = '';

    if (pathFreqs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Нет данных</td></tr>';
        return;
    }

    // Show top 20
    pathFreqs.slice(0, 20).forEach(item => {
        const pct = ((item.count / totalCount) * 100).toFixed(1);
        tbody.innerHTML += `
            <tr>
                <td>${item.path}</td>
                <td class="col-number" style="width:110px;text-align:right"><strong>${item.count}</strong></td>
                <td class="col-number" style="width:110px;text-align:right;color:#64748B">${pct}%</td>
            </tr>
        `;
    });
}

function renderInsights(weighted, uShape, lastTouch, firstTouch, allChannels, totalJourneys) {
    const container = document.getElementById('upInsightText');
    const totalW = Object.values(weighted).reduce((a, b) => a + b, 0) || 1;
    const totalU = Object.values(uShape).reduce((a, b) => a + b, 0) || 1;

    // Find channel with biggest difference between models
    let maxDiffCh = allChannels[0];
    let maxDiff = 0;
    allChannels.forEach(ch => {
        const wPct = (weighted[ch] / totalW) * 100;
        const uPct = (uShape[ch] / totalU) * 100;
        const diff = Math.abs(wPct - uPct);
        if (diff > maxDiff) {
            maxDiff = diff;
            maxDiffCh = ch;
        }
    });

    const wPct = ((weighted[maxDiffCh] / totalW) * 100).toFixed(1);
    const uPct = ((uShape[maxDiffCh] / totalU) * 100).toFixed(1);
    const ltCount = Math.round(lastTouch[maxDiffCh] || 0);
    const ftCount = Math.round(firstTouch[maxDiffCh] || 0);

    let text = `<strong>${capitalize(maxDiffCh)}</strong> показывает наибольшую разницу между моделями: `;
    text += `Weighted Score даёт <strong>${wPct}%</strong>, тогда как U-Shape — <strong>${uPct}%</strong>. `;
    text += `По Last Touch: <strong>${ltCount}</strong> продаж, по First Touch: <strong>${ftCount}</strong> продаж.`;

    if (maxDiff > 10) {
        text += `<br><br>⚠️ Разница в ${maxDiff.toFixed(1)}% — это значительно. Рекомендуем проверить баллы каналов и позиции в пути клиента.`;
    }

    // Average journey length insight
    const avgLen = allChannels.length > 0 ?
        (Object.values(lastTouch).reduce((a, b) => a + b, 0) > 0 ?
            (parsedData.length / Object.keys(lastTouch).length).toFixed(0) : '—') : '—';

    container.innerHTML = text;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
