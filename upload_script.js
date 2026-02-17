// ============================================
// Upload Page — CSV/Excel Attribution Analysis
// v4.0 — channel scores, date sorting, fixed models
// ============================================

let uploadedData = [];
let fileHeaders = [];
let channelColumns = [];
let clientIdColumn = 0;
let dateColumn = -1;
let journeys = [];
let currentWorkbook = null;
let channelScores = {}; // { channelName: score }

const DEFAULT_SCORE = 3;
const CHANNEL_COLORS = [
    '#3B82F6', '#ED64A6', '#ED8936', '#9F7AEA',
    '#48BB78', '#667EEA', '#F59E0B', '#EF4444',
    '#06B6D4', '#8B5CF6', '#10B981', '#F97316'
];

document.addEventListener('DOMContentLoaded', init);

function init() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });

    document.getElementById('clearFileBtn').addEventListener('click', clearFile);
    document.getElementById('runAnalysisBtn').addEventListener('click', runAnalysis);
    document.getElementById('sheetSelect').addEventListener('change', onSheetChange);
}

// ---- FILE HANDLING ----

function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        alert('Поддерживаемые форматы: .csv, .xlsx, .xls');
        return;
    }

    document.getElementById('uploadInfo').style.display = 'block';
    document.getElementById('dropzone').classList.add('hidden-zone');
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileMeta').textContent = `${(file.size / 1024).toFixed(1)} Кб`;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            if (ext === 'csv') {
                document.getElementById('sheetSelector').style.display = 'none';
                currentWorkbook = null;
                parseCSV(e.target.result);
            } else {
                parseExcel(e.target.result);
            }
        } catch (err) {
            console.error('Parse error:', err);
            alert('Ошибка при чтении файла: ' + err.message);
        }
    };

    if (ext === 'csv') {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function parseCSV(text) {
    const firstLine = text.split('\n')[0];
    const separator = firstLine.includes(';') ? ';' : ',';

    const lines = text.trim().split('\n');
    fileHeaders = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));

    uploadedData = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length >= fileHeaders.length && values.some(v => v)) {
            uploadedData.push(values);
        }
    }

    onDataLoaded();
}

function parseExcel(buffer) {
    currentWorkbook = XLSX.read(buffer, { type: 'array' });

    const sheetSelect = document.getElementById('sheetSelect');
    sheetSelect.innerHTML = currentWorkbook.SheetNames.map((name, i) =>
        `<option value="${i}" ${i === 0 ? 'selected' : ''}>${name}</option>`
    ).join('');

    if (currentWorkbook.SheetNames.length > 1) {
        document.getElementById('sheetSelector').style.display = 'flex';
    } else {
        document.getElementById('sheetSelector').style.display = 'none';
    }

    loadSheet(0);
}

function onSheetChange() {
    const idx = parseInt(document.getElementById('sheetSelect').value);
    loadSheet(idx);
}

function loadSheet(index) {
    if (!currentWorkbook) return;

    const sheetName = currentWorkbook.SheetNames[index];
    const sheet = currentWorkbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (json.length < 2) {
        alert('Лист пуст или содержит только заголовки.');
        return;
    }

    fileHeaders = json[0].map(h => String(h || '').trim());
    uploadedData = json.slice(1).filter(row => row.some(v => v !== null && v !== undefined && v !== ''));

    onDataLoaded();
}

function onDataLoaded() {
    renderPreview();
    renderColumnMapping();
    document.getElementById('previewCard').style.display = 'flex';
    document.getElementById('columnMapping').style.display = 'block';
}

function clearFile() {
    uploadedData = [];
    fileHeaders = [];
    channelColumns = [];
    journeys = [];
    currentWorkbook = null;
    channelScores = {};

    document.getElementById('uploadInfo').style.display = 'none';
    document.getElementById('dropzone').classList.remove('hidden-zone');
    document.getElementById('previewCard').style.display = 'none';
    document.getElementById('columnMapping').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('sheetSelector').style.display = 'none';
    document.getElementById('channelScoresSection').style.display = 'none';
    document.getElementById('fileInput').value = '';
}

// ---- DATA PREVIEW ----

