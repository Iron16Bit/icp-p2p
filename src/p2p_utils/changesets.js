// Algorithm based on changesets from etherpad: https://etherpad.org/
// A copy of their documentation is available in this folder

// A changeset has the following shape:
// {
//   "oldLen": int -> length of the text before modifications
//   "newLen": int -> length of the text after modifications
//   "modifications": [int|string] -> ints represent retained characters, strings represent added characters
// }

/**
 * @param {string} oldText
 * @param {string} newText
 */
export function computeChangeset(oldText, newText) {
    let modifications = [];
    
    // Find LCS (retained characters)
    let dp = Array.from({ length: oldText.length + 1 }, () => Array(newText.length + 1).fill(0));
    
    for (let i = 1; i <= oldText.length; i++) {
        for (let j = 1; j <= newText.length; j++) {
            if (oldText[i - 1] === newText[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to find the LCS sequence
    let i = oldText.length, j = newText.length, lcs = [];
    while (i > 0 && j > 0) {
        if (oldText[i - 1] === newText[j - 1]) {
            lcs.unshift({ index: i - 1, char: oldText[i - 1] });
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    // Build the modifications array
    let lastIndex = 0;
    for (let k = 0; k < lcs.length; k++) {
        let { index, char } = lcs[k];

        // Capture any inserted characters before the retained character
        let added = newText.slice(lastIndex, newText.indexOf(char, lastIndex));
        if (added) modifications.push(added);

        // Push the retained index
        modifications.push(index);
        lastIndex = newText.indexOf(char, lastIndex) + 1;
    }

    // Capture any remaining inserted characters at the end
    if (lastIndex < newText.length) {
        modifications.push(newText.slice(lastIndex));
    }

    const changeset = {
        "oldLen": oldText.length,
        "newLen": newText.length,
        "modifications": modifications,
    }

    return changeset;
}

/**
 * @param {{"oldLen": number, "newLen": number, "modifications": [number | string]}} changesetA
 * @param {{"oldLen": number, "newLen": number, "modifications": [number | string]}} changesetB
 */
// Merge 2 changesets
export function mergeChangesets(changesetA, changesetB) {
    let mergedModifications = [];
    let mergedRetained = [];
    let modificationsA = changesetA["modifications"];
    let modificationsB = changesetB["modifications"];

    // Find common retained indexes
    for (var i = 0; i < modificationsA.length; i++) {
        if (modificationsB.includes(modificationsA[i]) && typeof modificationsA[i] === "number") {
            mergedRetained.push(modificationsA[i]);
        }
    }

    let addedA = [];
    let addedB = [];
    var leftMargin = -1;

    // Process additions for A
    for (var i = 0; i < modificationsA.length; i++) {
        if (typeof modificationsA[i] === "number") {
            // @ts-ignore
            leftMargin = modificationsA[i];
        } else {
            let rightMargin = (i+1 < modificationsA.length && typeof modificationsA[i+1] === "number") 
                ? modificationsA[i+1] 
                : Number.MAX_SAFE_INTEGER;
            addedA.push([leftMargin, modificationsA[i], rightMargin]);
        }
    }

    // Process additions for B
    leftMargin = -1;
    for (var i = 0; i < modificationsB.length; i++) {
        if (typeof modificationsB[i] === "number") {
            // @ts-ignore
            leftMargin = modificationsB[i];
        } else {
            let rightMargin = (i+1 < modificationsB.length && typeof modificationsB[i+1] === "number") 
                ? modificationsB[i+1] 
                : Number.MAX_SAFE_INTEGER;
            addedB.push([leftMargin, modificationsB[i], rightMargin]);
        }
    }

    // @ts-ignore
    mergedModifications = mergeArrays(mergedRetained, addedA, addedB);

    var finalLen = 0;
    for (var i=0; i<mergedModifications.length; i++) {
        if (typeof mergedModifications[i] === "number") {
            finalLen += 1;
        } else {
            finalLen += mergedModifications[i].length;
        }
    }

    return { "oldLen": changesetA.oldLen, "newLen": finalLen, "modifications": mergedModifications};
}

/**
 * @param {[number]} mergedRetained
 * @param {[string]} addedA
 * @param {[string]} addedB
 */
function mergeArrays(mergedRetained, addedA, addedB) {
    let mergedModifications = [];
    let allEntries = [];

    // Add retained indexes
    mergedRetained.forEach((num) => {
        allEntries.push({ type: 'number', value: num, position: num });
    });

    // Add string additions
    addedA.forEach(([leftMargin, str, rightMargin]) => {
        allEntries.push({ type: 'string', value: str, leftMargin, rightMargin });
    });
    addedB.forEach(([leftMargin, str, rightMargin]) => {
        allEntries.push({ type: 'string', value: str, leftMargin, rightMargin });
    });

    // Custom sorting to preserve original order
    allEntries.sort((a, b) => {
        // Prioritize original changeset order
        let aPos = a.type === 'number' ? a.value : a.leftMargin;
        let bPos = b.type === 'number' ? b.value : b.leftMargin;

        // If positions are different, sort by position
        if (aPos !== bPos) return aPos - bPos;

        // Prefer numbers over strings at same position
        if (a.type === 'number' && b.type === 'string') return -1;
        if (a.type === 'string' && b.type === 'number') return 1;

        // If both are strings or both are numbers, maintain original order
        return 0;
    });

    // Remove duplicates while preserving order
    let lastValue = null;
    allEntries.forEach(entry => {
        if (entry.value !== lastValue) {
            mergedModifications.push(entry.value);
            lastValue = entry.value;
        }
    });

    return mergedModifications;
}

/**
 * @param {{"oldLen": number, "newLen": number, "modifications": [number | string]}} changesetA
 * @param {{"oldLen": number, "newLen": number, "modifications": [number | string]}} mergedChangeset
 */
export function computeFollow(changesetA, mergedChangeset) {
    // Tells us how to go from A to merged

    return mergedChangeset["modifications"].map(item => {
        const index = changesetA["modifications"].indexOf(item);
        return index !== -1 ? index : item;
    });
}