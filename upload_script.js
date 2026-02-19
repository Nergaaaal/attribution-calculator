// ============================================
// Upload Page — Multi-Sheet Attribution Analysis
// v6.0 — fixed client matching, loading progress, multi-sheet preview
// ============================================

let currentWorkbook = null;
let cashLoanData = [];     // { cliCode, dtOpen }
let channelEvents = [];    // { cliCode, date, channel }
let journeys = [];         // { clientId, path, dtOpen }
let detectedChannels = []; // ['stories', 'push', 'sms', ...]
let channelScores = {};    // { channelName: score }
let channelStats = {};     // { channelName: rowCount }
let sheetPreviews = {};    // { sheetName: { headers, rows, total } }

const DEFAULT_SCORE = 3;
const CHANNEL_COLORS = [
    '#3B82F6', '#ED64A6', '#ED8936', '#9F7AEA',
    '#48BB78', '#667EEA', '#F59E0B', '#EF4444',
    '#06B6D4', '#8B5CF6', '#10B981', '#F97316'
];

// Known channel sheets and their config
const CHANNEL_CONFIG = {
    'stories': { clientCol: 'CLIENT_CD', dateCol: 'EVENT_TIME', label: '📱 Stories' },
    'push': { clientCol: 'CLIENT_CD', dateCol: 'EVENT_TIME', label: '🔔 Push' },
    'sms': { clientCol: 'CLIENT_CD', dateCol: 'EVENT_TIME', label: '💬 SMS' },
    'telemarket': { clientCol: 'CLIENT_CD', dateCol: 'CREATED', label: '📞 Telemarket' },
    'banner': { clientCol: 'CLIENT_CD', dateCol: 'EVENT_TIME', label: '🖼 Banner' },
    'digital': { clientCol: 'CLIENT_CD', dateCol: 'EVENT_TIME', label: '🎯 Digital' }
};

// init() is called from HTML after script loads
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
}

// ---- FILE HANDLING ----

function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (!['xlsx', 'xls'].includes(ext)) {
        alert('Поддерживается только Excel (.xlsx, .xls) с несколькими листами');
        return;
    }

    document.getElementById('uploadInfo').style.display = 'block';
    document.getElementById('dropzone').classList.add('hidden-zone');
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileMeta').textContent = `${(file.size / 1024 / 1024).toFixed(1)} МБ`;

    // Show progress bar
    showProgress('Чтение файла...', 0);

    const reader = new FileReader();
    reader.onload = function (e) {
        // Use setTimeout to let the UI render the progress bar
        setTimeout(() => {
            try {
                parseMultiSheetExcel(e.target.result);
            } catch (err) {
                console.error('Parse error:', err);
                hideProgress();
                alert('Ошибка при чтении файла: ' + err.message);
            }
        }, 50);
    };
    reader.readAsArrayBuffer(file);
}

