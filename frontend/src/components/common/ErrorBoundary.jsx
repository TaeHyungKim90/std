import React from 'react';
import toast from 'react-hot-toast';

/**
 * 렌더/라이프사이클 오류를 잡아 전체 화면이 깨지지 않게 하는 보호막.
 * - API 실패 토스트는 `toastApiFailure`에서 처리하고, 이 컴포넌트는 렌더 예외에만 집중합니다.
 */
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, info) {
		// eslint-disable-next-line no-console
		console.error('ErrorBoundary caught an error:', error, info);
		toast.error('페이지를 처리하는 중 문제가 발생했습니다. 새로고침 해주세요.');
	}

	handleReload = () => {
		window.location.reload();
	};

	render() {
		if (!this.state.hasError) return this.props.children;

		const err = this.state.error;
		const detail =
			process.env.NODE_ENV !== 'production' && err?.message ? String(err.message) : '';

		return (
			<div
				role="alert"
				aria-live="polite"
				style={{
					padding: 24,
					maxWidth: 720,
					margin: '28px auto',
					border: '1px solid rgba(0,0,0,0.08)',
					borderRadius: 12,
					background: 'rgba(0,0,0,0.02)',
				}}
			>
				<h2 style={{ margin: 0, fontSize: 18 }}>문제가 발생했습니다</h2>
				<p style={{ margin: '10px 0 0 0', color: '#444', lineHeight: 1.6 }}>
					페이지를 다시 불러와 다시 시도해 주세요.
				</p>
				{detail ? (
					<pre
						style={{
							marginTop: 12,
							whiteSpace: 'pre-wrap',
							background: '#f5f5f5',
							padding: 12,
							borderRadius: 10,
							fontSize: 12,
						}}
					>
						{detail}
					</pre>
				) : null}
				<div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
					<button type="button" onClick={this.handleReload} style={{ padding: '10px 14px' }}>
						새로고침
					</button>
				</div>
			</div>
		);
	}
}

export default ErrorBoundary;

