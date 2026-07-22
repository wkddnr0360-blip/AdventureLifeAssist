# FocusBell 2.0 검증 결과

검증일: 2026-07-23

## 정적 검사

- `index.html` 인라인 ES module: Node.js 문법 검사 통과
- `sw.js`: Node.js 문법 검사 통과
- HTML ID 199개 중 중복 없음
- `<label for>` 대상 누락 없음
- ARIA 참조 대상 누락 없음
- CSS 중괄호 463쌍 균형 확인
- Firestore Rules 중괄호 51쌍, 괄호 375쌍 균형 확인
- `manifest.json`, `database.rules.json`, `firestore.indexes.json`, `firebase.json`: JSON 파싱 확인
- PWA 아이콘: 192×192, 512×512, Apple touch icon 180×180 확인
- 확대를 막는 `user-scalable=no` 또는 `maximum-scale=1`을 사용하지 않음

## 브라우저 통합 시나리오

헤드리스 Chromium의 로컬·모의 상태에서 다음 시나리오를 자동 실행했습니다.

- 앱 진입과 모바일·데스크톱 가로 오버플로 없음
- 목표 저장
- 할 일 저장·완료 토글
- 메모 저장
- 학습 세션 시작·종료
- 문제 범위 자동 계산
- 6단계 튜토리얼 완주
- 숫자 순서 게임 완주와 결과 표시
- 현재 공부 중 사용자와 랭킹 표시
- 친구 요청·친구 목록 표시
- 대화방 미리보기 표시
- 관리자 메뉴·KPI·사용자 데이터 표시
- 예기치 않은 페이지 오류 없음

상세 결과는 `qa/browser-comprehensive-test.json`, `qa/browser-admin-social-test.json`에 포함했습니다.

## 테스트 범위의 한계

이 환경에는 사용자의 Firebase Console 관리자 권한과 실제 배포 도메인이 없으므로 다음은 코드·규칙 정적 검증 및 모의 데이터 시나리오까지만 완료했습니다.

- 실제 이메일 가입·인증 메일 전달
- 실제 Firestore/Realtime Database Rules 배포 후 allow/deny 네트워크 테스트
- 서로 다른 실제 기기에서 `onDisconnect`와 멀티기기 동기화
- iOS 홈 화면 설치 후 Web Push 전달
- Firebase Hosting 또는 GitHub Pages 배포 캐시 갱신

배포 후 `DEPLOY.md`의 두 기기 최종 점검을 수행해야 합니다. 특히 Rules는 Firebase Console의 Rules Playground 또는 Emulator Suite에서 본인·타인·관리자 케이스를 최종 확인하세요.

## SHA-256

```text
b1409664bd5e5b20b0487e899535e017829217e5fdc7a02b07b9eb0cd86446e8  index.html
3054c737d8cbdaf83c63f5e4286967b73aaec475ad7aaf3786edea4f8bd07304  manifest.json
f597d07eae827e947d2b9fc204c21eb7c5f897cdc334cda903420cee498bad47  sw.js
fe5f61959cff69008e9bf58a0577417454ed5ec4e9c512d223bd53d5846eb501  firestore.rules
b4207e3134ddca176bad0ab8c030f94094104d8dd9f23d1fb1f1e149cad71117  database.rules.json
e258734ed82b355e8e0b281a9323e96ac62736022fba6952fd362af5aeb4ab68  icon-192.png
e3e855a089bc59210f4cbcfbf0aee53babb2008984d2a2c0adc7dde3ed39f452  icon-512.png
48917663b67e401fbaf108f82e6327571a321cce56d366b79752f049522829b3  apple-touch-icon.png
```