function showProgress(text, percent) {
    const el = document.getElementById('loadingStatus');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
        <div class="progress-wrapper">
            <div class="progress-text">${text}</div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%"></div>
            </div>
        </div>
    `;
}

function hideProgress() {
    const el = document.getElementById('loadingStatus');
    if (el) el.style.display = 'none';
}

function parseMultiSheetExcel(buffer) {
    showProgress('Парсинг Excel...', 5);

    currentWorkbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const sheetNamesLower = currentWorkbook.SheetNames.map(n => n.toLowerCase().trim());

    // Detect cash_loan sheet
    const cashLoanIdx = sheetNamesLower.findIndex(n => n === 'cash_loan' || n === 'cashloan' || n === 'loans');
    if (cashLoanIdx === -1) {
        hideProgress();
        alert('Не найден лист "cash_loan" с выдачами кредитов.');
        return;
    }

    // Parse cash_loan
    showProgress('Читаю выдачи кредитов (cash_loan)...', 10);

    // Use setTimeout for each step so UI can update
    setTimeout(() => {
        parseCashLoan(currentWorkbook.SheetNames[cashLoanIdx]);
        parseChannelSheetsSequentially(0);
    }, 30);
}

function parseChannelSheetsSequentially(index) {
    const nonLoanSheets = currentWorkbook.SheetNames.filter(name => {
        const lower = name.toLowerCase().trim();
        return lower !== 'cash_loan' && lower !== 'cashloan' && lower !== 'loans';
    });

    if (index === 0) {
        detectedChannels = [];
        channelEvents = [];
        channelStats = {};
        sheetPreviews = {};
    }

    if (index >= nonLoanSheets.length) {
        // All sheets parsed — finalize
        finalizeParsing();
        return;
    }

    const sheetName = nonLoanSheets[index];
    const lower = sheetName.toLowerCase().trim();
    const configKey = Object.keys(CHANNEL_CONFIG).find(k => lower.includes(k));

    const progressPct = 15 + Math.round((index / nonLoanSheets.length) * 70);

    if (configKey) {
        showProgress(`Читаю канал: ${sheetName} (${index + 1}/${nonLoanSheets.length})...`, progressPct);

        setTimeout(() => {
            const config = CHANNEL_CONFIG[configKey];
            const count = parseChannelSheet(sheetName, configKey, config);
            channelStats[configKey] = count;
            detectedChannels.push(configKey);

            parseChannelSheetsSequentially(index + 1);
        }, 30);
    } else {
        parseChannelSheetsSequentially(index + 1);
    }
}

function finalizeParsing() {
    hideProgress();

    if (detectedChannels.length === 0) {
        alert('Не найдены листы каналов коммуникаций.');
        return;
    }

    console.log(`Parsed: ${cashLoanData.length} loans, ${channelEvents.length} events, channels: ${detectedChannels.join(', ')}`);

    renderDetectedChannels();
    renderPreviewTabs();

    document.getElementById('channelsSummary').style.display = 'block';
    document.getElementById('previewCard').style.display = 'flex';

    const uniqueChannels = [...new Set(detectedChannels)];
    renderChannelScores(uniqueChannels);

    document.getElementById('runAnalysisBtn').style.display = 'flex';
}

function parseCashLoan(sheetName) {
    const sheet = currentWorkbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, cellDates: true });

    if (json.length < 2) {
        alert('Лист cash_loan пуст.');
        return;
    }

    const headers = json[0].map(h => String(h || '').trim().toUpperCase());

    // PRIORITY search: CLI_CODE > CLIENT_CD > CLI_ID
    let cliCodeIdx = headers.indexOf('CLI_CODE');
    if (cliCodeIdx === -1) cliCodeIdx = headers.indexOf('CLIENT_CD');
    if (cliCodeIdx === -1) cliCodeIdx = headers.indexOf('CLI_ID');

    const dtOpenIdx = headers.indexOf('DT_OPEN');

    if (cliCodeIdx === -1) {
        alert('Не найден столбец CLI_CODE / CLIENT_CD в cash_loan.');
        return;
    }
    if (dtOpenIdx === -1) {
        alert('Не найден столбец DT_OPEN в cash_loan.');
        return;
    }

    console.log(`cash_loan: using column "${headers[cliCodeIdx]}" (index ${cliCodeIdx}) for client ID`);

    cashLoanData = [];
    for (let i = 1; i < json.length; i++) {
        const row = json[i];
        const cliCode = normalizeId(row[cliCodeIdx]);
        const dtOpen = toDate(row[dtOpenIdx]);

        if (cliCode && dtOpen) {
            cashLoanData.push({ cliCode, dtOpen });
        }
    }

    // Store preview data
    sheetPreviews['cash_loan'] = {
        headers: json[0],
        rows: json.slice(1, 11),
        total: json.length - 1
    };
}

function parseChannelSheet(sheetName, channelName, config) {
    const sheet = currentWorkbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, cellDates: true });

    if (json.length < 2) return 0;

    const headers = json[0].map(h => String(h || '').trim().toUpperCase());

    // Find client column — priority search
    let clientIdx = headers.indexOf('CLIENT_CD');
    if (clientIdx === -1) clientIdx = headers.indexOf('CLI_CODE');
    if (clientIdx === -1) clientIdx = headers.indexOf('CLI_ID');

    // Find date column
    let dateIdx = headers.indexOf(config.dateCol.toUpperCase());
    if (dateIdx === -1) dateIdx = headers.indexOf('EVENT_TIME');
    if (dateIdx === -1) dateIdx = headers.indexOf('CREATED');
    if (dateIdx === -1) dateIdx = headers.indexOf('DATE');

    if (clientIdx === -1 || dateIdx === -1) {
        console.warn(`${sheetName}: client col (${clientIdx}) or date col (${dateIdx}) not found`);
        return 0;
    }

    // Store preview data
    sheetPreviews[channelName] = {
        headers: json[0],
        rows: json.slice(1, 11),
        total: json.length - 1
    };

    let count = 0;
    for (let i = 1; i < json.length; i++) {
        const row = json[i];
        const clientId = normalizeId(row[clientIdx]);
        const date = toDate(row[dateIdx]);

        if (clientId && date) {
            channelEvents.push({ cliCode: clientId, date, channel: channelName });
            count++;
        }
    }

    return count;
}

function normalizeId(val) {
    if (val === null || val === undefined || val === '') return '';
    return String(val).trim().replace(/^0+/, '') || '0';
}

function toDate(val) {
    if (val instanceof Date && !isNaN(val)) return val;
    if (typeof val === 'number') {
        // Excel serial date
        const epoch = new Date(1899, 11, 30);
        return new Date(epoch.getTime() + val * 86400000);
    }
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d) ? null : d;
    }
    return null;
}

function clearFile() {
    cashLoanData = [];
    channelEvents = [];
    detectedChannels = [];
    journeys = [];
    currentWorkbook = null;
    channelScores = {};
    channelStats = {};
    sheetPreviews = {};

    document.getElementById('uploadInfo').style.display = 'none';
    document.getElementById('dropzone').classList.remove('hidden-zone');
    document.getElementById('channelsSummary').style.display = 'none';
    document.getElementById('previewCard').style.display = 'none';
    document.getElementById('channelScoresSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('runAnalysisBtn').style.display = 'none';
    hideProgress();
    document.getElementById('fileInput').value = '';
}

// ---- DETECTED CHANNELS DISPLAY ----

function renderDetectedChannels() {
    const container = document.getElementById('channelsGrid');
    container.innerHTML = '';

    // Cash loan info
    const loanEl = document.createElement('div');
    loanEl.className = 'channel-stat-item loan-item';
    loanEl.innerHTML = `
        <div class="channel-stat-icon">🏦</div>
        <div class="channel-stat-info">
            <div class="channel-stat-name">Cash Loan (выдачи)</div>
            <div class="channel-stat-count">${cashLoanData.length.toLocaleString()} клиентов</div>
        </div>
    `;
    container.appendChild(loanEl);

    // Channel items
    detectedChannels.forEach(ch => {
        const config = CHANNEL_CONFIG[ch];
        const count = channelStats[ch] || 0;
        const el = document.createElement('div');
        el.className = 'channel-stat-item';
        el.innerHTML = `
            <div class="channel-stat-icon">${config.label.split(' ')[0]}</div>
            <div class="channel-stat-info">
                <div class="channel-stat-name">${config.label.substring(2).trim()}</div>
                <div class="channel-stat-count">${count.toLocaleString()} событий</div>
            </div>
        `;
        container.appendChild(el);
    });
}

// ---- MULTI-SHEET PREVIEW ----

function renderPreviewTabs() {
    const tabsContainer = document.getElementById('previewTabs');
    tabsContainer.innerHTML = '';

    const sheetKeys = Object.keys(sheetPreviews);

    sheetKeys.forEach((key, idx) => {
        const isLoan = key === 'cash_loan';
        const config = CHANNEL_CONFIG[key];
        const label = isLoan ? '🏦 cash_loan' : (config ? config.label : key);

        const tab = document.createElement('button');
        tab.className = 'preview-tab' + (idx === 0 ? ' active' : '');
        tab.textContent = label;
        tab.dataset.sheet = key;
        tab.onclick = () => switchPreviewTab(key);
        tabsContainer.appendChild(tab);
    });

    // Show first sheet
    if (sheetKeys.length > 0) {
        renderPreviewTable(sheetKeys[0]);
    }
}

function switchPreviewTab(sheetKey) {
    // Update active tab
    document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.preview-tab[data-sheet="${sheetKey}"]`);
    if (activeTab) activeTab.classList.add('active');

    renderPreviewTable(sheetKey);
}

