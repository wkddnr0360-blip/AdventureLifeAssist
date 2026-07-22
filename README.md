# FocusBell 2.0.0

학습 알람으로 시작해 문제 범위 로그로 끝나는 기존 FocusBell에 실시간 학습 현황, 랭킹, 친구, DM, 캘린더, 메모, 할 일, 목표·업적, 튜토리얼, 관리자 콘솔, 멀티기기 동기화, 집중력 미니게임을 통합한 설치형 PWA입니다.

## 바로 실행하는 파일

- `index.html`: 애플리케이션 UI와 기능 코드가 들어 있는 단일 실행 파일
- `manifest.json`, `sw.js`, 아이콘 3개: PWA 설치·오프라인 앱 셸
- `firestore.rules`: Firestore 접근 제어
- `database.rules.json`: Realtime Database 접속 상태 접근 제어
- `firebase.json`, `.firebaserc`: Firebase CLI 배포 구성

## 주요 기능

- 날짜·반복 학습 알람, 브라우저 알림, 진동, 알람음, 미루기
- 과목·시작 문제 입력 → 타이머 → 종료 문제·정답 수·회고 입력 → 자동 로그
- 오늘·주간·누적 랭킹과 현재 공부 중인 사용자
- 친구 요청·수락·삭제, 친구 전용 실시간 DM, 읽음 상태
- 날짜별 학습 로그·메모·할 일·완료 상태를 합친 월간 캘린더
- 일일 시간·문제 목표, 목표 진행률, 업적·축하 알림
- 공개 라운지 게시물, 좋아요, 댓글, 신고, 작성자 숨김
- `wkddnr0360@naver.com` 전용 관리자 콘솔과 운영 데이터 탐색
- 사용자별 온라인·랭킹·현재 과목 공개 범위 설정
- Firestore 오프라인 캐시와 세션 트랜잭션을 이용한 멀티기기 충돌 방지
- 6단계 첫 실행 튜토리얼과 숫자 순서 집중력 게임
- iOS safe-area, Android, Windows 데스크톱을 고려한 반응형 PWA
- CSV·JSON 내보내기, 테마, 패치 노트, 연결 상태, 캐시 복구

## 코드 구조

배포는 루트 파일만으로 가능하지만, 유지보수용 원본은 `source/`에 분리했습니다.

- `source/index.base.html`: FocusBell 1 기반 문서
- `source/v2.css`: 2.0 UI 확장 스타일
- `source/v2.*.html`: 화면·설정·모달 조각
- `source/v2.js`: 2.0 기능 레이어
- `tools/build.py`: 위 조각을 합쳐 루트 `index.html`을 재생성

재빌드:

```bash
python tools/build.py
```

## 중요한 범위

기존 Firebase 프로젝트 `reader2-43b34`와 `apps/focusbell_v1` 네임스페이스를 유지하므로 이전 FocusBell 학습 로그와 알람은 자동 삭제되지 않습니다. 데이터베이스를 물리적으로 초기화하지 않고 기능을 확장한 설계입니다.

실제 배포 순서는 `DEPLOY.md`, 보안 경계는 `SECURITY.md`, 컬렉션 구조는 `DATA_MODEL.md`, 검증 결과는 `VALIDATION.md`를 확인하세요.
