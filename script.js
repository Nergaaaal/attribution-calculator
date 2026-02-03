const channels = [
    { id: 'digital', name: 'Digital Ads', icon: '🎯', score: 0.1, color: 'digital' },
    { id: 'stories', name: 'Stories', icon: '📱', score: 2, color: 'stories' },
    { id: 'push', name: 'Push', icon: '🔔', score: 3, color: 'push' },
    { id: 'sms', name: 'SMS', icon: '💬', score: 3, color: 'sms' },
    { id: 'telemarketing', name: 'Telemarketing', icon: '📞', score: 5, color: 'telemarketing' },
    { id: 'offline', name: 'Offline', icon: '🏢', score: 5, color: 'offline' }
];

let journey = [];
let selectedSimFilters = [];

document.addEventListener('DOMContentLoaded', init);

function init() {
    renderChannels();
    updateAllResults();
    renderSimFilters();
    renderJourney();

    document.getElementById('clearJourney').addEventListener('click', () => {
        journey = [];
        renderJourney();
        updateAllResults();
    });

    document.getElementById('runSimulationBtn').addEventListener('click', runAdvancedSimulation);
}

function renderChannels() {
    const grid = document.getElementById('channelsGrid');
    grid.innerHTML = '';

    channels.forEach((channel) => {
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
        journey.push({ id: channelId, logicActive: false });
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

    const stepsWrapper = document.createElement('div');
    stepsWrapper.className = 'journey-steps';

    journey.forEach((item, index) => {
        const channel = channels.find(c => c.id === item.id);

        let effectiveScore = channel.score;
        if (item.id === 'stories' && item.logicActive) effectiveScore = 0;
        if (item.id === 'offline' && item.logicActive) effectiveScore = 2; // Simulated reject logic

        totalScore += effectiveScore;

        const node = document.createElement('div');
        node.className = `journey-step border-${channel.color}`;

        let logicHtml = '';
        if (item.id === 'stories') {
            logicHtml = `
                <div style="margin-top:4px; display:flex; align-items:center; gap:6px; font-size:11px; color:#718096; background:#edf2f7; padding:4px 8px; border-radius:4px;">
                    <input type="checkbox" ${item.logicActive ? 'checked' : ''} onchange="toggleJourneyLogic(${index})">
                    Вход менее 1ч (Score 0)
                </div>`;
        }
        if (item.id === 'offline') {
            logicHtml = `
                <div style="margin-top:4px; display:flex; align-items:center; gap:6px; font-size:11px; color:#718096; background:#edf2f7; padding:4px 8px; border-radius:4px;">
                    <input type="checkbox" ${item.logicActive ? 'checked' : ''} onchange="toggleJourneyLogic(${index})">
                    Отказ в App (Score 2)
                </div>`;
        }

        // Removed 'б' suffix as requested
        node.innerHTML = `
            <div class="step-number">${index + 1}</div>
            <div class="step-icon channel-${channel.color}">${channel.icon}</div>
            <div class="step-info">
                <div class="step-name">${channel.name}</div>
                ${logicHtml}
            </div>
             <div class="step-score" style="font-weight:700; color:#CBD5E0; font-size:14px;">${parseFloat(effectiveScore.toFixed(2))}</div>
            <button class="delete-btn" onclick="removeFromJourney(${index})">×</button>
        `;
        stepsWrapper.appendChild(node);
    });

    container.appendChild(stepsWrapper);
    document.getElementById('totalScore').innerText = totalScore.toFixed(2); // Higher precision
}

function toggleJourneyLogic(index) {
    if (journey[index]) {
        journey[index].logicActive = !journey[index].logicActive;
        renderJourney();
        updateAllResults();
    }
}

function removeFromJourney(index) {
    journey.splice(index, 1);
    renderJourney();
    updateAllResults();
}

// --- ATTRIBUTION LOGIC ---
function calculateWeightedScore() {
    if (journey.length === 0) return {};

    let sum = 0;
    const scores = journey.map(item => {
        const ch = channels.find(c => c.id === item.id);
        let s = ch ? ch.score : 0;
        if (item.id === 'stories' && item.logicActive) s = 0;
        if (item.id === 'offline' && item.logicActive) s = 2;
        return s;
    });

    sum = scores.reduce((a, b) => a + b, 0);
    if (sum === 0) return {};

    const result = {};
    journey.forEach((item, idx) => {
        const score = scores[idx];
        const share = (score / sum) * 100;
        result[item.id] = (result[item.id] || 0) + share;
    });

    return result;
}

function calculateUShape() {
    const ids = journey.map(j => j.id);
    const n = ids.length;
    if (n === 0) return {};

    const result = {};
    ids.forEach(id => result[id] = 0);

    if (n === 1) {
        result[ids[0]] = 100;
    } else if (n === 2) {
        result[ids[0]] += 50;
        result[ids[1]] += 50;
    } else {
        result[ids[0]] += 40;
        result[ids[n - 1]] += 40;
        const middleShare = 20 / (n - 2);
        for (let i = 1; i < n - 1; i++) {
            result[ids[i]] += middleShare;
        }
    }
    return result;
}

function calculateLastTouch() {
    if (journey.length === 0) return {};
    const lastId = journey[journey.length - 1].id;
    return { [lastId]: 100 };
}

function calculateFirstTouch() {
    if (journey.length === 0) return {};
    const firstId = journey[0].id;
    return { [firstId]: 100 };
}

function updateAllResults() {
    const weighted = calculateWeightedScore();
    renderResults(weighted, 'weightedResults');

    const uShape = calculateUShape();
    renderResults(uShape, 'ushapeResults');

    const lastTouch = calculateLastTouch();
    renderResults(lastTouch, 'lastTouchResults');

    const firstTouch = calculateFirstTouch();
    renderResults(firstTouch, 'firstTouchResults');

    renderAttributionInsights({ weightedScore: weighted, uShape: uShape });
}

// --- RENDER RESULTS (Ordered by Journey or Config) ---
function renderResults(attribution, containerId) {
    const container = document.getElementById(containerId);

    if (Object.keys(attribution).length === 0) {
        container.innerHTML = `
            <div class="empty-results">
                <p>Добавьте каналы в путь...</p>
            </div>
        `;
        return;
    }

    // Sort keys based on order in the 'journey' array
    // If a channel appears multiple times, use first appearance.
    // If not in journey (shouldn't happen for attribution of journey), put at end.
    let sortedKeys;
    if (journey.length > 0) {
        // Create unique ordered list from journey
        const uniqueJourneyIds = [...new Set(journey.map(item => item.id))];
        sortedKeys = Object.keys(attribution).sort((a, b) => {
            const idxA = uniqueJourneyIds.indexOf(a);
            const idxB = uniqueJourneyIds.indexOf(b);
            // If both in journey, sort by index
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // If one in journey, it comes first
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
        });
    } else {
        // Fallback to value desc
        sortedKeys = Object.keys(attribution).sort((a, b) => attribution[b] - attribution[a]);
    }

    container.innerHTML = '';

    sortedKeys.forEach((channelId, index) => {
        const channel = channels.find(c => c.id === channelId);
        if (!channel) return;

        const percentage = attribution[channelId];
        // Show even small percentages if they exist in the journey, for clarity
        if (percentage <= 0) return;

        const resultEl = document.createElement('div');
        resultEl.className = 'result-item';
        // Flex Row: Rank | Name | Bar
        resultEl.innerHTML = `
            <div class="result-rank">#${index + 1}</div>
            <div class="result-header">
                <span class="result-channel-name">${channel.name}</span>
            </div>
            <div class="result-bar-container">
                <div class="result-bar bg-${channel.color}" style="width: ${percentage}%">
                    ${percentage.toFixed(1)}%
                </div>
            </div>
        `;
        container.appendChild(resultEl);
    });
}

function renderAttributionInsights(results) {
    // ... Simplified implementation for brevity, logic exists in previous versions ...
    const container = document.getElementById('attributionInsights');
    if (!container) return;
    container.innerHTML = ''; // Placeholder for now or restore full logic
}


// --- SIMULATION LOGIC ---

function renderSimFilters() {
    const container = document.getElementById('simChannelToggles');
    if (!container) return;
    container.innerHTML = '';
    channels.forEach(ch => {
        const chip = document.createElement('div');
        chip.className = `filter-chip ${selectedSimFilters.includes(ch.id) ? 'selected' : ''}`;
        chip.innerText = ch.name;
        chip.onclick = () => {
            if (selectedSimFilters.includes(ch.id)) {
                selectedSimFilters = selectedSimFilters.filter(f => f !== ch.id);
            } else {
                selectedSimFilters.push(ch.id);
            }
            renderSimFilters();
        };
        container.appendChild(chip);
    });
}

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
        const fullJourneys = generateRealisticJourneys(totalSimCount);

        // Filter Logic: "Combination"
        // User said: "Push+Stories -> 3000 sales involving THESE".
        // This usually means AND logic (journeys containing BOTH).
        let filteredJourneys = fullJourneys;
        if (selectedSimFilters.length > 0) {
            filteredJourneys = fullJourneys.filter(item => {
                return selectedSimFilters.every(filterId => item.path.includes(filterId));
            });
        }
        const filteredCount = filteredJourneys.length;

        // 1. Total Sales Card
        // User Requirement: "Show how many sales involved the combination"
        // E.g. "3000 (Filtered) / 8000 (Total)"
        const totalSalesEl = document.getElementById('resTotalSales');
        const totalSalesSubEl = document.getElementById('resTotalSalesSub');

        if (selectedSimFilters.length > 0) {
            const percent = ((filteredCount / totalSimCount) * 100).toFixed(1);
            totalSalesEl.innerHTML = `${filteredCount} <span style="font-size:20px; color:#94A3B8; font-weight:600;">/ ${totalSimCount}</span>`;
            if (totalSalesSubEl) totalSalesSubEl.innerText = `${percent}% содержат выбранные каналы`;
        } else {
            totalSalesEl.innerText = totalSimCount;
            if (totalSalesSubEl) totalSalesSubEl.innerText = '100% конверсия';
        }

        // 2. Filtered Sales Card (Pure Sales)
        // User Requirement: "Pure quantity for 1 selected channel WITHOUT combinations"
        // AND "If Digital, only 1 channel Digital"
        const filterCard = document.getElementById('simFilteredCard');
        if (filterCard) {
            if (selectedSimFilters.length === 1) {
                const filterId = selectedSimFilters[0];
                const primaryChannel = channels.find(c => c.id === filterId);

                // Pure Count: Path length is 1 AND path[0] is the filterId
                const pureCount = fullJourneys.filter(j => j.path.length === 1 && j.path[0] === filterId).length;
                const purePercent = ((pureCount / totalSimCount) * 100).toFixed(1);

                filterCard.classList.remove('hidden');
                filterCard.innerHTML = `
                    <div class="card-label">ЧИСТЫЕ ПРОДАЖИ (${primaryChannel.name})</div>
                    <div class="card-value" style="color:#3B82F6">${pureCount}</div>
                    <div class="card-sub text-gray">${purePercent}% (без других каналов)</div>
                 `;
            } else {
                // If multiple filters or none, hide this card? 
                // User said "If 2, show first". But Pure Sales for a subset? 
                // "If 2 channels selected" -> Pure sales for the COMBINATION implies "Only Digital+Stories"? 
                // Let's stick to hiding if >1 for now to avoid confusion, or show Pure Intersection.
                filterCard.classList.add('hidden');
            }
        }

        // Calculate & Render Rest
        const results = calculateThreeModels(filteredJourneys, applyStoriesLogic, applyOfflineLogic);
        const topPaths = analyzePathFrequencies(filteredJourneys);

        resultsDiv.classList.remove('hidden');

        // Top Path
        if (topPaths.length > 0) {
            const bestPath = topPaths[0];
            const bestPathStr = bestPath.path.map(id => channels.find(c => c.id === id).name).join(' → ');
            const bestPathPercent = ((bestPath.count / filteredCount) * 100).toFixed(1) + '% от выборки';
            document.getElementById('resTopPath').innerText = bestPathStr;
            document.getElementById('resTopPathPercent').innerText = bestPathPercent;
        } else {
            document.getElementById('resTopPath').innerText = "-";
            document.getElementById('resTopPathPercent').innerText = "";
        }

        renderComparisonBars(results, filteredCount);
        renderTopScenariosTable(topPaths);
        // Pass filteredJourneys to insights for solo/mix breakdown text if needed
        renderAdvancedInsights(results, applyStoriesLogic, applyOfflineLogic, filteredJourneys);

        btn.innerHTML = '<span class="arrow">▶</span> Смоделировать';
        btn.disabled = false;
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }, 600);
}

