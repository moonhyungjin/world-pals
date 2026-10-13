# World Pals — 꼬마 세계 탐험대

7~9세 어린이용 세계 수도 탐험 웹게임. 기획서: `WORLD_PALS_PLAN.md`.
현재 구현 단계: **Phase 1~2** (5문제 수도 퀴즈, 도장·배지·꾸미기·여권·오답 복습).

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

## 다음 단계

Phase 3 (World Pals Lab) → Phase 4 (지도·배포).
