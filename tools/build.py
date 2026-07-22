from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source'
base = (SOURCE / 'index.base.html').read_text(encoding='utf-8')
css = (SOURCE / 'v2.css').read_text(encoding='utf-8')
home = (SOURCE / 'v2.home.html').read_text(encoding='utf-8')
views = (SOURCE / 'v2.views.html').read_text(encoding='utf-8')
settings = (SOURCE / 'v2.settings.html').read_text(encoding='utf-8')
modals = (SOURCE / 'v2.modals.html').read_text(encoding='utf-8')
js = (SOURCE / 'v2.js').read_text(encoding='utf-8')

# Metadata and platform tags
base = base.replace('content="알람으로 시작하고 학습 기록으로 끝나는 공부 루틴 PWA"', 'content="실시간 공부 현황, 친구, DM, 캘린더, 목표 달성을 통합한 멀티기기 학습 루틴 PWA"')
base = base.replace('<meta name="apple-mobile-web-app-capable" content="yes">', '<meta name="apple-mobile-web-app-capable" content="yes">\n  <meta name="mobile-web-app-capable" content="yes">\n  <meta name="format-detection" content="telephone=no">')
base = base.replace('<title>FocusBell · Study Alarm & Log</title>', '<title>FocusBell 2 · Live Study Planner</title>')

# CSS extension
assert '</style>' in base
base = base.replace('  </style>', css + '\n  </style>', 1)

# Home quick actions
old_quick = '''        <div class="quick-actions">
          <button class="quick-tile primary-tile" data-action="quick-start">
            <strong>바로 집중 시작</strong><span>과목과 시작 문제를 입력하고 타이머를 켭니다.</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="quick-tile secondary-tile" data-action="open-alarm">
            <strong>알람 예약</strong><span>원하는 시각에 공부 알림</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
          </button>
        </div>'''
new_quick = '''        <div class="quick-actions v2">
          <button class="quick-tile primary-tile" data-action="quick-start">
            <strong>바로 집중 시작</strong><span>과목과 시작 문제를 입력하고 타이머를 켭니다.</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="quick-tile secondary-tile compact" data-action="open-alarm">
            <strong>알람 예약</strong><span>원하는 시각에 공부 알림</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
          </button>
          <button class="quick-tile compact" data-view-go="calendar">
            <strong>캘린더</strong><span>어제의 로그·메모·할 일</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M4 5h16v16H4zM8 3v4M16 3v4M4 9h16"/></svg>
          </button>
          <button class="quick-tile compact" data-action="open-game">
            <strong>짧은 리프레시</strong><span>숫자 순서 집중 게임</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M7 8h10l3 4-2 7-4-3h-4l-4 3-2-7zM8 12h4M10 10v4M16 12h.01M18 14h.01"/></svg>
          </button>
        </div>'''
assert old_quick in base
base = base.replace(old_quick, new_quick, 1)
base = base.replace(new_quick, new_quick + '\n' + home, 1)

# New views before settings
settings_view_marker = '      <section class="view" data-view="settings" aria-labelledby="settingsTitle">'
assert settings_view_marker in base
base = base.replace(settings_view_marker, views + '\n\n' + settings_view_marker, 1)

# New settings group before patch notes group
patch_group_marker = '''        <div class="card settings-group">
          <button class="setting-row" data-action="open-patchnotes">'''
assert patch_group_marker in base
base = base.replace(patch_group_marker, settings + '\n\n' + patch_group_marker, 1)

# Version note
base = base.replace('FocusBell 1.0.0 · namespace: apps/focusbell_v1<br>기존 Firebase 데이터는 삭제하지 않고 새 영역으로 분리됩니다.', 'FocusBell 2.0.0 · namespace: apps/focusbell_v1<br>학습 로그는 유지하고 실시간·친구·캘린더 기능을 같은 앱 영역에 확장합니다.')

# Bottom navigation
nav_pattern = re.compile(r'    <nav class="bottom-nav" aria-label="주요 메뉴">.*?    </nav>', re.S)
nav_new = '''    <nav class="bottom-nav" aria-label="주요 메뉴">
      <button class="nav-btn active" data-view-go="home" aria-label="홈">
        <svg class="icon" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z"/></svg><span>홈</span>
      </button>
      <button class="nav-btn" data-view-go="calendar" aria-label="캘린더">
        <svg class="icon" viewBox="0 0 24 24"><path d="M4 5h16v16H4zM8 3v4M16 3v4M4 9h16"/></svg><span>캘린더</span>
      </button>
      <button class="nav-btn" data-view-go="community" aria-label="함께 공부">
        <svg class="icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6"/></svg><span>함께</span>
      </button>
      <button class="nav-btn" data-view-go="lounge" aria-label="라운지">
        <svg class="icon" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><span>라운지</span>
      </button>
      <button class="nav-btn" data-view-go="settings" aria-label="설정">
        <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg><span>설정</span>
      </button>
    </nav>'''
