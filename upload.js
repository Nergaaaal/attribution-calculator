// Channels Config (Same as main app)
const channels = [
    { id: 'digital', name: 'Digital Ads', icon: '🎯', score: 2, color: 'digital', aliases: ['digital', 'facebook', 'instagram', 'google', 'yandex', 'ad', 'ads', 'cpc'] },
    { id: 'stories', name: 'Stories', icon: '📱', score: 2, color: 'stories', aliases: ['stories', 'story', 'instagram stories'] },
    { id: 'push', name: 'Push', icon: '🔔', score: 3, color: 'push', aliases: ['push', 'app push', 'notification'] },
    { id: 'sms', name: 'SMS', icon: '💬', score: 3, color: 'sms', aliases: ['sms', 'message'] },
    { id: 'telemarketing', name: 'Telemarketing', icon: '📞', score: 5, color: 'telemarketing', aliases: ['telemarketing', 'call', 'phone', 'operator'] },
    { id: 'offline', name: 'Offline', icon: '🏢', score: 5, color: 'offline', aliases: ['offline', 'branch', 'office', 'store'] }
];

let processedJourneys = [];
let totalRows = 0;

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');

    fileInput.addEventListener('change', handleFileSelect);
    processBtn.addEventListener('click', processData);
});

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('fileInfo').innerText = `Выбран файл: ${file.name}`;
        document.getElementById('processBtn').style.display = 'block';
    }
}

async function processData() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;

    const btn = document.getElementById('processBtn');
    btn.disabled = true;
    btn.innerText = 'Обработка...';

    try {
        const data = await readExcel(file);
        if (!data || data.length === 0) {
            alert('Файл пуст или не удалось прочитать данные');
            return;
        }

        // Logic to group journeys
        // We look for columns like: 'Client', 'User', 'ID' AND 'Channel', 'Source' AND 'Time', 'Date'
        const journeys = groupToJourneys(data);

        if (journeys.length === 0) {
            alert('Не удалось определить цепочки. Проверьте наличие столбцов с ID клиента и Каналом.');
            return;
        }

        processedJourneys = journeys;

        // Calculate Models
        const results = calculateModels(processedJourneys);

        // Render
        renderResults(results, processedJourneys);

    } catch (err) {
        console.error(err);
        alert('Ошибка обработки файла: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Рассчитать атрибуцию';
    }
}

function readExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function groupToJourneys(rows) {
    if (rows.length === 0) return [];

    // Auto-detect columns
    const headers = Object.keys(rows[0]);

    const idCol = headers.find(h => /id|client|user|customer|клиент|userid/i.test(h));
    const channelCol = headers.find(h => /channel|source|medium|канал|источник/i.test(h));
    const timeCol = headers.find(h => /time|date|ts|время|дата/i.test(h)); // Optional

    if (!idCol || !channelCol) {
        throw new Error('Не найдены столбцы ID клиента или Канала. (Ожидаются: ClientID, Channel)');
    }

    // Group by ID
    const groups = {};
    rows.forEach(row => {
        const id = row[idCol];
        let rawChannel = String(row[channelCol]).toLowerCase().trim();

        // Map raw channel to our system channels
        const systemChannel = identifyChannel(rawChannel);

        if (id && systemChannel) {
            if (!groups[id]) groups[id] = [];
            groups[id].push({
                channel: systemChannel,
                time: row[timeCol] ? new Date(row[timeCol]) : null,
                originalTime: row[timeCol] // for debug
            });
        }
    });

    // Convert to array of { path: ['c1', 'c2'] }
    const result = Object.values(groups).map(events => {
        // Sort by time if available
        if (events[0].time) {
            events.sort((a, b) => a.time - b.time);
        }
        return {
            path: events.map(e => e.channel)
        };
    });

    return result;
}

function identifyChannel(raw) {
    // Try to match specific channel ID first
    const exact = channels.find(c => c.id === raw);
    if (exact) return exact.id;

    // Try aliases
    for (const ch of channels) {
        if (ch.aliases && ch.aliases.some(alias => raw.includes(alias))) {
            return ch.id;
        }
    }

    // Default fallback? Or ignore?
    // Let's map unknown to 'digital' if it looks like a url, otherwise maybe ignore or 'other'
    // For now, return null to ignore unknown channels (cleaner data)
    return null;
}

// --- ATTRIBUTION LOGIC (Copied & Adapted) ---

