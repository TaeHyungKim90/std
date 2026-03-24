import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react'; // lucide-react 아이콘 활용
import 'assets/css/notFound.css';

const NotFoundPage = () => {
    const navigate = useNavigate();

    return (
        <div className="notfound-container">
            <div className="notfound-content">
                <h1 className="notfound-code">404</h1>
                <h2 className="notfound-title">페이지를 찾을 수 없습니다</h2>
                <p className="notfound-text">
                    요청하신 페이지가 삭제되었거나, 주소가 잘못되었습니다.<br />
                    입력하신 주소를 다시 한번 확인해 주세요.
                </p>
                
                <div className="notfound-actions">
                    <button className="btn-back" onClick={() => navigate(-1)}>
                        <ArrowLeft size={18} /> 이전으로
                    </button>
                    <button className="btn-home" onClick={() => navigate('/')}>
                        <Home size={18} /> 홈으로 이동
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;