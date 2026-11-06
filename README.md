# 네온 PC방

서울의 날씨가 창밖으로 흐르는 픽셀 아트 온라인 PC방입니다. 같은 매장에 들어온 손님은 서로의 캐릭터와 좌석 상태를 볼 수 있어요.

- **이동:** 방향키, WASD, 또는 바닥 누르기.
- **전체화면:** 매장 오른쪽 상단 버튼을 누르면 카메라가 내 캐릭터를 따라옵니다. 좌석도와 내 PC는 화면 아래에서 열 수 있어요.
- **창밖:** [Open-Meteo](https://open-meteo.com/)의 서울 날씨와 서울의 일출·일몰 시각을 씁니다. 날씨를 가져오지 못하면 한국 시간에 맞춘 풍경을 보여줍니다.

## GitHub에서 배포하기

GitHub에 소스를 올리고 **Actions**에서 Cloudflare Workers로 배포합니다. 방문자 위치와 좌석은 D1에 저장되므로, 정적 파일만 제공하는 GitHub Pages로는 같이 돌아다니는 기능을 사용할 수 없어요.

1. Cloudflare에서 빈 D1 데이터베이스를 만들고 이름과 ID를 복사하세요. Workers의 `workers.dev` 하위 도메인이 없다면 설정하세요.
2. 프로젝트 파일을 GitHub 저장소에 올리세요. 숨김 폴더 `.github`와 `.openai`도 포함하세요.
3. 저장소의 **Settings → Secrets and variables → Actions**에서 다음 값을 등록하세요.

   | 위치 | 이름 | 값 |
   | --- | --- | --- |
   | Secrets | `CLOUDFLARE_API_TOKEN` | 해당 계정의 **Workers Scripts: Edit**, **D1: Edit** 권한이 있는 API 토큰 |
   | Secrets | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
   | Variables | `NEON_WORKER_NAME` | Worker 이름 (예: `neon-pcbang`) |
   | Variables | `NEON_D1_NAME` | 만든 D1 데이터베이스 이름 |
   | Variables | `NEON_D1_ID` | 만든 D1 데이터베이스 ID |

4. 기본 브랜치에서 **Actions → Deploy Neon PC Bang → Run workflow**를 누르세요. 워크플로가 테이블을 준비하고 배포합니다. 실행 로그 마지막에 새 주소가 표시됩니다.

이 절차로 만든 `workers.dev` 주소는 공개됩니다. 기존 Sites 주소나 그곳의 좌석 데이터는 연결되지 않습니다.

## 로컬에서 실행하기

Node.js 24에서 다음을 실행하고 `http://127.0.0.1:8787`로 접속하세요.

```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_strange_moira_mactaggert.sql
npm start
```
