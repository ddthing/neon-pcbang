# 길모퉁이PC방 Notion 검수

[기준 문서](https://app.notion.com/p/16-16-4241906cddf181b791a1deedbce972d0)의 배치·동작 조건을 기준으로 작성했다. 원격 인수인계 브랜치는 `notion-pastel-art`의 `b091dfa`다. 여기 적은 후속 변경은 로컬 `notion-pastel-art-validation`에서 검수했다.

## 변경 파일

| 영역 | 파일 |
| --- | --- |
| 매장 배치·길찾기 | `public/cafe-map.mjs`, `public/cafe-layout.js`, `lib/cafe-world.mjs`, `public/walk.js` |
| 스프라이트·조명·날씨 | `public/pixel-tiles.js`, `public/cafe-art.js`, `public/cafe-art.css`, `public/weather.js`, `public/avatar-sprites.js`, `scripts/build-notion-sprites.mjs`, `public/assets/original/`, `public/assets/chars/` |
| 화면·입장·카메라·시계 | `app/cafe.html`, `public/boot.js`, `public/app.js`, `public/camera.js`, `public/cafe-interface.css`, `public/cafe-clock.mjs` |
| 매점·쿠폰·게시판 | `public/corner-shop.js`, `public/corner-shop.css`, `public/cafe-board.js`, `app/api/cafe-board/route.ts`, `lib/cafe-snacks.mjs`, `lib/cafe-board.mjs`, `drizzle/0010_cafe_board.sql` |
| 오목 | `public/omok-rules.mjs`, `public/pvp-ai.mjs`, `public/pvp.js`, `lib/cafe-pvp.mjs` |
| 회귀 검사 | `tests/cafe-camera.test.mjs`, `tests/cafe-delivery-motion.test.mjs`, `tests/omok-rules.test.mjs`, `tests/renewal-movement.test.mjs`, `tests/upgrade-v2.test.mjs` |

## 타일 추가와 실행

- 벽·바닥 타일은 `public/pixel-tiles.js`에서 `images`에 시트를 등록하고 해당 렌더러가 읽는 16px 단위의 원본 좌표를 지정한다. Downtown 가구는 원본 `catalog.json`의 `objects[id]`에 적힌 `atlas`, `foot`, `seats`, `front`를 사용한다.
- 새 소품의 장면 기준 좌표는 `public/cafe-map.mjs`에서 수정한다. 충돌·길찾기와 좌석도도 같은 배치를 읽는다. PC, 키오스크, 자판기, 재떨이, 파티션과 기본 캐릭터 PNG는 `node scripts/build-notion-sprites.mjs`로 재생성한다.
- 새 체크아웃에서는 README에 명시한 3·4·7번 공식 팩을 내려받아 `node scripts/install-notion-art.mjs <DowntownEats_FREE> <Weather_FX> <Food_Icons>`를 실행한 뒤 빌드한다. 배포 러너에서 에셋을 공급하는 방식은 별도로 확인이 필요하다.
- 데스크톱은 `max(1, floor(min(vw/768, vh/512)))` 정수배로 화면 중앙에 배치한다. 모바일은 768px 이하 또는 포인터가 coarse일 때 3배로 시작한다. 드래그로 경계 안에서 패닝하고, 핀치로 2·3·4배 단계를 전환한다.

## 17개 항목

| 번호 | 항목 | 검수 결과 |
| ---: | --- | --- |
| 1 | 가구 PNG | 매장 캔버스의 책상·의자·소파·매점 소품은 3·7번 팩 또는 제작 PNG에서 읽는다. 이전 배경 이미지에 연결되던 입장 로더도 새 캔버스 이벤트로 교체했다. |
| 2 | 픽셀 렌더링 | CSS에서 이미지와 Canvas에 `pixelated`를 적용한다. 1920×993에서 1배, 390×844에서 3배를 실측했다. |
| 3 | 16px 그리드 | 지도·벽·룸·주요 가구의 기준점과 크기는 16px 단위다. 의자 좌판, 쟁반, PC 발광, 보행에는 1px 오프셋이 있어 전체 좌표가 16px 배수라는 항목은 부분 충족이다. |
| 4 | 41석·착석 | 22+4+4+5+6석과 41개 입구·배달 경로를 자동 검사했다. 데스크톱에서 41개 좌석 모두 중앙 클릭점에 가림이 없었다. |
| 5 | 통로 | 일반석 책상 사이 32px 이상, 중앙 통로 48px, 41석 모든 착석 대기 지점(`stand`)과 룸 문 중심의 보행 가능 여부를 `renewal-movement.test.mjs` 자동 검사로 검증했다. |
| 6 | 툴팁 | 구역·좌석에 접근성 이름과 2.5초 픽셀 툴팁을 적용했다. 기본 숨김과 착석 클릭 가능 상태를 확인했다. |
| 7 | 날씨와 창 빛 | FX 팩 128px·8프레임(`rain`, `storm`, `snow`, `leaves`) 4종과 `prefers-reduced-motion: reduce` 분기를 자동 검사로 검증했다. |
| 8 | 모바일 카메라 | 390px Chrome에서 3배, 패닝, 퀵버튼 네 개를 확인했다. 8px 탭 경계와 2·3·4배 핀치는 포인터 자동 테스트로 확인했다. 실기기 멀티터치 검수는 남았다. |
| 9 | 첫 화면 스프라이트 용량 | 설치 팩과 제작 에셋의 PNG 전체가 약 168KB다. 입장 로더에서 이전 대형 배경 이미지의 선로딩을 제거했다. |
| 10 | 게시판 | 지도 오브젝트와 하단 메뉴에서 열었다. 로컬 Chrome에서 글 등록, 로컬 Worker·D1에서 상태 변경과 필터 조회를 확인했다. |
| 11 | 주문 좌석 귀속 | A05에서 짜계치 배송과 쟁반 1개를 봤다. A10과 6인룸에서 이전 주문 요약·쟁반이 사라졌다. 기존 `hall:22+` 구좌석 레코드도 `cafe-presence.mjs`에서 `null`로 안전 정리됨을 자동 검증했다. |
| 12 | 테라스·휴식 HUD | 야외 하늘·난간·바닥을 분리했다. 390px에서 휴식 액션 높이 44px, 줄 간격 8px, 채팅과의 여백 7px, 잘린 버튼 0개를 확인했다. |
| 13 | 서울 시각 | 공용 `Asia/Seoul` 포매터를 사용한다. 브라우저에서 상단·날씨·PC 시각 일치를 확인했다. |
| 14 | 밤 조명 | 밤·비 조건에서 입장, 라운지까지 이동, 메뉴 열기·닫기 후 같은 반투명 레이어가 유지됐다. |
| 15 | 파스텔 색 | 매장·HUD·모든 `dialog`를 크림(`#f7efe5`)·라벤더(`#c8b6e2`)·웜브라운(`#5c4742`)으로 통일하고, CSS·렌더러 내 순흑(`#000`)·순백(`#fff`) 0건을 자동 검사로 검증했다. |
| 16 | 외곽선 | 제작 스프라이트와 전 UI 다이얼로그 테두리를 웜 브라운(`#5c4742`)·웜 퍼플(`#6b5b7b`)로 통일하고 순검정 외곽선을 제거했다. |
| 17 | 치비·UI 하모니 | 16×32 2등신 치비 아바타와 메뉴/하단 전체 에셋 크레딧(`CC BY 4.0` 포함)을 반영했고, 모든 `dialog` 프레임에 크림 바탕 + 각진 웜브라운 픽셀 테두리를 적용했다. |

일반석과 6인룸의 PC 창 내부 크기는 1920×993에서 각각 1136×672였다. 매점에는 24개 가격과 잔액을 표시하고, 단골 쿠폰은 하루 착석 30분 뒤 청구하는 10칸으로 통합했다. 오목은 기본 흑돌에 쌍삼과 장목 금수를 적용하며 방 생성 시 백돌에도 적용할 수 있다. `.github/workflows/deploy.yml`에 `drizzle/**` 트리거도 포함했다.

> **참고 (`main` 병합 전 선결 조건):** `.gitignore`에 제외된 외부 3종 팩(`/public/assets/downtown/`, `/public/assets/fx/`, `/public/assets/foods/`)이 CI/빌드 환경에 함께 공급되어야 `main` 병합 후 운영(`https://motoongpc.com`) 캔버스가 정상 로드된다.

자동 테스트 64개(`tests/*.test.mjs`)가 모두 통과했다.
