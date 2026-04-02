import 'assets/css/loadingBar.css'; // 분리한 CSS 임포트

import React from 'react';

const LoadingBar = ({ text = "처리 중입니다..." }) => {
	return (
		<div className="loading-overlay">
			<div className="loading-spinner"></div>
			{/* 🌟 고정된 텍스트 대신, 외부에서 받은 text를 출력합니다. */}
			<p className="loading-text">{text}</p>
		</div>
	);
};

export default LoadingBar;