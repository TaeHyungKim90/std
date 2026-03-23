import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../assets/css/careers.css';

const JobDetailView = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    
    // 이전 페이지에서 넘어온 job 데이터가 없으면 뒤로가기 (새로고침 방어용)
    const job = state?.job;
    if (!job) {
        alert("잘못된 접근입니다.");
        navigate('/careers', { replace: true });
        return null;
    }
    const handleApplyClick = () => {
        const user = sessionStorage.getItem('applicant_user');
        if (!user) {
            alert("입사 지원은 로그인이 필요합니다.");
            // 🚨 꿀팁: 로그인 성공 후 다시 이 공고로 돌아오도록 returnUrl을 넘김
            navigate('/careers/login', { state: { returnUrl: `/careers/${job.id}/apply`, job } });
        } else {
            // 로그인 되어 있으면 바로 지원서 작성으로 이동
            navigate(`/careers/${job.id}/apply`, { state: { job } });
        }
    };

    return (
        <div className="careers-container" style={{ maxWidth: '800px' }}>
            <button className="btn-back" onClick={() => navigate(-1)}>← 목록으로</button>
            <div className="job-detail-box">
                <h1 style={{ marginTop: '20px' }}>{job.title}</h1>
                <p style={{ color: '#666', marginBottom: '30px' }}>
                    마감일: {job.deadline ? new Date(job.deadline).toLocaleDateString() : '상시채용'}
                </p>
                
                {/* 에디터로 작성한 서식을 그대로 보여주는 영역 */}
                <div 
                    className="job-description-content"
                    dangerouslySetInnerHTML={{ __html: job.description }} 
                    style={{ minHeight: '300px', lineHeight: '1.6', fontSize: '1.1rem' }}
                />

                <div style={{ textAlign: 'center', marginTop: '50px' }}>
                    {/* onClick 함수를 handleApplyClick 으로 변경! */}
                    <button className="btn-apply-large" onClick={handleApplyClick}>
                        이 포지션에 지원하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobDetailView;