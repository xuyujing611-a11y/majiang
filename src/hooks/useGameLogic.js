// src/hooks/useGameLogic.js
import { useEffect } from 'react';
import { db } from '../firebase';
import { generateDeck, calculateFan } from '../utils';

const APP_ID = 'sichuan-mj-v1';
const TURN_TIMEOUT_SECONDS = 15;

// --- 音频逻辑 ---
let globalAudioCtx = null;
const initAudio = () => {
    if (!globalAudioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) globalAudioCtx = new AudioContext();
    }
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume().catch(e => console.log("Audio resume failed", e));
    }
};

export const playSound = (type, tile = null) => {
    initAudio();
    const actionSrc = type === 'draw' ? 'assets/click.mp3' : `assets/${type}.mp3`;
    const actionAudio = new Audio(actionSrc);
    actionAudio.volume = 0.7;
    actionAudio.play().catch(() => {});

    if (tile && type === 'click') {
        setTimeout(() => {
            const voiceSrc = `assets/${tile.suit}${tile.value}.mp3`;
            const voiceAudio = new Audio(voiceSrc);
            voiceAudio.volume = 1.0;
            voiceAudio.play().catch(e => {});
        }, 100); 
    }
};

// --- Hook 主体 ---
const useGameLogic = (room, roomId, userId) => {
    
    // 【血流修正】获取下一个玩家（不再跳过已胡牌玩家）
    const getNextActivePlayerIndex = (currentIndex, players) => {
        return (currentIndex + 1) % players.length;
    };

    // 辅助：游戏结束/本局结算处理
    const handleGameEnd = async (currentPlayers, currentWall) => {
        const roomRef = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms').doc(roomId);
        
        const winners = currentPlayers.filter(p => p.isHu).map(p => ({
            name: p.name,
            // 如果支持多胡，这里可能需要聚合所有胡牌记录，此处简化取最后状态
            hand: p.huDetails?.hand || p.hand, 
            scoreChange: p.huDetails?.scoreChange || 0,
            isZimo: p.huDetails?.isZimo,
            fanDetails: p.huDetails?.fanResult?.details || []
        }));

        const summaryData = {
           winners: winners,
           timestamp: Date.now()
        };

        await roomRef.update({
            players: currentPlayers,
            gameState: 'round_summary',
            roundSummary: summaryData,
            lastRoundResult: summaryData,
            wall: currentWall
        });
    };

    // 核心：统一操作处理
    const handleAction = async (type, payload = {}, autoTile = null, selectedTile = null) => {
        const roomRef = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms').doc(roomId);
        const myIndex = room.players.findIndex(p => p.id === userId);
        if (myIndex === -1) return;

        // 深拷贝防止直接修改 state
        const newPlayers = JSON.parse(JSON.stringify(room.players)); 
        const myP = newPlayers[myIndex];
        const update = {};
        const resetDeadline = () => { update.turnDeadline = Date.now() + (TURN_TIMEOUT_SECONDS * 1000); };

        if (type === 'void') {
            myP.voidSuit = payload;
            if (newPlayers.every(p => p.voidSuit)) { 
                update.gameState = 'playing'; 
                resetDeadline(); 
            }
        }
        else if (type === 'draw') {
            // 注意：血流中，如果玩家胡牌了，他依然会执行摸牌动作（轮到他时）
            if (myP.hand.length % 3 !== 1) return; 
            playSound('draw');
            let wall = [...room.wall];
            if (wall.length > 0) {
                myP.hand.forEach(t => delete t.isNew);
                const draw = wall.pop(); 
                draw.isNew = true; 
                myP.hand.push(draw);
                update.wall = wall; 
                update.lastDiscard = null; 
                resetDeadline();
            } else { 
                handleGameEnd(newPlayers, room.wall);
                return;
            }
        }
        else if (type === 'discard') {
            const tileToPlay = autoTile || selectedTile;
            if (!tileToPlay) return;
            
            // 定缺校验
            const hasVoidSuit = myP.hand.some(t => t.suit === myP.voidSuit);
            if (hasVoidSuit && tileToPlay.suit !== myP.voidSuit) {
                alert("请先打出定缺花色！");
                return;
            }

            playSound('click', tileToPlay);
            myP.hand = myP.hand.filter(t => t.id !== tileToPlay.id).sort((a,b)=>a.suit===b.suit?a.value-b.value:a.suit.localeCompare(b.suit));
            myP.discards = [...(myP.discards||[]), tileToPlay];
            
            // 【血流修正】即使下家已胡，也轮到下家
            let next = getNextActivePlayerIndex(room.turnIndex, newPlayers);
            let wall = [...room.wall];
            
            // 只有当牌墙空了才结束（或在draw时判断）
            if (wall.length === 0) { 
                 handleGameEnd(newPlayers, wall);
                 return;
            }

            update.turnIndex = next; 
            update.lastDiscard = { tile: tileToPlay, from: myIndex }; 
            resetDeadline();
        }
        else if (type === 'peng') {
            playSound('peng');
            const target = room.lastDiscard.tile;
            let removedCount = 0;
            myP.hand = myP.hand.filter(t => {
                if (t.suit === target.suit && t.value === target.value && removedCount < 2) {
                    removedCount++;
                    return false;
                }
                return true;
            });
            myP.exposed = [...(myP.exposed||[]), { type: 'peng', tiles: [target, target, target] }];
            
            const fromP = newPlayers[room.lastDiscard.from]; 
            if (fromP && fromP.discards) fromP.discards.pop();
            
            update.turnIndex = myIndex; 
            update.lastDiscard = null; 
            resetDeadline();
        }
        else if (type === 'gang') {
            playSound('gang');
            let wall = [...room.wall]; 
            let didGang = false;
            
            if (payload.isAn) {
                const counts = {}; myP.hand.forEach(t=>{const k=`${t.suit}-${t.value}`; counts[k]=(counts[k]||0)+1;});
                const key = Object.keys(counts).find(k=>counts[k]===4);
                if(key) { 
                    const [s,v] = key.split('-'); 
                    const toGang = myP.hand.filter(t=>t.suit===s&&t.value==v); 
                    myP.hand = myP.hand.filter(t=>t.suit!==s||t.value!=v); 
                    myP.exposed = [...(myP.exposed||[]), { type: 'angang', tiles: toGang }]; 
                    didGang = true;
                    newPlayers.forEach((p, idx) => {
                        if (idx !== myIndex) { p.score -= 200; myP.score += 200; }
                    });
                }
            } else if (payload.isBu) { 
                const exposedPeng = myP.exposed.find(exp => exp.type === 'peng' && myP.hand.some(t => t.suit === exp.tiles[0].suit && t.value === exp.tiles[0].value));
                if (exposedPeng) { 
                    const tileToAdd = myP.hand.find(t => t.suit === exposedPeng.tiles[0].suit && t.value === exposedPeng.tiles[0].value); 
                    myP.hand = myP.hand.filter(t => t !== tileToAdd); 
                    exposedPeng.tiles.push(tileToAdd); 
                    exposedPeng.type = 'angang';
                    didGang = true; 
                    newPlayers.forEach((p, idx) => {
                        if (idx !== myIndex) { p.score -= 100; myP.score += 100; }
                    });
                }
            } else { 
                const target = room.lastDiscard.tile; 
                const toGang = myP.hand.filter(t => t.suit === target.suit && t.value === target.value); 
                if (toGang.length === 3) {
                    myP.hand = myP.hand.filter(t => !toGang.includes(t)); 
                    myP.exposed = [...(myP.exposed||[]), { type: 'zhigang', tiles: [...toGang, target] }]; 
                    const fromP = newPlayers[room.lastDiscard.from]; 
                    if (fromP && fromP.discards) fromP.discards.pop();
                    fromP.score -= 200; myP.score += 200;
                    didGang = true;
                }
            }

            if (didGang) {
                myP.hand.forEach(t => delete t.isNew);
                const draw = wall.pop(); 
                if(draw) { 
                    draw.isNew = true; 
                    myP.hand.push(draw); 
                    update.wall = wall; 
                    update.turnIndex = myIndex; 
                    update.lastDiscard = null; 
                    resetDeadline();
                } else {
                     handleGameEnd(newPlayers, wall);
                     return;
                }
            }
        }
        else if (type === 'hu') {
            playSound('hu');
            const winTile = myP.hand[myP.hand.length-1];
            // 当前版本只支持自摸按钮触发，后续可扩展点炮
            const isZimo = true; 
            const fanResult = calculateFan(myP.hand, myP.exposed || [], winTile, isZimo);
            const baseScore = 100;
            const scoreChange = baseScore * fanResult.scoreMultiplier;
            const roundedScore = Math.round(scoreChange);

            // 【血流核心】标记胡牌，但游戏不结束
            myP.isHu = true;
            // 记录胡牌次数，可用于后续结算展示
            myP.huCount = (myP.huCount || 0) + 1;
            
            // 累加分数，而不是覆盖
            if (!myP.huDetails) {
                myP.huDetails = {
                    scoreChange: 0,
                    hand: [...myP.hand], // 记录第一次胡牌的手牌
                    fanResult: fanResult,
                    isZimo
                };
            }
            myP.huDetails.scoreChange += roundedScore;

            // 扣分逻辑
            newPlayers.forEach((p, i) => {
                if (i !== myIndex) { 
                    p.score -= roundedScore;
                    myP.score += roundedScore;
                }
            });

            // 【血流核心】只有牌墙摸完才结束
            if (room.wall.length === 0) {
                handleGameEnd(newPlayers, room.wall);
                return;
            } else {
                // 自摸胡牌后，玩家手牌数为14张（或13+1），依然是该玩家的回合
                // 该玩家必须打出一张牌，游戏才能继续流转
                update.turnIndex = myIndex;
                update.lastDiscard = null; 
                resetDeadline();
                // 此时前端UI需要检测到 isMyTurn 且 hand.length % 3 === 2，允许出牌
            }
        }
        
        update.players = newPlayers;
        await roomRef.update(update);
    };

    const startNewGameLogic = async () => {
        const deck = generateDeck();
        if (room.remove10 && room.players.length === 2) deck.splice(0, 10); 
        
        const newPlayers = room.players.map(p => ({
            ...p, 
            hand: deck.splice(0, 13), 
            discards: [], 
            exposed: [], 
            voidSuit: null,
            isHu: false, 
            huCount: 0,
            huDetails: null
        }));

        await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms').doc(roomId).update({
            wall: deck,
            players: newPlayers,
            turnIndex: 0, 
            lastDiscard: null,
            gameState: 'void_selection', 
            roundSummary: null,
            turnDeadline: null
        });
    };

    const handleNextGame = async () => {
        await startNewGameLogic();
    };

    useEffect(() => {
        const maxPlayers = room.maxPlayers || 4;
        if (room.gameState === 'waiting' && room.players.length === maxPlayers) {
            const isHost = room.players[0].id === userId;
            if (isHost) {
                startNewGameLogic();
            }
        }
    }, [room.players.length, room.gameState, userId, room.maxPlayers]);

    return { handleAction, handleNextGame, playSound, TURN_TIMEOUT_SECONDS };
};

export default useGameLogic;