# FocusBell 최종 정적 검증

- 인라인 모듈 JavaScript 문법 검사: 통과
- 서비스 워커 JavaScript 문법 검사: 통과
- manifest JSON 파싱: 통과
- CSS 파싱 오류: 없음
- HTML id 중복: 없음
- label 대상 누락: 없음
- 메뉴·모달·data-action 연결 누락: 없음
- 기존 styles/ 및 js/ 의존성: 없음
- 아이콘 크기·형식: 192×192 / 512×512 RGB PNG 확인
- Firestore 규칙 괄호·문자열 균형 검사: 통과

## SHA-256

| 파일 | 바이트 | SHA-256 |
|---|---:|---|
| `index.html` | 122027 | `27989bd5bdc469a3ab1f663fb0242fbc0a93f977581b6a31b7e16af6343891a1` |
| `manifest.json` | 1187 | `324bdc1058ff64032b73b866e32a56153c7b7a81373b3da9e5f622f8865991ca` |
| `sw.js` | 2706 | `4446b8098dad4678b94ea46e3948a745678e9ac3407dbda391678b8593160ff1` |
| `firestore.rules` | 14601 | `21ed6c01e81be5b29cea4ea4bd18b4634ecb7c8d6ba016edbad27af73df83c0b` |
| `icon-192.png` | 22784 | `e258734ed82b355e8e0b281a9323e96ac62736022fba6952fd362af5aeb4ab68` |
| `icon-512.png` | 79979 | `e3e855a089bc59210f4cbcfbf0aee53babb2008984d2a2c0adc7dde3ed39f452` |
| `DEPLOY.md` | 5628 | `0ada31bdcc9a686bdfa898dbba34a8f931a68a44509f2ecb18592c77b00d78e3` |

> 실제 Firebase Authentication, Firestore 권한, 브라우저 알림 및 설치 동작은 Firebase Console 설정 후 배포 도메인에서 최종 확인해야 합니다.
