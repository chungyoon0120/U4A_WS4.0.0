'use strict';

async function listTargets(debugHost) {
    try {
        const res = await fetch(`${debugHost}/json/list`);
        return await res.json();
    } catch (e) {
        return null;
    }
}

function pickMainWindow(list) {
    if (!Array.isArray(list)) {
        return null;
    }
    const found = list.find((x) => x && x.type === 'page' && /#Main/.test(x.title || ''));
    return found || null;
}

module.exports = {
    listTargets,
    pickMainWindow
};
