import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import AppRoutes from './routes'; // 위에서 만든 라우터 파일 가져오기

// CSS 한곳에서 관리
import './assets/css/global.css';
import './assets/css/layout.css';


function App() {
    return (
        <LoadingProvider>
            <AuthProvider>
                <BrowserRouter>
                    {/* 모든 페이지에 공통으로 들어갈 레이아웃(헤더 등)이 있다면 여기에 위치 */}
                    <AppRoutes /> {/* 실제 주소에 따른 컴포넌트 렌더링 */}
                </BrowserRouter>
            </AuthProvider>
        </LoadingProvider>
    );
}

export default App;