function renderPreview() {
    const head = document.getElementById('previewHead');
    const body = document.getElementById('previewBody');
    const count = document.getElementById('previewCount');

    const showRows = Math.min(uploadedData.length, 10);
    count.textContent = `Первые ${showRows} из ${uploadedData.length} строк`;

    head.innerHTML = '<tr>' + fileHeaders.map(h => `<th>${h}</th>`).join('') + '</tr>';

    const preview = uploadedData.slice(0, 10);
    body.innerHTML = preview.map(row =>
        '<tr>' + fileHeaders.map((_, i) => `<td>${row[i] != null ? row[i] : ''}</td>`).join('') + '</tr>'
    ).join('');
}

// ---- COLUMN MAPPING ----

function renderColumnMapping() {
    const optionsHtml = '<option value="">— Выберите —</option>' +
        fileHeaders.map((h, i) => `<option value="${i}">${h}</option>`).join('');

    document.getElementById('colClientId').innerHTML = optionsHtml;
    document.getElementById('colChannel').innerHTML = optionsHtml;
    document.getElementById('colDate').innerHTML = optionsHtml;

    fileHeaders.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (lower.includes('id') || lower.includes('клиент') || lower.includes('client') || lower.includes('_cd')) {
            document.getElementById('colClientId').value = i;
        }
        if (lower.includes('канал') || lower.includes('channel') || lower.includes('отделение') || lower.includes('source') || lower.includes('medium') || lower.includes('event_type') || lower.includes('тип')) {
            document.getElementById('colChannel').value = i;
        }
        if (lower.includes('дата') || lower.includes('date') || lower.includes('время') || lower.includes('time') || lower.includes('регистрац')) {
            document.getElementById('colDate').value = i;
        }
    });
}

// ---- CHANNEL SCORES UI ----

function renderChannelScores(allChannels) {
    const grid = document.getElementById('channelScoresGrid');
    grid.innerHTML = '';

    allChannels.forEach(ch => {
        // Keep existing score or default to 3
        if (channelScores[ch] === undefined) {
            channelScores[ch] = DEFAULT_SCORE;
        }

        const item = document.createElement('div');
        item.className = 'score-item';
        item.innerHTML = `
            <span class="score-item-name">${ch}</span>
            <input type="number" value="${channelScores[ch]}" min="0.1" max="10" step="0.1"
                   data-channel="${ch}" onchange="updateScore(this)">
        `;
        grid.appendChild(item);
    });

    document.getElementById('channelScoresSection').style.display = 'block';
}

function updateScore(input) {
    const ch = input.dataset.channel;
    channelScores[ch] = parseFloat(input.value) || DEFAULT_SCORE;
}

// ---- ANALYSIS ----

