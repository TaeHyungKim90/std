import React, { createContext, useState, useMemo } from 'react';
import LoadingBar from 'components/common/LoadingBar';

export const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);

    // 성능 최적화를 위해 value 객체를 메모이제이션 (선택 사항이지만 권장)
    const value = useMemo(() => ({ isLoading, setIsLoading }), [isLoading]);

    return (
        <LoadingContext value={value}>
            {children}
            {/* 전역 로딩 상태가 true일 때만 로딩바 표시 */}
            {isLoading && <LoadingBar />}
        </LoadingContext>
    );
};