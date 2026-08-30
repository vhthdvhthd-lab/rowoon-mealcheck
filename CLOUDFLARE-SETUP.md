# 로운 주간 식자재 수불대장 배포 방법

## 1. GitHub에 이 폴더 업로드

이 폴더 안의 파일 전체를 하나의 GitHub 저장소에 올립니다.

## 2. Cloudflare 앱 배포

Cloudflare 대시보드의 첫 화면에서 `Create app`을 누르고 GitHub 저장소를 연결한 뒤 아래처럼 입력합니다.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

## 3. D1 데이터베이스 만들기

Cloudflare에서 `D1 SQL Database` → `Create database`를 누르고 이름을 `rowoon-inventory`로 만듭니다.

데이터베이스의 `Console`에 들어가 `schema.sql`의 내용을 붙여넣고 실행합니다.

## 4. 배포한 앱과 D1 연결

배포한 앱 → `Settings` → `Bindings` → `Add` → `D1 database`에서 다음처럼 설정합니다.

- Variable name: `DB`
- D1 database: `rowoon-inventory`

## 5. 다시 배포

D1을 연결한 뒤 `Deployments`에서 최신 배포를 다시 실행합니다.

이후 입력 내용은 브라우저에 즉시 임시 저장되고, D1에는 입력이 멈춘 뒤 5초 후 묶어서 저장됩니다. 계속 작성하는 경우에도 최대 30초마다 저장되며 다른 컴퓨터에서도 같은 자료가 표시됩니다. 품목은 `global`, 주간 기록은 `week:날짜` 형식으로 나뉘어 장기간 보관됩니다. 기존 `main` 자료는 자동 분리 후에도 백업으로 남습니다. 별도의 비밀번호 없이 사이트에 접속한 사람이 수정할 수 있습니다.
