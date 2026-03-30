import React from 'react';

/**
 * 1-based page, skip = (page - 1) * pageSize
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

	const btnStyle = (disabled) => ({
		padding: '8px 16px',
		borderRadius: 8,
		border: '1px solid #ccc',
		background: disabled ? '#f0f0f0' : '#fff',
		cursor: disabled ? 'not-allowed' : 'pointer',
		fontSize: '0.9rem',
	});

	return (
		<div
			className={`admin-pagination-bar ${className}`.trim()}
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 10,
				marginTop: 8,
				flexWrap: 'wrap',
			}}
		>
			<button
				type="button"
				style={btnStyle(safePage <= 1)}
				disabled={safePage <= 1}
				onClick={() => go(safePage - 1)}
			>
				이전
			</button>
			<span style={{ color: '#444', fontSize: '0.9rem' }}>
				{from}–{to} / 총 {total}건 (페이지 {safePage}/{totalPages})
			</span>
			<button
				type="button"
				style={btnStyle(safePage >= totalPages)}
				disabled={safePage >= totalPages}
				onClick={() => go(safePage + 1)}
			>
				다음
			</button>
		</div>
	);
};

export default PaginationBar;
