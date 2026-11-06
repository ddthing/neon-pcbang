# 길모퉁이PC방

서울의 날씨가 창밖으로 흐르는 픽셀 아트 온라인 PC방입니다. 같은 매장에 들어온 손님은 서로의 캐릭터와 좌석 상태를 볼 수 있어요.

- **이동:** 방향키, WASD, 또는 바닥 누르기.
- **화면:** 기본 화면은 비율을 유지하면서 창을 채우고 내 캐릭터를 따라갑니다. 오른쪽 위의 전체 지도 버튼으로 매장을 한 번에 볼 수 있어요.
- **매점:** 메뉴 검색과 카테고리로 먹거리를 찾아 주문하세요. 실시간 주문표에는 닉네임과 좌석 없이 주문번호와 메뉴, 준비 상태만 보여요.
- **단골 쿠폰:** 한국 시간 기준 하루 착석 시간 30분을 채우면 도장 1개를 받을 수 있어요. 10개를 모아 매점의 단골 메뉴로 바꿀 수 있습니다. 이 브라우저에 저장된 손님 정보로 쿠폰을 이어서 사용해요.
- **창밖:** [Open-Meteo](https://open-meteo.com/)의 서울 날씨와 서울의 일출·일몰 시각을 씁니다. 날씨를 가져오지 못하면 한국 시간에 맞춘 풍경을 보여줍니다.
- **제목 글꼴**은 귀댕이의 [뚝딱감자체](https://blog.naver.com/guidang2/224435435470)이며, [눈누의 웹폰트 주소](https://noonnu.cc/font_page/1969)를 사용합니다.

## GitHub에서 배포하기

GitHub에 소스를 올리고 **Actions**에서 Cloudflare Workers로 배포합니다. 방문자 위치와 좌석은 D1에 저장되므로, 정적 파일만 제공하는 GitHub Pages로는 같이 돌아다니는 기능을 사용할 수 없어요.

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

이 절차로 만든 `workers.dev` 주소는 공개되지만, **초대코드를 인증한 사용자만 앱에 입장**할 수 있습니다. 기존 Sites 주소나 그곳의 좌석 데이터는 연결되지 않습니다.

## 초대코드 발급·관리

- 배포 후 `/admin/login`으로 접속하여 GitHub Actions Secret `NEON_ADMIN_PASSWORD`에 설정한 비밀번호로 로그인하세요.
- `/admin`에서 초대코드를 발급할 수 있습니다. 메모·사용 가능 횟수·만료 기간을 지정하고 생성한 코드를 사용자에게 전달하세요. 생성된 코드 원문은 **한 번만 표시**됩니다.
- 사용자는 `/invite`에서 코드를 입력합니다. 인증 후 30일 동안 같은 브라우저에서 입장할 수 있습니다. 브라우저 쿠키를 지우거나 다른 기기에서 접속하면 다시 초대코드가 필요합니다. (기본 1회용 코드는 재사용 불가)
- 관리자는 코드를 회수할 수 있습니다. 회수하면 해당 코드로 인증한 기존 세션도 차단됩니다. 관리자 세션은 12시간 유지됩니다.
- 초대코드는 D1에 SHA-256 해시로 저장됩니다. 암호나 세션 토큰은 소스 또는 GitHub 저장소에 추가하지 마세요.
- 초대 기능은 접근 제어를 위한 것으로 별도의 개인 계정 복구 기능은 없습니다. 한 사용자가 여러 기기에서 이용해야 한다면 코드 사용 횟수를 늘리거나 별도 코드를 발급하세요.
- 배포 스크립트는 기존 D1에 `0002_invitation_access` 마이그레이션을 자동 적용합니다. 관리자 비밀번호가 빠지거나 D1이 연결되지 않으면 앱 접근을 기본적으로 차단합니다.

## 로컬에서 실행하기

Node.js 24에서 다음을 실행하고 `http://127.0.0.1:8787`로 접속하세요.

```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_strange_moira_mactaggert.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_corner_snacks.sql
npm start
```

매점 메뉴는 [snack-menu.json](public/snack-menu.json)에서 관리합니다. 새 항목은 고유한 `id`를 사용하고, 품절은 `"available": false`로 표시합니다. 메뉴를 변경한 뒤 다시 배포하면 화면과 주문 검증에 함께 적용됩니다.
