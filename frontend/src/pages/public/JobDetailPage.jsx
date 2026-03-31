import React from 'react';
import * as Notify from 'utils/toastUtils';
import { useLocation, useNavigate } from 'react-router-dom';

import parse from 'html-react-parser';
import { sanitizeEditorHtml } from 'utils/sanitizeHtml';
import { PATHS, pathCareersJobApply } from 'constants/paths';
import { recruitmentApi } from 'api/recruitmentApi';
const JobDetailPage = () => {
	const { state } = useLocation();
	const navigate = useNavigate();
	
	const job = state?.job;
	if (!job) {
		Notify.toastWarn(" 공고 상세페이지 - 잘못된 접근입니다.");
		navigate(PATHS.CAREERS, { replace: true });
		return null;
	}

	const handleApplyClick = async () => {
		try {
			const meRes = await recruitmentApi.getApplicantMe();
			if (meRes?.data?.isLoggedIn) {
				sessionStorage.setItem('applicant_user', JSON.stringify(meRes.data));
				navigate(pathCareersJobApply(job.id), { state: { job } });
				return;
			}
		} catch {
			// ignore
		}
		sessionStorage.removeItem('applicant_user');
		Notify.toastInfo("입사 지원은 로그인이 필요합니다.");
		navigate(PATHS.CAREERS_LOGIN, { state: { returnUrl: pathCareersJobApply(job.id), job } });
	};

	const parseContent = (htmlString) => {
		if (!htmlString) return '내용이 없습니다.';

		const safe = sanitizeEditorHtml(htmlString);
		if (!safe.trim()) return '내용이 없습니다.';

		const options = {
			replace: (domNode) => {
				// img 태그를 발견했을 때
				if (domNode.name === 'img' && domNode.attribs) {
					const styleObj = {};
					
					// SunEditor가 남긴 인라인 style 속성을 리액트 객체로 변환
					if (domNode.attribs.style) {
						domNode.attribs.style.split(';').forEach(styleDef => {
							const [key, value] = styleDef.split(':');
							if (key && value) {
								// 카멜케이스 변환 (max-width -> maxWidth)
								const camelKey = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
								styleObj[camelKey] = value.trim();
							}
						});
					}

					const { style, ...otherAttribs } = domNode.attribs;

					return (
						<img 
							{...otherAttribs} 
							style={{ 
								...styleObj, 
								maxWidth: '100%', // 화면 밖으로 튀어나감 방지
								height: styleObj.height || 'auto' 
							}} 
							alt={domNode.attribs.alt || '채용 공고 이미지'}
						/>
					);
				}
			}
		};

		return parse(safe, options);
	};

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
				
				{/* 🌟 3. dangerouslySetInnerHTML 제거 및 parseContent 적용 */}
				<div 
					className="sun-editor-editable job-viewer-wrapper" 
				>
					{parseContent(job.description)}
				</div>

				<div className="job-apply-section">
					<button className="btn-apply-large" onClick={handleApplyClick}>
						이 포지션에 지원하기
					</button>
				</div>
			</div>
		</div>
	);
};

export default JobDetailPage;