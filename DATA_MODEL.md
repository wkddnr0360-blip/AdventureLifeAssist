# Firebase 데이터 모델

## Cloud Firestore

```text
apps/focusbell_v1
├─ handles/{handle}
├─ users/{uid}
│  ├─ alarms/{alarmId}
│  ├─ logs/{logId}
│  ├─ memos/{memoId}
│  ├─ plans/{planId}
│  └─ achievements/{achievementId}
├─ publicProfiles/{uid}
├─ publicStats/{uid}
├─ presence/{uid}
├─ adminPresence/{uid}
├─ friendRequests/{requestId}
├─ friendships/{friendshipId}
├─ conversations/{conversationId}
│  └─ messages/{messageId}
├─ posts/{postId}
│  └─ comments/{commentId}
└─ reports/{reportId}
```

### 개인 영역

`users/{uid}`에는 이메일, 프로필 원본, 공개 범위, 목표, 튜토리얼 완료 시점, 현재 활성 세션이 저장됩니다. 하위 컬렉션은 알람·완료 로그·메모·계획·업적입니다.

### 공개 파생 영역

`publicProfiles`, `publicStats`, `presence`는 친구 검색·랭킹·현재 공부 중 화면을 빠르게 렌더링하기 위한 최소 공개 사본입니다. 사용자의 공개 설정이 바뀌면 앱이 값을 제거하거나 익명화합니다.

### 관리자 운영 영역

`adminPresence`는 일반 사용자에게 공개되지 않는 최근 접속·기기 수·공부 상태 요약입니다. 관리자 콘솔은 이 문서와 각 컬렉션을 읽어 운영 상태를 표시하지만 DM 본문은 읽지 않습니다.

### 친구·DM 식별자

친구 관계와 대화방은 두 UID를 정렬해 만든 안정적인 pair ID를 사용합니다. 같은 두 사용자가 여러 기기에서 동시에 대화방을 열어도 중복 방이 생기지 않습니다.

## Realtime Database

```text
focusbell_v1/presence/{uid}/{deviceId}
```

각 기기가 자신의 노드만 씁니다. 연결이 끊기면 `onDisconnect`가 해당 노드를 제거하고, 앱은 남아 있는 기기 노드를 합쳐 사용자의 온라인·공부 상태를 계산해 Firestore 공개/관리자 presence에 반영합니다.

## 멀티기기 세션

활성 학습 세션은 `users/{uid}.activeSession`에 `sessionId`, `deviceId`, `revision`, 갱신 시각을 포함해 저장합니다. 일시정지·재개·완료 시 트랜잭션에서 원격 `sessionId`가 로컬 세션과 같은지 확인하므로 다른 기기에서 이미 종료되거나 교체된 세션을 덮어쓰지 않습니다.

## 시간 저장 원칙

동기화·정렬용 시각은 밀리초 정수로 저장하고, 캘린더 그룹화는 사용자 로컬 시간대의 `YYYY-MM-DD` 키를 사용합니다. 표시 문자열은 저장하지 않고 렌더링 시 현재 로캘로 계산합니다.
