const channels = [
    { id: 'digital', name: 'Digital Ads', icon: '🎯', score: 1, color: 'digital' },
    { id: 'stories', name: 'Stories', icon: '📱', score: 2, color: 'stories' },
    { id: 'push', name: 'Push', icon: '🔔', score: 3, color: 'push' },
    { id: 'sms', name: 'SMS', icon: '💬', score: 3, color: 'sms' },
    { id: 'telemarketing', name: 'Telemarketing', icon: '📞', score: 5, color: 'telemarketing' },
    { id: 'offline', name: 'Offline', icon: '🏢', score: 5, color: 'offline' }
];

let journey = [];

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
    renderChannels();
    updateAllResults();
    renderSimFilters(); // Init simulation filters

    // Initial State: Empty Journey
    renderJourney();

    // Clear journey button
    document.getElementById('clearJourney').addEventListener('click', () => {
        journey = [];
        renderJourney();
        updateAllResults();
    });
}

function renderChannels() {
    const grid = document.getElementById('channelsGrid');
    grid.innerHTML = '';

    channels.forEach((channel, index) => {
        const channelEl = document.createElement('div');
        channelEl.className = 'channel-item';
        channelEl.innerHTML = `
            <div class="channel-icon channel-${channel.color}">${channel.icon}</div>
            <div class="channel-name">${channel.name}</div>
            <div class="channel-score">
                <input 
                    type="number" 
                    value="${channel.score}" 
                    min="0.1" 
                    max="10"
                    step="0.1"
                    data-channel-id="${channel.id}"
                    onchange="updateChannelScore('${channel.id}', this.value)"
                >
                <button class="add-btn" onclick="addToJourney('${channel.id}')">+</button>
            </div>
        `;
        grid.appendChild(channelEl);
    });
}

function updateChannelScore(channelId, newScore) {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
        channel.score = parseFloat(newScore);
        renderJourney();
        updateAllResults();
    }
}

function addToJourney(channelId) {
    if (journey.length < 8) {
        journey.push(channelId);
        renderJourney();
        updateAllResults();
    } else {
        alert('Максимальная длина цепочки - 8 каналов');
    }
}