function renderPreviewTable(sheetKey) {
    const data = sheetPreviews[sheetKey];
    if (!data) return;

    const head = document.getElementById('previewHead');
    const body = document.getElementById('previewBody');
    const count = document.getElementById('previewCount');

    count.textContent = `Первые ${data.rows.length} из ${data.total.toLocaleString()} строк`;

    head.innerHTML = '<tr>' + data.headers.map(h => `<th>${h || ''}</th>`).join('') + '</tr>';

    body.innerHTML = data.rows.map(row =>
        '<tr>' + data.headers.map((_, i) => {
            let val = row[i];
            if (val instanceof Date) val = val.toLocaleDateString('ru-RU');
            return `<td>${val != null ? val : ''}</td>`;
        }).join('') + '</tr>'
    ).join('');
}

// ---- CHANNEL SCORES ----

function renderChannelScores(allChannels) {
    const grid = document.getElementById('channelScoresGrid');
    grid.innerHTML = '';

    allChannels.forEach(ch => {
        if (channelScores[ch] === undefined) {
            channelScores[ch] = DEFAULT_SCORE;
        }

        const config = CHANNEL_CONFIG[ch];
        const label = config ? config.label : ch;

        const item = document.createElement('div');
        item.className = 'score-item';
        item.innerHTML = `
            <span class="score-item-name">${label}</span>
            <input type="number" value="${channelScores[ch]}" min="0.1" max="10" step="0.1"
                   data-channel="${ch}" onchange="updateScore(this)">
        `;
        grid.appendChild(item);
    });

    document.getElementById('channelScoresSection').style.display = 'block';
}

