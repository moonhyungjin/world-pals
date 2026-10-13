// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { content } from './data/content';
import { LabLayout } from './features/lab/LabLayout';
import { PlaytestPanel } from './features/lab/PlaytestPanel';
import { todayString } from './lib/random';
import { STORAGE_KEYS } from './lib/storageKeys';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** jsdom은 hash를 바꾸면 hashchange를 비동기로 보낸다. 실제 브라우저는 페이지를 처음 열 때 보내지 않으므로, 그 이벤트가 지나간 뒤 렌더링한다. */
const openWithHash = async (hash: string) => {
  window.location.hash = hash;
  await new Promise((r) => setTimeout(r, 20));
};
const clickText = (text: string | RegExp) => fireEvent.click(screen.getByText(text));
const buttonByText = (text: string | RegExp) => screen.getByRole('button', { name: text });
const tab = (text: string | RegExp) => screen.getByRole('tab', { name: text });

/** 화면에 보이는 문제를 읽고 정답 보기를 클릭한다. */
function answerCurrentQuestion(correct: boolean) {
  const heading = screen.getByRole('heading', { level: 2 }).textContent ?? '';
  const choices = Array.from(document.querySelectorAll<HTMLButtonElement>('.choice'));
  expect(choices).toHaveLength(4);
  if (heading.includes('의 수도는')) {
    const country = content.countries.find((c) => heading.startsWith(c.nameKo + '의 수도는'))!;
    const target = choices.find((b) => (b.textContent === country.capitalKo) === correct)!;
    fireEvent.click(target);
    return 'capital';
  }
  const country = content.countries.find((c) => heading.startsWith(c.nameKo + '의 국기는'))!;
  const target = choices.find((b) => !!b.querySelector(`.fi-${country.id.toLowerCase()}`) === correct)!;
  fireEvent.click(target);
  return 'flag';
}

