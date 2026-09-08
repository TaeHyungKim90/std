import { render, screen } from '@testing-library/react';
import { PATHS } from 'constants/paths';
import { useApplicantSession } from 'hooks/useApplicantSession';
import { MemoryRouter } from 'react-router-dom';

import PublicHeader from './PublicHeader';

vi.mock('hooks/useApplicantSession', () => ({
	useApplicantSession: vi.fn(),
}));

vi.mock('api/recruitmentApi', () => ({
	recruitmentApi: {
		logoutApplicant: vi.fn(() => Promise.resolve({ data: { success: true } })),
	},
}));

vi.mock('utils/toastUtils', () => ({
	toastPromise: (p) => Promise.resolve(p).then(() => ({})),
}));

vi.mock('./ApplicantProfileModal', () => ({
	default: function MockModal() {
		return null;
	},
}));

describe('PublicHeader (지원자)', () => {
	test('세션 있으면 이름·내 지원 내역 링크를 보여준다', () => {
		useApplicantSession.mockReturnValue({
			user: { name: '김지원', isLoggedIn: true, email_id: 'kim@example.com' },
			setUser: vi.fn(),
			clearSession: vi.fn(),
		});

		render(
			<MemoryRouter initialEntries={[PATHS.CAREERS]}>
				<PublicHeader />
			</MemoryRouter>
		);

		expect(screen.getByText('김지원님')).toBeInTheDocument();
		const myApps = screen.getByRole('link', { name: '내 지원 내역' });
		expect(myApps).toHaveAttribute('href', PATHS.CAREERS_MY_APPLICATIONS);
	});

	test('세션 없으면 지원자 로그인 버튼만 보인다', () => {
		useApplicantSession.mockReturnValue({
			user: null,
			setUser: vi.fn(),
			clearSession: vi.fn(),
		});

		render(
			<MemoryRouter initialEntries={[PATHS.CAREERS]}>
				<PublicHeader />
			</MemoryRouter>
		);

		expect(screen.getByRole('button', { name: '지원자 로그인' })).toBeInTheDocument();
		expect(screen.queryByText(/님$/)).not.toBeInTheDocument();
	});
});