function runAnalysis() {
    const btn = document.getElementById('runAnalysisBtn');
    btn.innerHTML = 'Расчет...';
    btn.disabled = true;

    setTimeout(() => {
        try {
            const clientIdVal = document.getElementById('colClientId').value;
            const channelVal = document.getElementById('colChannel').value;
            const dateVal = document.getElementById('colDate').value;

            if (!clientIdVal && clientIdVal !== '0') {
                alert('Выберите столбец с ID клиента.');
                return;
            }
            if (!channelVal && channelVal !== '0') {
                alert('Выберите столбец с каналом коммуникации.');
                return;
            }

            clientIdColumn = parseInt(clientIdVal);
            channelColumns = [parseInt(channelVal)];
            dateColumn = (dateVal !== '' && dateVal !== undefined) ? parseInt(dateVal) : -1;

            buildJourneys();

            if (journeys.length === 0) {
                alert('Не удалось построить пути клиентов. Проверьте данные.');
                return;
            }

            const allChannels = getUniqueChannels();

            // Show score inputs
            renderChannelScores(allChannels);

            const results = calculateAllModels(allChannels);
            const topPaths = analyzePathFrequencies();

            renderSummaryCards(allChannels, topPaths);
            renderAllModelResults(results, allChannels);
            renderComparisonBars(results, allChannels);
            renderScenariosTable(topPaths);
            renderInsight(results, allChannels);

            document.getElementById('resultsSection').style.display = 'block';
            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (e) {
            console.error('Analysis Error:', e);
            alert('Ошибка анализа: ' + e.message);
        } finally {
            btn.innerHTML = '<span class="arrow">▶</span> Рассчитать атрибуцию';
            btn.disabled = false;
        }
    }, 300);
}

function buildJourneys() {
    journeys = [];

    // Collect all rows per client with their date (if available)
    const clientMap = {};

    uploadedData.forEach((row, rowIndex) => {
        const clientId = String(row[clientIdColumn] || '').trim();
        if (!clientId) return;

        const channelValue = String(row[channelColumns[0]] || '').trim();
        if (!channelValue || channelValue === '0' || channelValue === '-' ||
            channelValue.toLowerCase() === 'null' || channelValue.toLowerCase() === 'nan') return;

        let dateValue = null;
        if (dateColumn >= 0) {
            dateValue = row[dateColumn];
        }

        if (!clientMap[clientId]) {
            clientMap[clientId] = [];
        }
        clientMap[clientId].push({
            channel: channelValue,
            date: dateValue,
            rowOrder: rowIndex
        });
    });

    // Sort each client's touches by date (chronological), then by row order
    Object.keys(clientMap).forEach(clientId => {
        const touches = clientMap[clientId];

        // Sort by date if available
        touches.sort((a, b) => {
            if (a.date != null && b.date != null) {
                const da = new Date(a.date);
                const db = new Date(b.date);
                if (!isNaN(da) && !isNaN(db)) {
                    return da - db;
                }
            }
            return a.rowOrder - b.rowOrder;
        });

        const path = touches.map(t => t.channel);
        if (path.length > 0) {
            journeys.push({ clientId, path });
        }
    });
}

function getUniqueChannels() {
    const set = new Set();
    journeys.forEach(j => j.path.forEach(ch => set.add(ch)));
    return Array.from(set);
}

// ---- ATTRIBUTION CALCULATIONS ----

function calculateAllModels(allChannels) {
    const weighted = {};
    const uShape = {};
    const lastTouch = {};
    const firstTouch = {};

    allChannels.forEach(ch => {
        weighted[ch] = 0;
        uShape[ch] = 0;
        lastTouch[ch] = 0;
        firstTouch[ch] = 0;
    });

    journeys.forEach(j => {
        const path = j.path;
        const n = path.length;
        if (n === 0) return;

        // ---- Weighted Score (using channel scores) ----
        let totalScore = 0;
        const scores = path.map(ch => {
            const s = channelScores[ch] !== undefined ? channelScores[ch] : DEFAULT_SCORE;
            totalScore += s;
            return s;
        });

        if (totalScore > 0) {
            path.forEach((ch, idx) => {
                weighted[ch] = (weighted[ch] || 0) + (scores[idx] / totalScore);
            });
        }

        // ---- Last Touch: count last channel per journey ----
        const lastCh = path[n - 1];
        if (!lastTouch._counts) lastTouch._counts = {};
        lastTouch._counts[lastCh] = (lastTouch._counts[lastCh] || 0) + 1;

        // ---- First Touch: count first channel per journey ----
        const firstCh = path[0];
        if (!firstTouch._counts) firstTouch._counts = {};
        firstTouch._counts[firstCh] = (firstTouch._counts[firstCh] || 0) + 1;

        // ---- U-Shape: only for 2+ touchpoints ----
        // Single-touch journeys are excluded — U-Shape is position-based
        if (n >= 2) {
            if (n === 2) {
                uShape[path[0]] = (uShape[path[0]] || 0) + 0.5;
                uShape[path[1]] = (uShape[path[1]] || 0) + 0.5;
            } else {
                uShape[path[0]] = (uShape[path[0]] || 0) + 0.4;
                uShape[path[n - 1]] = (uShape[path[n - 1]] || 0) + 0.4;
                const mid = 0.2 / (n - 2);
                for (let k = 1; k < n - 1; k++) {
                    uShape[path[k]] = (uShape[path[k]] || 0) + mid;
                }
            }
        }
    });

    const toPercent = (obj) => {
        const total = Object.values(obj).reduce((a, b) => a + b, 0);
        const result = {};
        if (total > 0) {
            Object.keys(obj).forEach(k => {
                result[k] = (obj[k] / total) * 100;
            });
        }
        return result;
    };

    // Last Touch: 100% to the single most frequent last channel
    const lastCounts = lastTouch._counts || {};
    let maxLastCh = null, maxLastCount = 0;
    Object.keys(lastCounts).forEach(ch => {
        if (lastCounts[ch] > maxLastCount) {
            maxLastCount = lastCounts[ch];
            maxLastCh = ch;
        }
    });
    const lastTouchResult = {};
    allChannels.forEach(ch => lastTouchResult[ch] = 0);
    if (maxLastCh) lastTouchResult[maxLastCh] = 100;

    // First Touch: 100% to the single most frequent first channel
    const firstCounts = firstTouch._counts || {};
    let maxFirstCh = null, maxFirstCount = 0;
    Object.keys(firstCounts).forEach(ch => {
        if (firstCounts[ch] > maxFirstCount) {
            maxFirstCount = firstCounts[ch];
            maxFirstCh = ch;
        }
    });
    const firstTouchResult = {};
    allChannels.forEach(ch => firstTouchResult[ch] = 0);
    if (maxFirstCh) firstTouchResult[maxFirstCh] = 100;

    return {
        weighted: toPercent(weighted),
        uShape: toPercent(uShape),
        lastTouch: lastTouchResult,
        firstTouch: firstTouchResult,
        rawWeighted: weighted,
        rawUShape: uShape,
        rawLastTouch: lastCounts,
        rawFirstTouch: firstCounts
    };
}

function analyzePathFrequencies() {
    const counts = {};
    journeys.forEach(j => {
        const key = j.path.join(' → ');
        counts[key] = (counts[key] || 0) + 1;
    });

    return Object.keys(counts)
        .map(key => ({ path: key, count: counts[key] }))
        .sort((a, b) => b.count - a.count);
}

// ---- RENDERING ----

function getChannelColor(index) {
    return CHANNEL_COLORS[index % CHANNEL_COLORS.length];
}

function renderSummaryCards(allChannels, topPaths) {
    document.getElementById('rTotalClients').textContent = journeys.length;
    document.getElementById('rTotalClientsSub').textContent = `${topPaths.length} уникальных путей`;
    document.getElementById('rUniqueChannels').textContent = allChannels.length;
    document.getElementById('rChannelsList').textContent = allChannels.slice(0, 4).join(', ') + (allChannels.length > 4 ? '...' : '');

    if (topPaths.length > 0) {
        document.getElementById('rTopPath').textContent = topPaths[0].path;
        const pct = ((topPaths[0].count / journeys.length) * 100).toFixed(1);
        document.getElementById('rTopPathPercent').textContent = `${pct}% от всех клиентов`;
    }

    const avgLen = journeys.reduce((sum, j) => sum + j.path.length, 0) / journeys.length;
    document.getElementById('rAvgLength').textContent = avgLen.toFixed(1);
}

function renderModelResults(attribution, containerId, allChannels) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sortedKeys = Object.keys(attribution).sort((a, b) => attribution[b] - attribution[a]);

    if (sortedKeys.length === 0) {
        container.innerHTML = '<div class="sim-empty-state"><div class="empty-icon">✨</div><div class="empty-text">Нет данных</div></div>';
        return;
    }

    container.innerHTML = '';

    sortedKeys.forEach((ch, index) => {
        const pct = attribution[ch] || 0;

        const colorIdx = allChannels.indexOf(ch);
        const color = getChannelColor(colorIdx);

        const el = document.createElement('div');
        el.className = 'result-item';
        el.innerHTML = `
            <div class="result-rank">#${index + 1}</div>
            <div class="result-header">
                <span class="result-channel-name">${ch}</span>
            </div>
            <div class="result-percent">${pct.toFixed(1)}%</div>
            <div class="result-bar-container">
                <div class="result-bar" style="width: ${pct}%; background-color: ${color};"></div>
            </div>
        `;
        container.appendChild(el);
    });
}

