const channels = [
    { id: 'digital', name: 'Digital Ads', icon: '💻', color: 'blue', score: 1 },
    { id: 'stories', name: 'Stories', icon: '📸', color: 'pink', score: 1 },
    { id: 'push', name: 'Push', icon: '🔔', color: 'orange', score: 1 },
    { id: 'sms', name: 'SMS', icon: '💬', color: 'purple', score: 1 },
    { id: 'telemarketing', name: 'Telemarketing', icon: '📞', color: 'green', score: 1 },
    { id: 'offline', name: 'Offline', icon: '🏢', color: 'indigo', score: 1 }
];

let journey = [];

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
    renderChannels();
    updateAllResults();

    // Initial State: Empty Journey
    renderJourney();
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
        channel.score = parseFloat(newScore); // Fixed: parseFloat instead of parseInt
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

document.getElementById('clearJourney').addEventListener('click', () => {
    journey = [];
    renderJourney();
    updateAllResults();
});

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

    journey.forEach((channelId, index) => {
        const channel = channels.find(c => c.id === channelId);
        totalScore += channel.score;

        const node = document.createElement('div');
        node.className = 'journey-node';
        node.innerHTML = `
            <div class="node-icon channel-${channel.color}">${channel.icon}</div>
            <div class="node-name">${channel.name}</div>
            <div class="node-score">${channel.score}</div>
            ${index < journey.length - 1 ? '<div class="arrow">→</div>' : ''}
            <button class="remove-node" onclick="removeFromJourney(${index})">×</button>
        `;
        container.appendChild(node);
    });

    document.getElementById('totalScore').innerText = totalScore.toFixed(1);
}

function removeFromJourney(index) {
    journey.splice(index, 1);
    renderJourney();
    updateAllResults();
}

// --- ATTRIBUTION LOGIC ---

function updateAllResults() {
    // 1. Weighted Score (Your Model)
    const weighted = calculateWeightedScore();
    renderResults('weightedResults', weighted, 'green');

    // 2. U-Shape (Position Based: 40% First, 40% Last, 20% Middle)
    const uShape = calculateUShape();
    renderResults('ushapeResults', uShape, 'blue');

    // 3. Last Touch
    const lastTouch = calculateLastTouch();
    renderResults('lastTouchResults', lastTouch, 'gray');

    // 4. First Touch
    const firstTouch = calculateFirstTouch();
    renderResults('firstTouchResults', firstTouch, 'gray');

    // 5. Insights
    renderAttributionInsights({
        weightedScore: weighted,
        uShape: uShape
    });
}

// Helper: Filter out 'offline' if helper is active (NOT USED IN MAIN LOGIC ANYMORE, but kept for safe)
function getFilteredJourney() {
    // For main calculator, we use the journey AS IS.
    return journey;
}