function updateScore(input) {
    channelScores[input.dataset.channel] = parseFloat(input.value) || DEFAULT_SCORE;
}

// ---- ANALYSIS ----

function runAnalysis() {
    const btn = document.getElementById('runAnalysisBtn');
    btn.innerHTML = '⏳ Расчет...';
    btn.disabled = true;

    showProgress('Построение путей клиентов...', 85);

    setTimeout(() => {
        try {
            buildJourneys();

            // Even if no journeys with comms, we might have organic.
            // But if total loans is 0, something is wrong.
            if (cashLoanData.length === 0) {
                hideProgress();
                alert('Нет данных о выдачах кредитов (cash_loan пуст).');
                return;
            }

            showProgress('Расчёт моделей атрибуции...', 92);

            setTimeout(() => {
                const allChannels = getUniqueChannels(); // Only marketing channels

                // Ensure scores exist
                allChannels.forEach(ch => {
                    if (channelScores[ch] === undefined) channelScores[ch] = DEFAULT_SCORE;
                });

                // Calculate models on journeys WITH marketing channels (excluding Organic for models)
                const marketingJourneys = journeys.filter(j => j.path.length > 0);
                const results = calculateAllModels(marketingJourneys, allChannels);

                // path frequencies (including Organic)
                const topPaths = analyzePathFrequencies();

                renderSummaryCards(allChannels, marketingJourneys.length, topPaths);
                renderAllModelResults(results, allChannels);
                renderComparisonBars(results, allChannels);
                renderScenariosTable(topPaths);
                renderInsight(results, allChannels, marketingJourneys.length);

                hideProgress();

                document.getElementById('resultsSection').style.display = 'block';
                document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

                btn.innerHTML = '<span class="arrow">▶</span> Рассчитать атрибуцию';
                btn.disabled = false;
            }, 30);

        } catch (e) {
            console.error('Analysis Error:', e);
            hideProgress();
            alert('Ошибка анализа: ' + e.message);
            btn.innerHTML = '<span class="arrow">▶</span> Рассчитать атрибуцию';
            btn.disabled = false;
        }
    }, 50);
}

function buildJourneys() {
    journeys = [];

    // Build lookup: CLI_CODE → DT_OPEN
    const loanMap = {};
    cashLoanData.forEach(loan => {
        if (!loanMap[loan.cliCode] || loan.dtOpen < loanMap[loan.cliCode]) {
            loanMap[loan.cliCode] = loan.dtOpen;
        }
    });

    console.log(`Loan map: ${Object.keys(loanMap).length} unique clients`);

    // Group channel events by client
    const clientEvents = {};
    channelEvents.forEach(evt => {
        if (!loanMap[evt.cliCode]) return;
        const dtOpen = loanMap[evt.cliCode];

        if (evt.date >= dtOpen) return;

        if (!clientEvents[evt.cliCode]) clientEvents[evt.cliCode] = [];
        clientEvents[evt.cliCode].push(evt);
    });

    // Build paths for ALL clients in loanMap
    Object.keys(loanMap).forEach(clientId => {
        const events = clientEvents[clientId] || [];

        // Sort by date
        events.sort((a, b) => a.date - b.date);

        // Raw path
        let rawPath = events.map(e => e.channel);

        // Deduplicate consecutive identical channels
        // e.g. [Push, Push, SMS, SMS, Push] -> [Push, SMS, Push]
        const simplePath = [];
        if (rawPath.length > 0) {
            simplePath.push(rawPath[0]);
            for (let i = 1; i < rawPath.length; i++) {
                if (rawPath[i] !== rawPath[i - 1]) {
                    simplePath.push(rawPath[i]);
                }
            }
        }

        // If simplePath is empty, it's Organic
        journeys.push({
            clientId,
            path: simplePath, // used for attribution
            rawPath: rawPath, // kept just in case
            dtOpen: loanMap[clientId],
            isOrganic: simplePath.length === 0
        });
    });

    console.log(`Built ${journeys.length} journeys (including Organic)`);
}

