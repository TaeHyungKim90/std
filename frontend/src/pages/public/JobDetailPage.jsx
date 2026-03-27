import React from 'react';
import * as Notify from 'utils/toastUtils';
import { useLocation, useNavigate } from 'react-router-dom';

// 🌟 1. 파서(Parser) 임포트 추가!
import parse from 'html-react-parser'; 
import 'suneditor/dist/css/suneditor.min.css';

const JobDetailPage = () => {
	const { state } = useLocation();
	const navigate = useNavigate();
	
	const job = state?.job;
	if (!job) {
		Notify.toastWarn(" 공고 상세페이지 - 잘못된 접근입니다.");
		navigate('/careers', { replace: true });
		return null;
	}

	const handleApplyClick = () => {
		const user = sessionStorage.getItem('applicant_user');
		if (!user) {
			Notify.toastInfo("입사 지원은 로그인이 필요합니다.");
			navigate('/careers/login', { state: { returnUrl: `/careers/${job.id}/apply`, job } });
		} else {
			navigate(`/careers/${job.id}/apply`, { state: { job } });
		}
	};

	// 🌟 2. HTML을 안전하게 렌더링하고 이미지 스타일을 살려주는 파싱 함수
	const parseContent = (htmlString) => {
		if (!htmlString) return '내용이 없습니다.';

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

		return parse(htmlString, options);
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
					style={{ background: 'transparent', border: 'none', color: '#222' }}
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