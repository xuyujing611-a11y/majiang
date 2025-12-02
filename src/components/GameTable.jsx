// src/components/GameTable.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { analyzeHandPotential, checkMahjongWin } from '../utils';
import MahjongTile from './MahjongTile';
import PlayerAvatar from './PlayerAvatar';
import BackgroundMusic from './BackgroundMusic';
import RoundSummary from './RoundSummary';
import useGameLogic from '../hooks/useGameLogic';

// 小组件：牌背
const MahjongBack = ({ size = "md" }) => {
    const sizeClass = {
        mini: "w-5 h-7",
        sm: "w-6 h-9",
        md: "w-8 h-12",
        lg: "w-10 h-14"
    }[size] || "w-8 h-12";
    return <div className={`${sizeClass} bg-[#0d47a1] border border-blue-400 rounded-sm shadow-md`}></div>;
};

const GameTable = ({ room, roomId, userId, leaveRoom }) => {
    const { handleAction, handleNextGame, playSound, TURN_TIMEOUT_SECONDS } = useGameLogic(room, roomId, userId);
    
    // 本地视觉状态
    const [selectedTile, setSelectedTile] = useState(null);
    const [timeLeft, setTimeLeft] = useState(TURN_TIMEOUT_SECONDS);
    const [visibleHandCount, setVisibleHandCount] = useState(0); 
    const [showHistory, setShowHistory] = useState(false);

    const myIndex = room.players.findIndex(p => p.id === userId);
    const me = room.players[myIndex];
    const maxPlayers = room.maxPlayers || 4;

    // 用于防止自动胡牌/出牌过于频繁的Ref
    const autoActionTimer = useRef(null);

    if (!me) return <div className="flex h-full items-center justify-center text-white">数据加载中...</div>;

    const isMyTurn = room.turnIndex === myIndex;
    const isPlaying = room.gameState === 'playing';
    const isVoidSelection = room.gameState === 'void_selection';
    const isWaiting = room.gameState === 'waiting'; 
    const amIHu = me.isHu || false;

    // 【血流修正】胡牌后依然可以交互（出牌），但通常不能碰/杠
    const canInteract = isPlaying && isMyTurn; 
    
    // 摸牌逻辑：如果是我的回合，且手牌数量为 1/4/7/10/13，则需要摸牌
    const needsToDraw = canInteract && (me.hand.length % 3 === 1);
    
    // 动作判断逻辑
    
    // 1. 碰 (血流规则：胡牌后不能碰)
    const canPeng = isPlaying && room.lastDiscard && room.lastDiscard.from !== myIndex 
                    && me.hand.filter(t => t.suit === room.lastDiscard.tile.suit && String(t.value) === String(room.lastDiscard.tile.value)).length >= 2
                    && room.lastDiscard.tile.suit !== me.voidSuit
                    && !amIHu; // 已胡牌不能碰

    // 2. 直杠 (血流规则：胡牌后不能直杠)
    const canZhiGang = isPlaying && room.lastDiscard && room.lastDiscard.from !== myIndex
                     && me.hand.filter(t => t.suit === room.lastDiscard.tile.suit && String(t.value) === String(room.lastDiscard.tile.value)).length === 3
                     && room.lastDiscard.tile.suit !== me.voidSuit
                     && !amIHu; // 已胡牌不能杠

    // 3. 暗杠/补杠 
    // 【关键】：胡牌后，如果摸到牌可以杠，允许杠（可以增加收益），此时需要暂停自动出牌
    const canAnGang = isPlaying && isMyTurn && (
        Object.values(me.hand.reduce((acc, t) => { acc[`${t.suit}-${t.value}`] = (acc[`${t.suit}-${t.value}`]||0)+1; return acc; }, {})).some(c => c === 4) ||
        (me.exposed && me.exposed.some(exp => exp.type === 'peng' && me.hand.some(t => t.suit === exp.tiles[0].suit && String(t.value) === String(exp.tiles[0].value))))
    );

    const currentPotential = useMemo(() => me.hand ? analyzeHandPotential(me.hand, me.exposed || []) : {}, [me.hand, me.exposed]);

    // ================== 优化：胡牌后自动托管逻辑 ==================
    // 自动出牌函数：优先打缺，否则打出最后摸到的牌（摸切）
    const handleAutoDiscard = () => {
        if (!me.hand || me.hand.length === 0) return;
        
        let tileToDiscard = null;

        // 1. 优先处理缺门
        if (me.voidSuit) {
            const voidTile = me.hand.find(t => t.suit === me.voidSuit);
            if (voidTile) tileToDiscard = voidTile;
        }

        // 2. 没缺门，默认打出最后一张（模拟摸切，不破坏现有胡牌结构）
        if (!tileToDiscard) {
            tileToDiscard = me.hand[me.hand.length - 1];
        }

        if (tileToDiscard) {
            handleAction('discard', null, tileToDiscard);
        }
    };

    useEffect(() => {
        // 条件：必须已胡牌 且 游戏进行中
        if (!amIHu || !isPlaying) return;

        // 清除旧定时器
        if (autoActionTimer.current) clearTimeout(autoActionTimer.current);

        autoActionTimer.current = setTimeout(() => {
            // A. 轮到我
            if (isMyTurn) {
                // 1. 自动摸牌 (优先级最高)
                if (needsToDraw) {
                    handleAction('draw');
                    return;
                }

                // 2. 检测杠 (关键逻辑：如果有杠，直接 RETURN，停止自动化，等待用户操作)
                if (canAnGang) {
                    // 这里不执行任何操作，UI 会显示“杠”按钮
                    // 用户可以选择点“杠”，或者点一张手牌“出牌”（从而跳过杠）
                    return; 
                }

                // 3. 检测自摸胡
                // 血流成河允许胡了再胡。如果当前手牌满足胡牌条件，自动胡。
                if (checkMahjongWin(me.hand) && !me.hand.some(t => t.suit === me.voidSuit)) {
                    handleAction('hu');
                    return;
                }

                // 4. 自动出牌 (没杠、没自摸的情况下)
                handleAutoDiscard();
            } 
            // B. 没轮到我 (检测点炮胡)
            else {
                if (room.lastDiscard && room.lastDiscard.from !== myIndex) {
                    const tempHand = [...me.hand, room.lastDiscard.tile];
                    if (checkMahjongWin(tempHand) && room.lastDiscard.tile.suit !== me.voidSuit) {
                        handleAction('hu');
                    }
                }
            }
        }, 800); // 800ms 延迟，给玩家反应时间

        return () => clearTimeout(autoActionTimer.current);
    }, [amIHu, isPlaying, isMyTurn, me.hand, room.lastDiscard, canAnGang, needsToDraw, me.huCount]); 
    // ============================================================


    useEffect(() => {
        if ((isVoidSelection || isPlaying) && me.hand && me.hand.length > 0) {
            if (visibleHandCount === 0) {
                 const t = setTimeout(() => setVisibleHandCount(1), 100);
                 return () => clearTimeout(t);
            }
        }
        if (isWaiting) {
            setVisibleHandCount(0);
        }
    }, [room.gameState, roomId, me.hand?.length, isWaiting, isVoidSelection, isPlaying]); 

    useEffect(() => {
        if (visibleHandCount > 0 && visibleHandCount < 13) {
            const timer = setTimeout(() => {
                playSound('draw');
                setVisibleHandCount(prev => prev + 1);
            }, 100);
            return () => clearTimeout(timer);
        } else if (visibleHandCount === 13) {
             setVisibleHandCount(14); 
        }
    }, [visibleHandCount, playSound]);

    // 超时倒计时逻辑（保持不变）
    useEffect(() => {
        if (room.gameState !== 'playing') { setTimeLeft(null); return; }
        const interval = setInterval(() => {
            if (!room.turnDeadline) return;
            const delta = Math.floor((room.turnDeadline - Date.now()) / 1000);
            setTimeLeft(delta);
            if (delta <= 0 && isMyTurn) {
                if (needsToDraw) handleAction('draw');
                else handleAutoDiscard();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [room.turnDeadline, room.gameState, isMyTurn, needsToDraw, me.isHu]);

    const onNextGameClick = async () => {
        setVisibleHandCount(0);
        await handleNextGame();
    };

    const getRelativePosition = (index) => {
        const total = room.players.length;
        const diff = (index - myIndex + total) % total;
        if (total === 2 && diff === 1) return 'top';
        if (diff === 1) return 'right';
        if (diff === 2) return 'top';
        if (diff === 3) return 'left';
        return 'bottom';
    };

    const renderOther = (p, pos) => {
        if (!p) return null;
        const isActive = room.players[room.turnIndex]?.id === p.id;
        const isHu = p.isHu;
        
        const layoutClass = {
            top: 'flex-col-reverse',
            left: 'flex-row-reverse items-center',
            right: 'flex-row items-center',
        }[pos];

        const renderBacks = () => {
            if (isWaiting) return null; 
            if (pos === 'top') return <div className="flex gap-1">{Array(Math.min(p.hand.length, 13)).fill(0).map((_,i)=><MahjongBack key={i} size="sm"/>)}</div>;
            return <div className={`flex flex-col gap-1`}>{Array(Math.min(p.hand.length, 13)).fill(0).map((_,i)=><div key={i} className={`w-8 h-5 bg-blue-800 rounded border border-blue-400 ${pos==='left'?'rotate-90':'-rotate-90'}`}></div>)}</div>;
        };

        return (
            <div className={`flex ${layoutClass} gap-2`}>
                <div className="flex flex-col items-center relative">
                    <PlayerAvatar seed={p.name} size="sm" isActive={isActive} />
                    {isHu && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1 rounded-full animate-pulse border border-white">胡</div>}
                    <div className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded mt-1 text-center min-w-[60px]">
                        <div className="truncate w-16">{p.name}</div>
                        {p.voidSuit && <span className={`text-[10px] ${p.voidSuit==='wan'?'text-red-400':(p.voidSuit==='tong'?'text-blue-400':'text-green-400')}`}>
                             {p.voidSuit==='wan'?'缺万':(p.voidSuit==='tong'?'缺筒':'缺条')}
                        </span>}
                        <div className="text-yellow-200">💰{Math.floor(p.score)}</div>
                    </div>
                </div>
                <div className="flex flex-col items-center">
                    {p.exposed && p.exposed.length > 0 && (
                        <div className={`flex gap-1 mb-1 ${pos==='left'||pos==='right'?'flex-col':''}`}>
                            {p.exposed.map((g,i)=><div key={i} className="flex transform scale-50 bg-yellow-900/30 p-1 rounded">{g.tiles.map((t,k)=><MahjongTile key={k} suit={t.suit} value={t.value} size="mini"/>)}</div>)}
                        </div>
                    )}
                    {renderBacks()}
                </div>
            </div>
        );
    };

    const renderUnifiedDiscards = () => {
        const topP = room.players.find((p,i) => getRelativePosition(i) === 'top');
        const leftP = room.players.find((p,i) => getRelativePosition(i) === 'left');
        const rightP = room.players.find((p,i) => getRelativePosition(i) === 'right');

        const DiscardPile = ({ tiles, pos }) => {
            if (!tiles || tiles.length === 0) return null;
            const displayTiles = tiles.slice(-12); 
            
            let containerClass = "flex gap-0.5 pointer-events-none";
            if (pos === 'top') containerClass += " flex-row flex-wrap justify-center content-end w-full h-full px-4 pb-1";
            else if (pos === 'left') containerClass += " flex-row flex-wrap justify-center content-center w-full h-full p-1 pl-2";
            else if (pos === 'right') containerClass += " flex-row flex-wrap justify-center content-center w-full h-full p-1 pr-2";

            return (
                <div className={containerClass}>
                    {displayTiles.map((t, i) => (
                        <div key={i} className="transform scale-75 shadow-sm">
                            <MahjongTile suit={t.suit} value={t.value} size="mini" />
                        </div>
                    ))}
                </div>
            );
        };

        return (
            <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 w-full h-[28%] z-10"><DiscardPile tiles={topP?.discards} pos="top" /></div>
                <div className="absolute top-[28%] left-0 w-[22%] h-[44%] z-10"><DiscardPile tiles={leftP?.discards} pos="left" /></div>
                <div className="absolute top-[28%] right-0 w-[22%] h-[44%] z-10"><DiscardPile tiles={rightP?.discards} pos="right" /></div>

                <div className="absolute top-[28%] left-[22%] w-[56%] h-[44%] z-20 flex flex-col items-center justify-center pointer-events-auto">
                     {isWaiting ? (
                        <div className="text-center animate-pulse">
                            <div className="text-white text-lg font-bold mb-1">等待玩家加入...</div>
                            <div className="text-yellow-300 text-sm">({room.players.length}/{maxPlayers})</div>
                        </div>
                     ) : (
                         <>
                            {needsToDraw ? (
                                <div onClick={(e)=>{ e.stopPropagation(); handleAction('draw'); }} 
                                    className="w-16 h-20 bg-blue-600 rounded-lg border-2 border-yellow-400 shadow-xl flex items-center justify-center cursor-pointer animate-pulse hover:bg-blue-500 transition active:scale-95 touch-manipulation">
                                    <span className="text-white font-bold writing-vertical text-lg select-none drop-shadow-md">摸牌</span>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-yellow-400 font-bold text-sm bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm shadow mb-1 whitespace-nowrap">
                                        {room.gameState==='void_selection'
                                            ? "请定缺"
                                            : (room.gameState==='playing'
                                                ? (isMyTurn
                                                    ? (me.isHu 
                                                        ? (canAnGang ? "请选择：杠牌 或 出牌" : "已胡 - 自动托管中...") 
                                                        : "请出牌")
                                                    : "等待")
                                                : "")
                                        }
                                    </div>
                                    {room.gameState==='playing' && timeLeft!==null && (
                                        <div className={`text-3xl font-bold drop-shadow-md ${timeLeft < 5 ? 'text-red-500 animate-bounce' : 'text-white'}`}>
                                            {timeLeft}
                                        </div>
                                    )}
                                </div>
                            )}
                         </>
                     )}
                </div>
            </div>
        );
    };

    if (room.gameState === 'round_summary' && room.roundSummary) {
        return (
            <div className="relative w-full h-full overflow-hidden felt-bg">
                <div className="absolute inset-0 blur-sm pointer-events-none opacity-50"><div className="w-full h-full bg-[#1a5c38]"></div></div>
                <RoundSummary summary={room.roundSummary} onNext={onNextGameClick} />
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full w-full overflow-hidden relative felt-bg select-none`}>
            <BackgroundMusic />
            
            <div className="flex justify-between items-center p-2 bg-black/40 text-white z-30 shrink-0 shadow-md">
                <div className="flex gap-2 items-center">
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">房: {roomId}</span>
                    <span className="text-yellow-300 font-bold">余牌: {room.wall ? room.wall.length : 0}</span>
                </div>
                
                <div className="flex gap-2">
                    {room.lastRoundResult && (
                        <button onClick={() => setShowHistory(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs border border-blue-400 flex items-center gap-1 transition">
                            <span>📜</span> 上局
                        </button>
                    )}
                    <button onClick={leaveRoom} className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-xs border border-red-400 transition">退出</button>
                </div>
            </div>

            {showHistory && room.lastRoundResult && (
                <RoundSummary summary={room.lastRoundResult} isHistoryMode={true} onCloseHistory={() => setShowHistory(false)} />
            )}

            <div className="flex-1 relative w-full h-full">
                {room.players.map((p, i) => {
                    if (i === myIndex) return null;
                    const pos = getRelativePosition(i);
                    const posStyle = {
                        top: 'top-2 left-1/2 -translate-x-1/2',
                        left: 'left-2 top-1/2 -translate-y-1/2',
                        right: 'right-2 top-1/2 -translate-y-1/2',
                    }[pos];
                    return <div key={p.id} className={`absolute ${posStyle} z-10`}>{renderOther(p, pos)}</div>;
                })}

                <div className="absolute top-[42%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[85vw] max-w-[340px] aspect-square bg-black/20 border border-white/10 rounded-xl backdrop-blur-[2px] z-0 shadow-2xl">
                    {room.gameState === 'void_selection' && !me.voidSuit && me.hand.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center gap-2 z-[60] bg-black/80 rounded-xl animate-bounce-in">
                            <div className="text-white text-xs absolute top-4">请定缺一门</div>
                            <button onClick={()=>handleAction('void','tong')} className="bg-blue-600 w-12 h-12 rounded-full font-bold text-sm shadow border-2 border-white/50">筒</button>
                            <button onClick={()=>handleAction('void','tiao')} className="bg-green-600 w-12 h-12 rounded-full font-bold text-sm shadow border-2 border-white/50">条</button>
                            <button onClick={()=>handleAction('void','wan')} className="bg-red-600 w-12 h-12 rounded-full font-bold text-sm shadow border-2 border-white/50">万</button>
                        </div>
                    )}
                    
                    {renderUnifiedDiscards()}

                    {room.lastDiscard && room.lastDiscard.tile && (
                        <div className="absolute top-[35%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                            <div className="transform scale-150 drop-shadow-2xl opacity-90"><MahjongTile suit={room.lastDiscard.tile.suit} value={room.lastDiscard.tile.value} size="lg" /></div>
                        </div>
                    )}
                </div>

                <div className={`absolute bottom-0 w-full flex flex-col items-center pb-2 z-20`}>
                    {!isWaiting && (
                        <div className="flex gap-3 mb-2 min-h-[40px] items-end">
                            {/* 出牌按钮：
                                1. 没胡：正常显示
                                2. 胡了但选了牌：正常显示（用于放弃杠，打出选中的牌）
                            */}
                            {isMyTurn && !needsToDraw && room.gameState === 'playing' && (!me.isHu || selectedTile) && (
                                <button onClick={()=>handleAction('discard', {}, null, selectedTile)} disabled={!selectedTile} className={`px-6 py-2 rounded-full font-bold shadow-lg transition text-sm ${selectedTile?'bg-green-600 hover:bg-green-500 text-white':'bg-gray-500 text-gray-300'}`}>出牌</button>
                            )}

                            {canPeng && (
                                <button onClick={()=>handleAction('peng')} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-bounce">碰</button>
                            )}

                            {canZhiGang && (
                                <button onClick={()=>handleAction('gang', {isAn: false})} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-bounce">杠</button>
                            )}

                            {/* 暗杠/补杠：胡了之后也能杠（此时会阻断自动出牌，直到用户点击杠或出牌） */}
                            {canAnGang && (
                                <button onClick={()=>handleAction('gang', {isAn: true, isBu: true})} className="bg-blue-600 text-white px-4 py-2 rounded-full font-bold animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.8)] border-2 border-blue-300">杠</button>
                            )}

                            {/* 胡按钮：只有【没胡过】的时候才显示。已胡过会自动检测自摸胡，不需要按钮 */}
                            {isMyTurn && room.gameState === 'playing' && !me.isHu && checkMahjongWin(me.hand) && !me.hand.some(t => t.suit === me.voidSuit) && (
                                <button onClick={()=>handleAction('hu')} className="bg-red-600 hover:bg-red-500 text-white px-8 py-2 rounded-full font-bold shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-pulse text-lg border-2 border-red-300">胡</button>
                            )}
                        </div>
                    )}

                    <div className="flex flex-nowrap overflow-x-auto w-full max-w-[95vw] gap-0.5 mb-1 px-2 h-8 items-center justify-center opacity-70">
                        {me.discards && me.discards.map((t, i) => <div key={i} className="transform scale-75"><MahjongTile suit={t.suit} value={t.value} size="mini" /></div>)}
                    </div>

                    <div className="flex flex-wrap justify-center items-end px-1 pb-1 w-full max-w-3xl mx-auto">
                        {me.exposed && me.exposed.map((g, i) => (
                            <div key={i} className="flex mr-2 bg-black/20 p-1 rounded mb-1 border border-white/10">
                                {g.tiles.map((t,k)=><MahjongTile key={k} suit={t.suit} value={t.value} size="small"/>)}
                            </div>
                        ))}
                        
                        <div className="flex flex-wrap justify-center sm:flex-nowrap items-end -space-x-px sm:space-x-0.5 min-h-[60px] gap-y-1 w-full px-2">
                            {!isWaiting && [...me.hand]
                                .sort((a,b)=>a.suit===b.suit?a.value-b.value:a.suit.localeCompare(b.suit))
                                .map((t, idx) => {
                                    if (idx >= visibleHandCount) return null;
                                    
                                    const onTileClick = () => {
                                        if (!canInteract) return;
                                        if (me.isHu) {
                                            // 【胡牌后交互】
                                            // 点击手牌意味着：我想出这张牌（通常是为了跳过杠）
                                            // 直接触发出牌，或者先选中再点出牌按钮
                                            // 为了防止误触，改为：选中牌，让用户点击“出牌”按钮确认，或者双击出牌（这里复用选中逻辑）
                                            setSelectedTile(t);
                                        } else {
                                            setSelectedTile(t);
                                        }
                                    };

                                    return (
                                    <div key={t.id || idx} onClick={onTileClick} 
                                         className={`relative transform transition-all duration-150 shrink-0
                                            ${selectedTile?.id===t.id ? '-translate-y-4 z-10' : 'hover:-translate-y-1'}
                                            ${me.voidSuit && t.suit === me.voidSuit ? 'opacity-50 grayscale' : ''}
                                         `}>
                                        <MahjongTile suit={t.suit} value={t.value} size="lg" 
                                            isVoid={me.voidSuit && me.voidSuit === t.suit}
                                            isNew={t.isNew && !isVoidSelection} 
                                        />
                                    </div>
                                )})
                            }
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 mt-1 bg-black/60 px-4 py-1 rounded-full backdrop-blur-sm border border-white/10 shadow-lg">
                        <PlayerAvatar seed={me.name} size="sm" isActive={isMyTurn} />
                        <div className="flex flex-col items-start">
                            <div className="font-bold text-yellow-300 text-xs flex items-center">
                                {me.name} 
                                {me.isHu && <span className="ml-1 bg-red-600 text-white px-1 rounded text-[10px]">已胡{me.huCount>1?`x${me.huCount}`:''}</span>}
                                {me.voidSuit && <span className={`ml-2 text-[10px] px-1.5 rounded text-white ${me.voidSuit==='wan'?'bg-red-600':(me.voidSuit==='tong'?'bg-blue-600':'bg-green-600')}`}>
                                    缺{me.voidSuit==='wan'?'万':(me.voidSuit==='tong'?'筒':'条')}
                                </span>}
                            </div>
                            <div className="text-[10px] text-white/80">💰 {Math.floor(me.score)}</div>
                        </div>
                        {!me.isHu && currentPotential && currentPotential.tags && currentPotential.tags.length > 0 && <div className="text-[10px] text-indigo-200 border border-indigo-400 px-1 rounded">{currentPotential.tags.join(" ")}</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameTable;