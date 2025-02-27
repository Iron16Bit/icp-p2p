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
    
    // Find all common subsequences (LCS)
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

    // From the common subsequences, obtain the retained characters
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

        let added = newText.slice(lastIndex, newText.indexOf(char, lastIndex));
        if (added) modifications.push(added);

        modifications.push(index);
        lastIndex = newText.indexOf(char, lastIndex) + 1;
    }
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

export function applyChangeset(text, changeset) {
    let result = "";

    for (const mod of changeset.modifications) {
        if (typeof mod === "number") {
            result += text[mod];
        } else if (typeof mod === "string") {
            result += mod;
        }
    }

    return result;
}

export function getCursorPosition(oldText, newText, cursorPos) {
    let cursorOffset = 0;

    // Compare the oldText and newText until the cursor position to determine the offset
    for (let i = 0; i < cursorPos; i++) {
        if (oldText[i] !== newText[i + cursorOffset]) {
            let diffIndex = newText.indexOf(oldText[i], i + cursorOffset);
            if (diffIndex === -1) {
                cursorOffset++;
            } else {
                cursorOffset += diffIndex - (i + cursorOffset);
            }
        }
    }
    
    return cursorPos + cursorOffset;
}