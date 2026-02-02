// Marketing Attribution Calculator - Interactive Web App

// Channel Configuration
const channels = [
    { id: 'digital', name: 'Digital Ads', icon: '🎯', score: 1, color: 'digital' },
    { id: 'stories', name: 'Stories', icon: '📱', score: 2, color: 'stories' },
    { id: 'push', name: 'Push', icon: '🔔', score: 3, color: 'push' },
    { id: 'sms', name: 'SMS', icon: '💬', score: 3, color: 'sms' },
    { id: 'telemarketing', name: 'Telemarketing', icon: '📞', score: 5, color: 'telemarketing' },
    { id: 'offline', name: 'Offline', icon: '🏪', score: 5, color: 'offline' }
];

// Customer Journey (array of channel IDs)
let customerJourney = [];

// Channel-specific filter states
let channelFilters = {
    storyTimeExclude: false,
    offlineHelper: false
};

// Drag and Drop State
let draggedIndex = null;

// Initialize the app
function init() {
    renderChannels();
    updateAllResults();

    // Clear journey button
    document.getElementById('clearJourney').addEventListener('click', clearJourney);
}

// Render channel configuration panel
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

// Update channel score
function updateChannelScore(channelId, newScore) {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
        channel.score = parseFloat(newScore);
        renderJourney(); // Re-render journey to update displayed scores
        updateAllResults();
    }
}

// Add channel to customer journey
function addToJourney(channelId) {
    customerJourney.push(channelId);
    renderJourney();
    updateAllResults();
}

// Render customer journey
function renderJourney() {
    const journeyPath = document.getElementById('journeyPath');

    if (customerJourney.length === 0) {
        journeyPath.innerHTML = `
            <div class="empty-state">
                <p>Выберите каналы из списка выше, чтобы построить путь клиента</p>
            </div>
        `;
        updateTotalScore();
        return;
    }

    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'journey-steps';

    customerJourney.forEach((channelId, index) => {
        const channel = channels.find(c => c.id === channelId);
        if (!channel) return;

        const stepEl = document.createElement('div');
        stepEl.className = 'journey-step';
        stepEl.draggable = true;
        stepEl.dataset.index = index;

        let filterHTML = '';

        // Add channel-specific filters
        if (channelId === 'stories') {
            filterHTML = `
                <div class="channel-filter">
                    <div class="filter-checkbox-group">
                        <input 
                            type="checkbox" 
                            id="storyExclude_${index}"
                            ${channelFilters.storyTimeExclude ? 'checked' : ''}
                            onchange="toggleStoryExclude(this.checked)"
                        >
                        <label for="storyExclude_${index}">Вход в течение 1ч (Исключить)</label>
                    </div>
                </div>
            `;
        } else if (channelId === 'offline') {
            filterHTML = `
                <div class="channel-filter">
                    <div class="filter-checkbox-group">
                        <input 
                            type="checkbox" 
                            id="offlineHelper_${index}"
                            ${channelFilters.offlineHelper ? 'checked' : ''}
                            onchange="toggleOfflineHelper(this.checked)"
                        >
                        <label for="offlineHelper_${index}">Отказ в приложении (Helper)</label>
                    </div>
                </div>
            `;
        }

        stepEl.innerHTML = `
            <div class="step-number">${index + 1}</div>
            <div class="step-icon channel-${channel.color}">${channel.icon}</div>
            <div class="step-info">
                <div class="step-name">${channel.name}</div>
                <div class="step-description">Очки в приложении (${channel.score} балл${channel.score === 1 ? '' : channel.score < 5 ? 'а' : 'ов'})</div>
                ${filterHTML}
            </div>
            <button class="delete-btn" onclick="removeFromJourney(${index})">×</button>
        `;

        // Drag event listeners
        stepEl.addEventListener('dragstart', handleDragStart);
        stepEl.addEventListener('dragover', handleDragOver);
        stepEl.addEventListener('drop', handleDrop);
        stepEl.addEventListener('dragend', handleDragEnd);

        stepsContainer.appendChild(stepEl);
    });

    journeyPath.innerHTML = '';
    journeyPath.appendChild(stepsContainer);
    updateTotalScore();
}

// Drag and Drop Handlers
function handleDragStart(e) {
    draggedIndex = parseInt(e.target.dataset.index);
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const dropIndex = parseInt(e.target.closest('.journey-step').dataset.index);

    if (draggedIndex !== dropIndex) {
        // Swap elements in the journey array
        const draggedItem = customerJourney[draggedIndex];
        customerJourney.splice(draggedIndex, 1);
        customerJourney.splice(dropIndex, 0, draggedItem);

        renderJourney();
        updateAllResults();
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedIndex = null;
}

// Remove from journey
function removeFromJourney(index) {
    customerJourney.splice(index, 1);
    renderJourney();
    updateAllResults();
}

// Clear journey
function clearJourney() {
    customerJourney = [];
    renderJourney();
    updateAllResults();
}

// Toggle Stories time-based exclusion
function toggleStoryExclude(checked) {
    channelFilters.storyTimeExclude = checked;
    renderJourney();
    updateAllResults();
}

// Toggle Offline helper mode
function toggleOfflineHelper(checked) {
    channelFilters.offlineHelper = checked;
    updateAllResults();
}

// Update total score display
function updateTotalScore() {
    const totalScore = customerJourney.reduce((sum, channelId) => {
        const channel = channels.find(c => c.id === channelId);
        return sum + (channel ? channel.score : 0);
    }, 0);

    document.getElementById('totalScore').textContent = totalScore;
}

// Get filtered journey (applying channel-specific filters)
function getFilteredJourney() {
    let filtered = [...customerJourney];

    // Apply Stories time-based exclusion
    if (channelFilters.storyTimeExclude) {
        // Remove Stories from the journey if the filter is active
        filtered = filtered.filter(channelId => channelId !== 'stories');
    }

    return filtered;
}

// Calculate Weighted Score Attribution
function calculateWeightedScore() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};

    const totalScore = filtered.reduce((sum, channelId) => {
        const channel = channels.find(c => c.id === channelId);
        return sum + (channel ? channel.score : 0);
    }, 0);

    const attribution = {};

    filtered.forEach(channelId => {
        const channel = channels.find(c => c.id === channelId);
        if (!channel) return;

        if (!attribution[channelId]) {
            attribution[channelId] = 0;
        }

        let contribution = (channel.score / totalScore) * 100;

        // Apply offline helper logic - reduce contribution by 50%
        if (channelId === 'offline' && channelFilters.offlineHelper) {
            contribution *= 0.5;
        }

        attribution[channelId] += contribution;
    });

    // Normalize if offline helper is active (redistribute remaining percentage)
    if (channelFilters.offlineHelper && attribution['offline']) {
        const totalAttribution = Object.values(attribution).reduce((sum, val) => sum + val, 0);
        const scaleFactor = 100 / totalAttribution;

        Object.keys(attribution).forEach(key => {
            attribution[key] *= scaleFactor;
        });
    }

    return attribution;
}

