import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { recruitmentApi } from 'api/recruitmentApi';
import { PATHS } from 'constants/paths';
import { syncApplicantSessionFromServer } from 'utils/applicantSession';

import JobApplyPage from './JobApplyPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
	...(await vi.importActual('react-router-dom')),
	useLocation: () => ({
		state: {
			job: { id: 42, title: '테스트 공고' },
		},
	}),
	useNavigate: () => mockNavigate,
}));

vi.mock('api/recruitmentApi', () => ({
	recruitmentApi: {
		getMyApplications: vi.fn(),
		submitApplication: vi.fn(),
		uploadApplyFiles: vi.fn(),
	},
}));

vi.mock('utils/applicantSession', () => ({
	syncApplicantSessionFromServer: vi.fn(),
}));

vi.mock('utils/toastUtils', () => ({
	toastWarn: vi.fn(),
	toastError: vi.fn(),
	toastPromise: (p) => p,
	toastSuccess: vi.fn(),
	toastApiFailure: vi.fn(),
	toastLoading: vi.fn(),
	toastInfo: vi.fn(),
}));

vi.mock('utils/formatApiError', () => ({
	formatApiDetail: () => '',
}));

describe('JobApplyPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		syncApplicantSessionFromServer.mockResolvedValue({
			isLoggedIn: true,
			name: '지원자',
			email_id: 'u@test.com',
			phone: '010-1234-5678',
		});

		recruitmentApi.getMyApplications.mockResolvedValue({ data: [] });
		recruitmentApi.submitApplication.mockResolvedValue({ data: { success: true } });
		recruitmentApi.uploadApplyFiles.mockResolvedValue({
			data: { resume_file_url: 'resume-url', portfolio_file_url: null },
		});
	});

	test('이력서(.docx) 첨부 후 지원서 제출 시 submitApplication을 호출하고 내 지원 내역으로 이동한다', async () => {
		const { container } = render(<JobApplyPage />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: '지원서 최종 제출' })).toBeInTheDocument();
		});

		const fileInputs = container.querySelectorAll('input[type="file"]');
		expect(fileInputs.length).toBeGreaterThan(0);

		const resumeFile = new File(['x'], 'resume.docx', {
			type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		});

		fireEvent.change(fileInputs[0], { target: { files: [resumeFile] } });
		await waitFor(() => {
			expect(fileInputs[0].files?.[0]?.name).toBe('resume.docx');
		});
		fireEvent.submit(container.querySelector('form'));

		await waitFor(() => expect(recruitmentApi.uploadApplyFiles).toHaveBeenCalled());
		await waitFor(() => expect(recruitmentApi.submitApplication).toHaveBeenCalled());

		const payload = recruitmentApi.submitApplication.mock.calls[0][0];
		expect(payload.job_id).toBe(42);
		expect(payload.resume_file_url).toBe('resume-url');

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(PATHS.CAREERS_MY_APPLICATIONS, { replace: true });
		});
	});
});
