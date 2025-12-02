// src/components/Lobby.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // 注意这里变成了 ../
import BackgroundMusic from './BackgroundMusic';

const APP_ID = 'sichuan-mj-v1';

const AdminPanel = ({ isOpen, onClose, user }) => {
    const [password, setPassword] = useState("");
    const [isAuth, setIsAuth] = useState(false);
    const [players, setPlayers] = useState([]);
    const [editScore, setEditScore] = useState({});
    useEffect(() => {
        if (isAuth) {
            const unsub = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('leaderboard').onSnapshot(snap => {
                const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
                setPlayers(list);
            });
            return () => unsub();
        }
    }, [isAuth]);
    const handleUpdate = async (uid) => {
        const newScore = parseInt(editScore[uid]); 
        if (isNaN(newScore)) return;
        await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('leaderboard').doc(uid).update({ score: newScore });
        alert("修改成功"); setEditScore({...editScore, [uid]: ''});
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white text-black p-6 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between mb-4"><h2 className="text-xl font-bold">🛠️ 管理员充值</h2><button onClick={onClose} className="text-red-500 font-bold">关闭</button></div>
                {!isAuth ? (
                    <div className="flex flex-col gap-2">
                        <input type="password" placeholder="密码" className="border p-2 rounded" value={password} onChange={e=>setPassword(e.target.value)} />
                        <button onClick={()=>{if(password==='admin888')setIsAuth(true);else alert("错误");}} className="bg-blue-600 text-white p-2 rounded">进入</button>
                    </div>
                ) : (
                    <div>{players.map(p => (
                        <div key={p.id} className="flex items-center justify-between border-b py-2 gap-2">
                            <div className="flex-1"><div className="font-bold">{p.name}</div><div className="text-xs text-gray-500">余额: {p.score}</div></div>
                            <input type="number" className="border p-1 w-24 rounded" value={editScore[p.id]||''} onChange={e=>setEditScore({...editScore, [p.id]:e.target.value})} />
                            <button onClick={()=>handleUpdate(p.id)} className="bg-green-500 text-white px-3 py-1 rounded text-sm">保存</button>
                        </div>
                    ))}</div>
                )}
            </div>
        </div>
    );
};

const Lobby = ({ user, joinRoom, createRoom, loading }) => {
    const [roomCode, setRoomCode] = useState('');
    const [playerName, setPlayerName] = useState('');
    const [remove10, setRemove10] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);

    useEffect(() => { const saved = localStorage.getItem('mj_playerName'); if (saved) setPlayerName(saved); }, []);
    const handleCreate = (max) => { if(!playerName)return alert("请输入昵称"); localStorage.setItem('mj_playerName',playerName); createRoom(playerName, max, remove10); };
    const handleJoin = () => { if(!playerName||!roomCode)return alert("输入完整"); localStorage.setItem('mj_playerName',playerName); joinRoom(roomCode, playerName); };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden felt-bg">
            <BackgroundMusic />
            <button onClick={() => setShowAdmin(true)} className="absolute top-2 right-2 text-white/50 hover:text-white text-sm bg-black/20 px-2 py-1 rounded z-20">⚙️</button>
            <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} user={user} />

            <div className="relative z-10 w-full max-w-lg p-6 flex flex-col items-center">
                <div className="mb-8 text-center">
                    <h1 className="text-6xl font-black mb-2 title-gold" style={{ fontFamily: '"Noto Serif SC", serif' }}>四川麻将</h1>
                    <div className="text-xl text-green-200 tracking-[0.5em] opacity-80 font-bold border-t border-b border-green-500/30 py-1">血战到底</div>
                </div>

                <div className="w-full bg-black/20 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl">
                    <input 
                        type="text" 
                        placeholder="请输入您的昵称" 
                        className="w-full p-4 mb-6 bg-black/30 border border-green-500/30 rounded-xl text-white text-center text-xl placeholder-green-100/50 focus:outline-none focus:border-yellow-400 transition-colors"
                        value={playerName} 
                        onChange={e=>setPlayerName(e.target.value)} 
                    />

                    <div className="grid grid-cols-3 gap-3 mb-6">
                            <button onClick={()=>handleCreate(2)} disabled={loading} className="group relative overflow-hidden bg-gradient-to-br from-teal-600 to-teal-800 p-4 rounded-xl shadow-lg transform transition active:scale-95 hover:shadow-teal-500/30 border border-teal-400/30">
                            <div className="text-2xl mb-1">⚡️</div>
                            <div className="font-bold text-lg">两人</div>
                            <div className="text-[10px] opacity-70">极速对决</div>
                            </button>
                            <button onClick={()=>handleCreate(3)} disabled={loading} className="group relative overflow-hidden bg-gradient-to-br from-green-600 to-green-800 p-4 rounded-xl shadow-lg transform transition active:scale-95 hover:shadow-green-500/30 border border-green-400/30">
                            <div className="text-2xl mb-1">🎲</div>
                            <div className="font-bold text-lg">三人</div>
                            <div className="text-[10px] opacity-70">经典玩法</div>
                            </button>
                            <button onClick={()=>handleCreate(4)} disabled={loading} className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 rounded-xl shadow-lg transform transition active:scale-95 hover:shadow-indigo-500/30 border border-indigo-400/30">
                            <div className="text-2xl mb-1">🔥</div>
                            <div className="font-bold text-lg">四人</div>
                            <div className="text-[10px] opacity-70">热闹非凡</div>
                            </button>
                    </div>

                    <div className="mb-6 flex items-center justify-center">
                        <label className="flex items-center gap-2 cursor-pointer text-green-100 text-sm select-none hover:text-white transition">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${remove10 ? 'bg-green-500 border-green-400' : 'border-gray-400'}`}>
                                {remove10 && <span className="text-white text-xs">✓</span>}
                            </div>
                            <input type="checkbox" checked={remove10} onChange={e => setRemove10(e.target.checked)} className="hidden" />
                            <span>两人场去10张牌 (其他模式忽略)</span>
                        </label>
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="房间号" 
                            className="flex-1 p-3 bg-black/30 border border-white/10 rounded-xl text-center text-white tracking-widest font-mono text-lg focus:outline-none focus:border-blue-400"
                            value={roomCode} 
                            onChange={e=>setRoomCode(e.target.value)} 
                        />
                        <button onClick={handleJoin} disabled={loading} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition hover:shadow-blue-500/30 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1">
                            加入房间
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="absolute bottom-4 text-white/20 text-xs text-center w-full z-0 pointer-events-none">
                Powered by Vite & React
            </div>
        </div>
    );
};

export default Lobby;