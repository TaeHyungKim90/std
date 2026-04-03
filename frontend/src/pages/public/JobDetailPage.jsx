import { recruitmentApi } from 'api/recruitmentApi';
import { pathCareersJobApply, PATHS } from 'constants/paths';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import parse from 'html-react-parser';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { syncApplicantSessionFromServer } from 'utils/applicantSession';
import { sanitizeEditorHtml } from 'utils/sanitizeHtml';
import * as Notify from 'utils/toastUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

function isDeadlinePassedSeoul(deadline) {
	if (!deadline) return false;
	const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
	const d = dayjs(deadline).format('YYYY-MM-DD');
	return d < today;
}

const JobDetailPage = () => {
	const { state } = useLocation();
	const navigate = useNavigate();

	const job = state?.job;
	if (!job) {
		Notify.toastWarn(' 공고 상세페이지 - 잘못된 접근입니다.');
		navigate(PATHS.CAREERS, { replace: true });
		return null;
	}

	const deadlinePassed = isDeadlinePassedSeoul(job.deadline);
	const hasApplied = Boolean(job.has_applied);

	const handleApplyClick = async () => {
		if (hasApplied) {
			navigate(PATHS.CAREERS_MY_APPLICATIONS);
			return;
		}
		const me = await syncApplicantSessionFromServer();
		if (me?.isLoggedIn) {
			navigate(pathCareersJobApply(job.id), { state: { job } });
			return;
		}
		Notify.toastInfo('입사 지원은 로그인이 필요합니다.');
		navigate(PATHS.CAREERS_LOGIN, { state: { returnUrl: pathCareersJobApply(job.id), job } });
	};

	const handleDownloadTemplate = async () => {
		if (!job.resume_template_id) {
			Notify.toastWarn('연결된 이력서 양식이 없습니다.');
			return;
		}
		try {
			const res = await recruitmentApi.downloadJobResumeTemplate(job.id);
			const blob = res.data;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `이력서양식_${job.id}.docx`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (err) {
			Notify.toastApiFailure(err, '양식을 다운로드하지 못했습니다.');
		}
	};

	const parseContent = (htmlString) => {
		if (!htmlString) return '내용이 없습니다.';

		const safe = sanitizeEditorHtml(htmlString);
		if (!safe.trim()) return '내용이 없습니다.';

		const options = {
			replace: (domNode) => {
				if (domNode.name === 'img' && domNode.attribs) {
					const styleObj = {};

					if (domNode.attribs.style) {
						domNode.attribs.style.split(';').forEach((styleDef) => {
							const [key, value] = styleDef.split(':');
							if (key && value) {
								const camelKey = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
								styleObj[camelKey] = value.trim();
							}
						});
					}

					const { style: _style, ...otherAttribs } = domNode.attribs;

					return (
						<img
							{...otherAttribs}
							style={{
								...styleObj,
								maxWidth: '100%',
								height: styleObj.height || 'auto',
							}}
							alt={domNode.attribs.alt || '채용 공고 이미지'}
						/>
					);
				}
			},
		};

		return parse(safe, options);
	};

	let applyLabel = '이 포지션에 지원하기';
	let applyDisabled = false;
	if (hasApplied) {
		applyLabel = '내 지원 내역';
	} else if (deadlinePassed) {
		applyLabel = '채용 공고 마감';
		applyDisabled = true;
	}

	return (
		<div className="careers-content-wrapper job-detail-container">
			<button className="btn-back" onClick={() => navigate(-1)}>
				← 뒤로가기
			</button>

			<div className="glass-box job-detail-box">
				<h1>{job.title}</h1>
				<p className="job-deadline">
					마감일: {job.deadline ? new Date(job.deadline).toLocaleDateString() : '상시채용'}
				</p>

				{job.resume_template_id ? (
					<div className="job-detail__template-block" style={{ marginBottom: '1.25rem' }}>
						<p style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>
							해당 양식을 내려받아 작성한 뒤 지원해 주세요.
						</p>
						<button type="button" className="btn-apply-large" onClick={handleDownloadTemplate}>
							이력서 양식 다운로드
						</button>
					</div>
				) : null}

				<div className="sun-editor-editable job-viewer-wrapper">{parseContent(job.description)}</div>

				<div className="job-apply-section">
					<button
						type="button"
						className="btn-apply-large"
						onClick={applyDisabled ? undefined : handleApplyClick}
						disabled={applyDisabled}
						style={applyDisabled ? { opacity: 0.65, cursor: 'not-allowed' } : undefined}
					>
						{applyLabel}
					</button>
				</div>
			</div>
		</div>
	);
};

export default JobDetailPage;
