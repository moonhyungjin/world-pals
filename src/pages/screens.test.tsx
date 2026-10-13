import { renderToString as ssr } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { content } from '../data/content';
import { CustomizePage } from '../features/customization/CustomizePage';
import { PassportPage } from '../features/passport/PassportPage';
import { buildQuizItem, buildSession } from '../features/quiz/quizEngine';
import { QuizPage } from '../features/quiz/QuizPage';
import { seededRng } from '../lib/random';
import { defaultProgress } from '../lib/saveData';
import type { PlayerProgress } from '../types/progress';
import { HomePage } from './HomePage';
import { ResultPage } from './ResultPage';

// React SSR이 텍스트 사이에 넣는 주석 구분자를 제거해 비교한다.
const renderToString = (el: ReactElement) => ssr(el).replace(/<!-- -->/g, '');
const noop = () => {};
const progress: PlayerProgress = {
  ...defaultProgress(),
  totalStars: 12,
  discoveredCountryIds: ['KR', 'JP'],
  stampTiers: { KR: 'gold', JP: 'basic' },
  collectedBadgeIds: ['badge.first-session'],
  unlockedRewardIds: ['cosmetic.explorer-hat'],
  equippedCosmeticIds: ['cosmetic.explorer-hat'],
  wrongQuestionIds: ['q.capital.US'],
};

describe('화면 스모크 렌더링', () => {
  it('홈: 복습 버튼, 배지, 장착 장식', () => {
    const html = renderToString(<HomePage progress={progress} content={content} onStart={noop} onReview={noop} />);
    expect(html).toContain('헷갈린 문제 다시 풀기 (1)');
    expect(html).toContain('첫 탐험 완료');
    expect(html).toContain('🧢');
  });
  it('홈: 오답이 없으면 복습 버튼이 없다', () => {
    const html = renderToString(
      <HomePage progress={{ ...progress, wrongQuestionIds: [] }} content={content} onStart={noop} onReview={noop} />,
    );
    expect(html).not.toContain('헷갈린 문제 다시 풀기');
  });
  it('여권: 발견/미발견 구분, 국기 이미지, 출제 제외 국가는 숨김', () => {
    const html = renderToString(<PassportPage progress={progress} content={content} />);
    expect(html).toContain('2</strong> / 25개 나라 발견');
    expect(html).toContain('fi-kr');
    expect(html).toContain('???');
    expect(html).not.toContain('네덜란드');
  });
  it('꾸미기: 가격과 입기/벗기 버튼', () => {
    const html = renderToString(<CustomizePage progress={progress} content={content} onChange={noop} />);
    expect(html).toContain('✅ 벗기');
    expect(html).toContain('⭐ 20');
  });
  it('퀴즈: 국기 이미지와 4개 보기', () => {
    const items = buildSession(content, defaultProgress(), seededRng(1));
    const html = renderToString(<QuizPage items={items} content={content} onFinish={noop} onExit={noop} />);
    expect(html).toContain('수도는 어디일까요?');
    expect(html.match(/class="choice /g)).toHaveLength(4);
    expect(html).toContain('flag-img');
  });
  it('퀴즈: 국기 고르기 문제는 국기 4개를 보여주고 이름은 숨긴다', () => {
    const q = content.questions.find((x) => x.id === 'q.flag.KR')!;
    const item = buildQuizItem(q, content, seededRng(2));
    const html = renderToString(<QuizPage items={[item]} content={content} onFinish={noop} onExit={noop} />);
    expect(html).toContain('대한민국</span>의 국기는 어느 것일까요?');
    expect(html.match(/flag-choice /g)).toHaveLength(4);
    expect(html.match(/class="fi fi-/g)).toHaveLength(4);
    for (const label of item.choices.map((c) => c.label).filter((l) => l !== '대한민국')) {
      expect(html).not.toContain(label);
    }
  });
  it('결과: 도장 등급과 새 배지', () => {
    const html = renderToString(
      <ResultPage
        summary={{
          correctCount: 4,
          total: 5,
          starsEarned: 7,
          rewarded: true,
          stamps: [
            { countryId: 'KR', tier: 'gold', kind: 'new' },
            { countryId: 'JP', tier: 'basic', kind: 'new' },
          ],
        }}
        wrongCount={1}
        newBadges={[content.badges[0]]}
        practice={false}
        content={content}
        onHome={noop}
        onAgain={noop}
      />,
    );
    expect(html).toContain('stamp-gold');
    expect(html).toContain('stamp-basic');
    expect(html).toContain('새 배지를 받았어요');
  });
});
