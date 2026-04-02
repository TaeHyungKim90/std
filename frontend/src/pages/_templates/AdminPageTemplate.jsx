import React from 'react';

/**
 * [참조용] Admin 계열 페이지 템플릿
 *
 * - 현재 `AdminTodo`, `MyMessages` 등에서 쓰는
 *   `bq-admin-view` / `admin-header` / `admin-table-wrapper` 패턴을 기준으로 구성했습니다.
 * - 실제 라우팅에 연결하지 않습니다.
 */
const AdminPageTemplate = () => {
	return (
		<div className="bq-admin-view">
			<div className="admin-header">
				<h2>
					📌 <span>페이지 제목</span>
				</h2>
				<p>페이지 설명 (예: 데이터/기능 요약)</p>
			</div>

			<div className="admin-table-wrapper">
				<table className="admin-table">
					<thead>
						<tr>
							<th>컬럼1</th>
							<th>컬럼2</th>
							<th>컬럼3</th>
							<th>관리</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td colSpan={4}>데이터가 없습니다.</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default AdminPageTemplate;

