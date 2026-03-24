import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { recruitmentApi } from '../../api/recruitmentApi'; 
import { client } from '../../api/axiosInstance'; // 🌟 파일 업로드를 위해 client 임포트
import { formatPhoneNumber } from '../../utils/commonUtils';

const JobApplyPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [files, setFiles] = useState({ resume: null, portfolio: null });

    const job = state?.job; 

    useEffect(() => {
        if (!job) {
            alert("🚨 공고 등록페이지 - 잘못된 접근입니다.");
            navigate('/careers', { replace: true });
            return;
        }

        const userStr = sessionStorage.getItem('applicant_user');
        if (!userStr) {
            alert("로그인이 필요한 서비스입니다.");
            navigate('/careers/login', { state: { returnUrl: `/careers/${job.id}/apply`, job } });
            return;
        }
        const user = JSON.parse(userStr);
        setLoggedInUser(user);

        const checkDuplicate = async () => {
            try {
                const res = await recruitmentApi.getMyApplications(user.id);
                const applications = res.data || res;
                if (applications.some(app => app.job_id === job.id)) {
                    alert("이미 지원이 완료된 공고입니다.\n[내 지원 내역] 페이지에서 확인해 주세요.");
                    navigate('/careers/my-applications', { replace: true }); 
                }
            } catch (error) {
                console.error("중복 지원 검사 실패:", error);
            }
        };
        checkDuplicate();

    }, [job, navigate]);

    const handleFileChange = (e, type) => {
        setFiles({ ...files, [type]: e.target.files[0] });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!files.resume) {
            alert("이력서를 첨부해 주세요.");
            return;
        }

        setIsSubmitting(true);
        try {
            // ==========================================
            // STEP 1: 파일 먼저 서버에 업로드하기
            // ==========================================
            const fileFormData = new FormData();
            // 백엔드 common.py 에서 files: List[UploadFile] 로 받으므로 키 이름은 "files"
            fileFormData.append("files", files.resume);
            if (files.portfolio) {
                fileFormData.append("files", files.portfolio);
            }

            // 공통 파일 업로드 API 호출 (/api/common/upload)
            const uploadRes = await client.post('/common/upload', fileFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            // 업로드 결과 받기 (응답 배열)
            const uploadedFiles = uploadRes.data; 
            // 첫 번째 파일은 이력서, 두 번째 파일이 있다면 포트폴리오
            const resumeFileUrl = uploadedFiles[0].file_path; // 백엔드 FileUploadResponse 스키마에 맞춤
            const portfolioFileUrl = files.portfolio ? uploadedFiles[1].file_path : null;

            // ==========================================
            // STEP 2: 업로드된 파일 URL을 JSON에 담아서 지원서 제출
            // ==========================================
            const applicationData = {
                email_id: loggedInUser.email_id,
                password: "DUMMY_PW", // 지원서 제출용 (필요 없다면 스키마에서 빼는 것을 권장)
                name: loggedInUser.name,
                phone: loggedInUser.phone,
                job_id: job.id,
                resume_file_url: resumeFileUrl, // 🌟 백엔드가 원하는 정확한 키 이름으로 전달!
            };

            // 만약 스키마에 포트폴리오 필드가 있다면 추가
            if (portfolioFileUrl) {
                applicationData.portfolio_file_url = portfolioFileUrl;
            }

            // JSON 형태로 전송!
            await recruitmentApi.submitApplication(applicationData);
            
            alert("지원이 완료되었습니다! 좋은 결과가 있기를 바랍니다.");
            navigate('/careers/my-applications', { replace: true });
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.detail || "지원 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
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