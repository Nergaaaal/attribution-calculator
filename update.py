import sys

path = "/Users/nurbol/Documents/All Projects/Attribution/script_v35.js"
with open(path, "r") as f:
    content = f.read()

# Replace calculateWeightedScore
orig_weighted = """function calculateWeightedScore() {
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
}"""

new_weighted = """function calculateWeightedScore() {
    if (journey.length === 0) return {};

    // 1. Sequential deduplication
    const deduplicated = [];
    journey.forEach(item => {
        if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].id !== item.id) {
            deduplicated.push(item);
        }
    });

    // 2. Extract uniquely scored channels
    const uniqueIds = [...new Set(deduplicated.map(j => j.id))];
    let sum = 0;
    
    // get unique score sum
    const channelVals = {};
    uniqueIds.forEach(id => {
        // find item representing this id logic
        const item = deduplicated.find(i => i.id === id);
        const ch = channels.find(c => c.id === id);
        let s = ch ? ch.score : 0;
        if (id === 'stories' && item.logicActive) s = 0;
        if (id === 'offline' && item.logicActive) s = 2;
        channelVals[id] = s;
        sum += s;
    });

    if (sum === 0) return {};

    const result = {};
    uniqueIds.forEach(id => {
        const share = (channelVals[id] / sum) * 100;
        result[id] = share;
    });

    return result;
}"""

# Replace calculateUShape
orig_ushape = """function calculateUShape() {
    // Only filter out Stories when its logic is active
    // Offline logic affects score, not position
    const validItems = journey.filter(item => {
        if (item.id === 'stories' && item.logicActive) return false;
        return true;
    });

    const ids = validItems.map(j => j.id);
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
}"""

new_ushape = """function calculateUShape() {
    // 1. Sequential deduplication
    const deduplicated = [];
    journey.forEach(item => {
        if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].id !== item.id) {
            deduplicated.push(item);
        }
    });

    // Only filter out Stories when its logic is active
    // Offline logic affects score, not position
    const validItems = deduplicated.filter(item => {
        if (item.id === 'stories' && item.logicActive) return false;
        return true;
    });

    const ids = validItems.map(j => j.id);
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
        const middleIds = ids.slice(1, n - 1);
        const uniqueMiddle = [...new Set(middleIds)];
        if (uniqueMiddle.length > 0) {
            const middleShare = 20 / uniqueMiddle.length;
            uniqueMiddle.forEach(id => {
                result[id] += middleShare;
            });
        }
    }
    return result;
}"""

# Replace calculateFirstTouch, calculateLastTouch
orig_lt = """function calculateLastTouch() {
    const validItems = journey.filter(item => {
        if (item.id === 'stories' && item.logicActive) return false;
        return true;
    });

    if (validItems.length === 0) return {};
    const lastId = validItems[validItems.length - 1].id;
    return { [lastId]: 100 };
}"""

new_lt = """function calculateLastTouch() {
    // 1. Sequential deduplication
    const deduplicated = [];
    journey.forEach(item => {
        if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].id !== item.id) {
            deduplicated.push(item);
        }
    });

    const validItems = deduplicated.filter(item => {
        if (item.id === 'stories' && item.logicActive) return false;
        return true;
    });

    if (validItems.length === 0) return {};
    const lastId = validItems[validItems.length - 1].id;
    return { [lastId]: 100 };
}"""

orig_ft = """function calculateFirstTouch() {
    const validItems = journey.filter(item => {
        if (item.id === 'stories' && item.logicActive) return false;
        return true;
    });

    if (validItems.length === 0) return {};
    const firstId = validItems[0].id;
    return { [firstId]: 100 };
}"""

new_ft = """function calculateFirstTouch() {
    // 1. Sequential deduplication
    const deduplicated = [];
    journey.forEach(item => {
        if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].id !== item.id) {
            deduplicated.push(item);
        }
    });

    const validItems = deduplicated.filter(item => {
        if (item.id === 'stories' && item.logicActive) return false;
        return true;
    });

    if (validItems.length === 0) return {};
    const firstId = validItems[0].id;
    return { [firstId]: 100 };
}"""