describe('플레이어 흐름 (실제 클릭)', () => {
  it('홈 → 5문제 → 결과 → 새로고침 후에도 기록 유지, 같은 날 재플레이는 별 중복 없음', () => {
    const first = render(<App />);
    expect(screen.getByText('오늘의 탐험 시작!')).toBeTruthy();
    clickText('오늘의 탐험 시작!');

    const kinds = new Set<string>();
    for (let i = 0; i < 5; i++) {
      kinds.add(answerCurrentQuestion(i !== 1)); // 2번째 문제만 일부러 오답
      expect(screen.getByRole('status').textContent).toMatch(/정답|아쉬워요/);
      clickText(i === 4 ? '결과 보기' : '다음 문제');
    }
    expect(screen.getByText('탐험 끝!')).toBeTruthy();
    expect(screen.getByText(/4문제/)).toBeTruthy();
    expect(screen.getByText(/별 7개를 얻었어요/)).toBeTruthy(); // 정답 4 + 완료 3
    expect(document.querySelectorAll('.stamp-gold').length).toBe(4);

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);
    expect(saved.totalStars).toBe(7);
    expect(saved.wrongQuestionIds).toHaveLength(1);

    // 새로고침 시뮬레이션
    first.unmount();
    render(<App />);
    expect(screen.getByText('다시 연습하기')).toBeTruthy();
    expect(screen.getByText('헷갈린 문제 다시 풀기', { exact: false })).toBeTruthy();

    // 같은 날 재플레이: 별은 그대로
    clickText('다시 연습하기');
    for (let i = 0; i < 5; i++) {
      answerCurrentQuestion(true);
      clickText(i === 4 ? '결과 보기' : '다음 문제');
    }
    expect(screen.getByText(/오늘의 별은 이미 받았어요/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!).totalStars).toBe(7);
  });

  it('국기 고르기 문제는 국기 4개가 보이고, 답을 고르기 전에는 나라 이름이 보이지 않는다', () => {
    // 국기 문제가 나올 때까지 새 세션을 시작한다 (무작위라 여러 번 시도)
    render(<App />);
    let found = false;
    for (let attempt = 0; attempt < 30 && !found; attempt++) {
      clickText(attempt === 0 ? '오늘의 탐험 시작!' : '← 그만하기');
      if (attempt > 0) clickText('오늘의 탐험 시작!');
      for (let i = 0; i < 5 && !found; i++) {
        const heading = screen.getByRole('heading', { level: 2 }).textContent ?? '';
        if (heading.includes('국기는')) {
          found = true;
          const choices = Array.from(document.querySelectorAll('.flag-choice'));
          expect(choices).toHaveLength(4);
          expect(document.querySelectorAll('.flag-choice .fi')).toHaveLength(4);
          for (const b of choices) expect(b.textContent?.trim()).toBe('');
          answerCurrentQuestion(false);
          // 오답 후: 정답에 ⭕ 표시와 이름 공개
          expect(document.querySelector('.flag-choice.correct')?.textContent).toContain('⭕');
          expect(document.querySelector('.flag-choice.wrong')?.textContent).toContain('💡');
        } else {
          answerCurrentQuestion(true);
          clickText(i === 4 ? '결과 보기' : '다음 문제');
        }
      }
      if (!found) clickText('홈으로');
    }
    expect(found).toBe(true);
  });

  it('깨진 저장 데이터가 있어도 앱이 멈추지 않는다', () => {
    localStorage.setItem(STORAGE_KEYS.progress, '{깨진 json');
    render(<App />);
    expect(screen.getByText('오늘의 탐험 시작!')).toBeTruthy();
  });

  it('다른 탭이 먼저 오늘 보상을 받았다면, 이 탭에서 끝내도 별이 중복 지급되지 않는다', () => {
    render(<App />); // 이 탭은 빈 기록으로 시작
    clickText('오늘의 탐험 시작!');
    // 퀴즈를 푸는 동안 "다른 탭"이 오늘 보상을 받고 저장했다고 가정
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ totalStars: 10, completedDates: [todayString()], rewardEventIds: [`daily:${todayString()}`], collectedBadgeIds: ['badge.first-session'] }),
    );
    for (let i = 0; i < 5; i++) {
      answerCurrentQuestion(true);
      clickText(i === 4 ? '결과 보기' : '다음 문제');
    }
    expect(screen.getByText(/오늘의 별은 이미 받았어요/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);
    expect(saved.totalStars).toBe(10); // 5가 아니라 다른 탭의 10이 그대로
    expect(saved.collectedBadgeIds).toContain('badge.first-session'); // 다른 탭의 기록이 사라지지 않음
  });

  it('다른 탭에서 기록이 바뀌면(storage 이벤트) 홈 화면이 최신 기록으로 갱신된다', () => {
    render(<App />);
    expect(screen.getByText('별').previousSibling?.textContent).toBe('0');
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ totalStars: 9 }));
    fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEYS.progress }));
    expect(screen.getByText('별').previousSibling?.textContent).toBe('9');
    // 관련 없는 키의 변경은 무시한다
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ totalStars: 1 }));
    fireEvent(window, new StorageEvent('storage', { key: 'other.key' }));
    expect(screen.getByText('별').previousSibling?.textContent).toBe('9');
  });

  it('저장소 쓰기가 막혀도(용량 초과/시크릿 모드) 끝까지 플레이되고 안내가 나온다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    render(<App />);
    clickText('오늘의 탐험 시작!');
    for (let i = 0; i < 5; i++) {
      answerCurrentQuestion(true);
      clickText(i === 4 ? '결과 보기' : '다음 문제');
    }
    expect(screen.getByText('탐험 끝!')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('저장할 수 없어요');
    clickText('홈으로');
    // 화면의 별은 이번 세션 동안 유지된다
    expect(screen.getByText('별').previousSibling?.textContent).toBe('8');
  });

  it('저장소 읽기까지 막혀도 앱이 시작된다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<App />);
    expect(screen.getByText('오늘의 탐험 시작!')).toBeTruthy();
  });

  it('유효하지 않은 값이 섞인 저장 데이터는 필드별로 복구된다', () => {
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ totalStars: 'many', discoveredCountryIds: 'KR', stampTiers: { KR: 'platinum' }, wrongQuestionIds: [1, 'q.capital.KR'] }),
    );
    render(<App />);
    expect(screen.getByText('오늘의 탐험 시작!')).toBeTruthy();
    expect(screen.getByText('헷갈린 문제 다시 풀기', { exact: false }).textContent).toContain('(1)');
  });

  it('꾸미기: 별이 모자라면 해금되지 않고, 충분하면 해금 후 별이 차감된다', () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ totalStars: 6 }));
    render(<App />);
    fireEvent.click(buttonByText(/꾸미기/));
    fireEvent.click(screen.getByText('⭐ 12')); // 배낭(12) — 부족
    expect(screen.getByText(/별이 6개 더 필요해요/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) ?? '{"totalStars":6}').totalStars).toBe(6);
    fireEvent.click(screen.getByText('⭐ 5')); // 탐험가 모자(5)
    expect(screen.getByText(/탐험가 모자을\(를\) 얻었어요/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);
    expect(saved.totalStars).toBe(1);
    expect(saved.equippedCosmeticIds).toEqual(['cosmetic.explorer-hat']);
  });
});

