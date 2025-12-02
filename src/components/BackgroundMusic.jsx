// src/components/BackgroundMusic.jsx
import React, { useState, useEffect, useRef } from 'react';

const BackgroundMusic = () => {
    const [muted, setMuted] = useState(false);
    const audioRef = useRef(null);
    useEffect(() => { if (audioRef.current) { audioRef.current.volume = 0.3; audioRef.current.play().catch(()=>{}); } }, []);
    return (
        <div className="absolute top-2 left-2 z-50">
            <audio ref={audioRef} src="assets/bg.mp3" loop />
            <button onClick={()=>{ if(audioRef.current){ audioRef.current.muted = !muted; if(!muted) audioRef.current.play().catch(()=>{}); setMuted(!muted); } }} className="text-white text-xl bg-black/30 p-2 rounded-full hover:bg-black/50 transition">{muted ? "🔇" : "🔊"}</button>
        </div>
    );
};

export default BackgroundMusic;