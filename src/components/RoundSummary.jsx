// src/components/RoundSummary.jsx
import React from 'react';
import MahjongTile from './MahjongTile';

const RoundSummary = ({ summary, onNext, isHistoryMode = false, onCloseHistory }) => {
    if (!summary) return null;
    
    // 血战到底的结算通常包含多名赢家
    const winners = summary.winners || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1a5c38] p-6 rounded-2xl border-4 border-yellow-600 shadow-2xl max-w-2xl w-[90%] relative max-h-[90vh] overflow-y-auto">
                {isHistoryMode && (
                    <button onClick={onCloseHistory} className="absolute top-2 right-4 text-white/70 hover:text-white text-3xl font-bold">&times;</button>
                )}
                
                <h2 className="text-3xl font-bold text-center text-yellow-300 mb-6 drop-shadow-md">
                    {isHistoryMode ? "上局回顾" : (winners.length > 0 ? "🎉 本局结束 🎉" : "流局")}
                </h2>

                {winners.length > 0 ? (
                    <div className="space-y-6">
                        {winners.map((winner, idx) => (
                            <div key={idx} className="bg-black/20 p-4 rounded-xl border border-white/10">
                                <div className="text-white text-xl mb-2 flex justify-between items-center">
                                    <span>
                                        赢家: <span className="font-bold text-yellow-200 text-2xl mx-2">{winner.name}</span>
                                        <span className={`text-sm px-2 py-0.5 rounded text-white align-middle ${winner.isZimo ? 'bg-blue-600' : 'bg-red-600'}`}>
                                            {winner.isZimo ? "自摸" : "点炮"}
                                        </span>
                                    </span>
                                    <span className="text-green-300 font-bold text-xl">+{winner.scoreChange} 💰</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {winner.hand && winner.hand.map((t, i) => (
                                        <div key={i} className="transform scale-75"><MahjongTile suit={t.suit} value={t.value} size="md" /></div>
                                    ))}
                                </div>
                                <div className="text-xs text-gray-300 grid grid-cols-2 gap-2 bg-black/30 p-2 rounded">
                                     {winner.fanDetails && winner.fanDetails.map((d, i) => (
                                        <span key={i}>{d}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-300 text-xl py-10">荒庄（流局）</div>
                )}

                {!isHistoryMode && (
                    <button onClick={onNext} className="mt-6 w-full bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 text-white font-bold py-3 rounded-xl shadow-lg text-xl">
                        开始下一局
                    </button>
                )}
            </div>
        </div>
    );
};

export default RoundSummary;