describe('Lab (실제 클릭)', () => {
  it('#/lab 주소와 홈의 링크로 Lab에 들어가고 게임으로 돌아올 수 있다', async () => {
    render(<App />);
    clickText(/제작자 도구/);
    expect(await screen.findByText(/World Pals Lab/)).toBeTruthy();
    expect(window.location.hash).toBe('#/lab');
    clickText('← 게임으로');
    expect(await screen.findByText('오늘의 탐험 시작!')).toBeTruthy();
  });

  it('주소에 #/lab이 있으면 바로 Lab이 열린다', async () => {
    window.location.hash = '#/lab';
    render(<App />);
    expect(await screen.findByText(/World Pals Lab/)).toBeTruthy();
  });

  it('지도 탭: 발견/미발견 마커와 대륙 확대, 마커를 누르면 상세가 열린다', async () => {
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ discoveredCountryIds: ['KR', 'FR'], stampTiers: { KR: 'gold', FR: 'basic' } }),
    );
    render(<App />);
    fireEvent.click(buttonByText(/지도/));
    expect(await screen.findByText(/2/, { selector: '.map-page strong' })).toBeTruthy();
    expect(document.querySelectorAll('.map-marker')).toHaveLength(25);
    expect(document.querySelectorAll('.map-marker.has-gold')).toHaveLength(1);
    expect(document.querySelectorAll('.map-marker.has-basic')).toHaveLength(1);
    expect(document.querySelectorAll('.map-marker.locked')).toHaveLength(23);
    // 발견 전 마커의 접근성 이름에는 나라 이름이 없다
    expect(screen.queryAllByRole('button', { name: '아직 발견 못한 나라' })).toHaveLength(23);
    fireEvent.click(buttonByText('유럽'));
    expect(document.querySelectorAll('.map-marker').length).toBeLessThan(25);
    fireEvent.click(buttonByText(/프랑스, 기본 도장/));
    expect(screen.getByText('파리')).toBeTruthy();
    fireEvent.click(buttonByText('닫기'));
    expect(screen.queryByText('파리')).toBeNull();
  });

  it('새 국가를 만들고 편집하면 임시 저장되고, 필수값 오류가 검증 탭에 나온다', () => {
    render(<LabLayout onExit={() => {}} />);
    clickText('＋ 새 국가');
    const nameInput = screen.getByLabelText('국가명(한국어)') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '테스트나라' } });
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.labDraft)!);
    expect(draft.countries[0].nameKo).toBe('테스트나라');
    expect(draft.countries[0].id).toBe('NEW');

    fireEvent.click(tab(/검증/));
    expect(screen.getByText(/수도명을 입력해 주세요/)).toBeTruthy();
    fireEvent.click(tab(/가져오기\/내보내기/));
    expect((buttonByText('게임 데이터 파일 6개 내려받기') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/검증 오류가 있어서 게임 데이터 파일은 내보낼 수 없어요/)).toBeTruthy();
  });

  it('기본 퀴즈 초안 만들기는 draft 상태 문제를 만든다', () => {
    render(<LabLayout onExit={() => {}} />);
    clickText('＋ 새 국가');
    fireEvent.change(screen.getByLabelText('국가 ID', { exact: false }), { target: { value: 'ZZ' } });
    fireEvent.click(buttonByText('기본 퀴즈 초안 만들기'));
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.labDraft)!);
    const mine = draft.questions.filter((q: { countryId: string }) => q.countryId === 'ZZ');
    expect(mine.map((q: { type: string }) => q.type).sort()).toEqual(['capital', 'flag']);
    expect(mine.every((q: { status: string }) => q.status === 'draft')).toBe(true);
  });

  it('잘못된 JSON을 가져와도 앱이 충돌하지 않고 안내하며, 편집 내용은 그대로다', () => {
    render(<LabLayout onExit={() => {}} />);
    fireEvent.click(tab(/가져오기\/내보내기/));
    const box = screen.getByPlaceholderText(/JSON을 붙여넣/);
    for (const bad of ['{깨진', '[]', '{"countries": 5}', '{"countries":[1],"questions":[],"badges":[],"cosmetics":[]}']) {
      fireEvent.change(box, { target: { value: bad } });
      fireEvent.click(buttonByText('내용 확인'));
      expect(screen.getAllByText(/가져올 수 없어요/).length).toBeGreaterThan(0);
      expect(screen.queryByText('이 내용으로 편집 시작')).toBeNull();
    }
    fireEvent.click(tab(/국가 \(/));
    expect(screen.getAllByText(/대한민국/).length).toBeGreaterThan(0);
  });

  it('올바른 JSON은 확인 후 적용된다', () => {
    render(<LabLayout onExit={() => {}} />);
    fireEvent.click(tab(/가져오기\/내보내기/));
    const bundle = { countries: [{ id: 'KR', nameKo: '한국', capitalKo: '서울', continent: '아시아', flag: '', factKo: 'x', status: 'draft' }], questions: [], badges: [], cosmetics: [] };
    fireEvent.change(screen.getByPlaceholderText(/JSON을 붙여넣/), { target: { value: JSON.stringify(bundle) } });
    fireEvent.click(buttonByText('내용 확인'));
    fireEvent.click(buttonByText('이 내용으로 편집 시작'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.labDraft)!).countries).toHaveLength(1);
    expect(screen.getByText('가져온 내용을 적용했어요.', { exact: false })).toBeTruthy();
  });

  it('플레이 테스트는 테스트 저장 영역만 바꾸고 실제 플레이 기록은 건드리지 않는다', () => {
    const real = JSON.stringify({ version: 1, totalStars: 42 });
    localStorage.setItem(STORAGE_KEYS.progress, real);
    render(<PlaytestPanel content={content} />);
    fireEvent.click(buttonByText('테스트 별 +10'));
    expect(localStorage.getItem(STORAGE_KEYS.progress)).toBe(real);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.labTestProgress)!).totalStars).toBe(10);

    fireEvent.click(screen.getAllByText('이 문제만')[0]);
    answerCurrentQuestion(true);
    clickText('결과 보기');
    expect(screen.getByText('탐험 끝!')).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.progress)).toBe(real);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.labTestProgress)!).totalStars).toBeGreaterThan(10);

    clickText('홈으로');
    fireEvent.click(buttonByText('테스트 기록 초기화'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.labTestProgress)!).totalStars).toBe(0);
    expect(localStorage.getItem(STORAGE_KEYS.progress)).toBe(real);
  });

  it('깨진 참조/빈 목록이 든 초안으로 열어도 모든 탭이 충돌하지 않는다', () => {
    const broken = {
      format: 'world-pals-content',
      version: 1,
      countries: [{ id: 'AA', nameKo: '', capitalKo: '', continent: '', flag: '', factKo: '', status: 'verified' }],
      questions: [{ id: 'q1', type: 'capital', countryId: 'NOPE', distractorCountryIds: ['AA', 'XX'], difficulty: 9, status: 'verified' }],
      badges: [{ id: 'b1', nameKo: '', descriptionKo: '', emoji: '', condition: { type: 'continentDiscovered', continent: '달', count: 0 }, status: 'draft' }],
      cosmetics: [],
    };
    localStorage.setItem(STORAGE_KEYS.labDraft, JSON.stringify(broken));
    render(<LabLayout onExit={() => {}} />);
    for (const name of [/문제 \(/, /보상 \(/, /검증/, /플레이 테스트/, /가져오기\/내보내기/, /국가 \(/]) {
      fireEvent.click(tab(name));
    }
    fireEvent.click(tab(/문제 \(/));
    expect(screen.getAllByText(/없는 국가/, { selector: 'option' }).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(tab(/검증/));
    expect(screen.getAllByText(/존재하지 않아요/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('고치러 가기').length).toBeGreaterThan(0);
  });

  it('보상 탭: 장식/배지 편집기가 열리고 음수 비용은 오류로 표시된다', () => {
    render(<LabLayout onExit={() => {}} />);
    fireEvent.click(tab(/보상 \(/));
    const cost = screen.getByLabelText('비용(별)', { exact: false }) as HTMLInputElement;
    fireEvent.change(cost, { target: { value: '-3' } });
    expect(screen.getByText(/비용은 0 이상의 정수/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /^배지 \(/ }));
    expect(screen.getByText('해금 조건')).toBeTruthy();
    const panel = document.querySelector('.lab-form') as HTMLElement;
    expect(within(panel).getByText('미리보기')).toBeTruthy();
  });
});

describe('여권: 못 찾은 나라 가리기', () => {
  it('국기 이미지를 받지 않고, 접근성 이름/상세에도 나라 이름이 없다', () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ discoveredCountryIds: ['KR'], stampTiers: { KR: 'gold' } }));
    render(<App />);
    fireEvent.click(buttonByText(/여권/));
    // 발견한 1개만 실제 국기, 나머지 24개는 잠긴 칸
    expect(document.querySelectorAll('.passport-cell .fi-kr')).toHaveLength(1);
    expect(document.querySelectorAll('.passport-cell .flag-locked')).toHaveLength(24);
    expect(document.querySelectorAll('.passport-cell .fi:not(.flag-locked)')).toHaveLength(1);
    expect(screen.queryByText(/중국/)).toBeNull();
    // 잠긴 나라를 눌러도 이름과 국기가 나오지 않고, 대륙만 알려준다
    fireEvent.click(screen.getAllByRole('button', { name: /아직 발견 못한 나라/ })[0]);
    expect(screen.getByText('???', { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText(/에 있어요/)).toBeTruthy();
    expect(document.querySelector('.detail .fi-cn, .detail .fi-jp')).toBeNull();
  });
});

describe('도전장 (친구에게 문제 내기)', () => {
  const clipboard = () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    return writeText;
  };
  const playDaily = (correctCount: number) => {
    clickText('오늘의 탐험 시작!');
    for (let i = 0; i < 5; i++) {
      answerCurrentQuestion(i < correctCount);
      clickText(i === 4 ? '결과 보기' : '다음 문제');
    }
  };

  it('처음에는 잠겨 있고, 안내 문구만 보인다', () => {
    render(<App />);
    expect(screen.queryByText('💌 친구에게 도전장 보내기')).toBeNull();
    expect(screen.getByRole('note').textContent).toContain('4문제 이상 맞히면 열려요');
  });

  it('오늘의 탐험에서 3문제만 맞히면 열리지 않는다', () => {
    render(<App />);
    playDaily(3);
    expect(screen.queryByText(/도전장 보내기가 열렸어요/)).toBeNull();
    clickText('홈으로');
    expect(screen.getByRole('note').textContent).toContain('내일 다시 도전');
  });

  it('4문제 이상 맞히면 열리고, 나라를 골라 링크를 만들고 복사할 수 있다', async () => {
    const writeText = clipboard();
    render(<App />);
    playDaily(5);
    expect(screen.getByText(/도전장 보내기가 열렸어요/)).toBeTruthy();
    clickText('친구에게 도전장 보내기');

    // 3개 미만이면 만들 수 없다
    const make = () => screen.getByRole('button', { name: /도전장 만들기|나라를 3개 이상 골라요/ }) as HTMLButtonElement;
    expect(make().disabled).toBe(true);
    const cells = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.pick-cell'));
    expect(cells().length).toBeGreaterThanOrEqual(4); // 오늘 도장을 받은 나라들만
    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    expect(make().disabled).toBe(true);
    fireEvent.click(cells()[2]);
    expect(make().disabled).toBe(false);

    // 하나는 국기 문제로, 인사말은 3번째로
    fireEvent.click(screen.getAllByRole('button', { name: /국기/ })[0]);
    fireEvent.click(screen.getByLabelText('이 문제 어려울걸?'));
    fireEvent.click(make());

    const link = (screen.getByLabelText('도전장 링크') as HTMLInputElement).value;
    expect(link).toMatch(/#\/c\/[A-Z]{2}[cf]\.[A-Z]{2}[cf]\.[A-Z]{2}[cf]~2$/);
    expect(link).toContain('f'); // 국기 유형이 반영됨

    fireEvent.click(screen.getByRole('button', { name: /링크 복사/ }));
    expect(await screen.findByText(/복사했어요/)).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(link);

    // 고치면 링크가 사라지고 다시 만들어야 한다
    fireEvent.click(cells()[3]);
    expect(screen.queryByLabelText('도전장 링크')).toBeNull();
  });

  it('최대 5개까지만 고를 수 있다', () => {
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({
        discoveredCountryIds: ['KR', 'JP', 'FR', 'DE', 'IT', 'ES', 'US'],
        challengeUnlockedDates: [todayString()],
      }),
    );
    render(<App />);
    clickText('💌 친구에게 도전장 보내기');
    const cells = Array.from(document.querySelectorAll<HTMLButtonElement>('.pick-cell'));
    cells.slice(0, 5).forEach((c) => fireEvent.click(c));
    expect(document.querySelectorAll('.pick-cell.on')).toHaveLength(5);
    expect(cells[5].disabled).toBe(true);
    expect(screen.getByText(/5\/5/)).toBeTruthy();
  });

  it('나라를 아주 빠르게 연달아 눌러도 선택이 사라지지 않는다', () => {
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ discoveredCountryIds: ['KR', 'JP', 'FR', 'DE'], challengeUnlockedDates: [todayString()] }),
    );
    render(<App />);
    clickText('💌 친구에게 도전장 보내기');
    // 한 번의 갱신 묶음 안에서 연속 클릭 (렌더링 사이에 끼어들 틈이 없는 상황)
    act(() => {
      document.querySelectorAll<HTMLButtonElement>('.pick-cell').forEach((c) => c.click());
    });
    expect(document.querySelectorAll('.pick-cell.on')).toHaveLength(4);
    act(() => {
      document.querySelectorAll<HTMLButtonElement>('.type-toggle .chip').forEach((c) => c.click());
    });
    expect(document.querySelectorAll('.type-list li')).toHaveLength(4);
  });

  it('어제 열린 도전장 만들기는 오늘은 다시 잠겨 있다', () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ discoveredCountryIds: ['KR', 'JP', 'FR'], challengeUnlockedDates: ['2000-01-01'] }));
    render(<App />);
    expect(screen.queryByText('💌 친구에게 도전장 보내기')).toBeNull();
  });

  it('친구의 링크를 열면 소개 → 풀기 → 결과(맞힌 만큼 보너스 별과 도장)로 이어진다', async () => {
    const writeText = clipboard();
    await openWithHash('#/c/KRc.JPf.FRc~1');
    render(<App />);
    expect(screen.getByText('💌 도전장이 왔어요!')).toBeTruthy();
    expect(screen.getByText(/같이 세계 여행을 떠나자/)).toBeTruthy();
    expect(screen.getByText('3문제')).toBeTruthy();
    expect(screen.getByText(/맞힌 만큼 보너스 별을 받아요.*오늘 최대 ⭐ 6개/)).toBeTruthy();
    expect(screen.getByText(/수도 2개 · 🚩 국기 1개/)).toBeTruthy();

    clickText('도전 시작!');
    const kinds: string[] = [];
    for (let i = 0; i < 3; i++) {
      kinds.push(answerCurrentQuestion(i !== 1)); // 두 번째만 오답
      clickText(i === 2 ? '결과 보기' : '다음 문제');
    }
    expect(kinds.sort()).toEqual(['capital', 'capital', 'flag']);
    expect(screen.getByText('도전 끝!')).toBeTruthy();
    expect(document.querySelector('.marks')?.textContent).toMatch(/^[⭕❌]{3}$/);
    expect(document.querySelectorAll('.marks')[0].textContent).toContain('❌');
    expect(screen.getByText(/보너스 별 2개를 받았어요/)).toBeTruthy();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);
    expect(saved.totalStars).toBe(2); // 맞힌 2문제 = 보너스 별 2개 (오늘의 탐험 별은 아님)
    expect(saved.completedDates).toEqual([]); // 오늘의 탐험으로 치지 않음
    expect(saved.challengeUnlockedDates).toEqual([]); // 도전장을 풀어도 만들기가 열리지는 않음
    expect(Object.values(saved.stampTiers)).toEqual(['basic', 'basic']); // 맞힌 2개만 기본 도장
    expect(screen.getByText(/오늘의 탐험에서 4문제 이상 맞히면 나도 도전장을 만들 수 있어요/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /결과 친구에게 보내기/ }));
    expect(await screen.findByText(/복사했어요/)).toBeTruthy();
    expect(writeText.mock.calls[0][0]).toMatch(/World Pals 도전장 결과 [⭕❌]{3} \(2\/3\)[\s\S]*#\/c\/KRc\.JPf\.FRc~1$/);

    clickText('홈으로');
    expect(window.location.hash).toBe(''); // 새로고침해도 도전장이 다시 열리지 않음
    expect(screen.getByText('오늘의 탐험 시작!')).toBeTruthy();
  });

  it('잘못된 링크는 앱이 멈추지 않고 안내한다', () => {
    for (const bad of ['#/c/garbage', '#/c/', '#/c/NLc.KRc', '#/c/ZZc.KRc.JPc', '#/c/KRc.KRf', '#/c/%E0%A4%A', '#/c/<script>']) {
      window.location.hash = bad;
      const { unmount } = render(<App />);
      expect(screen.getByText('도전장을 열 수 없어요'), bad).toBeTruthy();
      expect(screen.queryByText('도전 시작!')).toBeNull();
      clickText('홈으로');
      expect(screen.getByText('오늘의 탐험 시작!')).toBeTruthy();
      unmount();
    }
  });

  it('게임을 켜 둔 채 도전장 링크로 이동해도 소개 화면이 열린다', async () => {
    render(<App />);
    window.location.hash = '#/c/KRc.JPc.FRc';
    expect(await screen.findByText('💌 도전장이 왔어요!')).toBeTruthy();
  });
});

