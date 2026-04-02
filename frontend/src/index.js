import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

if (process.env.NODE_ENV === 'production') {
	const apiBase = String(process.env.REACT_APP_API_BASE_URL ?? '').trim();
	if (!apiBase) {
		throw new Error(
			'REACT_APP_API_BASE_URL이 빌드 시점에 설정되지 않았습니다. 프로덕션 API 요청이 깨질 수 있으므로 배포 파이프라인과 .env.production을 확인하세요.'
		);
	}
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <App />
);