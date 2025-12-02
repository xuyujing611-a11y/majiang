// src/components/PlayerAvatar.jsx
import React from 'react';

const PlayerAvatar = ({ seed, size = "md", isActive }) => {
    const hash = (seed || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ["#e53935", "#d81b60", "#8e24aa", "#5e35b1", "#3949ab", "#1e88e5", "#039be5", "#00acc1", "#00897b", "#43a047", "#7cb342", "#c0ca33", "#fdd835", "#ffb300", "#fb8c00", "#f4511e"];
    const bgColor = colors[hash % colors.length];
    const faceType = hash % 4;
    let sizePx = 40;
    if (size === 'sm') sizePx = 32;
    if (size === 'lg') sizePx = 56;
    return (
        <div className={`rounded-full overflow-hidden border-2 shadow-md flex-shrink-0 flex items-center justify-center transition-all duration-300 ${isActive ? 'active-player-glow' : 'border-white/50'}`} style={{width: sizePx, height: sizePx, backgroundColor: bgColor}}>
            <svg viewBox="0 0 100 100" width="100%" height="100%">
                <circle cx="50" cy="50" r="40" fill="rgba(255,255,255,0.2)" />
                <circle cx="35" cy="40" r="5" fill="white" />
                <circle cx="65" cy="40" r="5" fill="white" />
                {faceType === 0 && <path d="M30 65 Q50 80 70 65" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />}
                {faceType === 1 && <circle cx="50" cy="70" r="10" stroke="white" strokeWidth="4" fill="none" />}
                {faceType === 2 && <rect x="30" y="65" width="40" height="10" rx="5" fill="white" />}
                {faceType === 3 && <path d="M30 70 Q50 60 70 70" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />}
            </svg>
        </div>
    );
};

export default PlayerAvatar;