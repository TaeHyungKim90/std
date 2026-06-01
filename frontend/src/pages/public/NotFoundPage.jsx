import 'assets/css/notFound.css';

import { DEFAULT_TENANT_SLUG, pathsForTenant } from 'constants/paths';
import { ArrowLeft,Home } from 'lucide-react';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const NotFoundPage = () => {
	const navigate = useNavigate();
	const { tenantSlug } = useParams();
	const paths = pathsForTenant((tenantSlug || DEFAULT_TENANT_SLUG).toLowerCase());

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
					<button type="button" className="btn-back" onClick={() => navigate(-1)}>
						<ArrowLeft size={18} strokeWidth={2} aria-hidden />
						이전으로
					</button>
					<button type="button" className="btn-home" onClick={() => navigate(paths.HOME)}>
						<Home size={18} strokeWidth={2} aria-hidden />
						홈으로 이동
					</button>
				</div>
			</div>
		</div>
	);
};

export default NotFoundPage;