function getUniqueChannels() {
    const set = new Set();
    journeys.forEach(j => {
        if (!j.isOrganic) {
            j.path.forEach(ch => set.add(ch));
        }
    });
    return Array.from(set);
}

// ---- ATTRIBUTION CALCULATIONS ----

function calculateAllModels(marketingJourneys, allChannels) {
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

    marketingJourneys.forEach(j => {
        const path = j.path; // already deduplicated
        const n = path.length;
        if (n === 0) return;

        // Weighted Score
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

        // Last Touch
        lastTouch[path[n - 1]] = (lastTouch[path[n - 1]] || 0) + 1;

        // First Touch
        firstTouch[path[0]] = (firstTouch[path[0]] || 0) + 1;

        // U-Shape: 40% first, 40% last, 20% middle
        if (n === 1) {
            uShape[path[0]] = (uShape[path[0]] || 0) + 1;
        } else if (n === 2) {
            // Split 50/50 if only 2 touchpoints (or should it be 40/40 and 20 lost? Standard is usually 50/50 or 40/40/20 normalized)
            // User asked for: "40% First, 40% Last, 20% Middle".
            // If n=2, there is no middle. 40+40=80. Normalized -> 50/50.
            uShape[path[0]] = (uShape[path[0]] || 0) + 0.5;
            uShape[path[1]] = (uShape[path[1]] || 0) + 0.5;
        } else {
            uShape[path[0]] = (uShape[path[0]] || 0) + 0.4;
            uShape[path[n - 1]] = (uShape[path[n - 1]] || 0) + 0.4;
            const midShare = 0.2 / (n - 2);
            for (let k = 1; k < n - 1; k++) {
                uShape[path[k]] = (uShape[path[k]] || 0) + midShare;
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

    return {
        weighted: toPercent(weighted),
        uShape: toPercent(uShape),
        lastTouch: toPercent(lastTouch),
        firstTouch: toPercent(firstTouch),
        rawWeighted: weighted,
        rawUShape: uShape,
        rawLastTouch: lastTouch,
        rawFirstTouch: firstTouch
    };
}

function analyzePathFrequencies() {
    const counts = {};
    journeys.forEach(j => {
        const key = j.isOrganic ? 'Organic (Без коммуникаций)' : j.path.join(' → ');
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

function getChannelLabel(ch) {
    return CHANNEL_CONFIG[ch] ? CHANNEL_CONFIG[ch].label : ch;
}

function renderSummaryCards(allChannels, marketingCount, topPaths) {
    const totalClients = journeys.length; // This is now total cash_loan clients

    // Card 1: Total Sales (Loans)
    document.getElementById('rTotalClients').textContent = totalClients.toLocaleString();
    const totalSub = document.getElementById('rTotalClientsSub');
    totalSub.textContent = 'всего продаж';
    totalSub.className = 'card-sub text-gray';

    // Card 2: Clients with Communications (replacing Unique Channels)
    const card2Label = document.querySelectorAll('.sim-card .card-label')[1];
    card2Label.textContent = 'С КОММУНИКАЦИЯМИ';
    document.getElementById('rUniqueChannels').textContent = marketingCount.toLocaleString();
    const conversion = ((marketingCount / totalClients) * 100).toFixed(1);
    document.getElementById('rChannelsList').textContent = `${conversion}% от всех продаж`;

    // Card 3: Top Path
    if (topPaths.length > 0) {
        // Find top MARKETING path if possible, or just top overall
        const topItem = topPaths[0]; // could be Organic

        let displayPath = topItem.path;
        if (displayPath.length > 25) displayPath = displayPath.substring(0, 25) + '...';

        document.getElementById('rTopPath').textContent = displayPath;
        const pct = ((topItem.count / totalClients) * 100).toFixed(1);
        document.getElementById('rTopPathPercent').textContent = `${pct}% всех клиентов`;
    }

    // Card 4: Avg Path Length (of marketing paths only)
    let avgLen = 0;
    if (marketingCount > 0) {
        const marketingOnly = journeys.filter(j => !j.isOrganic);
        const sumLen = marketingOnly.reduce((sum, j) => sum + j.path.length, 0);
        avgLen = sumLen / marketingCount;
    }
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
        const label = getChannelLabel(ch);

        const el = document.createElement('div');
        el.className = 'result-item';
        el.innerHTML = `
            <div class="result-rank">#${index + 1}</div>
            <div class="result-header">
                <span class="result-channel-name">${label}</span>
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

    // Calculate max value for scaling bar widths
    let maxVal = 0;
    allChannels.forEach(ch => {
        maxVal = Math.max(maxVal,
            results.rawLastTouch[ch] || 0,
            results.rawFirstTouch[ch] || 0,
            results.rawWeighted[ch] || 0,
            results.rawUShape[ch] || 0
        );
    });

    if (maxVal === 0) maxVal = 1;

    allChannels.forEach((ch, idx) => {
        const valLast = Math.round(results.rawLastTouch[ch] || 0);
        const valFirst = Math.round(results.rawFirstTouch[ch] || 0);
        const valWeighted = Math.round(results.rawWeighted[ch] || 0);
        const valUShape = Math.round(results.rawUShape[ch] || 0);
        const label = getChannelLabel(ch);

        if (valLast + valFirst + valWeighted + valUShape === 0) return;

        const wLast = (valLast / maxVal) * 100;
        const wFirst = (valFirst / maxVal) * 100;
        const wWeighted = (valWeighted / maxVal) * 100;
        const wUShape = (valUShape / maxVal) * 100;

        const html = `
            <div class="bar-group">
                <div class="bar-group-header">
                    <span>${label}</span>
                    <span class="bar-stats">
                        L: ${valLast} | F: ${valFirst} | U: ${valUShape}
                    </span>
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
        const isOrganic = item.path.includes('Organic');
        const pathStyle = isOrganic ? 'color: #64748B; font-style: italic;' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="${pathStyle}">${item.path}</td>
            <td class="col-number" style="width: 110px; text-align: right;"><strong>${item.count.toLocaleString()}</strong></td>
            <td class="col-number" style="width: 110px; text-align: right; color:#64748B">${pct}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderInsight(results, allChannels, marketingCount) {
    const container = document.getElementById('uploadInsightText');
    if (!container) return;

    const totalClients = journeys.length;
    const organicCount = totalClients - marketingCount;
    const organicPct = ((organicCount / totalClients) * 100).toFixed(1);
    const marketingPct = ((marketingCount / totalClients) * 100).toFixed(1);

    let text = `📊 <b>Общая статистика:</b><br>`;
    text += `Всего продаж: <b>${totalClients.toLocaleString()}</b>.<br>`;
    text += `Органический трафик (без касаний): <b>${organicCount.toLocaleString()}</b> (${organicPct}%).<br>`;
    text += `С маркетинговыми касаниями: <b>${marketingCount.toLocaleString()}</b> (${marketingPct}%).`;

    if (marketingCount > 0) {
        const avgLen = (journeys.filter(j => !j.isOrganic).reduce((sum, j) => sum + j.path.length, 0) / marketingCount).toFixed(1);
        text += `<br><br>📈 <b>Анализ путей (среди клиентов с коммуникацией):</b><br>`;
        text += `Среднее число касаний: ${avgLen}. `;

        if (parseFloat(avgLen) <= 1.2) {
            text += 'В основном клиенты совершают покупку после единственного касания.';
        } else {
            text += 'Заметна многоканальность — клиенты взаимодействуют с брендом несколько раз.';
        }

        // Top channel
        const topCh = Object.keys(results.weighted).sort((a, b) => results.weighted[b] - results.weighted[a])[0];
        if (topCh) {
            text += `<br><br>🏆 <b>Лидер влияния:</b> ${getChannelLabel(topCh)} (${results.weighted[topCh].toFixed(1)}% вклада).`;
        }
    }

    container.innerHTML = text;
}
