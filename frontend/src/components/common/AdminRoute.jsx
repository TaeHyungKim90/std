import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import LoadingBar from './LoadingBar';
import '../../assets/css/privateRoute.css';

const AdminRoute = () => {
    const { isLoggedIn, userRole, loading } = useContext(AuthContext);

    // 1. 로딩 중 대기
    if (loading) {
        return (
            <div className="bq-private-loading-container">
                <LoadingBar /> 
                <p className="bq-private-loading-text">권한 확인 중...</p>
            </div>
        );
    }

    // 2. 로그인이 안 되어 있으면 로그인 창으로
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }

    // 🚨 3. 로그인은 했지만 관리자가 아니라면 튕겨냄 (핵심!)
    if (userRole !== 'admin') {
        alert("관리자 권한이 필요합니다.");
        return <Navigate to="/my/todos" replace />;
    }

    // 4. 관리자가 맞으면 통과!
    return <Outlet />;
};

export default AdminRoute;