describe('탐험 친구 (나라별 동물)', () => {
  const seed = (extra: object = {}) =>
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ discoveredCountryIds: ['KR', 'AU'], stampTiers: { KR: 'gold', AU: 'basic' }, ...extra }),
    );
  const goCustomize = () => fireEvent.click(buttonByText(/꾸미기/));

  it('꾸미기: 만난 친구만 고를 수 있고, 못 만난 친구는 이름과 나라가 보이지 않는다', () => {
    seed();
    render(<App />);
    goCustomize();
    expect(document.querySelectorAll('.friend-grid li')).toHaveLength(25);
    expect(document.querySelectorAll('button.friend-cell')).toHaveLength(2); // 호랑이, 캥거루
    const locked = screen.getAllByRole('img', { name: /아직 못 만난 친구/ });
    expect(locked).toHaveLength(23);
    for (const el of locked) {
      expect(el.getAttribute('aria-label')).toMatch(/의 나라에서 만나요/);
      expect(el.textContent).toContain('???'); // 이름 대신 물음표
      expect(el.getAttribute('aria-label')).not.toMatch(/대한민국|호주|일본|프랑스/);
    }
    expect(screen.getByText(/🐾 탐험 친구 \(2\/25\)/)).toBeTruthy();
  });

  it('친구를 고르면 홈 캐릭터와 함께 다니고, 새로고침해도 유지되고, 다시 누르면 혼자가 된다', () => {
    seed();
    const first = render(<App />);
    goCustomize();
    const tiger = screen.getByRole('button', { name: /호랑이/ });
    expect(tiger.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(tiger);
    expect(screen.getByRole('button', { name: /호랑이/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('img', { name: /함께 다니는 호랑이/ })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!).companionId).toBe('companion.kr');

    // 다른 친구로 바꾸기
    fireEvent.click(screen.getByRole('button', { name: /캥거루/ }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!).companionId).toBe('companion.au');

    // 새로고침 후 홈에서도 보인다
    first.unmount();
    render(<App />);
    expect(screen.getByRole('img', { name: /함께 다니는 캥거루/ })).toBeTruthy();

    // 다시 누르면 혼자
    goCustomize();
    fireEvent.click(screen.getByRole('button', { name: /캥거루/ }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!).companionId).toBeNull();
    expect(screen.queryByRole('img', { name: /함께 다니는/ })).toBeNull();
  });

  it('못 만난 친구를 가리키는 저장 값이 있어도 앱이 멈추지 않고 혼자 다닌다', () => {
    seed({ companionId: 'companion.jp' }); // 일본은 아직 못 만남
    render(<App />);
    expect(screen.getByRole('img', { name: '캐릭터 폭시' })).toBeTruthy();
  });

  it('오늘의 탐험에서 새 나라 도장을 받으면 결과 화면에서 새 친구를 만난다', () => {
    render(<App />);
    clickText('오늘의 탐험 시작!');
    for (let i = 0; i < 5; i++) {
      answerCurrentQuestion(true);
      clickText(i === 4 ? '결과 보기' : '다음 문제');
    }
    expect(screen.getByText(/새 친구를 만났어요/)).toBeTruthy();
    expect(document.querySelectorAll('.new-friends li')).toHaveLength(5);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);
    expect(saved.discoveredCountryIds).toHaveLength(5);
  });

  it('여권 상세: 만난 나라는 친구를 소개하고, 못 만난 나라에는 친구 정보가 없다', () => {
    seed();
    render(<App />);
    fireEvent.click(buttonByText(/여권/));
    fireEvent.click(screen.getByRole('button', { name: /대한민국, 황금 도장/ }));
    expect(screen.getByText(/친구: 호랑이/)).toBeTruthy();
    fireEvent.click(buttonByText('닫기'));
    fireEvent.click(screen.getAllByRole('button', { name: /아직 발견 못한 나라/ })[0]);
    expect(screen.queryByText(/친구:/)).toBeNull();
  });

  it('Lab: 탐험 친구 탭에서 목록과 편집, 검증 오류가 보인다', () => {
    render(<LabLayout onExit={() => {}} />);
    fireEvent.click(tab(/보상 \(/));
    fireEvent.click(screen.getByRole('tab', { name: /^탐험 친구 \(25\)/ }));
    const name = screen.getByLabelText('이름') as HTMLInputElement;
    expect(name.value).toBe('호랑이');
    fireEvent.change(name, { target: { value: '' } });
    expect(screen.getByText(/표시 이름을 입력해 주세요/)).toBeTruthy();
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.labDraft)!);
    expect(draft.companions[0].nameKo).toBe('');
    expect(draft.companions).toHaveLength(25);
  });
});

