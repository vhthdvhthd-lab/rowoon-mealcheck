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

## 5. 수정 비밀번호 등록

배포한 앱 → `Settings` → `Variables and Secrets` → `Add`에서 다음 값을 등록합니다.

- Variable name: `EDIT_PIN`
- Value: 직원이 함께 사용할 수정 비밀번호
- 가능하면 Secret/Encrypt 선택

숫자 네 자리보다는 6자리 이상 또는 문자와 숫자를 섞은 비밀번호를 권장합니다.

## 6. 다시 배포

D1과 비밀번호를 연결한 뒤 `Deployments`에서 최신 배포를 다시 실행합니다. 사이트를 열고 오른쪽 위 `수정 잠금`을 눌러 등록한 비밀번호로 잠금을 해제합니다.

이후 입력 내용은 D1에 자동 저장되며 다른 컴퓨터에서도 같은 자료가 표시됩니다.
