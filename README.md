# World Pals — 꼬마 세계 탐험대

7~9세 어린이용 세계 수도 탐험 웹게임. 기획서: `WORLD_PALS_PLAN.md`.
현재 구현 단계: **Phase 1~4** (수도/국기 퀴즈, 도장·배지·꾸미기·여권·오답 복습, 세계지도, World Pals Lab).

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm run typecheck  # 타입 검사
npm test           # 단위 테스트 (vitest)
npm run build      # 프로덕션 빌드 (dist/)
```

Node 20+ 권장 (개발은 Node 22에서 확인).

## 구조

```
src/data/        콘텐츠(countries, questions, badges, rewards[장식] .json) — 로직과 분리, 고유 ID로 참조
src/config.ts    세션 크기, 복습 개수, 보상 수치
src/features/quiz/  quizEngine.ts(출제·보상 로직, 순수 함수), QuizPage.tsx
src/features/rewards/  rewardEngine.ts(배지 조건, 장식 해금/장착)
src/features/passport/, customization/, map/  여권, 꾸미기, 세계지도 화면 (map/worldLand.ts는 생성된 지도 데이터)
src/features/lab/  World Pals Lab (validators, importExport, labOps, labStorage + 편집기 화면)
src/lib/         saveData.ts(localStorage 저장/복구), storageKeys.ts, random.ts
src/types/       Country, Question, PlayerProgress
src/pages/       HomePage, ResultPage
```

## 설계 메모

- 콘텐츠와 플레이어 진행은 분리되어 있고, 진행 데이터는 ID만 저장합니다.
- `status: "verified"`인 국가·문제만 출제됩니다. 현재 데이터는 **개발자 일반 지식 기반 초안**이며 출처 확인 전입니다 (`src/data/SOURCES.md`).
- 별과 일일 보상은 `rewardEventIds`(`daily:날짜`)로 하루 한 번만 지급합니다. 같은 날 재플레이와 오답 복습은 별 없는 연습 모드입니다.
- 국가 도장은 연습에서도 받습니다. 연습 = 기본 도장, 오늘의 탐험 = 황금 도장이며 기본 도장은 오늘의 탐험에서 맞히면 황금으로 올라갑니다.
- 배지 조건은 `badges.json`에 데이터로 정의합니다 (지원 조건: 탐험 횟수, 발견 국가 수, 대륙별 발견 수, 푼 문제 수, 복습 정답 수).
- 별(`totalStars`)은 현재 보유량입니다. 장식 해금 시 차감되고, 이미 해금한 장식은 다시 차감되지 않습니다.
- 국기는 `flag-icons`(MIT) SVG를 국가 ID(ISO 코드)로 연결합니다.
- 진행은 브라우저 localStorage(`worldpals.progress`)에 저장됩니다. 클라우드 백업이 아니며, 사이트 데이터를 지우면 사라집니다. 저장 실패나 깨진 데이터는 기본값으로 복구됩니다.
- Lab 플레이 테스트용 저장 키(`worldpals.lab.test.progress`)는 미리 분리해 두었습니다.

## 문제 유형

- `capital`: 나라 → 수도 4지선다 / `flag`: 나라 이름 → 국기 그림 4지선다 (답을 고르기 전에는 보기에 나라 이름이 보이지 않음)
- 한 세션에는 같은 나라가 한 번만 나오고, 비슷한 국기(호주·뉴질랜드 등)는 같은 문제의 보기로 묶지 않습니다.

## World Pals Lab (콘텐츠 편집기)

게임 화면 아래의 "🧪 제작자 도구 (Lab)" 링크 또는 주소 뒤에 `#/lab`을 붙여 엽니다. 로컬(브라우저) 전용 도구입니다.

1. 국가/문제/보상(장식·배지)을 편집합니다. 편집 내용은 브라우저에 자동 임시 저장됩니다 (`worldpals.lab.draft`).
2. '검증' 탭에서 오류를 확인합니다 (중복 ID, 없는 국가 참조, 보기 중복, 정답 중복, 음수 비용 등).
3. '가져오기/내보내기'에서 `게임 데이터 파일 4개`를 내려받아 `src/data/`의 같은 이름 파일을 교체합니다 (검증 오류가 없을 때만 가능).
4. 교체 전 '버전 사본'(브라우저 내 최대 10개)이나 백업 JSON을 만들어 두세요.
5. '플레이 테스트'는 테스트 전용 저장 키(`worldpals.lab.test.progress`)만 사용하며 실제 플레이 기록을 바꾸지 않습니다.

- 저장된 항목의 ID는 바꿀 수 없습니다 (진행 기록·문제가 ID로 연결되기 때문). 새로 만든 항목만 ID를 정할 수 있습니다.
- 초안/검수 중 항목은 게임에서 출제·지급되지 않습니다.
- 편집 내용은 브라우저 저장소에만 있으므로 지우면 사라집니다. 백업 JSON을 내려받아 보관하세요.

## 세계지도

- 등장방형 2D SVG(`src/features/map/worldLand.ts`) 위에 국가 위도/경도로 마커를 올립니다. 발견한 나라는 국기(황금/기본 도장 테두리), 아직은 물음표입니다.
- 나라가 모여 있어 겹치므로 대륙 버튼으로 확대해서 봅니다. 마커는 실제 버튼이라 키보드/터치로 열 수 있습니다.
- 지도 데이터 출처/라이선스는 `src/data/SOURCES.md` 참고.

## 배포 (Vercel)

정적 사이트라 서버가 필요 없습니다.

1. GitHub 저장소를 Vercel에서 Import (Framework: Vite 자동 감지, Build `npm run build`, Output `dist`).
2. **Lab은 배포본에서 기본으로 숨겨집니다.** `#/lab` 주소와 홈의 링크가 모두 없어집니다. 배포본에서도 Lab을 쓰려면 환경변수 `VITE_ENABLE_LAB=true`를 설정하고 다시 빌드하세요. (Lab은 편집 내용을 그 브라우저에만 저장하며, 게임 데이터에는 파일 교체로만 반영됩니다.)
3. 로컬에서 배포본 확인: `npm run build && npm run preview`.

## 알려진 한계

- 진행 기록은 브라우저 localStorage에만 있습니다. 같은 브라우저의 탭 두 개로 동시에 플레이하면 나중에 끝낸 탭의 기록이 덮어씁니다.
- 퀴즈 도중 새로고침하면 그 세션은 처음부터 다시 시작합니다.
- 첫 로드 CSS(약 88KB gzip)에 국기 이미지가 인라인되어 있습니다. 필요한 국기만 쓰도록 줄일 수 있습니다.
- 국가/수도 데이터는 출처 검증 전 초안입니다 (`src/data/SOURCES.md`).

## 다음 단계

- 국가 데이터 출처 검증, 국가 수 확대 (Lab 사용)
- 실제 어린이/보호자 사용성 검토
- 3D 지구본, 온라인 기능은 MVP 이후
