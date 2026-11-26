# 2차 픽셀아트 리뉴얼 · 브랜치 통합 및 운영 배포 보고

- **통합 브랜치:** `feat/pixel-renewal-integration` (`main` 병합 및 운영 배포 포함)
- **통합한 트랙 브랜치:**
  - 기준 시안 (`feat/pixel-renewal-slice-1`, `f79c0e9`): 공용 배치 [`public/renewal-layout.mjs`](../public/renewal-layout.mjs), 기준표 [`docs/renewal-slice-1-spec.md`](./renewal-slice-1-spec.md)
  - B. 아트 (`origin/feat/pixel-renewal-art`, `c40730d`): [`public/renewal-slice-art.mjs`](../public/renewal-slice-art.mjs), 다중 착석 포즈·등받이 가림·고해상도 픽셀 디테일
  - C. 이동 (`origin/feat/pixel-renewal-movement`, `ddd5259`): [`lib/cafe-world.mjs`](../lib/cafe-world.mjs) 출입문 문턱 도달·흡연/테라스 연속 충돌 BFS·6인룸 내부 통로·`strictTarget` 클릭, [`public/walk.js`](../public/walk.js) 수동 연속 충돌·도달 불가 마커·기립 복귀
  - D. 좌석 UI (`origin/feat/pixel-renewal-seat-ui`, `b554d4a`): [`public/renewal-seat-picker.mjs`](../public/renewal-seat-picker.mjs) 반응형 도면·키보드/스크린리더 접근성·`?qa=1` 동시 예약 충돌·44×44 모바일 터치 타겟
  - E. 환경 효과 (`origin/feat/pixel-renewal-effects`, `a34fb2e`): [`public/renewal-effects.mjs`](../public/renewal-effects.mjs) 창 유리 클리핑 비/눈·문턱/발 회피 바닥 물튐·활성 트레이 증기·낮/밤 조명·모션 감소, [`public/cafe-art.js`](../public/cafe-art.js) 레거시 클리핑·안전장치

## 통합 중 해결·개선한 사항

1. **렌더 레이어 결합 ([`public/renewal-slice.js`](../public/renewal-slice.js)):** Track B의 Y-정렬 `depthList` 및 마지막 2프레임 의자 등받이 가림 앞에 Track E의 `renderFloorLightingAndSplashes`를 배치해 바닥·스콘스 조명·물튐이 캐릭터/가구를 덮지 않게 정리하고, `renderTraySteamAndSeatHighlight`를 뒤에 두어 활성 트레이 증기와 좌석 강조를 선명히 유지했다.
2. **모션 감소 상태 단일화:** Track B의 식물·키오스크 `reduced` 플래그도 `effectiveReducedMotion()`을 참조하도록 통합해 `모션 감소` QA 토글과 OS 설정이 모든 요소에 함께 적용된다.
3. **모바일 상단 HUD 겹침 수정 ([`public/renewal-slice.css`](../public/renewal-slice.css)):** `390×844` 폭에서 좌측 `.hud-top-left`가 우측 `패널 숨기기` 버튼과 겹치지 않도록 `max-width: calc(100vw - 118px)` 및 `flex-wrap: wrap`을 적용했다.
4. **배포 파이프라인 확장 ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), [`tests/smoke-live-game.mjs`](../tests/smoke-live-game.mjs), [`worker/index.ts`](../worker/index.ts)):** `main` 푸시 시 `public/**`, `lib/**`, `app/**` 변경이 자동 배포·스모크 검증(`renewal-layout.mjs`, `renewal-effects.mjs`, `renewal-slice-art.mjs`, `renewal-seat-picker.mjs`, `renewal-slice.html`, `walk.js` 포함)까지 실행되도록 연결했고, Workers Assets의 `.html` 확장자 제거 리다이렉트(`307 → /renewal-slice`)가 [`worker/index.ts`](../worker/index.ts) 확장자 필터에 막혀 `404`를 내던 실운영 오류를 수정해 `/renewal-slice`와 `/renewal-slice.html` 모두 `200`으로 서빙되게 해결했다.

## 통합 검수 결과

- **단위 테스트 (`node --test tests/*.test.mjs`):** 9개 스위트 **47건 전부 통과**.
- **실브라우저(Headless Chrome, `errors: []`):**
  - FHD(`1920×1080`, `3×`) · QHD(`2560×1440`, `4×`) · 125%(`1536×864`, `3×`) · 울트라와이드(`2560×1080`, `3×`) · 4K(`3840×2160`, `6×`) 정수 스케일 및 무오류 동작 확인.
  - 수동 `KeyW` 입구 통과, 벽 클릭 차단 피드백, 키오스크 좌석도 `?qa=1` 동시 예약 충돌 후 구역·포커스 유지 → `hall:0` 착석·부팅·타이핑 → 수동 키 기립 → `solo:0` 방 문 통과·착석, 낮/맑음·밤/비·밤/눈·효과 꺼짐·모션 감소, 모바일 `390×844` `44×44` 비겹침 확인.
