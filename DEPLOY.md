# FocusBell 2.0 배포 가이드

## 1. 저장소 백업과 파일 교체

기존 저장소를 먼저 별도 브랜치나 ZIP으로 백업합니다. 그다음 이 패키지 루트의 아래 파일을 저장소 루트에 복사합니다.

```text
index.html
manifest.json
sw.js
icon-192.png
icon-512.png
apple-touch-icon.png
firestore.rules
database.rules.json
firestore.indexes.json
firebase.json
.firebaserc
```

GitHub Pages만 사용할 때도 앞의 여섯 웹 파일은 반드시 함께 올리는 것이 좋습니다. `index.html`만 올리면 핵심 화면은 실행되지만 설치 이름·아이콘·서비스 워커가 이전 버전으로 남을 수 있습니다.

## 2. Firebase Authentication

Firebase 프로젝트 `reader2-43b34`에서 다음을 확인합니다.

1. Authentication의 이메일/비밀번호 로그인을 활성화합니다.
2. 실제 배포 도메인을 Authorized domains에 추가합니다.
3. 관리자 계정 `wkddnr0360@naver.com`으로 가입한 뒤 이메일 인증을 완료합니다.
4. 앱의 설정 화면에서 이메일 인증 상태가 `인증 완료`인지 확인합니다.

Firestore 규칙과 앱은 이 계정의 **검증된 이메일** 또는 `admin: true` custom claim을 관리자 권한으로 인정합니다. 단순히 화면의 이메일 값을 바꾸는 것으로는 권한이 생기지 않습니다.

## 3. Firestore 규칙 배포

이 Firebase 프로젝트를 FocusBell만 사용한다면 패키지의 규칙을 그대로 배포할 수 있습니다.

```bash
firebase login
firebase use reader2-43b34
firebase deploy --only firestore:rules,firestore:indexes
```

같은 Firebase 프로젝트에 다른 앱 데이터가 있다면 `firestore.rules` 전체를 덮어쓰지 말고 `apps/focusbell_v1` 관련 규칙을 기존 규칙에 병합합니다. 배포 전 Rules Playground 또는 Emulator Suite로 로그인 사용자·타인·관리자 시나리오를 다시 확인하세요.

## 4. Realtime Database 접속 상태

정확한 기기 연결 종료 감지를 사용하려면 같은 프로젝트에 Realtime Database 인스턴스를 생성하고 규칙을 배포합니다.

```bash
firebase deploy --only database
```

앱의 Firebase 설정은 다음 기본 인스턴스를 가리킵니다.

```text
reader2-43b34-default-rtdb
```

해당 인스턴스가 아직 없거나 연결이 실패해도 앱은 Firestore heartbeat를 대체 경로로 사용합니다. 다만 갑작스러운 앱 종료를 반영하는 속도는 Realtime Database의 `onDisconnect` 경로가 더 정확합니다.

## 5. 관리자 custom claim 권장 설정

검증된 지정 이메일만으로도 관리자 콘솔은 동작합니다. 역할을 토큰에 명시하고 싶다면 `server-tools/`를 로컬의 안전한 관리자 환경에서 실행합니다. 서비스 계정 키는 저장소에 커밋하지 않습니다.

```bash
cd server-tools
npm install
# GOOGLE_APPLICATION_CREDENTIALS 또는 Application Default Credentials 구성 후
npm run claim-admin
```

권한을 제거할 때:

```bash
npm run remove-admin
```

실행 후 대상 계정에서 로그아웃하고 다시 로그인해야 새 ID 토큰의 claim이 반영됩니다.

## 6. Hosting 배포

Firebase Hosting:

```bash
firebase deploy --only hosting
```

전체 Firebase 구성 동시 배포:

```bash
firebase deploy --only firestore:rules,firestore:indexes,database,hosting
```

GitHub Pages에서도 상대 경로와 해시 라우팅을 사용하므로 저장소 하위 경로에서 실행할 수 있습니다. 배포 후 이전 PWA가 설치되어 있다면 앱 설정의 `PWA 캐시 복구`를 한 번 실행하거나 기존 앱을 제거한 뒤 다시 설치합니다.

## 7. 플랫폼별 확인

- iPhone/iPad: Safari에서 사이트를 연 뒤 홈 화면에 추가하고, 알림은 설치된 웹 앱 안에서 허용합니다.
- Android: Chrome 계열 브라우저의 설치 메뉴 또는 앱 내 설치 버튼을 사용합니다.
- Windows/macOS: Chromium 계열 브라우저에서 주소창 설치 버튼으로 독립 창 앱으로 설치합니다.
- 모든 플랫폼: 브라우저 알림·진동·백그라운드 정책은 운영체제 설정의 영향을 받습니다.

## 8. 두 기기 최종 점검

1. 휴대폰과 PC에서 같은 계정으로 로그인합니다.
2. 한 기기에서 세션을 시작하고 다른 기기에서 현재 공부 상태가 보이는지 확인합니다.
3. 다른 기기에서 세션 종료를 시도해 세션 ID 충돌 안내가 정상인지 확인합니다.
4. 두 계정으로 친구 요청·수락·DM·읽음 상태를 확인합니다.
5. 랭킹 공개, 공부 상태 공개, 온라인 공개를 각각 끈 뒤 공개 화면에서 정보가 사라지는지 확인합니다.
6. 관리자 계정에서 관리자 화면의 KPI·사용자·신고·데이터 탐색을 확인합니다.

## 웹 알람의 한계

현재 빌드는 앱이 열려 있거나 운영체제가 PWA 프로세스를 유지하는 동안 예약 알람과 계획 알림을 처리합니다. 앱이 완전히 종료된 뒤에도 특정 시각에 반드시 깨우는 서버 예약 알림은 Firebase Cloud Messaging, 토큰 등록, Cloud Functions 또는 Scheduler 같은 별도 백엔드가 필요합니다. 서비스 워커에는 일반 Push 수신 골격만 포함되어 있으며 서버 발송 구성은 포함하지 않았습니다.
