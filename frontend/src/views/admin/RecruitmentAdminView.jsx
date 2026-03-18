import React, { useEffect, useState } from 'react';
import { recruitmentService } from '../../services/recruitmentService';
import JobPostingModal from './JobPostingModal';

const RecruitmentAdminView = () => {
    const [jobs, setJobs] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);

    const loadJobs = async () => {
        try {
            const res = await recruitmentService.getJobPostings();
            setJobs(res.data);
        } catch (err) {
            console.error("공고 목록 로드 실패", err);
        }
    };

    useEffect(() => { loadJobs(); }, []);

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h2>📢 채용 공고 관리</h2>
                <button className="btn-add" onClick={() => { setSelectedJob(null); setIsModalOpen(true); }}>
                    + 새 공고 등록
                </button>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>상태</th>
                            <th>공고명</th>
                            <th>마감일</th>
                            <th>등록일</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.length > 0 ? jobs.map(job => (
                            <tr key={job.id}>
                                <td>
                                    <span className={`status-badge ${job.status}`}>
                                        {job.status === 'open' ? '진행중' : '마감'}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{job.title}</td>
                                <td>{job.deadline || '상시채용'}</td>
                                <td>{new Date(job.created_at).toLocaleDateString()}</td>
                                <td>
                                    {/* 이 버튼을 누르면 해당 공고의 지원자 현황(칸반)으로 이동하게 설계할 예정입니다 */}
                                    <button className="btn-edit" onClick={() => alert(`${job.id}번 지원자 목록으로 이동`)}>
                                        지원자 보기
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5">등록된 공고가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <JobPostingModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onRefresh={loadJobs} 
                editingJob={selectedJob} 
            />
        </div>
    );
};

export default RecruitmentAdminView;