// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect((buttonByText('게임 데이터 파일 4개 내려받기') as HTMLButtonElement).disabled).toBe(true);
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
