# 2차 리뉴얼 [이동] 트랙 완료 보고 및 인계 문서

- **작업 브랜치:** `feat/pixel-renewal-movement` (출발 커밋: `f79c0e9`, `docs/pixel-art-renewal.md` · `docs/renewal-slice-1-spec.md` 기준)
- **담당 범위:** C. 이동(충돌 판정, 수동/클릭 이동, 문턱 도달, 룸 내부 동선, 기립 복귀) — **main 병합 및 운영 배포 미실행 (통합 담당 인계)**

---

## 1. 변경 파일 및 개선 내용

1. [`lib/cafe-world.mjs`](../lib/cafe-world.mjs) (브라우저 `/world.js` 겸용)
   - **공용 규격 재사용:** `./renewal-layout.mjs`에서 `CHARACTER_SPEC`, `WORLD_SPEC`을 직접 import해 `MOVEMENT_SPEC`(논리 `640×360`, 발 충돌 `12×8px`, 걷기 속도 `84px/s`)과 `768×512` 레거시 `%` 어댑터(`percentToLegacyPx`, `legacyPxToPercent`)를 내보낸다.
   - **출입문 문턱 도달 복구 (`entranceThreshold`):** `y = 83.8`에서 끊겨 있던 홀 자유 이동 경계를 `cafe-art.js` 출입문 그림(`x: 31.6..35.8%`, `y: 83.8..90.0%`, 중심 `(33.7, 89.2)`)까지 확장해 문턱 포켓만 보행 가능하게 하고, 양옆 하단 벽은 차단을 유지했다. 탐색 그리드(`rows: 63`)도 `y = 90.4`까지 확장했다.
   - **흡연구역·테라스 연속 충돌 BFS (`clearSegmentInSpace`, `findRelaxPath`):** 기존의 단순 2-경유점 우회(`midY = 60 / 66`)를 제거하고, `1.5%` 격자 BFS + 연속 세그먼트 충돌 검사(`clearSegmentInSpace`) 기반 경로 탐색으로 교체했다.
   - **바닥 클릭 엄격 판정 (`{ strictTarget = false }`):** `strictTarget: true`일 때 목적지(`to`)가 벽·장애물·외부 구역이면 가까운 통로로 임의 보정하지 않고 빈 경로(`[]`)를 반환한다.
   - **같은 룸 내 좌석 변경 내부 동선 (`routeToSeat`):** `duo` / `team` / `squad`(6인룸) 내부 이동에서 `roomDoor (50, 94)` 경유를 제거했다. `squad` 앞줄(`0..2`) ↔ 앞줄은 앞줄 내부 통로(`y = 38`), 뒷줄(`3..5`) ↔ 뒷줄은 뒷줄 내부 통로(`y = 87`), 앞줄 ↔ 뒷줄은 좌측 내부 세로 통로(`x = 17.5`)로 연결한다.

2. [`public/walk.js`](../public/walk.js) & [`public/walk.css`](../public/walk.css)
   - **수동 이동(WASD/방향키/조이스틱) 연속 충돌:** `clearSegmentInSpace(location, next, walkSpace)`로 축별 이동 구간 전체를 검사해 큰 프레임 간격(`dt`)에서도 모서리 관통을 막는다.
   - **바닥 클릭 피드백 (`.cafe-move-marker`):** `{ strictTarget: true }` 경로가 있을 때만 이동하고 짧은 발밑 표시를 낸다. 벽·가구를 클릭하면 이동하지 않고 `"도달 불가"` 피드백을 표시한다. (`prefers-reduced-motion` 시 정적 표시)
   - **기립 후 위치 복귀 유지 (`stoodFromSeat`):** `standFromSeat()` 실행 시 홀 좌석 앞 통로 또는 룸 포탈에 서도록 유지하고, `animate()`의 `spawn` 강제 복귀가 기립 위치를 덮어쓰지 않도록 수정했다.

3. [`public/renewal-slice.js`](../public/renewal-slice.js)
   - **시안 수동 이동 연속 충돌 및 자동 기립:** WASD/방향키 이동에 `isSegmentWalkable`을 적용했고, 착석(`typing`) 상태에서 방향키를 누르면 즉시 `standPoint`로 일어난 뒤 이동하도록 연결했다.
   - **모션 감소 존중:** `prefers-reduced-motion`에서 클릭 마커 크기 펄스를 멈춘 정적 사각 표시로 렌더링한다.

4. [`tests/renewal-movement.test.mjs`](../tests/renewal-movement.test.mjs)
   - 공용 `WORLD_SPEC`/`footBox` 재사용, 홀 출입문 문턱 도달, `strictTarget` 차단, `booth`/`terrace` 전 스팟 연속 충돌 경로, `duo`/`team`/`squad` 룸 내부 좌석 전환(문 왕복 제거) 5개 단위 테스트 추가.

---

## 2. 공용 기준과의 충돌·조율 사항 (총괄 및 타 트랙 전달용)

