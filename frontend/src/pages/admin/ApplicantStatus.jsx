import React, { useState, useEffect, useContext } from 'react';
import { recruitmentApi } from '../../api/recruitmentApi';
import { openFileViewer } from '../../utils/fileUtils';
import { LoadingContext } from '../../context/LoadingContext';
// ✅ 마스터님의 모델(Application.status)과 동일하게 단계를 설정합니다.

const STATUS_COLUMNS = [
    { id: 'applied', title: '📄 서류 접수', color: '#4A90E2' },
    { id: 'document_passed', title: '✅ 서류 합격', color: '#F39C12' },
    { id: 'interviewing', title: '🗣️ 면접 진행', color: '#9B59B6' },
    { id: 'final_passed', title: '🎉 최종 합격', color: '#3DAF7A' },
    { id: 'rejected', title: '❌ 불합격', color: '#FF6A3D' }
];

const ApplicantStatusView = () => {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [applications, setApplications] = useState([]);
    const { setIsLoading } = useContext(LoadingContext);

    useEffect(() => {
        const fetchJobs = async () => {
            setIsLoading(true);
            try {
                const res = await recruitmentApi.getJobPostings();
                const data = res.data || res; 
                setJobs(data);
                if (data.length > 0) setSelectedJobId(data[0].id);
            } catch (err) { 
                console.error("공고 로드 실패", err); 
            } finally {
                setIsLoading(false);
            }
            
        };
        fetchJobs();
    }, [setIsLoading]);

    useEffect(() => {
        if (!selectedJobId) return;
        const fetchApplicants = async () => {
            //setIsLoading(true);
            try {
                const res = await recruitmentApi.getApplicationsByJob(selectedJobId);
                setApplications(res.data || res);
            } catch (err) {
                console.error("지원자 로드 실패:", err);
                setApplications([]);
            } finally { 
                //setIsLoading(false); 
            }
        };
        fetchApplicants();
    }, [selectedJobId]);

    const handleDragStart = (e, appId) => { e.dataTransfer.setData('appId', appId); };
    const handleDragOver = (e) => { e.preventDefault(); };

    const handleDrop = async (e, targetStatus) => {
        e.preventDefault();
        const appId = e.dataTransfer.getData('appId');
        if (!appId) return;

        const currentApp = applications.find(app => String(app.id) === appId);
        if (currentApp.status === targetStatus) return;

        if (targetStatus === 'final_passed') {
            if (!window.confirm("최종 합격 처리 시 임직원으로 자동 등록됩니다. 진행하시겠습니까?")) return;
        }

        setApplications(prev => prev.map(app => 
            String(app.id) === appId ? { ...app, status: targetStatus } : app
        ));

        try {
            await recruitmentApi.updateApplicationStatus(appId, targetStatus);
        } catch (err) {
            alert("상태 변경 실패");
            const res = await recruitmentApi.getApplicationsByJob(selectedJobId);
            setApplications(res.data || res);
        }
    };

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>📊 지원자 전형 현황</h2>
                <select className="bq-select" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                    <option value="">공고를 선택하세요</option>
                    {jobs.map(job => (
                        <option key={job.id} value={job.id}>{job.title}</option>
                    ))}
                </select>
            </div>

            <div className="kanban-board">
                {STATUS_COLUMNS.map(col => (
                    <div key={col.id} className="kanban-column" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
                        <div className="kanban-column-header" style={{ borderBottomColor: col.color }}>
                            <h3>{col.title}</h3>
                            <span className="kanban-count">{applications.filter(app => app.status === col.id).length}</span>
                        </div>
                        <div className="kanban-cards">
                            {applications.filter(app => app.status === col.id).map(app => (
                                <div key={app.id} className="kanban-card" draggable onDragStart={(e) => handleDragStart(e, app.id)}>
                                    {/* 🚨 중요: app.applicant 객체 내부 필드에 접근합니다. */}
                                    <div className="card-name">{app.applicant?.name}</div>
                                    <div className="card-info">📧 {app.applicant?.email_id}</div>
                                    <div className="card-info">📞 {app.applicant?.phone || '연락처 미상'}</div>
                                    <div className="card-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        {app.resume_file_url && (
                                            <button 
                                                onClick={() => openFileViewer(app.resume_file_url)}
                                                className="btn-edit"
                                                style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }}
                                            >
                                                📄 이력서 보기
                                            </button>
                                        )}
                                        {app.portfolio_file_url && (
                                            <button 
                                                onClick={() => openFileViewer(app.portfolio_file_url)}
                                                className="btn-delete"
                                                style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }}
                                            >
                                                🎨 포트폴리오
                                            </button>
                                        )}
                                    </div>
                                    <div className="card-date">지원일: {new Date(app.applied_at).toLocaleDateString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ApplicantStatusView;