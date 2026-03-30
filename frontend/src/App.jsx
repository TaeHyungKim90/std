import React, { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import LoadingBar from 'components/common/LoadingBar';
import AppRoutes from './routes';

// CSS 한곳에서 관리
import './assets/css/global.css';
import './assets/css/layout.css';
// SunEditor 사용 화면이 많아 스타일은 앱 진입에서 한 번만 로드합니다.
import 'suneditor/dist/css/suneditor.min.css';


function App() {
	return (
		<LoadingProvider>
			<AuthProvider>
				<BrowserRouter>
					<Suspense fallback={<LoadingBar text="페이지를 불러오는 중..." />}>
						<AppRoutes />
					</Suspense>
					<Toaster 
						position="top-center" 
						toastOptions={{
							duration: 3000,
							style: {
								background: '#333',
								color: '#fff',
								borderRadius: '8px',
								padding: '12px 20px',
								fontSize: '15px'
							},
							success: { style: { background: '#28a745' } },
							error: { style: { background: '#dc3545' } },
						}} 
					/>
				</BrowserRouter>
			</AuthProvider>
		</LoadingProvider>
	);
}

export default App;