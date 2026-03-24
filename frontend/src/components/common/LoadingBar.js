import React from 'react';
import 'assets/css/loadingBar.css'; // 분리한 CSS 임포트

const LoadingBar = () => {
    return (
        <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p className="loading-text">처리 중입니다...</p>
        </div>
    );
};

export default LoadingBar;