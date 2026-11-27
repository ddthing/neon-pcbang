# 길모퉁이PC방

내 위치의 날씨와 시간이 창밖으로 흐르는 파스텔 픽셀아트 온라인 PC방입니다. 같은 매장에 입장한 손님들이 실시간으로 걸어다니며 좌석을 고르고, 음식 배달을 시키고, 11종의 미니게임과 대전을 함께 즐길 수 있습니다.

- **3/4 탑다운 월드 (`1152×768`)**는 16×16 PNG 타일과 가구를 렌더링 단계에서 파스텔로 보정합니다. [스프라이트 렌더러](public/pixel-tiles.js) · [매장 렌더러](public/cafe-art.js)
- **캐릭터와 옷장**은 16×32 치비 스프라이트의 4방향 걷기·착석·휴식·간식 동작과 회전 미리보기를 지원합니다. [캐릭터](public/avatar-sprites.js) · [옷장](public/walk.js)
- **휴식·흡연구역 2종 (좌석 유지 외출):** 매장 좌측 상단 **실내 흡연구역(`booth`)**과 우측 상단 **야외 흡연구역(`terrace`)**을 PC 자리를 반납하지 않고 오갈 수 있으며, 구역별 독립 채팅을 지원합니다.
- **길모퉁이 매점 2.0 & 오픈키친:** 24종 메뉴([snack-menu.json](public/snack-menu.json)) 주문, 알바냥 서빙 배달([cafe-delivery.js](public/cafe-delivery.js)), 옆 자리 간식 선물을 지원합니다.
- **길모퉁이 OS 2.0 & 미니게임 11종:** 런처 아이콘(`게임 런처` / 작업표시줄 `게임`)을 누를 때 열리며, 실시간 오목·알까기(`모퉁이 대국장`), 테트리스(`모퉁이 블록 드롭`), **코지 솔리테어**, **뜨개 실풀기(Knit Unravel)**, 붕어빵 포차, 매점 러시, 산성비, 지뢰찾기, 벽돌깨기 DX, 2048, 스도쿠(고정/입력 구분·Undo 지원)와 실시간 TOP 5 랭킹([lib/cafe-arcade.mjs](lib/cafe-arcade.mjs))을 제공합니다.

---

## 공동개발자 필독 지침 (아키텍처·디자인·동기화 규칙)

새로운 가구를 추가하거나 인테리어·미니게임·UI를 수정할 때는 **반드시 아래 항목별 지침**을 지켜 주세요.

### ① 단일 배치 원본(Single Source of Truth) 및 좌석도 동기화 규칙
> **원칙:** 인테리어·가구·좌석 위치가 바뀌면 **홀 렌더링**, **좌석 선택기(`#floor-kiosk`)**, **충돌·길찾기**, **알바냥 배달**이 함께 바뀌어야 합니다. 좌표값을 HTML이나 여러 JS 파일에 중복 하드코딩하지 마세요.

| 대상 | 원본 파일 | 연동 소비처 (수정 시 반드시 함께 확인) |
| --- | --- | --- |
| 홀 좌석 열·행, 룸 좌석, 구역 랜드마크(입구·키오스크·매점·라운지·흡연구역·화분) | [public/cafe-layout.js](public/cafe-layout.js) (`window.cafeLayout`) | [public/cafe-art.js](public/cafe-art.js) (홀 렌더링), [public/app.js](public/app.js) (`#floor-kiosk` 좌석 버튼 및 `syncFloorLandmarks()`) |
| 충돌 박스·출입문 통행·경로탐색·착석 기준점 | [lib/cafe-world.mjs](lib/cafe-world.mjs) (운영 시 `/world.js`로 서빙) | [public/walk.js](public/walk.js) (캐릭터 이동·클릭 길찾기), [public/cafe-delivery.js](public/cafe-delivery.js) (배달 동선) |
| 상세 2차 리뉴얼 시안 규격·검수 기록 | [docs/pixel-art-renewal.md](docs/pixel-art-renewal.md), [public/renewal-layout.mjs](public/renewal-layout.mjs) | [public/renewal-seat-picker.mjs](public/renewal-seat-picker.mjs) |