function renderJourney() {
    const container = document.getElementById('journeyPath');

    if (journey.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Выберите каналы из списка выше, чтобы построить путь клиента</p>
            </div>
        `;
        document.getElementById('totalScore').innerText = '0';
        return;
    }

    container.innerHTML = '';
    let totalScore = 0;

    // Use a wrapper for horizontal layout if needed, but style.css handles .journey-steps
    const stepsWrapper = document.createElement('div');
    stepsWrapper.className = 'journey-steps';

    journey.forEach((channelId, index) => {
        const channel = channels.find(c => c.id === channelId);
        totalScore += channel.score;

        const node = document.createElement('div');
        node.className = 'journey-step';
        node.innerHTML = `
            <div class="step-number">${index + 1}</div>
            <div class="step-icon channel-${channel.color}">${channel.icon}</div>
            <div class="step-info">
                <div class="step-name">${channel.name}</div>
                <div class="step-description">(${channel.score} балла)</div>
            </div>
            <button class="delete-btn" onclick="removeFromJourney(${index})">×</button>
        `;
        stepsWrapper.appendChild(node);
    });

    container.appendChild(stepsWrapper);

    document.getElementById('totalScore').innerText = totalScore.toFixed(1);
}

function removeFromJourney(index) {
    journey.splice(index, 1);
    renderJourney();
    updateAllResults();
}

// --- ATTRIBUTION LOGIC ---

function updateAllResults() {
    const weighted = calculateWeightedScore();
    renderResults(weighted, 'weightedResults');

    const uShape = calculateUShape();
    renderResults(uShape, 'ushapeResults');

    const lastTouch = calculateLastTouch();
    renderResults(lastTouch, 'lastTouchResults');

    const firstTouch = calculateFirstTouch();
    renderResults(firstTouch, 'firstTouchResults');

    renderAttributionInsights({
        weightedScore: weighted,
        uShape: uShape
    });
}

function getFilteredJourney() {
    return journey;
}

function calculateWeightedScore() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};

    let sum = 0;
    const channelScores = filtered.map(id => {
        const ch = channels.find(c => c.id === id);
        return ch ? ch.score : 0;
    });
    sum = channelScores.reduce((a, b) => a + b, 0);

    if (sum === 0) return {};

    const result = {};
    filtered.forEach((id, idx) => {
        const score = channelScores[idx];
        const share = (score / sum) * 100;
        result[id] = (result[id] || 0) + share;
    });

    return result;
}

function calculateUShape() {
    const filtered = getFilteredJourney();
    const n = filtered.length;
    if (n === 0) return {};

    const result = {};
    filtered.forEach(id => result[id] = 0);

    if (n === 1) {
        result[filtered[0]] = 100;
    } else if (n === 2) {
        result[filtered[0]] += 50;
        result[filtered[1]] += 50;
    } else {
        result[filtered[0]] += 40;
        result[filtered[n - 1]] += 40;
        const middleShare = 20 / (n - 2);
        for (let i = 1; i < n - 1; i++) {
            result[filtered[i]] += middleShare;
        }
    }

    return result;
}

function calculateLastTouch() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};
    const lastChannelId = filtered[filtered.length - 1];
    return { [lastChannelId]: 100 };
}

function calculateFirstTouch() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};
    const firstChannelId = filtered[0];
    return { [firstChannelId]: 100 };
}

// Render attribution results (Restored "Old" Design)
function renderResults(attribution, containerId) {
    const container = document.getElementById(containerId);

    if (Object.keys(attribution).length === 0) {
        container.innerHTML = `
            <div class="empty-results">
                <p>Добавьте каналы в путь клиента для расчета атрибуции</p>
            </div>
        `;
        return;
    }

    // Sort by value desc
    const sortedKeys = Object.keys(attribution).sort((a, b) => attribution[b] - attribution[a]);

    container.innerHTML = '';

    sortedKeys.forEach((channelId) => {
        const channel = channels.find(c => c.id === channelId);
        if (!channel) return;

        const percentage = attribution[channelId];
        if (percentage < 0.1) return;

        let colorClass = 'gray';
        if (containerId.includes('weighted')) colorClass = 'green';
        if (containerId.includes('ushape')) colorClass = 'blue';

        const resultEl = document.createElement('div');
        resultEl.className = 'result-item';
        resultEl.innerHTML = `
            <div class="result-header">
                <span class="result-channel-icon">${channel.icon}</span>
                <span class="result-channel-name">${channel.name}</span>
            </div>
            <div class="result-bar-container">
                <div class="result-bar result-bar-${colorClass}" style="width: ${percentage}%">
                    ${percentage.toFixed(1)}%
                </div>
            </div>
        `;
        container.appendChild(resultEl);
    });
}

function renderAttributionInsights(results) {
    const container = document.getElementById('attributionInsights');
    if (!container) return;

    const discrepancies = [];
    const weightedScores = results.weightedScore || {};
    const uShapeScores = results.uShape || {};

    channels.forEach(channel => {
        const weighted = weightedScores[channel.id] || 0;
        const uShape = uShapeScores[channel.id] || 0;
        const diff = weighted - uShape;
        if (diff !== 0) {
            discrepancies.push({ channel: channel, diff: diff });
        }
    });

    if (discrepancies.length === 0) {
        container.innerHTML = '';
        return;
    }

    discrepancies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    const top = discrepancies[0];
    const isOvervalued = top.diff > 0;

    let message;
    const diffPercent = Math.abs(top.diff).toFixed(0);

    if (isOvervalued) {
        message = `По сравнению с рыночным стандартом (U-Shape), Ваша модель <strong>переоценивает</strong> канал 
            <span class="insights-highlight">${top.channel.name}</span> 
            на <strong>${diffPercent}%</strong>. Это может привести к излишнему финансированию этого канала.`;
    } else {
        message = `По сравнению с рыночным стандартом (U-Shape), Ваша модель <strong>недооценивает</strong> канал 
            <span class="insights-highlight">${top.channel.name}</span> 
            на <strong>${diffPercent}%</strong>. Это может привести к ошибочному решению сократить бюджет на этот канал.`;
    }

    container.innerHTML = `
        <div class="insights-header">
            <span class="icon">💡</span>
            <h3>Анализ расхождений:</h3>
        </div>
        <div class="insights-content">
            ${message}
        </div>
    `;
}


// -------------------------------------------------------------
// FILTER CHIPS LOGIC
// -------------------------------------------------------------
let selectedSimFilters = [];

function renderSimFilters() {
    const container = document.getElementById('simChannelToggles');
    if (!container) return;

    container.innerHTML = '';
    channels.forEach(ch => {
        const chip = document.createElement('div');
        chip.className = `filter-chip ${selectedSimFilters.includes(ch.id) ? 'selected' : ''}`;
        chip.innerText = ch.name;
        chip.onclick = () => toggleSimFilter(ch.id);
        container.appendChild(chip);
    });
}

function toggleSimFilter(id) {
    if (selectedSimFilters.includes(id)) {
        selectedSimFilters = selectedSimFilters.filter(f => f !== id);
    } else {
        selectedSimFilters.push(id);
    }
    renderSimFilters();
}


// -------------------------------------------------------------
// ADVANCED SIMULATION DASHBOARD LOGIC (v2.1 - With Filters)
// -------------------------------------------------------------

document.getElementById('runSimulationBtn').addEventListener('click', runAdvancedSimulation);

function runAdvancedSimulation() {
    const btn = document.getElementById('runSimulationBtn');
    const inputCount = document.getElementById('simCount');
    const checkStories = document.getElementById('simCheckStories');
    const checkOffline = document.getElementById('simCheckOffline');
    const resultsDiv = document.getElementById('simulationResults');

    const totalSimCount = parseInt(inputCount.value) || 8000;
    const applyStoriesLogic = checkStories.checked;
    const applyOfflineLogic = checkOffline.checked;

    btn.innerHTML = 'Моделирование...';
    btn.disabled = true;

    setTimeout(() => {
        // 1. Generate Full Dataset
        const fullJourneys = generateRealisticJourneys(totalSimCount);

        // 2. Apply Filters
        let filteredJourneys = fullJourneys;
        if (selectedSimFilters.length > 0) {
            filteredJourneys = fullJourneys.filter(item => {
                return selectedSimFilters.every(filterId => item.path.includes(filterId));
            });
        }

        const filteredCount = filteredJourneys.length;

        // 3. Calculate Models on FILTERED data
        const results = calculateThreeModels(filteredJourneys, applyStoriesLogic, applyOfflineLogic);

        // 4. Find Top Scenarios
        const topPaths = analyzePathFrequencies(filteredJourneys);

        // 5. Update UI Components
        resultsDiv.classList.remove('hidden');

        // Cards
        if (selectedSimFilters.length > 0) {
            document.getElementById('resTotalSales').innerHTML = `${filteredCount} <span style="font-size:14px; color:#94A3B8">из ${totalSimCount}</span>`;
            document.getElementById('resTotalSales').nextElementSibling.innerText = 'По выбранным каналам';
        } else {
            document.getElementById('resTotalSales').innerText = totalSimCount;
            document.getElementById('resTotalSales').nextElementSibling.innerText = '100% конверсия';
        }

        // Top Path
        if (topPaths.length > 0) {
            const bestPath = topPaths[0];
            const bestPathStr = bestPath.path.map(id => getChannelName(id)).join(' → ');
            const bestPathPercent = ((bestPath.count / filteredCount) * 100).toFixed(1) + '% от выборки';
            document.getElementById('resTopPath').innerText = bestPathStr;
            document.getElementById('resTopPathPercent').innerText = bestPathPercent;
        } else {
            document.getElementById('resTopPath').innerText = "-";
            document.getElementById('resTopPathPercent').innerText = "";
        }

        // Digital Diff
        const digitalId = 'digital';
        const uShapeDigital = results.uShape[digitalId] || 0;
        const weightedDigital = results.weighted[digitalId] || 0;
        let diffPercent = 0;
        if (weightedDigital > 0) {
            diffPercent = ((uShapeDigital - weightedDigital) / weightedDigital) * 100;
        }
        const diffSign = diffPercent > 0 ? '+' : '';
        document.getElementById('resDigitalDiff').innerText = `${diffSign}${diffPercent.toFixed(1)}%`;

        renderComparisonBars(results, filteredCount);
        renderTopScenariosTable(topPaths);
        renderAdvancedInsights(results, applyStoriesLogic, applyOfflineLogic, filteredJourneys);

        btn.innerHTML = '<span class="arrow">▶</span> Смоделировать';
        btn.disabled = false;
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }, 600);
}

function getChannelName(id) {
    const found = channels.find(c => c.id === id);
    return found ? found.name : id;
}

function generateRealisticJourneys(count) {
    const dataset = [];
    const channelIds = channels.map(c => c.id);

    for (let i = 0; i < count; i++) {
        let journey = [];
        const rand = Math.random();

        // 20% - The "Problem" path (Push -> Stories -> Offline)
        if (rand < 0.20) {
            journey = ['push', 'stories', 'offline'];
        }
        // 15% - Digital -> Stories -> Telemarketing
        else if (rand < 0.35) {
            journey = ['digital', 'stories', 'telemarketing'];
        }
        // 10% - Digital -> Offline
        else if (rand < 0.45) {
            journey = ['digital', 'offline'];
        }
        // 15% - PURE Single Channel (Direct)
        else if (rand < 0.60) {
            const randomCh = channelIds[Math.floor(Math.random() * channelIds.length)];
            journey = [randomCh];
        }
        // Others - Random Mixed (2-4 steps)
        else {
            const len = Math.floor(Math.random() * 3) + 2;
            for (let j = 0; j < len; j++) {
                journey.push(channelIds[Math.floor(Math.random() * channelIds.length)]);
            }
        }
        dataset.push({ path: journey });
    }
    return dataset;
}

// ... calculation functions ...

function renderAdvancedInsights(results, storiesLogic, offlineLogic, filteredJourneys) {
    const container = document.getElementById('simInsightText');
    let htmlContent = '';

    // 1. SOLO vs MIXED STATS (If 1 filter active)
    if (selectedSimFilters.length === 1 && filteredJourneys) {
        const filterId = selectedSimFilters[0];
        const filterName = getChannelName(filterId);

        const total = filteredJourneys.length;
        const soloCount = filteredJourneys.filter(j => j.path.length === 1 && j.path[0] === filterId).length;
        const mixedCount = total - soloCount;

        const soloPercent = ((soloCount / total) * 100).toFixed(1);
        const mixedPercent = ((mixedCount / total) * 100).toFixed(1);

        htmlContent += `
            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #E2E8F0;">
                <strong>Анализ канала ${filterName}:</strong><br>
                • Чистые продажи (Solo): <b>${soloCount}</b> (${soloPercent}%)<br>
                • В связке (Mix): <b>${mixedCount}</b> (${mixedPercent}%)
            </div>
        `;
    }

    // 2. MODEL COMPARISON INSIGHT
    const tmId = 'telemarketing';
    const tmWeighted = results.weighted[tmId] || 0;
    const tmUShape = results.uShape[tmId] || 0;

    let diffText = '';

    if (tmWeighted > tmUShape) {
        let diff = 0;
        if (tmUShape > 0) diff = ((tmWeighted - tmUShape) / tmUShape) * 100;
        else diff = 100;
        diffText = `Ваша модель "Score" присваивает Телемаркетингу (TM) на <strong>${diff.toFixed(0)}% больше продаж</strong>, чем U-Shape. Это происходит из-за высокого балла (5).`;
    } else {
        diffText = `Ваша модель показывает схожие результаты с U-Shape.`;
    }

    htmlContent += diffText;

    const logicText = storiesLogic ?
        `<br><br>Логика "Stories < 1h" работает: часть касаний сторис была исключена (score=0), что перераспределило вес на другие каналы.` :
        `<br><br>Логика "Stories < 1h" выключена.`;

    htmlContent += logicText;

    container.innerHTML = htmlContent;

    document.getElementById('insightStoriesScore').innerText = storiesLogic ? '0' : 'Current';
    document.getElementById('insightOfflineScore').innerText = offlineLogic ? '2' : 'Current';
}

function calculateThreeModels(dataset, useStoriesLogic, useOfflineLogic) {
    const weightedTotals = {};
    const uShapeTotals = {};
    const lastTouchTotals = {};

    channels.forEach(c => {
        weightedTotals[c.id] = 0;
        uShapeTotals[c.id] = 0;
        lastTouchTotals[c.id] = 0;
    });

    dataset.forEach(row => {
        let path = [...row.path];

        // Simulating logic modification...
        // For simplicity in this demo, logic affects SCORES, not path structure usually.
        // But for advanced simulation, let's keep it simple.

        const n = path.length;
        const revenue = 1;

        // Last Touch
        lastTouchTotals[path[n - 1]] += revenue;

        // U-Shape
        if (n === 1) {
            uShapeTotals[path[0]] += revenue;
        } else if (n === 2) {
            uShapeTotals[path[0]] += revenue * 0.5;
            uShapeTotals[path[1]] += revenue * 0.5;
        } else {
            uShapeTotals[path[0]] += revenue * 0.4;
            uShapeTotals[path[n - 1]] += revenue * 0.4;
            const mid = (revenue * 0.2) / (n - 2);
            for (let k = 1; k < n - 1; k++) {
                uShapeTotals[path[k]] += mid;
            }
        }

        // Weighted
        let totalScore = 0;
        const itemScores = path.map(channelId => {
            const chObj = channels.find(c => c.id === channelId);
            let score = chObj ? chObj.score : 1;

            if (useStoriesLogic && channelId === 'stories') score = 0;
            if (useOfflineLogic && channelId === 'offline') score = 2; // Reduced from 5

            return { id: channelId, score: score };
        });

        const sumScores = itemScores.reduce((sum, item) => sum + item.score, 0);

        if (sumScores > 0) {
            itemScores.forEach(item => {
                weightedTotals[item.id] += (item.score / sumScores) * revenue;
            });
        }
    });

    return { lastTouch: lastTouchTotals, uShape: uShapeTotals, weighted: weightedTotals };
}

function analyzePathFrequencies(dataset) {
    const counts = {};
    dataset.forEach(row => {
        const key = row.path.join('|');
        counts[key] = (counts[key] || 0) + 1;
    });

    const sorted = Object.keys(counts).map(key => ({
        path: key.split('|'),
        count: counts[key]
    })).sort((a, b) => b.count - a.count);

    return sorted.slice(0, 5);
}

function renderComparisonBars(results, maxBase) {
    const container = document.getElementById('simBarsContainer');
    container.innerHTML = '';

    // If empty
    if (maxBase === 0) {
        container.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:20px">Нет данных по выбранным фильтрам</div>';
        return;
    }

    channels.forEach(channel => {
        const id = channel.id;
        const valLast = Math.round(results.lastTouch[id] || 0);
        const valWeighted = Math.round(results.weighted[id] || 0);
        const valUShape = Math.round(results.uShape[id] || 0);

        if (selectedSimFilters.length > 0 && valLast + valWeighted + valUShape === 0) return;

        const scale = maxBase * 0.8 || 1;

        const wLast = Math.min((valLast / scale) * 100, 100);
        const wWeighted = Math.min((valWeighted / scale) * 100, 100);
        const wUShape = Math.min((valUShape / scale) * 100, 100);

        const html = `
            <div class="bar-group">
                <div class="bar-group-header">
                    <span>${channel.name}</span>
                    <span class="bar-stats">Last: ${valLast} | Score: ${valWeighted} | U: ${valUShape}</span>
                </div>
                ${wLast > 0 ? `<div class="bar-row"><div class="bar-fill fill-gray" style="width: ${wLast}%"></div></div>` : ''}
                ${wWeighted > 0 ? `<div class="bar-row"><div class="bar-fill fill-green" style="width: ${wWeighted}%"></div></div>` : ''}
                ${wUShape > 0 ? `<div class="bar-row"><div class="bar-fill fill-blue" style="width: ${wUShape}%"></div></div>` : ''}
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderTopScenariosTable(topPaths) {
    const tbody = document.getElementById('simTableBody');
    tbody.innerHTML = '';

    if (topPaths.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center">Нет данных</td></tr>';
        return;
    }

    topPaths.forEach(item => {
        const pathStr = item.path.map(id => getChannelName(id)).join(' → ');
        const row = `
            <tr>
                <td>${pathStr}</td>
                <td class="text-right"><strong>${item.count}</strong></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function renderAdvancedInsights(results, storiesLogic, offlineLogic) {
    const tmId = 'telemarketing';
    const tmWeighted = results.weighted[tmId] || 0;
    const tmUShape = results.uShape[tmId] || 0;

    let diffText = '';

    if (tmWeighted > tmUShape) {
        let diff = 0;
        if (tmUShape > 0) diff = ((tmWeighted - tmUShape) / tmUShape) * 100;
        else diff = 100;
        diffText = `Ваша модель "Score" присваивает Телемаркетингу (TM) на <strong>${diff.toFixed(0)}% больше продаж</strong>, чем U-Shape. Это происходит из-за высокого балла (5).`;
    } else {
        diffText = `Ваша модель показывает схожие результаты с U-Shape.`;
    }

    const logicText = storiesLogic ?
        `<br><br>Логика "Stories < 1h" работает: часть касаний сторис была исключена (score=0), что перераспределило вес на другие каналы.` :
        `<br><br>Логика "Stories < 1h" выключена.`;

    document.getElementById('simInsightText').innerHTML = diffText + logicText;

    document.getElementById('insightStoriesScore').innerText = storiesLogic ? '0' : 'Current';
    document.getElementById('insightOfflineScore').innerText = offlineLogic ? '2' : 'Current';
}