| 구분 | 확인된 충돌 / 과도기 상태 | 영향 범위 | 총괄 / 타 트랙 권장 조치 |
| --- | --- | --- | --- |
| **좌표계 이중화 (`%` vs `640×360` px)** | `public/renewal-layout.mjs`(`f79c0e9`)는 `640×360` 논리 px 시안(3석)만 정의하고, 실서비스 [`lib/cafe-world.mjs`](../lib/cafe-world.mjs)는 `768×512` 기반 `%` 좌표(홀 88석 + 4룸 + 흡연구역·테라스)를 사용한다. | **A(월드), B(아트), D(좌석도), F(통합)** | A 트랙이 `public/renewal-layout.mjs`를 전 구역(홀 88석·1/2/5/6인룸·매점·흡연·테라스)으로 확장 완료하면 `cafe-world.mjs`의 `%` 좌표와 `legacyPixels` 어댑터를 제거하고 `renewal-layout.mjs`의 `isFootWalkable` / `findPath`로 단일화해야 함. |
| **`/world.js` 상대 경로 import** | [`app/world.js/route.ts`](../app/world.js/route.ts)는 `lib/cafe-world.mjs?raw`를 `/world.js` 루트로 직접 서빙한다. `cafe-world.mjs`가 `./renewal-layout.mjs`를 import하므로 `lib/renewal-layout.mjs`(Node용)와 `public/renewal-layout.mjs`(브라우저 `/renewal-layout.mjs`용) 둘의 동기화가 필수다. | **F(통합·배포)** | `public/renewal-layout.mjs`만 수정해도 `lib/renewal-layout.mjs`는 단순 re-export(`export * from "../public/renewal-layout.mjs"`)이므로 두 경로가 항상 같은 원본을 바라본다. 단, Next/Vinext 번들링이나 라우트 변경 시 `/renewal-layout.mjs` 정적 서빙 유지 여부를 확인해야 함. |
| **기존 88석 `seats` 배열 미이관** | [`public/app.js`](../public/app.js)가 소유한 홀 88석·룸 의자 좌표(`roomChairs`)는 아직 D/A 트랙 소관이며, `walk.js`는 `window.cafeSeating.position/chair` 인터페이스를 통해 간접 참조한다. | **A(월드), D(좌석도)** | A·D 트랙이 좌석 좌표를 `renewal-layout.mjs` 기반으로 옮길 때 `seating.position(key)`가 통로 `approachPoint` 및 `cushionAnchor`를 일관되게 반환하도록 계약을 맞추면 `walk.js`의 `routeToSeat` / `standFromSeat` 수정 없이 연동 가능함. |

---

## 3. 검증한 동선·화면 및 남은 문제

### 검증 완료
- **단위 테스트 (`node --test tests/*.test.mjs`):** `renewal-movement.test.mjs`(5건) + `renewal-layout.test.mjs`(8건) + 기존 6개 테스트 스위트 총 41건 전체 통과.
- **실브라우저(Headless Chrome, `errors: []`):**
  - `GET /world.js` + `./renewal-layout.mjs` 브라우저 ES 모듈 로드, `entranceThreshold(33.7, 89.2)` 보행 가능, `strictTarget` 벽 클릭 `[]` 반환, `MOVEMENT_SPEC.footBox = 12×8` 확인.
  - **FHD (`1920×1080`, `3×`):** `KeyW` 수동 키보드로 매장 앞 복도 → `entrance` 문 통과 → 홀 진입, 벽 클릭 시 `"이동할 수 없습니다"` 차단 피드백 및 제자리 유지, `solo:0` 착석 후 `ArrowDown` 수동 입력으로 `standPoint(124, 132)` 자동 기립 확인.
  - **4K (`3840×2160`, `6×`):** `hall:0` 착석 상태에서 `hall:1` 선택 시 통로 기립 → 중앙 우회 → `hall:1` 착석·타이핑 전환 확인.

### 남은 문제 (미검증·후속 필요)
1. **전 구역 88석·매점·휴식구역 통합 이동:** 현재 본 브랜치의 `640×360` 실화면 동선 검증은 1차 시안(`entrance`, `kiosk`, `hall:0`, `hall:1`, `solo:0`) 범위이며, 88석 전체와 2·5·6인룸·매점·흡연실 실화면 동선은 A·B·D 트랙 합류 후 F(통합) 단계에서 실측해야 함.
2. **모바일 뷰포트 조이스틱 + 채팅 + 하단 메뉴 동시 노출:** 터치 실기기/모바일 에뮬레이션에서 조이스틱·채팅·하단 메뉴가 동시에 열렸을 때 이동 마커 가림 여부는 D/F 통합 단계에서 최종 확인 필요.
3. **프로덕션 빌드 (`npm run build`):** 현 로컬 환경에 `node_modules`가 설치되어 있지 않아 미실행(CI 또는 통합 브랜치에서 실행 필요).