base, count = nav_pattern.subn(nav_new, base, count=1)
assert count == 1

# Patch notes content
patch_list_pattern = re.compile(r'      <div class="patch-list">.*?      </div>\n    </div>\n  </div>\n\n  <div id="confirmModal"', re.S)
patch_list_new = '''      <div class="patch-list">
        <article class="patch-item"><strong>FocusBell 2.0.0</strong><time>2026.07.23</time><ul><li>실시간 접속·공부 상태와 오늘·주간·누적 학습 랭킹</li><li>친구 요청·수락·삭제, 친구 전용 실시간 DM</li><li>학습 로그·메모·할 일을 한 날짜에 연결한 월간 캘린더</li><li>일일 시간·문제 목표와 업적 달성 애니메이션·알림</li><li>관리자 이메일 또는 admin custom claim 기반 운영 콘솔</li><li>Realtime Database onDisconnect 접속 감지와 Firestore heartbeat 대체 경로</li><li>Firestore 트랜잭션을 이용한 멀티기기 세션 충돌 방지</li><li>6단계 사용 튜토리얼과 숫자 순서 집중력 리프레시 게임</li><li>iOS safe-area, Android, Windows 설치형 PWA UI 개선</li></ul></article>
        <article class="patch-item"><strong>FocusBell 1.0.0</strong><time>기반 기능</time><ul><li>예약·반복 알람, 미루기, 브라우저 알림과 진동</li><li>과목·시작 문제 입력 → 종료 문제 입력 → 자동 학습 로그</li><li>이메일 로그인·회원가입·비밀번호 재설정</li><li>공개 라운지 게시물·좋아요·댓글·신고·작성자 숨김</li><li>CSV/JSON 내보내기, 다크 모드, PWA 설치</li></ul></article>
        <article class="patch-item"><strong>보안·운영 원칙</strong><time>Firebase</time><ul><li>관리자 권한은 검증된 이메일 또는 서버 custom claim을 보안 규칙에서 재검사</li><li>DM 본문은 참여자만 읽으며 관리자 기본 데이터 목록에도 노출하지 않음</li><li>공개 랭킹·현재 과목·온라인 상태는 사용자가 각각 비공개로 전환 가능</li><li>앱을 완전히 종료한 뒤의 정확한 시각 알람은 별도 서버 푸시 없이는 보장되지 않음</li></ul></article>
      </div>
    </div>
  </div>

  <div id="confirmModal"'''
base, count = patch_list_pattern.subn(patch_list_new, base, count=1)
assert count == 1

# Modals before confirmation modal
confirm_marker = '  <div id="confirmModal" class="modal" role="alertdialog"'
assert confirm_marker in base
base = base.replace(confirm_marker, modals + '\n\n' + confirm_marker, 1)

# Fix duplicated Monday checkbox from original source
base = base.replace('''            <label class="weekday"><input type="checkbox" name="repeatDay" value="1"><span>월</span></label>
            <label class="weekday"><input type="checkbox" name="repeatDay" value="1"><span>월</span></label>''', '''            <label class="weekday"><input type="checkbox" name="repeatDay" value="1"><span>월</span></label>''', 1)

# Config update
base = base.replace("version: '1.0.0'", "version: '2.0.0'", 1)
base = base.replace("appId: '1:909397198375:web:bd21eb8f3731b545af7002'", "appId: '1:909397198375:web:bd21eb8f3731b545af7002',\n        databaseURL: 'https://reader2-43b34-default-rtdb.firebaseio.com'", 1)

# Insert feature JS before event binding, then activate it in boot
bind_marker = '    function bindEvents() {'
assert bind_marker in base
base = base.replace(bind_marker, js + '\n\n' + bind_marker, 1)
base = base.replace('Theme.init(); bindEvents(); await PWA.init();', 'Theme.init(); bindEvents(); bindV2Events(); await PWA.init();', 1)

# Keep route support for new PWA shortcuts
base = base.replace("if (route === '#alarms') UI.navigate('alarms');", "if (route === '#alarms') UI.navigate('alarms');\n        if (route === '#calendar') UI.navigate('calendar');\n        if (route === '#community') UI.navigate('community');", 1)
base = base.replace("if (route === '#alarms' || route === '#quick-start') history.replaceState", "if (['#alarms','#quick-start','#calendar','#community'].includes(route)) history.replaceState", 1)

# Game buttons use the designed tile class
base = base.replace('data-game-number="${n}" disabled>${n}', 'class="number-tile" data-game-number="${n}" disabled>${n}')
base = base.replace('data-game-number="${n}">${n}', 'class="number-tile" data-game-number="${n}">${n}')

out = (ROOT / 'index.html')
out.write_text(base, encoding='utf-8')
print(out, len(base))
