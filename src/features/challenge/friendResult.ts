import { CONFIG } from '../../config';
import type { PlayerProgress } from '../../types/progress';
import { challengeKey } from './bonus';

/**
 * 친구가 푼 결과(확인코드)로 도전장을 만든 사람이 별을 받는 방식. 서버가 없다.
 *
 *   친구: 도전장을 풀고 "결과 친구에게 보내기"를 누르면, 복사되는 글에 확인코드가 한 줄 들어간다.
 *         WP1-FRc.JPf.KRc-3-3-k7m2x9ab-3f9a2c   (도전장 - 맞힌 수 - 문제 수 - 친구 기기 번호 - 서명)
 *   만든 사람: 그 글을 앱에 붙여 넣으면 별을 받는다.
 *
 * 서명은 앱 코드 안의 값으로 만든 해시라서 점수나 도전장을 고치면 무효가 되지만, 코드를 분석하는 사람은 위조할 수 있다.
 * (아는 사람끼리 쓰는 기능이고 보상이 작아서 이 정도로 한다. 하루/도전장별 상한이 피해를 제한한다.)
 */

const VERSION = 'WP1';
const SALT = 'world-pals/friend-result/v1'; // 비밀이 아니다
const madeEvent = (key: string) => `challenge-made:${key}`;
const claimPrefix = (key: string) => `friend-claim:${key}:`;

/** FNV-1a 32비트 해시 (가볍고 결과가 항상 같다) */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const sign = (payload: string) => fnv1a(`${SALT}|${payload}`).toString(36).padStart(7, '0').slice(-6);

export type FriendResult = { key: string; score: number; total: number; solverId: string };

export function makeResultCode(r: FriendResult): string {
  const payload = `${r.key}-${r.score}-${r.total}-${r.solverId}`;
  return `${VERSION}-${payload}-${sign(payload)}`;
}

/** 이 기기의 무작위 번호. 처음 필요할 때 만들어 저장하고, 같은 친구가 다시 풀어도 같은 번호라서 만든 사람이 한 번만 받을 수 있다. */
export function ensureSolverId(progress: PlayerProgress): PlayerProgress {
  if (progress.solverId) return progress;
  let id = '';
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (const b of bytes) id += (b % 36).toString(36);
  return { ...progress, solverId: id };
}

export type ParseFailure = 'none' | 'format' | 'signature';
export type ParsedResult = { ok: true; result: FriendResult } | { ok: false; reason: ParseFailure };

const CODE_RE = /WP1-([A-Za-z]{2}[cfCF](?:\.[A-Za-z]{2}[cfCF]){0,9})-(\d{1,2})-(\d{1,2})-([A-Za-z0-9]{4,12})-([A-Za-z0-9]{6})/i;

/** 붙여 넣은 글 어디에 있든 확인코드를 찾아서 서명까지 확인한다. 줄바꿈/앞뒤 글/대소문자 차이는 괜찮다. */
export function parseResultText(text: string): ParsedResult {
  if (!text.toUpperCase().includes(VERSION + '-')) return { ok: false, reason: 'none' };
  const m = CODE_RE.exec(text);
  if (!m) return { ok: false, reason: 'format' };
  const key = challengeKey(m[1]);
  const score = Number(m[2]);
  const total = Number(m[3]);
  if (!key || total < 1 || total > 10 || score > total) return { ok: false, reason: 'format' };
  const solverId = m[4].toLowerCase();
  const payload = `${key}-${score}-${total}-${solverId}`;
  if (sign(payload) !== m[5].toLowerCase()) return { ok: false, reason: 'signature' };
  return { ok: true, result: { key, score, total, solverId } };
}

export type ClaimStatus =
  | { kind: 'claimed'; score: number; total: number; perfect: boolean }
  | { kind: 'invalid'; reason: ParseFailure }
  | { kind: 'not-mine' } // 내가 만든 도전장이 아님
  | { kind: 'self' } // 내가 푼 결과
  | { kind: 'already' } // 이미 받은 친구의 결과
  | { kind: 'full' } // 이 도전장은 받을 수 있는 친구 수를 다 채움
  | { kind: 'cap' }; // 오늘의 친구 보너스를 다 받음

export type ClaimOutcome = { stars: number; status: ClaimStatus };

