import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { recruitmentApi } from 'api/recruitmentApi'; 
import { commonApi } from 'api/commonApi';
import { formatPhoneNumber } from 'utils/commonUtils';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError'; 

const JobApplyPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [files, setFiles] = useState({ resume: null, portfolio: null });

    const job = state?.job; 

    useEffect(() => {
        let isMounted = true; 
        if (!job) {
            Notify.toastError("🚨 잘못된 접근입니다.");
            navigate('/careers', { replace: true });
            return;
        }
        const userStr = sessionStorage.getItem('applicant_user');
        if (!userStr) {
            Notify.toastWarn("로그인이 필요한 서비스입니다.");
            navigate('/careers/login', { state: { returnUrl: `/careers/${job.id}/apply`, job } });
            return;
        }
        
        const user = JSON.parse(userStr);
        setLoggedInUser(user);

        const checkDuplicate = async () => {
            Notify.toastPromise(recruitmentApi.getMyApplications(user.id), {
                loading: '기존 지원 내역을 확인하는 중입니다...',
                success: '지원 내역 확인이 완료되었습니다.',
                error: '중복 지원 확인에 실패했습니다.'
            }).then((res) => {
                const applications = res.data || res;
                if (applications.some(app => app.job_id === job.id)) {
                    if (isMounted) {
                        Notify.toastWarn("이미 지원이 완료된 공고입니다.\n[내 지원 내역] 페이지에서 확인해 주세요.");
                        navigate('/careers/my-applications', { replace: true }); 
                    }
                }
            }).catch((error) => {
                console.error("중복 지원 검사 실패:", error);
            });
        };
        checkDuplicate();
        return () => { isMounted = false; };
    }, [job, navigate]);

    const handleFileChange = (e, type) => {
        setFiles({ ...files, [type]: e.target.files[0] });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!files.resume) {
            Notify.toastWarn("이력서를 첨부해 주세요.");
            return;
        }

        setIsSubmitting(true);
        
        const processApplicationTask = async () => {
            // STEP 1: 파일 업로드
            const fileFormData = new FormData();
            fileFormData.append("files", files.resume);
            if (files.portfolio) fileFormData.append("files", files.portfolio);

            const uploadRes = await commonApi.uploadFiles(fileFormData);
            const uploadedFiles = uploadRes.data; 
            const resumeFileUrl = uploadedFiles[0].file_path; 
            const portfolioFileUrl = files.portfolio ? uploadedFiles[1].file_path : null;

            // STEP 2: 지원서 제출
            const applicationData = {
                email_id: loggedInUser.email_id,
                password: "DUMMY_PW", 
                name: loggedInUser.name,
                phone: loggedInUser.phone,
                job_id: job.id,
                resume_file_url: resumeFileUrl, 
            };
            if (portfolioFileUrl) applicationData.portfolio_file_url = portfolioFileUrl;

            // 마지막 통신
            await recruitmentApi.submitApplication(applicationData);
            return true; // 에러 없이 여기까지 오면 성공!
        };

        // 🌟 2. 그 '임무'를 통째로 toastPromise에 넣어버립니다!
        Notify.toastPromise(
            processApplicationTask(), // 👈 방금 만든 두 개의 await가 든 묶음!
            {
                loading: '파일 업로드 및 지원서를 제출하고 있습니다... ⏳', 
                success: '지원이 완료되었습니다! 좋은 결과가 있기를 바랍니다. 🎉',
                error: (error) =>
                    formatApiDetail(error) ||
                    '지원 중 오류가 발생했습니다.'
            }
        ).then(() => {
            // 전부 다 성공했을 때의 처리
            navigate('/careers/my-applications', { replace: true });
        }).catch((error) => {
            // 에러 로그
            console.error("지원서 제출 에러:", error);
        }).finally(() => {
            setIsSubmitting(false);
        });
    };

    if (!loggedInUser || !job) return null;

    return (
        <div className="careers-content-wrapper" style={{ maxWidth: '750px' }}>
            <button className="btn-back" onClick={() => navigate(-1)}>
                ← 뒤로가기
            </button>
            <div className="glass-box apply-form-box">
                <h2 style={{ marginBottom: '10px', color: '#111' }}>{job.title}</h2>
                <p style={{ color: '#555', marginBottom: '30px', fontWeight: '500' }}>아래 정보를 확인하고 이력서를 제출해 주세요.</p>
                
                <div style={{ background: 'rgba(255,255,255,0.5)', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#333' }}>지원자 기본 정보</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px', fontSize: '0.95rem', color: '#555' }}>
                        <span>이름:</span> <strong style={{ color: '#111' }}>{loggedInUser.name}</strong>
                        <span>이메일:</span> <strong style={{ color: '#111' }}>{loggedInUser.email_id}</strong>
                        <span>연락처:</span> <strong style={{ color: '#111' }}>{formatPhoneNumber(loggedInUser.phone)}</strong>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>이력서 (PDF 등, 필수) <span style={{color: '#E74C3C'}}>*</span></label>
                        <input type="file" accept=".pdf,.doc,.docx" required onChange={(e) => handleFileChange(e, 'resume')} />
                    </div>
                    <div className="form-group">
                        <label>포트폴리오 (선택)</label>
                        <input type="file" accept=".pdf,.zip" onChange={(e) => handleFileChange(e, 'portfolio')} />
                    </div>
                    <button type="submit" disabled={isSubmitting} style={{ padding: '16px', background: isSubmitting ? '#cbd5e1' : '#3DAF7A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%', marginTop: '20px', transition: 'all 0.2s' }}>
                        {isSubmitting ? '파일 업로드 및 제출 중...' : '지원서 최종 제출'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default JobApplyPage;