import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { recruitmentApi } from '../../api/recruitmentApi';
import '../../assets/css/careers.css';

const JobApplyView = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const job = state?.job;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: '', email_id: '', password: '', phone: '' });
    const [files, setFiles] = useState({ resume: null, portfolio: null });

    if (!job) {
        navigate('/careers', { replace: true });
        return null;
    }

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleFileChange = (e, type) => setFiles({ ...files, [type]: e.target.files[0] });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!files.resume) return alert("이력서는 필수입니다.");
        
        setIsSubmitting(true);
        try {
            // 1. 이력서 업로드
            const resumeData = new FormData();
            resumeData.append('files', files.resume);
            const resumeRes = await recruitmentApi.uploadFiles(resumeData);
            const resumeUrl = resumeRes.data[0].file_path;

            // 2. 포트폴리오 업로드 (선택)
            let portfolioUrl = null;
            if (files.portfolio) {
                const portfolioData = new FormData();
                portfolioData.append('files', files.portfolio);
                const portfolioRes = await recruitmentApi.uploadFiles(portfolioData);
                portfolioUrl = portfolioRes.data[0].file_path;
            }

            // 3. 최종 지원서 제출
            await recruitmentApi.submitApplication({
                job_id: job.id,
                ...formData,
                resume_file_url: resumeUrl,
                portfolio_file_url: portfolioUrl
            });

            alert("지원서가 성공적으로 접수되었습니다. 감사합니다!");
            navigate('/careers', { replace: true }); // 완료 후 리스트로 이동

        } catch (error) {
            console.error(error);
            alert("지원 처리 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="careers-container" style={{ maxWidth: '600px' }}>
            <button className="btn-back" onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>← 뒤로가기</button>
            <h2>{job.title} 지원하기</h2>
            
            <form onSubmit={handleSubmit} className="apply-form-box" style={{ marginTop: '20px' }}>
                <div className="form-group">
                    <label>이름 *</label>
                    <input type="text" name="name" required onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label>이메일 *</label>
                    <input type="email" name="email_id" required onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label>비밀번호 (결과 조회용) *</label>
                    <input type="password" name="password" required onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label>연락처 *</label>
                    <input type="tel" name="phone" required onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label>이력서 (PDF, 필수) *</label>
                    <input type="file" accept=".pdf,.doc,.docx" required onChange={(e) => handleFileChange(e, 'resume')} />
                </div>
                <div className="form-group">
                    <label>포트폴리오 (선택)</label>
                    <input type="file" accept=".pdf,.zip" onChange={(e) => handleFileChange(e, 'portfolio')} />
                </div>
                
                <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '15px', backgroundColor: '#3DAF7A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer', marginTop: '20px' }}>
                    {isSubmitting ? '제출 중...' : '최종 제출하기'}
                </button>
            </form>
        </div>
    );
};

export default JobApplyView;