// Calculate U-Shape Attribution
function calculateUShape() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};

    // Fixed weights: 40% first, 40% last, 20% middle
    const firstWeight = 0.4;
    const lastWeight = 0.4;
    const middleWeight = 0.2;

    const attribution = {};
    const journeyLength = filtered.length;

    if (journeyLength === 1) {
        // Single touchpoint gets 100%
        attribution[filtered[0]] = 100;
    } else if (journeyLength === 2) {
        // Two touchpoints: split between first and last
        attribution[filtered[0]] = firstWeight * 100;
        attribution[filtered[1]] = lastWeight * 100;
    } else {
        // Three or more touchpoints
        const middleCount = journeyLength - 2;
        const middlePerTouchpoint = (middleWeight / middleCount) * 100;

        filtered.forEach((channelId, index) => {
            if (!attribution[channelId]) {
                attribution[channelId] = 0;
            }

            if (index === 0) {
                attribution[channelId] += firstWeight * 100;
            } else if (index === journeyLength - 1) {
                attribution[channelId] += lastWeight * 100;
            } else {
                attribution[channelId] += middlePerTouchpoint;
            }
        });
    }

    return attribution;
}

// Calculate Last Touch Attribution
function calculateLastTouch() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};

    const lastChannelId = filtered[filtered.length - 1];
    return { [lastChannelId]: 100 };
}

// Calculate First Touch Attribution
function calculateFirstTouch() {
    const filtered = getFilteredJourney();
    if (filtered.length === 0) return {};

    const firstChannelId = filtered[0];
    return { [firstChannelId]: 100 };
}

// Render attribution results
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

    // Display in the order of customer journey (not sorted by percentage)
    const orderedResults = [];
    const seenChannels = new Set();

    // First, add channels in the order they appear in the journey
    customerJourney.forEach(channelId => {
        if (!seenChannels.has(channelId) && attribution[channelId] !== undefined) {
            const channel = channels.find(c => c.id === channelId);
            if (channel) {
                orderedResults.push({ channel, percentage: attribution[channelId] });
                seenChannels.add(channelId);
            }
        }
    });

    container.innerHTML = '';

    orderedResults.forEach((item, index) => {
        const resultEl = document.createElement('div');
        resultEl.className = 'result-item';
        resultEl.innerHTML = `
            <div class="result-rank">#${index + 1}</div>
            <div class="result-channel-name">${item.channel.name}</div>
            <div class="result-bar-container">
                <div class="result-bar result-bar-${item.channel.color}" style="width: ${item.percentage}%">
                    ${item.percentage.toFixed(1)}%
                </div>
            </div>
        `;
        container.appendChild(resultEl);
    });
}

// Update all attribution results
function updateAllResults() {
    const weightedScore = calculateWeightedScore();
    const uShape = calculateUShape();
    const lastTouch = calculateLastTouch();
    const firstTouch = calculateFirstTouch();

    renderResults(weightedScore, 'weightedResults');
    renderResults(uShape, 'ushapeResults');
    renderResults(lastTouch, 'lastTouchResults');
    renderResults(firstTouch, 'firstTouchResults');

    renderAttributionInsights(weightedScore, uShape);

    updateTotalScore();
}

// Render attribution insights
function renderAttributionInsights(weightedScore, uShape) {
    const container = document.getElementById('attributionInsights');

    if (Object.keys(weightedScore).length === 0 || Object.keys(uShape).length === 0) {
        container.innerHTML = '';
        return;
    }

    // Find the biggest discrepancies
    const discrepancies = [];

    // Get all unique channels
    const allChannels = new Set([...Object.keys(weightedScore), ...Object.keys(uShape)]);

    allChannels.forEach(channelId => {
        const weighted = weightedScore[channelId] || 0;
        const uShapeVal = uShape[channelId] || 0;
        const diff = weighted - uShapeVal;

        if (Math.abs(diff) > 5) { // Only show if difference > 5%
            const channel = channels.find(c => c.id === channelId);
            if (channel) {
                discrepancies.push({
                    channel,
                    diff,
                    weighted,
                    uShapeVal
                });
            }
        }
    });

    if (discrepancies.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Sort by absolute difference (descending)
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
