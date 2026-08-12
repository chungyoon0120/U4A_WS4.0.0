# 02_audit_agy — BR26 부모 UI 삭제 시 하위 prev 캐시 잔존 버그 심층 재검수 결과

## 판정

**❌ 수정필요 (Modify)**

---

## 1. 지적 사항 (핵심 맹점)

- **멀티(체크) 삭제 로직에서의 반쪽짜리 버그 방치**
  - 요청서(01_request.md)의 3번 항목에서 "부분 체크 시 원본도 자식 prev를 남기는 동작을 동일하게 유지(단건에만 배선)하는 판단이 맞는가?"라고 하였으나, **이 판단은 틀렸습니다.**
  - 단건 삭제 버그를 고치기 위해 `_purgePrevSubtree`를 도입했다면, **멀티(체크) 삭제** 경로(`oAPP.fn.designTreeMultiDeleteItem` 내 `del` 함수)에서도 당연히 동일한 처리가 들어가야 합니다.
  - 현재 `ws_html5_ws20_edit.js` 556-557행:
    ```javascript
    if (n.chk !== true) { continue; }
    _removeNodePreview(n);
    ```
    부모는 체크(`chk===true`)되어 있고 자식은 체크되지 않은(`chk!==true`) 상태로 멀티 삭제를 수행하면, 자식은 루프에서 `continue`로 스킵되지만 부모가 `_removeNodePreview(n)`로 삭제될 때 미리보기(화면)에서는 자식까지 연쇄 삭제됩니다. 그러나 `prev` 캐시는 삭제되지 않고 고스란히 남아 **화면-상태 불일치 버그가 똑같이 재발**합니다.
  - "원본도 버그였으니 그대로 둔다"는 원칙은, 명백한 메모리/상태 불일치 버그를 고치려는 본 이슈(BR26)의 목적에 부합하지 않는 위험한 타협입니다.

---

## 2. 권장 수정 방안

`ws_html5_ws20_edit.js`의 다중 삭제 재귀 함수 내부에 단건 삭제와 동일하게 `_purgePrevSubtree(n)` 호출을 추가하십시오.

**수정 위치**: `ws_html5_ws20_edit.js` 라인 556 부근 (`lf_do` 내 `del` 재귀함수)

```javascript
// 수정 전 (AS-IS)
(function del(arr) {
    if (!arr) { return; }
    for (var i = arr.length - 1; i >= 0; i--) {
        var n = arr[i];
        del(n.zTREE);                 // 자식 먼저
        if (n.chk !== true) { continue; }
        _removeNodePreview(n);
        arr.splice(i, 1);
    }
})(_tree());

// 수정 후 (TO-BE)
(function del(arr) {
    if (!arr) { return; }
    for (var i = arr.length - 1; i >= 0; i--) {
        var n = arr[i];
        del(n.zTREE);                 // 자식 먼저
        if (n.chk !== true) { continue; }
        _removeNodePreview(n);
        _purgePrevSubtree(n);         // [수정필요] 멀티 삭제 시에도 부모에 딸려 지워지는 미체크 자식들의 prev 캐시를 말끔히 정리!
        arr.splice(i, 1);
    }
})(_tree());
```

---

## 3. 종합 평가

단건 삭제 경로(`_deleteUI`)에 대한 재귀 삭제 유틸(`_purgePrevSubtree`) 적용은 훌륭하게 이식되었으나, 동일한 버그가 발생하는 멀티 삭제(`designTreeMultiDeleteItem`) 경로를 "원본 1:1"이라는 이유로 방치한 것은 본 이슈의 근본 목적을 훼손합니다. 멀티 삭제 경로에도 `_purgePrevSubtree(n)`를 배선하여 하위 캐시 누수를 완벽히 차단한 뒤 다시 검수를 요청하시기 바랍니다.