orig_3models = """    dataset.forEach(row => {
        let path = [...row.path];

        // --- 1. Weighted (Original Logic: just zero out score) ---
        let totalScore = 0;
        const itemScores = path.map(channelId => {
            const chObj = channels.find(c => c.id === channelId);
            let score = chObj ? chObj.score : 1;
            if (useStoriesLogic && channelId === 'stories') score = 0;
            if (useOfflineLogic && channelId === 'offline') score = 2; // Penalty
            return { id: channelId, score: score };
        });

        const sumScores = itemScores.reduce((sum, item) => sum + item.score, 0);
        if (sumScores > 0) {
            itemScores.forEach(item => {
                weightedTotals[item.id] += (item.score / sumScores);
            });
        }

        // --- 2. U-Shape & Last Touch (Filtered Path Logic) ---
        // If Logic is ON, completely remove Stories/Offline from the path consideration for U-Shape/LT?
        // User Request: "Story doesn't disappear in U-Shape".
        // Interpretation: If Stories logic is ON, treat it as if it didn't exist in the chain for position-based models.

        let filteredPath = path.filter(id => {
            // Only Stories is excluded from U-Shape when logic is active
            // Offline logic only affects score, not position
            if (useStoriesLogic && id === 'stories') return false;
            return true;
        });

        if (filteredPath.length > 0) {
            const n = filteredPath.length;

            // Last Touch (on filtered)
            lastTouchTotals[filteredPath[n - 1]] += 1;

            // U-Shape (on filtered)
            if (n === 1) {
                uShapeTotals[filteredPath[0]] += 1;
            } else if (n === 2) {
                uShapeTotals[filteredPath[0]] += 0.5;
                uShapeTotals[filteredPath[1]] += 0.5;
            } else {
                uShapeTotals[filteredPath[0]] += 0.4;
                uShapeTotals[filteredPath[n - 1]] += 0.4;
                const mid = 0.2 / (n - 2);
                for (let k = 1; k < n - 1; k++) {
                    uShapeTotals[filteredPath[k]] += mid;
                }
            }
        }
    });"""

new_3models = """    dataset.forEach(row => {
        let rawPath = [...row.path];
        let path = [];
        if (rawPath.length > 0) {
            path.push(rawPath[0]);
            for (let i = 1; i < rawPath.length; i++) {
                 if (rawPath[i] !== rawPath[i - 1]) path.push(rawPath[i]);
            }
        }

        // --- 1. Weighted ---
        const uniqueChannels = [...new Set(path)];
        let totalScore = 0;
        const channelScoresMap = {};
        uniqueChannels.forEach(channelId => {
            const chObj = channels.find(c => c.id === channelId);
            let score = chObj ? chObj.score : 1;
            if (useStoriesLogic && channelId === 'stories') score = 0;
            if (useOfflineLogic && channelId === 'offline') score = 2; // Penalty
            channelScoresMap[channelId] = score;
            totalScore += score;
        });

        if (totalScore > 0) {
            uniqueChannels.forEach(channelId => {
                weightedTotals[channelId] += (channelScoresMap[channelId] / totalScore);
            });
        }

        // --- 2. U-Shape & Last Touch (Filtered Path Logic) ---
        let filteredPath = path.filter(id => {
            // Only Stories is excluded from U-Shape when logic is active
            if (useStoriesLogic && id === 'stories') return false;
            return true;
        });

        if (filteredPath.length > 0) {
            const n = filteredPath.length;

            // Last Touch (on filtered)
            lastTouchTotals[filteredPath[n - 1]] += 1;

            // U-Shape (on filtered)
            if (n === 1) {
                uShapeTotals[filteredPath[0]] += 1;
            } else if (n === 2) {
                uShapeTotals[filteredPath[0]] += 0.5;
                uShapeTotals[filteredPath[1]] += 0.5;
            } else {
                uShapeTotals[filteredPath[0]] += 0.4;
                uShapeTotals[filteredPath[n - 1]] += 0.4;
                
                const middleIds = filteredPath.slice(1, n - 1);
                const uniqueMiddle = [...new Set(middleIds)];
                if (uniqueMiddle.length > 0) {
                    const mid = 0.2 / uniqueMiddle.length;
                    uniqueMiddle.forEach(id => {
                        uShapeTotals[id] += mid;
                    });
                }
            }
        }
    });"""


if orig_weighted not in content:
    print("Error: orig_weighted not found!")
if orig_ushape not in content:
    print("Error: orig_ushape not found!")
if orig_3models not in content:
    print("Error: orig_3models not found!")

content = content.replace(orig_weighted, new_weighted)
content = content.replace(orig_ushape, new_ushape)
content = content.replace(orig_lt, new_lt)
content = content.replace(orig_ft, new_ft)
content = content.replace(orig_3models, new_3models)

with open(path, "w") as f:
    f.write(content)

print("Done updating script_v35.js")
