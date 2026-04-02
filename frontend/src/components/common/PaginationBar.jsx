import 'assets/css/layout.css';

import React from 'react';

/**
 * 페이지네이션 UI (1-based).
 * 페이지 상태는 부모에서 `useSearchParams` + `usePaginationSearchParams` 등으로 URL과 동기화하는 것을 권장합니다.
 *
 * @param {number} page 현재 페이지 (1 이상)
 * @param {number} pageSize 페이지당 건수
 * @param {number} total 전체 건수
 * @param {(nextPage: number) => void} onPageChange 페이지 변경 시 (URL `setSearchParams` 등과 연결)
 */
const PaginationBar = ({ page, pageSize, total, onPageChange, className = '' }) => {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(Math.max(1, page), totalPages);

	const go = (next) => {
		const p = Math.max(1, Math.min(next, totalPages));
		if (p !== page) onPageChange(p);
	};

	if (total === 0) return null;

	const from = (safePage - 1) * pageSize + 1;
	const to = Math.min(safePage * pageSize, total);

	return (
		<div
			className={`pagination-bar admin-pagination-bar ${className}`.trim()}
		>
			<button
				type="button"
				className="pagination-bar__nav-btn"
				disabled={safePage <= 1}
				onClick={() => go(safePage - 1)}
			>
				이전
			</button>
			<span className="pagination-bar__meta">
				{from}–{to} / 총 {total}건 (페이지 {safePage}/{totalPages})
			</span>
			<button
				type="button"
				className="pagination-bar__nav-btn"
				disabled={safePage >= totalPages}
				onClick={() => go(safePage + 1)}
			>
				다음
			</button>
		</div>
	);
};

export default PaginationBar;
