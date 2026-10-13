# World Pals — 꼬마 세계 탐험대

7~9세 어린이용 세계 수도 탐험 웹게임. 기획서: `WORLD_PALS_PLAN.md`.
현재 구현 단계: **Phase 1~3** (수도/국기 퀴즈, 도장·배지·꾸미기·여권·오답 복습, World Pals Lab).

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
src/features/passport/, customization/  여권, 꾸미기 화면
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

## 다음 단계

Phase 4 (2D 세계지도, 반응형 점검, 배포).
