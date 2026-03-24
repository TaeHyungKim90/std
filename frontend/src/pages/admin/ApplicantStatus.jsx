import React, { useState, useEffect, useContext } from 'react';
import { recruitmentApi } from '../../api/recruitmentApi';
import { openFileViewer } from '../../utils/fileUtils';
import { LoadingContext } from '../../context/LoadingContext';
import { formatPhoneNumber, formatDate } from '../../utils/commonUtils';
import '../../assets/css/admin.css';

const STATUS_OPTIONS = [
    { id: 'all', title: '전체 보기', color: '#111' },
    { id: 'applied', title: '서류 접수', color: '#4A90E2', bg: '#EFF6FF' },
    { id: 'document_passed', title: '서류 합격', color: '#F39C12', bg: '#FEF9C3' },
    { id: 'interviewing', title: '면접 진행', color: '#9B59B6', bg: '#F3E8FF' },
    { id: 'final_passed', title: '최종 합격', color: '#3DAF7A', bg: '#DCFCE7' },
    { id: 'rejected', title: '불합격', color: '#FF6A3D', bg: '#FEE2E2' }
];

const ApplicantStatus = () => {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [applications, setApplications] = useState([]);
    const { setIsLoading } = useContext(LoadingContext);

    // 🌟 검색 및 필터링 상태 추가
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

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
        if (!selectedJobId) {
            setApplications([]); // 리스트 비우기
            setSearchTerm('');   // 검색어 리셋
            setFilterStatus('all'); // 필터 리셋
            return;
        }
        const fetchApplicants = async () => {
            try {
                const res = await recruitmentApi.getApplicationsByJob(selectedJobId);
                setApplications(res.data || res);
                setSearchTerm('');
                setFilterStatus('all');
            } catch (err) {
                console.error("지원자 로드 실패:", err);
                setApplications([]);
            }
        };
        fetchApplicants();
    }, [selectedJobId]);

    // 🌟 상태 변경 로직 (드래그 대신 Select 선택 방식)
    const handleStatusChange = async (appId, newStatus) => {
        const currentApp = applications.find(app => app.id === appId);
        if (currentApp.status === newStatus) return;

        if (newStatus === 'final_passed') {
            if (!window.confirm("최종 합격 처리 시 임직원으로 자동 등록됩니다. 진행하시겠습니까?")) return;
        }

        // 화면 즉시 반영 (Optimistic UI)
        setApplications(prev => prev.map(app => 
            app.id === appId ? { ...app, status: newStatus } : app
        ));

        try {
            await recruitmentApi.updateApplicationStatus(appId, newStatus);
        } catch (err) {
            alert("상태 변경 실패");
            // 롤백 (데이터 다시 불러오기)
            const res = await recruitmentApi.getApplicationsByJob(selectedJobId);
            setApplications(res.data || res);
        }
    };


    // 🌟 검색 및 필터링 적용 로직
    const filteredApplications = applications.filter(app => {
        // 1. 상태 필터 검사
        if (filterStatus !== 'all' && app.status !== filterStatus) return false;
        
        // 2. 검색어 검사 (이름 또는 이메일)
        const keyword = searchTerm.toLowerCase();
        const nameMatch = app.applicant?.name?.toLowerCase().includes(keyword);
        const emailMatch = app.applicant?.email_id?.toLowerCase().includes(keyword);
        
        if (searchTerm && !nameMatch && !emailMatch) return false;
        
        return true;
    });

    return (
        <div className="bq-admin-view">
            <div className="admin-header" style={{ marginBottom: '20px' }}>
                <h2>📊 지원자 전형 현황</h2>
                <select className="bq-select" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
                    <option value="">공고를 선택하세요</option>
                    {jobs.map(job => (
                        <option key={job.id} value={job.id}>{job.title}</option>
                    ))}
                </select>
            </div>

            {/* 🌟 1. 검색 및 카테고리 필터 영역 (클래스로 분리!) */}
            <div className="admin-filter-section">
                
                {/* 검색 바 */}
                <div className="admin-search-group">
                    <span>검색</span>
                    <input 
                        type="text" 
                        className="admin-search-input"
                        placeholder="이름 또는 이메일 검색" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* 상태 필터 버튼들 */}
                <div className="admin-filter-group">
                    {STATUS_OPTIONS.map(opt => {
                        const isActive = filterStatus === opt.id;
                        return (
                            <button 
                                key={opt.id}
                                className={`admin-filter-btn ${isActive ? 'active' : ''}`}
                                onClick={() => setFilterStatus(opt.id)}
                                style={{
                                    // 클릭되어 활성화된 상태의 색상만 인라인으로 남깁니다 (데이터에 따라 다르므로)
                                    borderColor: isActive ? opt.color : undefined,
                                    backgroundColor: isActive ? (opt.bg || '#f8f9fa') : undefined,
                                    color: isActive ? opt.color : undefined
                                }}
                            >
                                {opt.title} {isActive && `(${filteredApplications.length})`}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 🌟 2. 지원자 리스트 (표 형태) */}
            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>이름</th>
                            <th>이메일</th>
                            <th>연락처</th>
                            <th style={{ textAlign: 'center'}}>첨부 서류</th>
                            <th>지원 일자</th>
                            <th style={{ width: '150px' }}>진행 상태 변경</th>
                        </tr>
                    </thead>
                    <tbody>
                    {filteredApplications.length > 0 ? (
                        /* index % 2 하던 로직 삭제! (CSS가 알아서 해줍니다) */
                        filteredApplications.map((app) => (
                            <tr key={app.id}>
                                <td style={{ fontWeight: 'bold' }}>{app.applicant?.name}</td>
                                <td>{app.applicant?.email_id}</td>
                                <td>{formatPhoneNumber(app.applicant?.phone)}</td>
                                
                                <td style={{ textAlign: 'center' }}>
                                    {/* 파일 버튼 래퍼도 클래스로 분리! */}
                                    <div className="admin-file-buttons">
                                        {app.resume_file_url && (
                                            <button onClick={() => openFileViewer(app.resume_file_url)} className="btn-edit">
                                                📄 이력서
                                            </button>
                                        )}
                                        {app.portfolio_file_url && (
                                            <button onClick={() => openFileViewer(app.portfolio_file_url)} className="btn-delete">
                                                🎨 포플
                                            </button>
                                        )}
                                    </div>
                                </td>

                                <td>{formatDate(app.applied_at)}</td>
                                <td style={{ textAlign: 'center' }}>
                                    <select 
                                        className="admin-status-select"
                                        value={app.status} 
                                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                        style={{ 
                                            // 동적 색상만 인라인 유지
                                            color: STATUS_OPTIONS.find(opt => opt.id === app.status)?.color || '#333'
                                        }}
                                    >
                                        {STATUS_OPTIONS.filter(opt => opt.id !== 'all').map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.title}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                                조건에 맞는 지원자가 없습니다.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ApplicantStatus;