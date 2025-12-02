// src/App.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { generateDeck } from './utils';
import GameTable from './components/GameTable';
import Lobby from './components/Lobby';

const APP_ID = 'sichuan-mj-v1';

function App() {
    const [user, setUser] = useState(null);
    const [room, setRoom] = useState(null);
    const [roomId, setRoomId] = useState(localStorage.getItem('mj_roomId') || null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(u => {
            if(u) setUser(u);
            else auth.signInAnonymously().catch(e=>alert(e.message));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!roomId || !user) return;
        const unsub = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms').doc(roomId).onSnapshot(doc => {
            if (doc.exists) setRoom(doc.data());
            else { localStorage.removeItem('mj_roomId'); alert("房间不存在"); setRoom(null); setRoomId(null); }
        });
        return () => unsub();
    }, [roomId, user]);

    const createRoom = async (name, max, remove10) => {
        if(!user) return; setLoading(true);
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const deck = generateDeck();
        const initHand = deck.splice(0, 13);
        const score = 1000;
        if (max === 2 && remove10) deck.splice(0, 10);
        const p = { id: user.uid, name, score: score, hand: initHand, discards: [], exposed: [], voidSuit: null };
        p.hand.push(deck.pop());
        await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms').doc(code).set({
            code, host: user.uid, players: [p], maxPlayers: max, remove10: remove10, gameState: 'waiting', wall: deck, turnIndex: 0, lastDiscard: null, history: [],
            turnDeadline: Date.now() + 15000 
        });
        localStorage.setItem('mj_roomId', code); setRoomId(code); setLoading(false);
    };

    const joinRoom = async (code, name) => {
        if(!user) return; setLoading(true);
        const ref = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms').doc(code);
        const score = 1000;
        try {
            await db.runTransaction(async t => {
                const doc = await t.get(ref);
                if (!doc.exists) throw "房间不存在";
                const d = doc.data();
                if (d.players.find(p=>p.id===user.uid)) return;
                if (d.players.length >= d.maxPlayers) throw "房间已满";
                let w = [...d.wall];
                const h = w.splice(0, 13);
                const np = [...d.players, { id: user.uid, name, score: score, hand: h, discards: [], exposed: [], voidSuit: null }];
                t.update(ref, { players: np, wall: w, gameState: np.length >= d.maxPlayers ? 'void_selection' : 'waiting' });
            });
            localStorage.setItem('mj_roomId', code); setRoomId(code);
        } catch(e) { alert(e); }
        setLoading(false);
    };

    if (!user) return <div className="flex items-center justify-center h-screen bg-[#0f3d24] text-xl text-white">连接中...</div>;
    if (roomId && room) return <GameTable room={room} roomId={roomId} userId={user.uid} leaveRoom={()=>{localStorage.removeItem('mj_roomId');setRoomId(null);setRoom(null);}} />;
    return <Lobby user={user} joinRoom={joinRoom} createRoom={createRoom} loading={loading} />;
}

export default App;