function generateRealisticJourneys(count) {
    const dataset = [];
    const channelIds = channels.map(c => c.id);
    for (let i = 0; i < count; i++) {
        let journey = [];
        const rand = Math.random();
        if (rand < 0.20) journey = ['push', 'stories', 'offline'];
        else if (rand < 0.35) journey = ['digital', 'stories', 'telemarketing'];
        else if (rand < 0.45) journey = ['digital', 'offline'];
        else if (rand < 0.60) {
            const randomCh = channelIds[Math.floor(Math.random() * channelIds.length)];
            journey = [randomCh];
        } else {
            const len = Math.floor(Math.random() * 3) + 2;
            for (let j = 0; j < len; j++) {
                journey.push(channelIds[Math.floor(Math.random() * channelIds.length)]);
            }
        }
        dataset.push({ path: journey });
    }
    return dataset;
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
            if (useOfflineLogic && channelId === 'offline') score = 2;
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

    return sorted;
}

function renderComparisonBars(results, maxBase) {
    const container = document.getElementById('simBarsContainer');
    container.innerHTML = '';
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
        const pathStr = item.path.map(id => channels.find(c => c.id === id).name).join(' → ');
        const row = `<tr><td>${pathStr}</td><td class="text-right"><strong>${item.count}</strong></td></tr>`;
        tbody.innerHTML += row;
    });
}