function calculateModels(dataset) {
    const weightedTotals = {};
    const uShapeTotals = {};
    const lastTouchTotals = {};
    const firstTouchTotals = {};

    channels.forEach(c => {
        weightedTotals[c.id] = 0;
        uShapeTotals[c.id] = 0;
        lastTouchTotals[c.id] = 0;
        firstTouchTotals[c.id] = 0;
    });

    dataset.forEach(row => {
        const path = row.path;
        if (path.length === 0) return;

        // 1. Weighted
        const itemScores = path.map(channelId => {
            const ch = channels.find(c => c.id === channelId);
            return { id: channelId, score: ch ? ch.score : 1 };
        });
        const sum = itemScores.reduce((a, b) => a + b.score, 0);
        if (sum > 0) {
            itemScores.forEach(item => {
                weightedTotals[item.id] += (item.score / sum);
            });
        }

        // 2. Position Based (U-Shape, First, Last) mechanism
        // Note: In upload tool, we assume NO filtered logic checkboxes by default unless requested.
        // So we use the full path.

        const n = path.length;

        // Last Touch
        lastTouchTotals[path[n - 1]] += 1;

        // First Touch
        firstTouchTotals[path[0]] += 1;

        // U-Shape
        if (n === 1) {
            uShapeTotals[path[0]] += 1;
        } else if (n === 2) {
            uShapeTotals[path[0]] += 0.5;
            uShapeTotals[path[1]] += 0.5;
        } else {
            uShapeTotals[path[0]] += 0.4;
            uShapeTotals[path[n - 1]] += 0.4;
            const mid = 0.2 / (n - 2);
            for (let k = 1; k < n - 1; k++) {
                uShapeTotals[path[k]] += mid;
            }
        }
    });

    return {
        weighted: weightedTotals,
        uShape: uShapeTotals,
        lastTouch: lastTouchTotals,
        firstTouch: firstTouchTotals
    };
}

function renderResults(results, journeys) {
    document.getElementById('uploadResults').classList.remove('hidden');
    document.getElementById('resClientCount').innerText = journeys.length;
    document.getElementById('resTouchCount').innerText = journeys.reduce((sum, j) => sum + j.path.length, 0);

    const container = document.getElementById('resultsBarsContainer');
    container.innerHTML = '';

    // Determine max value for scaling
    // We base scale on the highest First/Last touch count to fit bars
    const allValues = [
        ...Object.values(results.lastTouch),
        ...Object.values(results.weighted),
        ...Object.values(results.uShape),
        ...Object.values(results.firstTouch) // Added First Touch
    ];
    const maxVal = Math.max(...allValues) || 1;

    channels.forEach(channel => {
        const id = channel.id;
        const vLast = Math.round(results.lastTouch[id] || 0);
        const vFirst = Math.round(results.firstTouch[id] || 0);
        const vWeighted = Math.round(results.weighted[id] || 0);
        const vUShape = Math.round(results.uShape[id] || 0);

        if (vLast + vFirst + vWeighted + vUShape === 0) return;

        const pLast = (vLast / maxVal) * 100;
        const pFirst = (vFirst / maxVal) * 100;
        const pWeighted = (vWeighted / maxVal) * 100;
        const pUShape = (vUShape / maxVal) * 100;

        const html = `
            <div class="result-item" style="margin-bottom: 24px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-weight:600;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="channel-icon channel-${channel.color}">${channel.icon}</span>
                        <span>${channel.name}</span>
                    </div>
                    <div style="font-size:12px; color:#64748B;">
                        Last: ${vLast} | First: ${vFirst} | Score: ${vWeighted} | U: ${vUShape}
                    </div>
                </div>
                
                <!-- First Touch (Red/Pink) -->
                <div style="display:flex; align-items:center; margin-bottom:4px; height:12px;">
                     <div style="width:80px; font-size:10px; color:#64748B;">First Touch</div>
                     <div style="flex:1; background:#F1F5F9; border-radius:4px; height:100%;">
                        <div style="width:${pFirst}%; background:#EF4444; height:100%; border-radius:4px;"></div>
                     </div>
                </div>

                <!-- Last Touch (Gray) -->
                <div style="display:flex; align-items:center; margin-bottom:4px; height:12px;">
                     <div style="width:80px; font-size:10px; color:#64748B;">Last Touch</div>
                     <div style="flex:1; background:#F1F5F9; border-radius:4px; height:100%;">
                        <div style="width:${pLast}%; background:#CBD5E0; height:100%; border-radius:4px;"></div>
                     </div>
                </div>

                <!-- Weighted (Green) -->
                <div style="display:flex; align-items:center; margin-bottom:4px; height:12px;">
                     <div style="width:80px; font-size:10px; color:#64748B;">Weighted</div>
                     <div style="flex:1; background:#F1F5F9; border-radius:4px; height:100%;">
                        <div style="width:${pWeighted}%; background:#10B981; height:100%; border-radius:4px;"></div>
                     </div>
                </div>

                <!-- U-Shape (Blue) -->
                <div style="display:flex; align-items:center; margin-bottom:4px; height:12px;">
                     <div style="width:80px; font-size:10px; color:#64748B;">U-Shape</div>
                     <div style="flex:1; background:#F1F5F9; border-radius:4px; height:100%;">
                        <div style="width:${pUShape}%; background:#3B82F6; height:100%; border-radius:4px;"></div>
                     </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    renderTopPaths(journeys);
}

function renderTopPaths(journeys) {
    const counts = {};
    journeys.forEach(j => {
        const key = j.path.join(' → ');
        counts[key] = (counts[key] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Нет данных</td></tr>';
        return;
    }

    const total = journeys.length;

    sorted.forEach(([pathStr, count]) => {
        // Pretty print path
        const prettyPath = pathStr.split(' → ').map(id => {
            const ch = channels.find(c => c.id === id);
            return ch ? ch.name : id;
        }).join(' → ');

        const percent = ((count / total) * 100).toFixed(1);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${prettyPath}</td>
            <td style="text-align: right; font-weight:600;">${count}</td>
            <td style="text-align: right; color:#64748B;">${percent}%</td>
        `;
        tbody.appendChild(tr);
    });
}
