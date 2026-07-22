# FocusBell 배포·설정 가이드

## 1. 이번 빌드의 구성

- `index.html`: 앱 전체 UI와 기능이 들어 있는 단일 파일 본체
- `manifest.json`: 설치 이름, 아이콘, 시작 경로, PWA 바로가기
- `sw.js`: 오프라인 셸 캐시, 새 버전 갱신, 알림 클릭 처리
- `firestore.rules`: 사용자별 학습 데이터와 공개 라운지를 분리하는 보안 규칙
- 기존 저장소의 `icon-192.png`, `icon-512.png`는 그대로 사용

앱 이름은 **FocusBell**, 데이터 루트는 아래와 같습니다.

```text
apps/focusbell_v1
├─ handles/{handle}
├─ users/{uid}
│  ├─ alarms/{alarmId}
│  └─ logs/{logId}
├─ posts/{postId}
│  └─ comments/{commentId}
└─ reports/{reportId}
```

기존 Firebase 프로젝트 `reader2-43b34`를 재사용하지만, 기존 컬렉션은 읽거나 삭제하지 않습니다. 같은 프로젝트를 쓴다고 Firestore가 자동 초기화되지는 않습니다. 새 네임스페이스를 사용하므로 FocusBell에서는 빈 앱처럼 시작합니다.

## 2. GitHub 저장소에 반영

### 권장 방식

저장소 루트에서 다음 세 파일을 교체합니다.

```text
index.html
manifest.json
sw.js
```

그리고 `firestore.rules`는 저장소에 보관하거나 Firebase Console에 직접 붙여 넣습니다. 기존 `styles/`, `js/` 폴더는 새 `index.html`에서 참조하지 않으므로 삭제해도 앱 본체에는 영향이 없습니다. 다만 완전 삭제 전에는 Git 기록이나 별도 백업을 남기는 편이 안전합니다.

### 정말 `index.html`만 교체하는 방식

핵심 기능은 실행됩니다. 그러나 기존 `manifest.json`과 `sw.js`가 남기 때문에 다음 차이가 있습니다.

- 설치된 앱 이름이 이전 이름으로 보일 수 있음
- 이전 서비스 워커 캐시가 첫 접속에서 구 화면을 보여줄 수 있음
- 새 PWA 바로가기와 개선된 오프라인 갱신 로직은 적용되지 않음

이 경우 새 화면이 한 번 로드된 뒤 **설정 → PWA 캐시 복구**를 실행하거나 브라우저 사이트 데이터를 지우고 다시 접속합니다.

## 3. Firebase Authentication 설정

Firebase Console에서 프로젝트 `reader2-43b34`를 선택합니다.

1. **Authentication → Sign-in method**로 이동
2. **Email/Password** 제공자를 활성화
3. **Authentication → Settings → Authorized domains**에서 GitHub Pages 도메인을 확인
4. 배포 주소가 `wkddnr0360-blip.github.io`라면 해당 도메인이 없을 때 추가

회원가입, 로그인, 비밀번호 재설정은 이 제공자가 활성화되어 있어야 동작합니다.

## 4. Firestore 보안 규칙 배포

1. Firebase Console에서 **Firestore Database → Rules**로 이동
2. `firestore.rules` 전체를 붙여 넣기
3. **Publish** 실행

이 규칙은 다음을 적용합니다.

- 이메일, 진행 중 세션, 알람, 학습 로그는 본인만 읽고 수정
- 라운지 게시물과 댓글은 로그인 사용자만 조회
- 게시물은 작성자만 삭제
- 좋아요는 자기 UID 한 개만 추가하거나 제거 가능
- 댓글은 댓글 작성자 또는 게시물 작성자가 삭제 가능
- 신고 문서는 일반 사용자가 다시 읽을 수 없음
- 공개 아이디는 별도 예약 문서로 중복 방지

> 이 규칙 파일을 그대로 전체 배포하면 `apps/focusbell_v1` 밖의 Firestore 접근은 모두 차단됩니다. 같은 Firebase 프로젝트에서 다른 앱을 계속 운영해야 한다면 기존 규칙과 FocusBell 규칙을 병합해야 합니다.

## 5. PWA와 알람 동작 범위

현재 버전은 다음 상황에서 알람을 처리합니다.

- 앱 화면이 열려 있음
- PWA가 백그라운드에서 아직 살아 있음
- 알림 권한이 허용됨
- 세션 진행 중 화면 켜두기 기능을 사용할 수 있는 브라우저

웹 페이지의 `setTimeout`·주기 확인만으로는 사용자가 PWA를 완전히 종료했거나 운영체제가 프로세스를 정리한 뒤 정확한 예약 시각에 앱을 다시 깨울 수 없습니다. 완전 종료 상태까지 보장하려면 다음 단계에서 **Firebase Cloud Messaging + 서버 예약 작업(Cloud Functions 또는 Cloud Scheduler)**을 추가해야 합니다.

## 6. 첫 배포 후 점검 순서

1. 새 계정 회원가입
2. 로그아웃 후 다시 로그인
3. 알림 권한 허용
4. 2~3분 뒤의 1회 알람 생성
5. 알람에서 과목·시작 문제 입력 후 세션 시작
6. 마지막 문제번호를 입력하고 로그 저장
7. 로그의 자동 문제 수와 집중 시간이 맞는지 확인
8. 두 계정으로 라운지 게시물·좋아요·댓글·신고 확인
9. 네트워크를 끈 뒤 최근 알람·로그가 로컬에서 보이는지 확인
10. 홈 화면 설치 후 앱 이름과 아이콘 확인

## 7. 배포 전 권장 추가 설정

- Firebase **App Check** 활성화
- Firestore 사용량·비용 알림 설정
- 신고 문서를 검토할 관리자 도구 또는 운영 절차 마련
- 실제 사용자에게 공개하기 전 Firebase Emulator Suite에서 규칙 테스트
- 장기적으로는 Firebase 설정과 앱 로직을 파일별로 분리하고 빌드 도구 도입

## 8. 정적 검증 결과

- 인라인 모듈 JavaScript 문법 검사 통과
- HTML `id` 중복 없음
- `<label for>` 대상 누락 없음
- 새 앱 본체에서 기존 `styles/`·`js/` 파일 참조 없음
- Firebase SDK 버전: `12.16.0`

실제 Firebase 로그인·Firestore 권한·푸시 전달은 사용자의 Firebase Console 설정과 배포 도메인에서 최종 확인해야 합니다.