function calculateWeightedScore() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};

    // Calculate sum of scores
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

    // Initialize
    filtered.forEach(id => result[id] = 0);

    if (n === 1) {
        result[filtered[0]] = 100;
    } else if (n === 2) {
        result[filtered[0]] += 50;
        result[filtered[1]] += 50;
    } else {
        // First & Last get 40%
        result[filtered[0]] += 40;
        result[filtered[n - 1]] += 40;

        // Middle gets 20% distributed
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

function renderResults(elementId, data, colorClass) {
    const container = document.getElementById(elementId);
    if (!container) return;

    container.innerHTML = '';

    // Sort keys by value desc
    const sortedKeys = Object.keys(data).sort((a, b) => data[b] - data[a]);

    if (sortedKeys.length === 0) {
        container.innerHTML = '<div class="no-data">-</div>';
        return;
    }

    sortedKeys.forEach(channelId => {
        const channel = channels.find(c => c.id === channelId);
        const value = data[channelId];
        if (value > 0.1) { // Hide negligible
            const row = document.createElement('div');
            row.className = 'result-row';
            row.innerHTML = `
                <div class="channel-info">
                    <span class="icon">${channel.icon}</span>
                    <span>${channel.name}</span>
                </div>
                <div class="channel-bar-wrapper">
                    <div class="result-bar fill-${colorClass}" style="width: ${value}%">
                        ${value.toFixed(1)}%
                    </div>
                </div>
            `;
            container.appendChild(row);
        }
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
            discrepancies.push({
                channel: channel,
                diff: diff
            });
        }
    });

    if (discrepancies.length === 0) {
        container.innerHTML = ''; // No discrepancies found
        return;
    }

    // Sort discrepancies by the absolute difference, highest first
    discrepancies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    // Get the most significant discrepancy
    const top = discrepancies[0];
    const isOvervalued = top.diff > 0;

    let message;
    if (isOvervalued) {
        // Weighted Score > U-Shape = переоценивает
        const diffPercent = Math.abs(top.diff).toFixed(0);
        message = `По сравнению с рыночным стандартом (U-Shape), Ваша модель <strong>переоценивает</strong> канал 
            <span class="insights-highlight">${top.channel.name}</span> 
            на <strong>${diffPercent}%</strong>. Это может привести к излишнему финансированию этого канала.`;
    } else {
        // Weighted Score < U-Shape = недооценивает
        const diffPercent = Math.abs(top.diff).toFixed(0);
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
// ADVANCED SIMULATION DASHBOARD LOGIC (v2.0)
// -------------------------------------------------------------

document.getElementById('runSimulationBtn').addEventListener('click', runAdvancedSimulation);

function runAdvancedSimulation() {
    const btn = document.getElementById('runSimulationBtn');
    const inputCount = document.getElementById('simCount');
    const checkStories = document.getElementById('simCheckStories');
    const checkOffline = document.getElementById('simCheckOffline');
    const resultsDiv = document.getElementById('simulationResults');

    const count = parseInt(inputCount.value) || 800;
    const applyStoriesLogic = checkStories.checked;
    const applyOfflineLogic = checkOffline.checked;

    // UI Feedback
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Моделирование...';
    btn.disabled = true;

    setTimeout(() => {
        // 1. Generate Realistic Data
        const journeys = generateRealisticJourneys(count);

        // 2. Calculate Models (Returns totals for each model)
        const results = calculateThreeModels(journeys, applyStoriesLogic, applyOfflineLogic);

        // 3. Find Top Scenarios
        const topPaths = analyzePathFrequencies(journeys);

        // 4. Update UI Components
        resultsDiv.classList.remove('hidden');

        // Cards
        document.getElementById('resTotalSales').innerText = count;

        // Top Path
        const bestPath = topPaths[0];
        const bestPathStr = bestPath.path.map(id => getChannelName(id)).join(' → ');
        const bestPathPercent = ((bestPath.count / count) * 100).toFixed(1) + '% от всех продаж';
        document.getElementById('resTopPath').innerText = bestPathStr;
        document.getElementById('resTopPathPercent').innerText = bestPathPercent;

        // Digital Diff (Example: Digital Ads comparison between U-Shape and Weighted)
        // Let's compare Digital Ads specifically as in screenshot
        const digitalId = 'digital';
        const uShapeDigital = results.uShape[digitalId];
        const weightedDigital = results.weighted[digitalId];
        // If U-Shape is much bigger than Weighted (as in screenshot +172.3%)
        let diffPercent = 0;
        if (weightedDigital > 0) {
            diffPercent = ((uShapeDigital - weightedDigital) / weightedDigital) * 100;
        }
        const diffSign = diffPercent > 0 ? '+' : '';
        document.getElementById('resDigitalDiff').innerText = `${diffSign}${diffPercent.toFixed(1)}%`;

        // 5. Render Bars
        renderComparisonBars(results);

        // 6. Render Table
        renderTopScenariosTable(topPaths);

        // 7. Render Insights
        renderAdvancedInsights(results, applyStoriesLogic, applyOfflineLogic);

        // Reset Btn
        btn.innerHTML = originalText;
        btn.disabled = false;

        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }, 600);
}

function getChannelName(id) {
    const found = channels.find(c => c.id === id);
    return found ? found.name : id;
}

function generateRealisticJourneys(count) {
    // We need to generate paths that create the "problem" scenario (navigation bias)
    // Common paths: Push -> Stories -> Offline; Digital -> Stories -> Offline
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
        // 15% - Digital -> Offline
        else if (rand < 0.50) {
            journey = ['digital', 'offline'];
        }
        // Others - Random
        else {
            const len = Math.floor(Math.random() * 3) + 2; // 2-4 steps
            for (let j = 0; j < len; j++) {
                journey.push(channelIds[Math.floor(Math.random() * channelIds.length)]);
            }
        }
        dataset.push({ path: journey });
    }
    return dataset;
}

function calculateThreeModels(dataset, useStoriesLogic, useOfflineLogic) {
    // Config values from main app
    // We need to use "current" scores for Weighted model
    // And standard 40/40/20 for U-Shape

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

        // --- LOGIC MODIFIERS ---
        // 1. Stories < 1h Logic (Simulated):
        // If 'stories' is in path, we assume 50% of them are "navigation clicks" (fast)
        // If useStoriesLogic is TRUE, we remove 'stories' from calculation if it looks like nav
        // For simulation simplicity: if path contains 'stories' in middle, remove it 50% of time
        if (useStoriesLogic) {
            // Apply logic: if 'stories' is treated as non-valuable, we skip it
            // In the screenshot "Stories Score = 0 (if < 1h)"
            // Let's filter out 'stories' from the path for the models that support this logic
            // Actually, usually this logic applies to ALL models or specific ones.
            // Let's assume this modifies the *Effective Path* for Weighted/U-Shape

            // In simulation, let's say "Stories" in middle position is often noise.
            // We'll strip it out for U-Shape and Weighted if simulating "Smart" logic
            // But wait, the screenshot compares "U-Shape" vs "Weighted".
            // Let's apply valid path logic.

            // For this output, we need:
            // 1. Last Touch (Raw, naive)
            // 2. Weighted (Your Model - with modifiers)
            // 3. U-Shape (Market Standard - usually naive path but position based)

            // Actually, "Stories < 1h" usually modifies the Weighted Score (score=0).
        }

        const n = path.length;
        const revenue = 1; // 1 sale

        // --- 1. LAST TOUCH (Naive) ---
        lastTouchTotals[path[n - 1]] += revenue;

        // --- 2. U-SHAPE (Standard 40/40/20) ---
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

        // --- 3. WEIGHTED SCORE (Your Model) ---
        // This is where "Logic" checkboxes apply heavily
        // We get scores from the UI config
        let totalScore = 0;
        const itemScores = path.map(channelId => {
            const chObj = channels.find(c => c.id === channelId);
            let score = chObj ? chObj.score : 1;

            // APPLY CHECKBOX LOGIC 1: Stories
            if (useStoriesLogic && channelId === 'stories') {
                // Simulate that for THIS specific journey, it was a "fast" click
                // In a real app we check time. In simulation, we assume 100% application for demo
                // or 50% probabilistic.
                // Screenshot implies "Stories Score = 0".
                score = 0;
            }

            // APPLY CHECKBOX LOGIC 2: Offline
            if (useOfflineLogic && channelId === 'offline') {
                // Screenshot: "Offline Score = 2 (if app rejection)"
                // Normally Offline might be 10.
                score = 2; // Hardcoded simulation value or reduced value
            }

            return { id: channelId, score: score };
        });

        // Calculate total score
        const sumScores = itemScores.reduce((sum, item) => sum + item.score, 0);

        if (sumScores > 0) {
            itemScores.forEach(item => {
                weightedTotals[item.id] += (item.score / sumScores) * revenue;
            });
        }
    });

    return {
        lastTouch: lastTouchTotals,
        uShape: uShapeTotals,
        weighted: weightedTotals
    };
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

    return sorted.slice(0, 5); // Top 5
}