describe('도전장 보너스 별 (실제 클릭)', () => {
  const playLink = async (hash: string, answerPlan: boolean[]) => {
    await openWithHash(hash);
    const view = render(<App />);
    clickText('도전 시작!');
    for (let i = 0; i < answerPlan.length; i++) {
      answerCurrentQuestion(answerPlan[i]);
      clickText(i === answerPlan.length - 1 ? '결과 보기' : '다음 문제');
    }
    return view;
  };
  const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)!);

  it('같은 도전장을 다시 풀면 보너스 별이 없다 (새로고침 후에도)', async () => {
    const first = await playLink('#/c/KRc.JPf.FRc', [true, true, true]);
    expect(screen.getByText(/보너스 별 3개를 받았어요/)).toBeTruthy();
    expect(saved().totalStars).toBe(3);
    first.unmount();

    // 같은 도전장을 순서만 바꿔서 다시 연다
    await openWithHash('#/c/FRc.KRc.JPf~2');
    render(<App />);
    expect(screen.getByText(/이미 푼 도전장이에요/)).toBeTruthy();
    clickText('도전 시작!');
    for (let i = 0; i < 3; i++) {
      answerCurrentQuestion(true);
      clickText(i === 2 ? '결과 보기' : '다음 문제');
    }
    expect(screen.getByText(/이미 푼 도전장이에요/)).toBeTruthy();
    expect(saved().totalStars).toBe(3); // 늘지 않음
  });

  it('내가 만든 도전장은 같은 기기에서 풀어도 별이 없다', async () => {
    localStorage.setItem(
      STORAGE_KEYS.progress,
      JSON.stringify({ discoveredCountryIds: ['KR', 'JP', 'FR'], stampTiers: { KR: 'gold', JP: 'gold', FR: 'gold' }, challengeUnlockedDates: [todayString()] }),
    );
    const view = render(<App />);
    clickText('💌 친구에게 도전장 보내기');
    Array.from(document.querySelectorAll<HTMLButtonElement>('.pick-cell')).forEach((c) => fireEvent.click(c));
    fireEvent.click(screen.getByRole('button', { name: /^💌 도전장 만들기$/ }));
    const link = (screen.getByLabelText('도전장 링크') as HTMLInputElement).value;
    const hash = link.slice(link.indexOf('#'));
    expect(saved().rewardEventIds.some((e: string) => e.startsWith('challenge-made:'))).toBe(true);
    // 오늘 처음 만들었으니 만들기 보너스 별 2개 (하루 한 번)
    expect(screen.getByText(/오늘의 도전장 보너스 별 2개를 받았어요/)).toBeTruthy();
    expect(saved().totalStars).toBe(2);
    // 고쳐서 다시 만들어도 같은 날에는 더 받지 않는다
    fireEvent.click(Array.from(document.querySelectorAll<HTMLButtonElement>('.pick-cell'))[2]);
    fireEvent.click(Array.from(document.querySelectorAll<HTMLButtonElement>('.pick-cell'))[2]);
    fireEvent.click(screen.getByRole('button', { name: /^💌 도전장 만들기$/ }));
    expect(saved().totalStars).toBe(2);
    view.unmount();

    await openWithHash(hash);
    render(<App />);
    expect(screen.getByText(/내가 만든 도전장이라 보너스 별은 없어요/)).toBeTruthy();
    clickText('도전 시작!');
    for (let i = 0; i < 3; i++) {
      answerCurrentQuestion(true);
      clickText(i === 2 ? '결과 보기' : '다음 문제');
    }
    expect(saved().totalStars).toBe(2); // 내 도전장을 풀어도 늘지 않음 (만들기 보너스 2개 그대로)
  });

  it('오늘 보너스를 다 받았으면 안내만 나오고, 푼 것으로 기록되지 않는다', async () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ challengeBonusDate: todayString(), challengeBonusToday: 6, totalStars: 6 }));
    await playLink('#/c/KRc.JPf.FRc', [true, true, true]);
    expect(screen.getByText(/오늘의 보너스 별은 다 받았어요/)).toBeTruthy();
    expect(saved().totalStars).toBe(6);
    expect(saved().rewardEventIds.some((e: string) => e.startsWith('challenge-solved:'))).toBe(false);
  });

  it('오답은 별이 없고 오늘의 탐험 별과는 따로 계산된다', async () => {
    await playLink('#/c/KRc.JPf.FRc', [true, false, false]);
    expect(screen.getByText(/보너스 별 1개를 받았어요/)).toBeTruthy();
    expect(saved().totalStars).toBe(1);
    expect(saved().completedDates).toEqual([]);
    expect(saved().challengeBonusToday).toBe(1);
  });
});
