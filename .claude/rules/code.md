# 코드(.js 등) 저장 직전 체크

- **원본(as-is) 1:1**. 원본에 없는 UX·동작·옵션 임의 추가 금지. 이상하면 보고만.
- **busy**: on 걸면 모든 종료 분기(early return/취소/에러)에서 off 짝 필수. 성공은 WS20 왕복이 해제(자기해제 금지). 닫기버튼=`_setBusy` 대칭.
- 공통 자산(shell/bootstrap-skin/u4a-ui/tokens) **직접 수정 금지** → 스코프 override.
- 하드코딩 hex 금지, `color-mix` 금지(Chromium 93).
- 메시지: 기존은 **원본(as-is) 키 참조**, 원본에 없고 지시 없으면 `ZMSG_WS_COMMON_001`(포화 임박→추후 `_002`). 임의 문구·키 생성 금지, 필요 키 보고.
- 저장 후 **`node --check`**. 오류 삼킴·조용한 catch 금지(오류코드+표면화).