- **좌석·인테리어 수정 절차:**
  1. [public/cafe-layout.js](public/cafe-layout.js)의 `hallBanks`, `hallRows`, `spaces`, `landmarks`를 먼저 수정합니다.
  2. [app/cafe.html](app/cafe.html)의 `.floor-map-marker`에는 반드시 `data-landmark="<key>"` 속성을 유지해 [public/app.js](public/app.js)의 `syncFloorLandmarks()`가 좌석도 위치를 자동 갱신하도록 합니다.
  3. **기존 좌석 키(`hall:0`~`hall:87`, `solo:0`, `duo:0..1`, `team:0..4`, `squad:0..5`)는 D1 예약/배달과 직결되므로 임의로 변경·삭제하지 않습니다.**

---

### ② 16×16 파스텔 픽셀아트 제작 지침

현재 매장 구현과 검수는 [Notion 브랜치 인수인계](docs/notion-implementation-handoff.md)를 따릅니다. 아래 1차 시안 배치 및 이전 좌석 수는 기록용입니다. [16×16 무료 픽셀 에셋 & 제미나이 가이드](https://app.notion.com/p/16-16-4241906cddf181b791a1deedbce972d0)

- 가구·소품은 3/4 탑다운 PNG 스프라이트에서 가져옵니다. Downtown Eats & Nights를 인테리어 주 팩으로 쓰고, 100 Free Pixel Art Foods는 진열, 메뉴, 서비스 쟁반에 적용합니다. 창밖과 테라스의 날씨에는 Weather & Nature FX를 사용합니다.
- 팩에 없는 PC 세트·키오스크·자판기와 매점 완제품은 같은 팔레트로 제작한 원본 PNG를 사용합니다. 원본 도안을 수정한 뒤 `node scripts/build-notion-sprites.mjs`로 PNG를 다시 만듭니다.
- 16px 타일과 정수배 확대를 사용합니다. 캔버스 스무딩을 끄고, PNG 원본은 보존하며 색 보정은 렌더 단계에서 적용합니다.
- 바탕은 크림 베이지 `#F7EFE5`와 라이트 우드, 포인트는 라벤더 `#C8B6E2`·베이비핑크 `#F4C2D7`·피치·민트를 씁니다. HUD·퀵버튼·툴팁은 2px 웜 브라운 `#5C4742` 테두리로 맞춥니다.
- 착석 위치는 스프라이트의 방향별 앵커와 맞추고 의자 앞면은 별도로 그립니다. 자리의 화면과 쟁반 위치는 가구 렌더러에서 함께 계산합니다.

게임을 빌드하거나 실행하기 전에 아래 세 팩을 공식 배포처에서 받아 압축을 풀고, 루트에서 경로를 순서대로 전달합니다. 스크립트가 PNG와 JSON을 `public/assets/`에 원본 이름으로 복사합니다.

```sh
node scripts/install-notion-art.mjs <DowntownEats_FREE> <Weather_FX> <Food_Icons>
```

- [Downtown Eats & Nights FREE · dotplays](https://dotplays.itch.io/downtown-eats-and-nights-16x16-top-down-interior-tileset)
- [Weather & Nature FX · reodesuxz](https://reodesuxz.itch.io/free-pixel-weather-nature-fx-63-assets)
- [100 Free Pixel Art Foods · alexkovacsart · CC BY 4.0](https://alexkovacsart.itch.io/free-pixel-art-foods)

---

### ③ 캐릭터 스프라이트 & 화살표 옷장 UI 지침
- **순수 도트 매트릭스 ([public/avatar-sprites.js](public/avatar-sprites.js)):**
  - 둥근 2등신 치비를 16×32 프레임(7열×13행 시트)에 그립니다. 점 눈과 작은 입, 웜 브라운 `#5C4742` 외곽선, 파스텔 의상을 사용합니다.
  - **7종 종족(`skins`):** `0: 사람`, `1: 고양이`, `2: 곰`, `3: 토끼`, `4: 쥐`, `5: 기린`, `6: 호랑이` (각 종족별 4톤 팔레트 + 귀·뿔·코·볼터치·줄무늬/점박이 픽셀 파츠).
  - **6자리 16진 코드(`AVATAR_WARDROBE`, `encodeAvatarCode`/`normalizeAvatarCode`):** 각 카테고리(`skins`, `hairs`, `hairColors`, `outfits`, `headsets`, `accessories`)는 6-니블(nibble) 규격 상 **최대 16개(0~15)** 이내로 유지해 D1 저장·테스트 호환성을 지킵니다.
- **옷장 UI ([app/cafe.html](app/cafe.html), [public/walk.js](public/walk.js), [public/walk.css](public/walk.css)):**
  - 부위별 선택은 작은 칩 버튼 나열 대신 **`.wardrobe-stepper` (`[◀]` · 현재 스타일/색상/인덱스 · `[▶]`)** 형태를 유지하고, `#wardrobe-rot-left`/`#wardrobe-rot-right`로 4방향(정면·오른쪽·뒷모습·왼쪽)을 즉시 회전 미리보기할 수 있어야 합니다.

---

### ④ 미니게임·런처·대전 AI·랭킹 개발 지침
- **게임 런처 기본 상태:** `#pc-desktop`을 열 때 `#pc-launcher`는 기본 `hidden` 상태여야 하며(`pc.css` `.pc-launcher[hidden] { display: none !important; }`), `[data-launcher]` 버튼 클릭으로만 열립니다.
- **구조 분리 및 자원 정리:**
  - 순수 게임 규칙·상태 엔진은 `.mjs`(`solitaire-engine.mjs`, `knit-unravel-engine.mjs`, `pvp-ai.mjs` 등)로 분리해 브라우저 없이 Node 단위 테스트가 가능하게 작성합니다.
  - 모든 미니게임은 `dialog`가 닫히거나(`close` 이벤트) 탭이 비활성화(`document.hidden`)될 때 `requestAnimationFrame`과 `setInterval`을 즉시 정지해야 합니다.
- **스도쿠 / 솔리테어 / Knit Unravel 핵심 규칙:**
  - **스도쿠:** 고정 숫자(`[data-given]`), 사용자 입력(`[data-user]`), 중복 오류(`[data-conflict]`)가 배경·글자색·밑줄로 한눈에 구분되고 Undo(`#sudoku-undo`, `Ctrl+Z`)를 지원합니다.
  - **솔리테어 ([public/solitaire.js](public/solitaire.js)):** 기본 뽑기는 **3장 뽑기(`drawCount = 3`)**이며, `.sol-waste-fan` 컨테이너 안에서 최대 3장을 부채꼴(`--fan-i`)로 펼쳐 최상단 카드만 조작 가능하게 합니다.
  - **Knit Unravel ([public/knit-unravel-engine.mjs](public/knit-unravel-engine.mjs), [public/knit-unravel.js](public/knit-unravel.js)):**
    - 상단 니트 도안(`KNIT_PATTERNS`)의 색상별 총 스티치 수와 하단 실패 총 용량의 합은 **스테이지 생성 시 100% 일치**해야 하며, 도우미 `가위` 사용 시에도 해당 색상 스티치를 함께 정리해 클리어 불가능(데드락)을 방지합니다.
    - **엄격한 인접 해제 규칙:** `triggerNeighborsAfterPick`은 픽셀을 집었을 때 **실제로 출구(0행)까지 열릴 수 있는 이웃(`isSingleReachable(..., { ignoreIce: true })`)만** `?` 미스터리/얼음(`ice = 1`)을 해제합니다. 옆 칸을 집었더라도 아직 앞줄에 막힌 칸의 잠금은 풀리지 않습니다.
    - **트레이 DOM 분리 (연속 터치 보장):** 실이 풀리는 60fps 루프에서는 `drawLoom()`과 `renderDockAndHud()`만 갱신하며 `#knit-tray` 버튼 DOM을 재생성하는 `renderTray()`는 셀 선택·Undo·부스터 등 상태 변화 시에만 호출해 실이 풀리는 중에도 다른 가능한 실을 막힘없이 누를 수 있어야 합니다.
    - **모바일 뷰포트 상단 고정:** `@media (max-width: 680px)`에서 `#knit` 다이얼로그는 `margin: max(6px, env(safe-area-inset-top)) auto auto;`로 상단 클리핑 없이 전체 UI가 노출되어야 합니다.
- **대전 AI ([public/pvp-ai.mjs](public/pvp-ai.mjs), [public/pvp.js](public/pvp.js)):**
  - `#pvp-ai-level`로 난이도(`hard`: 고수 AI, `medium`: 보통 AI, `easy`: 쉬움 AI, 기본값 `hard`)를 선택합니다.
  - **오목 AI (`chooseOmokAiMove`):** 연속/띄엄 5·열린4(`011110`)·끊긴4(`10111` 등)·열린3(`010110`) 패턴 평가 + 쌍삼/사삼 포크 가산점 + `hard` 2수 앞(2-ply) 상대 최선 응수 감점을 적용합니다.
  - **알까기 AI (`chooseAlkkagiAiShot`):** `lib/cafe-pvp.mjs`의 `simulateAlkkagiShot`으로 전 살아있는 말·타겟·각도(`[-0.08, 0, 0.08]`)·파워(`2.4/3.1/3.8`)를 선계산해 자살 샷을 피하고 상대 말 장외를 극대화합니다.
- **랭킹 연동:** 새 게임을 추가할 때는 [lib/cafe-arcade.mjs](lib/cafe-arcade.mjs)의 `validGames`에 게임 ID를 등록하고 `mountLeaderboardBox()`를 연결합니다.

---

### ⑤ 모바일·카메라·터치 UX 지침
- **풀뷰포트 카메라 ([public/camera.js](public/camera.js)):** 모바일 세로 화면(`390×844`)에서도 `worldHeight >= viewport.clientHeight`를 보장해 화면 하단에 빈 검은 여백이 남지 않게 합니다.
- **터치 영역 및 비겹침 ([public/walk.css](public/walk.css), [public/game-shell.css](public/game-shell.css), [public/chat.css](public/chat.css), [public/pc.css](public/pc.css)):**
  - 모바일 터치 버튼은 최소 `44px` 이상 확보하고, `touch-action: manipulation` / `none`을 적용해 더블탭 확대를 막습니다.
  - 플로어 화면에서 `#cafe-joystick`(좌측), `.walk-controls`(하단), `#cafe-chat-controls`(우측 상단 위)가 겹치지 않아야 하며, PC 착석 시 조이스틱은 자동 숨김(`syncMobileJoystickVisibility`) 처리됩니다.
  - 모든 미니게임 `dialog`는 모바일 가로 폭(`390px`)에서 가로 스크롤(`scrollWidth > innerWidth`)이 발생하지 않아야 합니다.

---

### ⑥ 테스트·시각 검수·배포 체크리스트
코드 수정 후 커밋·푸시 전에 반드시 아래를 순서대로 확인하세요:
1. **단위 테스트 전체 통과:**
   ```sh
   node --test tests/*.test.mjs
   ```
2. **라이브 스모크 대상 등록:** `public/`에 새 JS/CSS/MJS 파일을 추가했다면 [tests/smoke-live-game.mjs](tests/smoke-live-game.mjs) 검증 목록에 파일명을 추가합니다.
3. **브라우저 실화면 검수:** 데스크톱 FHD(`1920×1080`)와 모바일(`390×844`)에서 콘솔/런타임 에러 `0`건, 가구 확대 캡처(의자/모니터/소파 삐져나옴 없음), 좌석도 마커 일치, 미니게임 플레이 정상 여부를 스크린샷으로 직접 확인합니다.
4. **배포 확인:** `main` 브랜치 푸시 후 `.github/workflows/deploy.yml` (`Deploy Gilmotungi PC Bang`) 성공과 `https://motoongpc.com` 응답(`HTTP 200` 및 해시 일치)을 확인합니다.

---

## GitHub에서 배포하기

GitHub에 소스를 올리고 **Actions**에서 Cloudflare Workers로 배포합니다. 방문자 위치와 좌석은 D1에 저장되므로, 정적 파일만 제공하는 GitHub Pages로는 멀티플레이·좌석 예약 기능을 사용할 수 없어요.

1. Cloudflare에서 빈 D1 데이터베이스를 만들고 이름과 ID를 복사하세요. Workers의 `workers.dev` 하위 도메인이 없다면 설정하세요.
2. 프로젝트 파일을 GitHub 저장소에 올리세요. 숨김 폴더 `.github`와 `.openai`도 포함하세요.
3. 저장소의 **Settings → Secrets and variables → Actions**에서 다음 값을 등록하세요.

   | 위치 | 이름 | 값 |
   | --- | --- | --- |
   | Secrets | `CLOUDFLARE_API_TOKEN` | 해당 계정의 **Workers Scripts: Edit**, **D1: Edit** 권한이 있는 API 토큰 |
   | Secrets | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
   | Secrets | `NEON_ADMIN_PASSWORD` | 관리자 로그인 비밀번호 (16자 이상, 충분히 복잡하게 설정) |
   | Variables | `NEON_WORKER_NAME` | Worker 이름 (예: `neon-pcbang`) |
   | Variables | `NEON_D1_NAME` | 만든 D1 데이터베이스 이름 |
   | Variables | `NEON_D1_ID` | 만든 D1 데이터베이스 ID |

4. 기본 브랜치에서 **Actions → Deploy Gilmotungi PC Bang → Run workflow**를 누르세요. 워크플로가 테이블을 준비하고 배포합니다. 실행 로그 마지막에 새 주소가 표시됩니다.

이 절차로 만든 `workers.dev` 주소는 외부에 공개되며, 기본 설정은 **베타 초대제**로서 초대코드 인증 사용자만 앱에 입장할 수 있습니다. 관리자가 **정식 공개**로 전환하면 모든 사용자가 초대코드 없이 입장할 수 있습니다.

## 베타 초대제 ↔ 정식 공개 전환

- 관리자는 `/admin` 상단에서 현재 사이트 상태(베타 초대제 / 정식 공개)를 확인하고 전환할 수 있습니다.
- **베타 초대제(기본값):** 초대코드로 인증된 사용자와 관리자가 앱을 이용할 수 있습니다. 페이지뿐 아니라 API 및 정적 자원 요청도 서버에서 검사합니다.
- **정식 공개:** 신규 방문자는 초대코드 없이 바로 앱을 이용할 수 있습니다. 기존 좌석·게임·매점 기능과 방문자 브라우저 데이터는 그대로 유지합니다. 관리자 페이지는 관리자 로그인으로 계속 보호됩니다.
- 정식 공개로 전환할 때 확인 체크가 필요합니다. 공개 전환 후에도 발급한 코드와 인증 기록은 D1에 남아 있으므로 필요 시 베타 초대제로 되돌릴 수 있습니다.
- 배포마다 설정이 초기화되지 않도록 D1의 `invite_settings`에 저장합니다. 신규 설치의 기본값은 `invite`이며, `public`은 관리자 승인으로만 선택됩니다.

## 초대코드 발급·관리

- 배포 후 `/admin/login`으로 접속하여 GitHub Actions Secret `NEON_ADMIN_PASSWORD`에 설정한 비밀번호로 로그인하세요.
- `/admin`에서 메모·사용 가능 횟수·유효 기간을 지정해 초대코드를 발급하세요. 새로 발급한 코드는 **발급 목록 → 코드 보기 → 코드 복사**에서 다시 꺼낼 수 있습니다.
- 사용자는 베타 기간 `/invite`에서 최초 1회 코드를 입력합니다. 서버 인증 기록에는 만료일을 두지 않으며, 같은 브라우저로 재방문하면 인증 쿠키가 자동 연장됩니다.
- **1년 이상 방문하지 않거나 브라우저/기기에서 쿠키를 삭제하면** 재인증이 필요할 수 있으므로 새 코드 발급이 필요합니다.
- 관리자는 코드를 회수할 수 있으며, 회수하면 해당 코드로 인증한 기존 세션도 차단됩니다. 관리자 세션은 12시간 유지됩니다.
- 입장 검증에는 SHA-256 해시를 사용하고, 원문은 AES-GCM으로 암호화해 별도 테이블에 저장합니다 (`NEON_INVITE_VAULT_KEY` 분실 시 기존 원문 복구 불가).

## 로컬에서 실행하기

Node.js 24에서 다음을 실행하고 `http://127.0.0.1:8787`로 접속하세요.

```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_strange_moira_mactaggert.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_corner_snacks.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_invitation_access.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_invite_form_tokens.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_invite_code_vault.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_cafe_delivery.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0006_cafe_chat.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0007_world_zones_and_avatars.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0008_snack_bar_v2.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0009_arcade_and_pvp.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0010_cafe_board.sql
npm start
```

로컬 관리자 로그인에는 `NEON_ADMIN_PASSWORD`(16자 이상)가 필요하며, 새 코드를 발급하려면 로컬 전용 `NEON_INVITE_VAULT_KEY`도 Worker 실행 환경에 지정하세요.

매점 메뉴는 [snack-menu.json](public/snack-menu.json)에서 관리합니다. 새 항목은 고유한 `id`를 사용하고, 품절은 `"available": false`로 표시합니다.
