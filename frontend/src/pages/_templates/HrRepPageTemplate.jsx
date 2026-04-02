import React from 'react';

/**
 * [참조용] HR(리포트) 계열 페이지 템플릿
 *
 * - 현재 `MyReports` 등에서 쓰는 `rep-page rep-page--wide` 계열 패턴을 기준으로 구성했습니다.
 * - 실제 라우팅에 연결하지 않습니다. 새 화면 생성 시 복사해서 사용하세요.
 */
const HrRepPageTemplate = () => {
	return (
		<div className="rep-page rep-page--wide">
			<h1 className="rep-page__title">페이지 제목</h1>
			<p className="rep-page__sub">페이지 설명 (무슨 화면인지)</p>

			<div className="rep-page__content">
				{/* TODO: 본문 영역(리스트/폼/모달 트리거 등)을 넣으세요. */}
			</div>
		</div>
	);
};

export default HrRepPageTemplate;

