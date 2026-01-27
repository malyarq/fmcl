export function loadNickname() {
  return localStorage.getItem('nickname') || 'Player';
}

export function saveNickname(nickname: string) {
  localStorage.setItem('nickname', nickname);
}

