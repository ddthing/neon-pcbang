# 2차 리뉴얼 [환경 효과] 트랙 완료 보고 및 인계 문서

- **작업 브랜치:** `feat/pixel-renewal-effects` (출발 커밋: `f79c0e9`, `docs/pixel-art-renewal.md` §7·§9 기준)
- **담당 범위:** E. 환경 효과(창문 클리핑 비·눈, 외곽 바닥 물튐 가림, 트레이·조리 증기, 낮·밤 조명 및 반사, 모션 감소 모드) — **main 병합 및 운영 배포 미실행 (통합 담당 인계)**

---

## 1. 변경 파일 및 구현 내용

1. [`public/renewal-effects.mjs`](../public/renewal-effects.mjs) (`lib/renewal-effects.mjs`에서 재export)
   - **공용 배치·치수 재사용:** `public/renewal-layout.mjs`의 `DOORS`, `SEATS`, `WORLD_SPEC`, `ZONES`, `getFootBox`, `rectContains`, `rectsOverlap`을 직접 소비한다.
   - **엄격한 창 유리 클리핑 (`SLICE_WINDOWS`, `computeWindowWeatherParticles`, `renderClippedWindow`):** 각 북측 창문(`solo-window`, `hall-window-1`, `hall-window-2`)을 좌·우 `glassPanes`로 나누고 `ctx.clip()`과 `rectContains(pane, particle)`로 가둬 비·눈이 창틀과 중간 살(`mullionX`) 밖으로 새지 않도록 차단했다.
   - **문턱·발 회피 바닥 물튐 (`EXTERIOR_SPLASH_ZONE`, `computeExteriorSplashes`):** `ZONES.exterior.bounds` 내부에서만 생성하되, 출입문 문턱(`DOORS[0].threshold` ±4px)과 플레이어 `footBox`(±2px)와 겹치는 물튐은 제외한다.
   - **조건 연동 증기 (`computeSteamParticles`, `renderTraySteamAndSeatHighlight`):** `cooking: false`일 때 조리 증기를 전혀 생성하지 않으며, 활성 배달 쟁반이 있는 좌석의 `trayAnchor` 바로 위로만 증기를 띄운다.
   - **낮·밤 조명·반사 및 가독성 보정 (`computeLightingPalette`, `renderFloorLightingAndSplashes`):** `night` 실내 오버레이 알파를 `0.16` 이하로 제한해 바닥 줄·통로 경계·실루엣이 어두워져도 읽히게 유지하고, 창 빛 유입·벽면 등(`SLICE_LAMPS`)·활성 모니터 바닥 반사를 구분했다.
   - **효과 끄기 & 모션 감소 (`effectsEnabled`, `reducedMotion`):** `effectsEnabled: false`는 파티클/동적 광원을 끄되 가독성을 유지하고, `reducedMotion: true`는 시간에 따라 변하지 않는 정적 방울·정적 증기·정적 내 자리 테두리만 유지한다.

2. [`public/renewal-slice.html`](../public/renewal-slice.html) & [`public/renewal-slice.js`](../public/renewal-slice.js)
   - QA 조작 바에 `조명: 밤/낮`, `날씨: 맑음/비/눈`, `효과 켜짐/꺼짐`, `모션 감소` 토글과 `window.__renewalSlice.setEnvironment()` API를 연결했다.

3. [`public/cafe-art.js`](../public/cafe-art.js)
   - 레거시 Canvas 렌더러에서도 `glassPanes` 비·눈 렌더링에 `overlay.clip()`을 적용하고, 테라스 `doorway` 문턱 영역과 겹치는 물튐을 건너뛰며, `reducedMotion.matches` 시 정적 날씨·조리 상태를 유지하도록 보완했다.

4. [`tests/renewal-effects.test.mjs`](../tests/renewal-effects.test.mjs)
   - 창 유리 클리핑, 문턱·발 회피 물튐, 비조리/트레이 증기 조건, `effectsEnabled: false` & `reducedMotion: true` 정적 결정성, 낮·밤 가독성 상한 5개 단위 테스트 추가.

---

## 2. 공용 기준과의 충돌·타 트랙 영향 (총괄 전달용)

| 구분 | 확인된 충돌 / 조율 필요 사항 | 영향 범위 | 총괄 / 타 트랙 권장 조치 |
| --- | --- | --- | --- |
| **창·조명 앵커의 배치 모듈 미포함** | 기준 커밋 `f79c0e9`의 [`public/renewal-layout.mjs`](../public/renewal-layout.mjs)에는 벽면 창문(`glassPanes`)과 스콘스(`SLICE_LAMPS`) 좌표가 없어 E 트랙이 [`public/renewal-effects.mjs`](../public/renewal-effects.mjs) 내부에 Slice 1 기준 앵커를 정의함. | **A(월드), B(아트), F(통합)** | A 트랙이 전체 매장(테라스·휴식·매점 포함)으로 `renewal-layout.mjs`를 확장할 때 `windows`와 `lamps`(및 매점 `cookingAnchor`)를 공용 배치 데이터로 승격하면 `renewal-effects.mjs`가 즉시 참조할 수 있음. |
| **B 트랙(`feat/pixel-renewal-art`, `c40730d`)과의 렌더러 분화** | B 트랙이 `public/renewal-slice.js`를 [`renewal-slice-art.mjs`](../public/renewal-slice-art.mjs)로 분리했으나, E 트랙은 충돌 최소화를 위해 모든 효과 연산과 렌더링을 `public/renewal-effects.mjs`에 분리 유지함. | **B(아트), F(통합)** | F 통합 시 B 브랜치의 `renewal-slice.js` 창문/조명/트레이 지점에서 `renderClippedWindow`, `renderFloorLightingAndSplashes`, `renderTraySteamAndSeatHighlight`만 호출하면 충돌 없이 합칠 수 있음. |
| **레거시 `cafe-art.js` 좌표계** | 실서비스 [`public/cafe-art.js`](../public/cafe-art.js)는 여전히 `768×512` 좌표계를 사용하므로 이번 브랜치에서는 `clip()`·문턱 회피·모션 감소 안전장치만 패치함. | **A(월드), F(통합)** | 전 구역 `640×360` 마이그레이션 완료 후 레거시 `cafe-art.js`의 하드코딩 좌표 제거 예정. |

---

## 3. 검증한 동선·화면 및 남은 문제

### 검증 완료
- **Node 단위 테스트 (`node --test tests/*.test.mjs`):** `renewal-effects.test.mjs`(5건) + `renewal-layout.test.mjs`(8건) + 기존 6개 테스트 스위트 총 41건 통과.
- **실브라우저(Headless Chrome, `errors: []`):**
  - **FHD (`1920×1080`, `3×`):** `hall:0` 착석·트레이 활성 상태에서 `밤+비+효과켜짐`, `낮+맑음+효과켜짐`, `밤+비+효과꺼짐`, 및 `모션 감소 ON`(`solo:0` 이동·착석) 전환 화면 검증.
  - **4K (`3840×2160`, `6×`):** `hall:1` 착석·트레이 활성 상태에서 `밤+눈+효과켜짐` 화면 검증.

### 남은 문제 (미검증·후속 필요)
1. **전 구역 조리대·테라스·휴식구역 연결:** 매점 조리(`cooking` 상태)와 2층 테라스 난간·바깥 건물 비·물튐은 전체 매장 `renewal-layout.mjs` 확장(A/B 트랙) 후 연결 검수 필요.
2. **프로덕션 빌드 (`npm run build`):** 로컬 `node_modules` 미설치로 미실행(CI/통합 단계에서 검증 필요).
