export const formatPhoneNumber = (phone) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2,3})(\d{3,4})(\d{4})$/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return phone;
};

/**
 * 2. 전화번호 숫자만 추출 (DB 저장용: 010-1234-1234 -> 01012341234)
 */
export const getRawPhoneNumber = (phone) => {
    return phone ? phone.replace(/\D/g, '') : '';
};

/**
 * 3. 날짜 포맷팅 (2026-03-24T... -> 2026. 03. 24)
 */
export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    
    // 연, 월, 일을 추출하여 2자리씩 맞춤
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};