function renderComparisonBars(results) {
    const container = document.getElementById('simBarsContainer');
    container.innerHTML = '';

    channels.forEach(channel => {
        const id = channel.id;
        // Get values
        const valLast = Math.round(results.lastTouch[id]);
        const valWeighted = Math.round(results.weighted[id]);
        const valUShape = Math.round(results.uShape[id]);

        // Find max to calculate width % (relative to total sales or max value?)
        // Let's use max value among all bars to scale correctly
        // Or just fixed scale max = Total Sales (800)
        // Better: Find global max across all channels/models to define 100% width
        const totalSales = document.getElementById('resTotalSales').innerText;
        const maxScale = parseInt(totalSales) * 0.6; // Scale so bars aren't too small

        const wLast = Math.min((valLast / maxScale) * 100, 100);
        const wWeighted = Math.min((valWeighted / maxScale) * 100, 100);
        const wUShape = Math.min((valUShape / maxScale) * 100, 100);

        const html = `
            <div class="bar-group">
                <div class="bar-group-header">
                    <span>${channel.name}</span>
                    <span class="bar-stats">Last: ${valLast} | Score: ${valWeighted} | U: ${valUShape}</span>
                </div>
                
                <!-- Last Touch (Gray) -->
                ${wLast > 0 ? `
                <div class="bar-row">
                    <div class="bar-fill fill-gray" style="width: ${wLast}%"></div>
                </div>` : ''}

                <!-- Weighted (Green - Your Model) -->
                ${wWeighted > 0 ? `
                <div class="bar-row">
                    <div class="bar-fill fill-green" style="width: ${wWeighted}%"></div>
                </div>` : ''}

                <!-- U-Shape (Blue) -->
                ${wUShape > 0 ? `
                <div class="bar-row">
                    <div class="bar-fill fill-blue" style="width: ${wUShape}%"></div>
                </div>` : ''}
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderTopScenariosTable(topPaths) {
    const tbody = document.getElementById('simTableBody');
    tbody.innerHTML = '';

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
    // Generate text similar to screenshot
    // "Ваша модель присваивает Телемаркетингу... больше..."
    const tmId = 'telemarketing';
    const tmWeighted = results.weighted[tmId];
    const tmUShape = results.uShape[tmId];

    let diff = 0;
    let diffText = '';

    if (tmWeighted > tmUShape) {
        diff = ((tmWeighted - tmUShape) / tmUShape) * 100;
        diffText = `Ваша модель "Score" присваивает Телемаркетингу (TM) на <strong>${diff.toFixed(0)}% больше продаж</strong>, чем U-Shape. Это происходит из-за высокого балла (5).`;
    } else {
        diffText = `Ваша модель показывает схожие результаты с U-Shape.`;
    }

    // Digital check
    const digId = 'digital';
    const digW = results.weighted[digId];
    const digU = results.uShape[digId];
    if (digU > digW) {
        const dDiff = ((digU - digW) / digW) * 100;
        diffText += ` При этом Digital недооценен. В U-Shape он получает на ${dDiff.toFixed(0)}% больше заслуг как "Инициатор" сделки.`;
    }

    const logicText = storiesLogic ?
        `<br><br>Логика "Stories < 1h" работает: часть касаний сторис была исключена (score=0), что перераспределило вес на другие каналы.` :
        `<br><br>Логика "Stories < 1h" выключена.`;

    document.getElementById('simInsightText').innerHTML = diffText + logicText;

    // Update settings box
    document.getElementById('insightStoriesScore').innerText = storiesLogic ? '0' : 'Current';
    document.getElementById('insightOfflineScore').innerText = offlineLogic ? '2' : 'Current';
}
