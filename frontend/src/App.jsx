// CSS 한곳에서 관리
import './assets/css/global.css';
import './assets/css/layout.css';

import AuthNavigateRegistrar from 'components/common/AuthNavigateRegistrar';
import ErrorBoundary from 'components/common/ErrorBoundary';
import LoadingBar from 'components/common/LoadingBar';
import React, { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import { PlatformAuthProvider } from './context/PlatformAuthContext';
import AppRoutes from './routes';


function App() {
	return (
		<LoadingProvider>
			<PlatformAuthProvider>
				<BrowserRouter>
					<AuthProvider>
						<AuthNavigateRegistrar />
						<ErrorBoundary>
							<Suspense fallback={<LoadingBar text="페이지를 불러오는 중..." />}>
								<AppRoutes />
							</Suspense>
						</ErrorBoundary>
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
					</AuthProvider>
				</BrowserRouter>
			</PlatformAuthProvider>
		</LoadingProvider>
	);
}

export default App;