import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// 🌟 SunEditor CSS만 임포트
import 'suneditor/dist/css/suneditor.min.css';

const JobDetailPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    
    const job = state?.job;
    if (!job) {
        alert("🚨 공고 상세페이지 - 잘못된 접근입니다.");
        navigate('/careers', { replace: true });
        return null;
    }

    const handleApplyClick = () => {
        const user = sessionStorage.getItem('applicant_user');
        if (!user) {
            alert("입사 지원은 로그인이 필요합니다.");
            navigate('/careers/login', { state: { returnUrl: `/careers/${job.id}/apply`, job } });
        } else {
            navigate(`/careers/${job.id}/apply`, { state: { job } });
        }
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
                
                {/* 🌟 TUI 뷰어 컴포넌트를 지우고 기본 div + SunEditor 클래스로 대체! */}
                <div 
                    className="sun-editor-editable job-viewer-wrapper" 
                    dangerouslySetInnerHTML={{ __html: job.description || '내용이 없습니다.' }} 
                    style={{ background: 'transparent', border: 'none', color: '#222' }}
                />

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