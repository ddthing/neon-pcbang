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
| 5 | 통로 | 일반석 책상 사이 32px, 중앙 48px 설계를 적용했다. 입구→41석, 룸 내부 전환, 라운지 착석 및 일어서기를 확인했다. 모든 소품 사이 거리의 일괄 실측은 남았다. |
| 6 | 툴팁 | 구역·좌석에 접근성 이름과 2.5초 픽셀 툴팁을 적용했다. 기본 숨김과 착석 클릭 가능 상태를 확인했다. |
| 7 | 날씨와 창 빛 | FX 팩 128px·8프레임과 창 빛, 낮·밤 합성을 적용했다. 비를 주간과 밤에 확인했다. 강한 비·눈·낙엽·저모션을 각각 화면에서 재확인하는 작업이 남았다. |
| 8 | 모바일 카메라 | 390px Chrome에서 3배, 패닝, 퀵버튼 네 개를 확인했다. 8px 탭 경계와 2·3·4배 핀치는 포인터 자동 테스트로 확인했다. 실기기 멀티터치 검수는 남았다. |
| 9 | 첫 화면 스프라이트 용량 | 설치 팩과 제작 에셋의 PNG 전체가 약 168KB다. 입장 로더에서 이전 대형 배경 이미지의 선로딩을 제거했다. |
| 10 | 게시판 | 지도 오브젝트와 하단 메뉴에서 열었다. 로컬 Chrome에서 글 등록, 로컬 Worker·D1에서 상태 변경과 필터 조회를 확인했다. |
| 11 | 주문 좌석 귀속 | A05에서 짜계치 배송과 쟁반 1개를 봤다. A10과 6인룸에서 이전 주문 요약·쟁반이 사라졌다. 로컬 Worker에서 45 G 차감, 재시도 중복 차감 방지, 주문 취소를 확인했다. |
| 12 | 테라스·휴식 HUD | 야외 하늘·난간·바닥을 분리했다. 390px에서 휴식 액션 높이 44px, 줄 간격 8px, 채팅과의 여백 7px, 잘린 버튼 0개를 확인했다. |
| 13 | 서울 시각 | 공용 `Asia/Seoul` 포매터를 사용한다. 브라우저에서 상단·날씨·PC 시각 일치를 확인했다. |
| 14 | 밤 조명 | 밤·비 조건에서 입장, 라운지까지 이동, 메뉴 열기·닫기 후 같은 반투명 레이어가 유지됐다. |
| 15 | 파스텔 색 | 매장·HUD를 크림, 라벤더, 로즈, 민트, 라이트 우드로 보정했다. 전체 메뉴와 모든 옷장 조합의 픽셀 값 대조는 남았다. |
| 16 | 외곽선 | 제작 스프라이트와 매장 UI 테두리는 웜 브라운·웜 퍼플을 사용한다. 가져온 팩 일부와 기존 미니게임 UI의 전체 외곽선 검수는 남았다. |
| 17 | 치비·UI 하모니 | 기본 아바타와 알바냥 PNG는 16×32 프레임이다. 옷장에 회전과 코디를 적용했다. 옷장 모든 조합과 모든 구형 팝업의 시각 검수는 남았다. |

일반석과 6인룸의 PC 창 내부 크기는 1920×993에서 각각 1136×672였다. 매점에는 24개 가격과 잔액을 표시하고, 단골 쿠폰은 하루 착석 30분 뒤 청구하는 10칸으로 통합했다. 오목은 기본 흑돌에 쌍삼과 장목 금수를 적용하며 방 생성 시 백돌에도 적용할 수 있다.

자동 테스트 61개와 프로덕션 빌드가 모두 통과했다. 격리한 로컬 Worker·D1에서 47개 마이그레이션 구문, 초대 관리자 로그인, PNG 응답, 주문 차감 및 게시판 등록·상태 변경을 검증했다.