function renderAllModelResults(results, allChannels) {
    renderModelResults(results.weighted, 'uploadWeightedResults', allChannels);
    renderModelResults(results.uShape, 'uploadUShapeResults', allChannels);
    renderModelResults(results.lastTouch, 'uploadLastTouchResults', allChannels);
    renderModelResults(results.firstTouch, 'uploadFirstTouchResults', allChannels);
}

function renderComparisonBars(results, allChannels) {
    const container = document.getElementById('uploadBarsContainer');
    container.innerHTML = '';

    const totalJourneys = journeys.length;
    const maxBase = totalJourneys * 0.8 || 1;

    allChannels.forEach((ch, idx) => {
        const valLast = Math.round(results.rawLastTouch[ch] || 0);
        const valFirst = Math.round(results.rawFirstTouch[ch] || 0);
        const valWeighted = Math.round(results.rawWeighted[ch] || 0);
        const valUShape = Math.round(results.rawUShape[ch] || 0);

        if (valLast + valFirst + valWeighted + valUShape === 0) return;

        const scale = maxBase || 1;
        const wLast = Math.min((valLast / scale) * 100, 100);
        const wFirst = Math.min((valFirst / scale) * 100, 100);
        const wWeighted = Math.min((valWeighted / scale) * 100, 100);
        const wUShape = Math.min((valUShape / scale) * 100, 100);

        const html = `
            <div class="bar-group">
                <div class="bar-group-header">
                    <span>${ch}</span>
                    <span class="bar-stats">Last: ${valLast} | First: ${valFirst} | Score: ${valWeighted} | U: ${valUShape}</span>
                </div>
                ${wLast > 0 ? `<div class="bar-row"><div class="bar-fill fill-gray" style="width: ${wLast}%"></div></div>` : ''}
                ${wFirst > 0 ? `<div class="bar-row"><div class="bar-fill fill-green" style="width: ${wFirst}%"></div></div>` : ''}
                ${wWeighted > 0 ? `<div class="bar-row"><div class="bar-fill fill-purple" style="width: ${wWeighted}%"></div></div>` : ''}
                ${wUShape > 0 ? `<div class="bar-row"><div class="bar-fill fill-blue" style="width: ${wUShape}%"></div></div>` : ''}
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderScenariosTable(topPaths) {
    const tbody = document.getElementById('uploadTableBody');
    tbody.innerHTML = '';

    const totalCount = journeys.length || 1;

    if (topPaths.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Нет данных</td></tr>';
        return;
    }

    topPaths.forEach((item, index) => {
        const pct = ((item.count / totalCount) * 100).toFixed(1);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.path}</td>
            <td class="col-number" style="width: 110px; text-align: right;"><strong>${item.count}</strong></td>
            <td class="col-number" style="width: 110px; text-align: right; color:#64748B">${pct}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderInsight(results, allChannels) {
    const container = document.getElementById('uploadInsightText');
    if (!container) return;

    let maxDiffChannel = '';
    let maxDiff = 0;

    allChannels.forEach(ch => {
        const uVal = results.uShape[ch] || 0;
        const wVal = results.weighted[ch] || 0;
        const diff = Math.abs(uVal - wVal);
        if (diff > maxDiff) {
            maxDiff = diff;
            maxDiffChannel = ch;
        }
    });

    let text = '';

    if (maxDiffChannel && maxDiff > 1) {
        const uVal = results.uShape[maxDiffChannel] || 0;
        const wVal = results.weighted[maxDiffChannel] || 0;

        if (uVal > wVal) {
            text += `<b>${maxDiffChannel}</b> получает на <b>${(uVal - wVal).toFixed(1)}%</b> больше атрибуции в U-Shape модели, чем в Weighted. Это означает, что канал часто стоит на первой или последней позиции в пути клиента.`;
        } else {
            text += `<b>${maxDiffChannel}</b> получает на <b>${(wVal - uVal).toFixed(1)}%</b> больше атрибуции в Weighted модели, чем в U-Shape. Это означает, что канал часто участвует в пути, но не как первый или последний контакт.`;
        }
    } else {
        text += 'Модели показывают схожие результаты для всех каналов.';
    }

    const avgLen = (journeys.reduce((sum, j) => sum + j.path.length, 0) / journeys.length).toFixed(1);
    text += `<br><br>📊 <b>Средняя длина пути:</b> ${avgLen} касаний. `;

    if (parseFloat(avgLen) <= 1.5) {
        text += 'Большинство клиентов принимают решение после 1-2 контактов — Last Touch и First Touch дадут похожие результаты.';
    } else if (parseFloat(avgLen) <= 3) {
        text += 'Клиенты проходят через несколько касаний — U-Shape модель хорошо подходит для оценки.';
    } else {
        text += 'Длинные пути клиентов — рекомендуется использовать Weighted или U-Shape для корректной атрибуции.';
    }

    container.innerHTML = text;
}
