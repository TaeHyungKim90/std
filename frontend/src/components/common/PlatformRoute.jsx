import { PLATFORM_PATHS } from 'constants/platformPaths';
import { PlatformAuthContext } from 'context/PlatformAuthContext';
import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import LoadingBar from './LoadingBar';

const PlatformRoute = () => {
	const { isLoggedIn, loading } = useContext(PlatformAuthContext);

	if (loading) {
		return (
			<div className="bq-private-loading-container">
				<LoadingBar />
				<p className="bq-private-loading-text">플랫폼 권한 확인 중...</p>
			</div>
		);
	}

	if (!isLoggedIn) {
		return <Navigate to={PLATFORM_PATHS.LOGIN} replace />;
	}

	return <Outlet />;
};

export default PlatformRoute;
