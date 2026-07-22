# 소스 조각 안내

루트 `index.html`은 단일 파일 배포를 위해 빌드 결과를 커밋한 것입니다. 수정할 때는 가능한 한 이 폴더의 조각을 편집하고 `python tools/build.py`로 다시 합치세요.

`tools/build.py`는 문자열 마커를 사용하므로 `index.base.html`에서 기존 마커를 바꿀 때 assertion이 실패할 수 있습니다. 이는 잘못된 위치에 조용히 삽입되는 것을 방지하기 위한 의도된 동작입니다.
