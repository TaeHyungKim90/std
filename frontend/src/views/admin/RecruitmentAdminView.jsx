// src/views/admin/RecruitmentAdminView.jsx 수정

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

    // 👉 수정 모달 열기 핸들러
    const handleEditClick = (job) => {
        setSelectedJob(job);
        setIsModalOpen(true);
    };

    // 👉 공고 삭제 핸들러
    const handleDeleteClick = async (jobId) => {
        if (!window.confirm("정말 이 공고를 삭제하시겠습니까?\n(관련 지원자 정보가 함께 삭제될 수 있습니다)")) return;
        try {
            await recruitmentService.deleteJobPosting(jobId);
            alert("공고가 삭제되었습니다.");
            loadJobs(); // 삭제 후 목록 새로고침
        } catch (err) {
            alert("삭제에 실패했습니다.");
            console.error(err);
        }
    };

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>📢 채용 공고 관리</h2>
                <button className="btn-primary" onClick={() => { setSelectedJob(null); setIsModalOpen(true); }}>
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
                            <th style={{ minWidth: '220px' }}>관리</th> {/* 버튼 들어갈 자리 넓힘 */}
                        </tr>
                    </thead>
                    <tbody>
                        {jobs?.length > 0 ? jobs.map(job => (
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
                                    {/* 👉 세 가지 버튼으로 나누어 배치 */}
                                    <button className="btn-save" style={{ marginRight: '5px' }} onClick={() => alert(`${job.id}번 지원자 목록으로 이동`)}>
                                        지원자
                                    </button>
                                    <button className="btn-edit" onClick={() => handleEditClick(job)}>수정</button>
                                    <button className="btn-delete-small" onClick={() => handleDeleteClick(job.id)}>삭제</button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>등록된 공고가 없습니다.</td></tr>
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