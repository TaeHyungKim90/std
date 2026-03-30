import React, { createContext, useState, useMemo, useContext } from 'react';
import LoadingBar from 'components/common/LoadingBar';

// 1. 컨텍스트 생성
const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    // 🌟 단순히 켜고 끄는 것뿐만 아니라, 문구(text)도 상태로 관리합니다!
    const [loadingState, setLoadingState] = useState({
        isLoading: false,
        text: "처리 중입니다..."
    });

    // 🌟 로딩 켜기 함수 (원하는 멘트를 넣을 수 있음)
    const showLoading = (text = "처리 중입니다...") => {
        setLoadingState({ isLoading: true, text });
    };

    // 🌟 로딩 끄기 함수
    const hideLoading = () => {
        setLoadingState({ isLoading: false, text: "처리 중입니다..." });
    };

    // 성능 최적화: 함수들만 리모컨에 담아서 내보냅니다.
    const value = useMemo(() => ({ showLoading, hideLoading }), []);

    return (
        // 🌟 마스터님의 힙한 React 19 문법 그대로! (.Provider 생략)
        <LoadingContext value={value}>
            {children}
            
            {/* 전역 로딩 상태가 true일 때 띄우고, text도 전달! */}
            {loadingState.isLoading && <LoadingBar text={loadingState.text} />}
        </LoadingContext>
    );
};

// 🌟 마스터님이 다른 파일에서 편하게 꺼내 쓸 '리모컨' (커스텀 훅)
export const useLoading = () => {
    return useContext(LoadingContext);
};