import React, { createContext, useState } from 'react';
import LoadingBar from '../views/common/LoadingBar';

// 1. Context 생성
export const LoadingContext = createContext();

// 2. Provider 컴포넌트
export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);

    // 3. value를 통해 상태(isLoading)와 제어 함수(setIsLoading)를 전역으로 배포
    return (
        <LoadingContext value={{ isLoading, setIsLoading }}>
            {children}
            {/* 로딩바가 여기서 조건부 렌더링 됩니다. */}
            {isLoading && <LoadingBar />}
        </LoadingContext>
    );
};
