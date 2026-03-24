import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recruitmentApi } from '../../api/recruitmentApi';

const JobListPage = () => {
    const [jobs, setJobs] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await recruitmentApi.getPublicJobs();
                setJobs(res.data || res);
            } catch (error) {
                console.error("공고 로드 실패", error);
            }
        };
        fetchJobs();
    }, []);

    return (
        <div className="careers-content-wrapper">
            <header className="careers-header">
                <h1>채용 공고</h1>
                <p>우리를 가슴 뛰게 할 당신을 기다립니다.</p>
            </header>
            <div>
                {jobs.length === 0 ? (
                    <div className="glass-box" style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
                        현재 진행 중인 채용 공고가 없습니다.
                    </div>
                ) : (
                    <div className="job-cards">
                        {jobs.map(job => (
                            <div 
                                key={job.id} 
                                className="job-card"
                                onClick={() => navigate(`/careers/${job.id}`, { state: { job } })}
                            >
                                <h3>{job.title}</h3>
                                <p className="deadline">마감일: {job.deadline ? new Date(job.deadline).toLocaleDateString() : '상시채용'}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobListPage;