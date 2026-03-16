import React from 'react';

const LoadingBar = () => {
    return (
        <div style={styles.overlay}>
            <div style={styles.spinner}></div>
            <p style={styles.text}>처리 중입니다...</p>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(240, 238, 233, 0.8)', /* 🎨 새 배경색 #F0EEE9 기반 반투명 */
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, 
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '5px solid rgba(61, 175, 122, 0.2)', /* 연한 Primary 테두리 */
        borderTop: '5px solid #3DAF7A', /* 🎨 Primary 컬러 스피너 */
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '15px'
    },
    text: {
        color: '#141414', /* 🎨 Text 컬러 적용 */
        fontWeight: 'bold',
        fontSize: '16px'
    }
};

// CSS 애니메이션을 위해 스타일 시트에 추가할 내용 (또는 styled-components 사용 시)
// @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

export default LoadingBar;