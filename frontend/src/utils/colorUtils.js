/**
 * 배경색의 밝기에 따라 최적의 텍스트 색상(검정/하양)을 반환합니다.
 * @param {string} hexColor - #ffffff 형식의 색상 코드
 * @returns {string} 'white' 또는 'black'
 */
export const getContrastColor = (hexColor) => {
  if (!hexColor) return 'black';

  // # 기호 제거
  const hex = hexColor.replace('#', '');

  // r, g, b 값 추출
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // YIQ 밝기 계산 공식
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  // 밝기가 150보다 크면 밝은 색(검정 글자), 작으면 어두운 색(흰 글자) 반환
  return yiq >= 150 ? '#000000' : '#ffffff';
};