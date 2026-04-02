import React from 'react';

/**
 * [참조용] Public/Careers 계열 페이지 템플릿
 *
 * - 현재 `JobListPage`, `ApplicantLoginPage` 등에서 사용 중인
 *   `careers-content-wrapper`, `careers-header` 패턴을 기준으로 잡았습니다.
 * - 실제 라우팅에 연결하지 않습니다. 새 화면 생성 시 그대로 복사해서 사용하세요.
 */
const CareersPageTemplate = () => {
	return (
		<div className="careers-content-wrapper">
			<header className="careers-header">
				<h1>페이지 제목</h1>
				<p>서브 카피 (해당 화면 설명)</p>
			</header>

			<div>
				{/* TODO: 리스트/필터/빈 상태 렌더링 영역을 추가하세요. */}
				<div className="glass-box job-list__empty-glass">표시할 데이터가 없습니다.</div>
			</div>
		</div>
	);
};

export default CareersPageTemplate;

