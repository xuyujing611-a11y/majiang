// src/components/MahjongTile.jsx
import React, { useState } from 'react';

const MahjongTile = ({ suit, value, onClick, selected, disabled, size, isVoid, isNew, overlayColor, isDealing }) => {
    // 这里把 React.useState 改成了 useState，或者保留 React.useState 都可以
    // 为了保险起见，我保留了你的原逻辑，但也引入了 React
    const [err, setErr] = useState(false);
    
    // 逻辑：根据花色决定颜色
    const color = suit === 'wan' ? '#d93025' : (suit === 'tiao' ? '#188038' : '#1a73e8');
    const isMini = size === 'mini';
    
    // 动画类名逻辑
    let animateClass = '';
    if (isDealing) animateClass = 'animate-deal';
    else if (isNew) animateClass = 'animate-fly-in';

    // SVG 渲染逻辑 (当图片加载失败时显示)
    const renderSVG = () => (
        <svg viewBox="0 0 44 60" width="100%" height="100%">
            {suit === 'tong' ? <circle cx="22" cy="30" r="12" fill="white" stroke={color} strokeWidth="8"/> :
             suit === 'tiao' ? <rect x="18" y="10" width="8" height="40" rx="4" fill={color}/> :
             <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill={color} fontSize="24" fontWeight="bold">{['一','二','三','四','五','六','七','八','九'][value-1]}</text>}
            {suit === 'wan' && <text x="38" y="10" fontSize="10" fill="red" textAnchor="end">万</text>}
        </svg>
    );

    return (
        <div className={`${isMini ? 'mahjong-tile-mini' : 'mahjong-tile'} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${animateClass}`} onClick={onClick}>
            {isVoid && <div className="absolute inset-0 bg-gray-600/60 rounded-md z-10 pointer-events-none transition-all"></div>}
            {overlayColor && <div className={`absolute inset-0 ${overlayColor} rounded z-20 pointer-events-none`}></div>}
            
            {/* 这里的图片路径 assets/... 稍后需要确保图片在 public 文件夹里 */}
            {!err ? <img src={`assets/${suit}${value}.png`} className="w-full h-full object-contain p-0.5" onError={() => setErr(true)}/> : renderSVG()}
        </div>
    );
};

// 关键的一步：导出组件
export default MahjongTile;