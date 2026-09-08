/**
 * 성명 표시: 닉네임 없거나 이름과 같으면 이름만, 다르면 이름(닉네임)
 */
export function formatUserDisplayName(userName, userNickname) {
	const name = String(userName || '').trim();
	const nick = String(userNickname || '').trim();
	if (!name) return nick || '-';
	if (!nick || nick === name) return name;
	return `${name}(${nick})`;
}