/** 내가 도전장을 만든 적이 있는지 (홈에서 결과 확인 버튼을 보여줄지) */
export const hasMadeChallenge = (progress: PlayerProgress) => progress.rewardEventIds.some((e) => e.startsWith('challenge-made:'));

/**
 * 붙여 넣은 친구의 결과로 별을 받는다. 입력을 바꾸지 않는다.
 * - 내가 만든 도전장의 결과만, 내가 푼 결과는 안 됨
 * - 같은 친구(기기 번호)의 같은 도전장은 한 번만, 도전장 하나에서 최대 friendResultsPerChallenge명
 * - 별: 친구 한 명당 friendResultStars, 만점이면 friendResultPerfectBonus 추가. 하루 friendBonusDailyMax까지
 * - 하루 상한 때문에 못 받은 결과는 기록하지 않아서, 다른 날 다시 붙여 넣으면 받을 수 있다
 */
export function claimFriendResult(
  progress: PlayerProgress,
  text: string,
  today: string,
  config: {
    friendResultStars: number;
    friendResultPerfectBonus: number;
    friendResultsPerChallenge: number;
    friendBonusDailyMax: number;
  } = CONFIG,
): { progress: PlayerProgress; outcome: ClaimOutcome } {
  const none = (status: ClaimStatus) => ({ progress, outcome: { stars: 0, status } });
  const parsed = parseResultText(text);
  if (!parsed.ok) return none({ kind: 'invalid', reason: parsed.reason });
  const { key, score, total, solverId } = parsed.result;

  if (!progress.rewardEventIds.includes(madeEvent(key))) return none({ kind: 'not-mine' });
  if (progress.solverId && solverId === progress.solverId) return none({ kind: 'self' });
  const claimEvent = `${claimPrefix(key)}${solverId}`;
  if (progress.rewardEventIds.includes(claimEvent)) return none({ kind: 'already' });
  if (progress.rewardEventIds.filter((e) => e.startsWith(claimPrefix(key))).length >= config.friendResultsPerChallenge) {
    return none({ kind: 'full' });
  }
  const got = progress.friendBonusDate === today ? progress.friendBonusToday : 0;
  const remaining = Math.max(0, config.friendBonusDailyMax - got);
  if (remaining === 0) return none({ kind: 'cap' });

  const perfect = score === total;
  const stars = Math.min(config.friendResultStars + (perfect ? config.friendResultPerfectBonus : 0), remaining);
  return {
    progress: {
      ...progress,
      totalStars: progress.totalStars + stars,
      friendBonusDate: today,
      friendBonusToday: got + stars,
      rewardEventIds: [...progress.rewardEventIds, claimEvent],
    },
    outcome: { stars, status: { kind: 'claimed', score, total, perfect } },
  };
}

/** 결과 확인 화면에 보여줄 안내 (아이용 문구). */
export function claimMessage(outcome: ClaimOutcome): { tone: 'good' | 'info'; text: string } {
  const { status, stars } = outcome;
  switch (status.kind) {
    case 'claimed':
      return {
        tone: 'good',
        text: `🎉 친구가 ${status.total}문제 중 ${status.score}문제를 맞혔어요! ${status.perfect ? '만점 보너스까지 ' : ''}⭐ 별 ${stars}개를 받았어요!`,
      };
    case 'invalid':
      return {
        tone: 'info',
        text:
          status.reason === 'none'
            ? '확인코드를 찾지 못했어요. 친구가 보낸 글을 통째로 붙여 넣어 볼래요?'
            : '확인코드를 읽을 수 없어요. 글이 중간에 잘렸거나 바뀐 것 같아요. 친구에게 다시 받아 볼래요?',
      };
    case 'not-mine':
      return { tone: 'info', text: '내가 이 기기에서 만든 도전장의 결과가 아니에요.' };
    case 'self':
      return { tone: 'info', text: '내가 푼 결과로는 별을 받을 수 없어요. 친구에게 보내 달라고 해요!' };
    case 'already':
      return { tone: 'info', text: '이미 받은 친구의 결과예요.' };
    case 'full':
      return { tone: 'info', text: `이 도전장은 친구 보너스를 다 받았어요 (최대 ${CONFIG.friendResultsPerChallenge}명).` };
    case 'cap':
      return { tone: 'info', text: '오늘의 친구 보너스는 다 받았어요. 내일 다시 붙여 넣으면 받을 수 있어요!' };
  }
}
