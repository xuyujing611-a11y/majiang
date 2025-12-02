// src/utils.js
export const generateDeck = () => {
    let deck = [];
    ['wan', 'tiao', 'tong'].forEach(suit => {
        for (let i = 1; i <= 9; i++) {
            for (let j = 0; j < 4; j++) { deck.push({ id: `${suit}-${i}-${j}`, suit, value: i }); }
        }
    });
    const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };
    return shuffle(deck);
};

// 辅助：统计牌的数量
const countTiles = (tiles) => {
    const counts = {};
    tiles.forEach(t => { 
        const key = `${t.suit}-${t.value}`; 
        counts[key] = (counts[key] || 0) + 1; 
    });
    return counts;
};

// 新增：计算番数
export const calculateFan = (hand, exposed, winTile, isZimo) => {
    // 确保 hand 不为空
    if (!hand || hand.length === 0) return { totalFan: 0, details: [], scoreMultiplier: 1 };

    const allTiles = [...hand, ...exposed.reduce((acc, e) => [...acc, ...e.tiles], [])];
    const handCounts = countTiles(hand);
    const allCounts = countTiles(allTiles);
    
    let fan = 0;
    let details = [];

    // 1. 清一色
    const firstSuit = allTiles[0].suit;
    if (allTiles.every(t => t.suit === firstSuit)) {
        fan += 2; details.push("清一色(2番)");
    }

    // 2. 七小对
    let isQiDui = false;
    if (exposed.length === 0 && hand.length === 14) {
        const pairCount = Object.values(handCounts).reduce((acc, c) => acc + (c === 2 ? 1 : (c === 4 ? 2 : 0)), 0);
        if (pairCount === 7) {
            isQiDui = true; fan += 2; details.push("七小对(2番)");
        }
    }

    // 3. 对对胡 (简化判断：无顺子)
    if (!isQiDui) {
        // 简易判断：只要没有顺子结构就是对对胡
        const hasSequence = Object.keys(handCounts).some(key => {
            const [s, vStr] = key.split('-');
            const v = parseInt(vStr);
            return (handCounts[key] > 0 && handCounts[`${s}-${v+1}`] > 0 && handCounts[`${s}-${v+2}`] > 0);
        });
        if (!hasSequence) {
            fan += 1; details.push("对对胡(1番)");
        }
    }

    // 4. 带根
    let genCount = 0;
    Object.values(allCounts).forEach(c => { if (c === 4) genCount++; });
    if (genCount > 0) {
        fan += genCount; details.push(`带根(x${genCount})`);
    }

    if (isZimo) { fan += 1; details.push("自摸(1番)"); }
    if (fan === 0) fan = 0; 

    return { totalFan: fan, details, scoreMultiplier: Math.pow(2, fan) };
};

export const checkMahjongWin = (tiles) => {
    if (tiles.length === 0) return true;
    const counts = countTiles(tiles);
    // 七对
    if (tiles.length === 14) {
        const pCount = Object.values(counts).reduce((acc, c) => acc + (c===2?1:(c===4?2:0)), 0);
        if (pCount === 7) return true;
    }
    // 标准
    const keys = Object.keys(counts);
    for (let k of keys) {
        if (counts[k] >= 2) {
            const temp = {...counts}; temp[k] -= 2;
            if (checkMelds(temp)) return true;
        }
    }
    return false;
};

const checkMelds = (currentCounts) => {
    const keys = Object.keys(currentCounts).filter(k => currentCounts[k] > 0);
    if (keys.length === 0) return true;
    const key = keys[0];
    const [suit, valStr] = key.split('-'); const val = parseInt(valStr);

    // 刻子
    if (currentCounts[key] >= 3) {
        currentCounts[key] -= 3;
        if (checkMelds(currentCounts)) return true;
        currentCounts[key] += 3;
    }
    // 顺子
    const k1=key, k2=`${suit}-${val+1}`, k3=`${suit}-${val+2}`;
    if (currentCounts[k1]>0 && currentCounts[k2]>0 && currentCounts[k3]>0) {
        currentCounts[k1]--; currentCounts[k2]--; currentCounts[k3]--;
        if (checkMelds(currentCounts)) return true;
        currentCounts[k1]++; currentCounts[k2]++; currentCounts[k3]++;
    }
    return false;
};

export const analyzeHandPotential = (hand, exposed) => {
    const allTiles = [...hand, ...exposed.reduce((acc, e) => [...acc, ...e.tiles], [])];
    if (allTiles.length === 0) return { tags: [] };
    const tags = [];
    if (allTiles.every(t => t.suit === allTiles[0].suit)) tags.push("清一色");
    return { tags };
};