import React, { useState, useEffect } from 'react';
import { recruitmentService } from '../../services/recruitmentService';

// 칸반 보드의 단계를 정의합니다.
const STATUS_COLUMNS = [
    { id: 'applied', title: '📄 서류 접수', color: '#4A90E2' },
    { id: 'document_passed', title: '✅ 서류 합격', color: '#F39C12' },
    { id: 'interview_passed', title: '🗣️ 면접 합격', color: '#9B59B6' },
    { id: 'final_passed', title: '🎉 최종 합격', color: '#3DAF7A' },
    { id: 'rejected', title: '❌ 불합격', color: '#FF6A3D' }
];

const ApplicantStatusView = () => {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // 1. 활성화된 채용 공고 목록 불러오기
    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await recruitmentService.getJobPostings();
                setJobs(res.data || []);
                if (res.data?.length > 0) {
                    setSelectedJobId(res.data[0].id); // 첫 번째 공고를 기본 선택
                }
            } catch (err) {
                console.error("공고 로드 실패:", err);
            }
        };
        fetchJobs();
    }, []);

    // 2. 선택된 공고의 지원자 목록 불러오기
    useEffect(() => {
        if (!selectedJobId) return;
        const fetchApplicants = async () => {
            setIsLoading(true);
            try {
                const res = await recruitmentService.getApplicationsByJob(selectedJobId);
                setApplications(res.data || []);
            } catch (err) {
                console.error("지원자 로드 실패:", err);
                setApplications([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchApplicants();
    }, [selectedJobId]);

    // 3. Drag & Drop 이벤트 핸들러
    const handleDragStart = (e, appId) => {
        e.dataTransfer.setData('appId', appId);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Drop을 허용하기 위해 필수
    };

    const handleDrop = async (e, targetStatus) => {
        e.preventDefault();
        const appId = e.dataTransfer.getData('appId');
        if (!appId) return;

        const currentApp = applications.find(app => String(app.id) === appId);
        if (currentApp.status === targetStatus) return; // 같은 컬럼이면 무시

        if (targetStatus === 'final_passed') {
            if (!window.confirm("이 지원자를 '최종 합격' 처리하시겠습니까?\n(승인 시 시스템 임직원으로 자동 등록될 수 있습니다.)")) {
                return;
            }
        }

        // 화면 즉시 업데이트 (Optimistic UI)
        setApplications(prev => prev.map(app => 
            String(app.id) === appId ? { ...app, status: targetStatus } : app
        ));

        try {
            // 백엔드 상태 업데이트 요청
            await recruitmentService.updateApplicationStatus(appId, targetStatus);
        } catch (err) {
            alert("상태 변경에 실패했습니다.");
            // 실패 시 원래 데이터로 롤백 로직 추가 가능
            const res = await recruitmentService.getApplicationsByJob(selectedJobId);
            setApplications(res.data || []);
        }
    };

    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <h2>📊 지원자 전형 현황</h2>
                <select 
                    className="bq-select" 
                    value={selectedJobId} 
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    style={{ minWidth: '300px', fontSize: '1rem', padding: '10px' }}
                >
                    <option value="">공고를 선택하세요</option>
                    {jobs.map(job => (
                        <option key={job.id} value={job.id}>
                            {job.status === 'closed' ? '[마감] ' : '[진행중] '} {job.title}
                        </option>
                    ))}
                </select>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>지원자 정보를 불러오는 중...</div>
            ) : (
                <div className="kanban-board">
                    {STATUS_COLUMNS.map(col => (
                        <div 
                            key={col.id} 
                            className="kanban-column"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className="kanban-column-header" style={{ borderBottomColor: col.color }}>
                                <h3>{col.title}</h3>
                                <span className="kanban-count">
                                    {applications.filter(app => app.status === col.id).length}
                                </span>
                            </div>
                            
                            <div className="kanban-cards">
                                {applications.filter(app => app.status === col.id).map(app => (
                                    <div 
                                        key={app.id} 
                                        className="kanban-card"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, app.id)}
                                    >
                                        <div className="card-name">{app.applicant_name}</div>
                                        <div className="card-info">📧 {app.email}</div>
                                        <div className="card-info">📞 {app.phone || '연락처 미상'}</div>
                                        <div className="card-date">
                                            지원일: {new Date(app.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ApplicantStatusView;