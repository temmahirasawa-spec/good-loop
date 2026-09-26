/**
 * v5「つなげる」で、**AIが足した文字**に印を付ける（docs/specs/survey-v5.md §4）。
 *
 * 整えるAI（/api/survey/polish）の出力は、検査層（polish-guard.ts）を通った時点で
 * 「本人の文字をそのままの順に残し、助詞と句読点を**足しただけ**」になっている（空白だけは消えることがある）。
 * そこで、本人の文字列と出力の最長共通部分列（＝両方に同じ順で出てくる文字の並び）を取り、
 * そこに入らなかった出力の文字を「AIが足した文字」とする。
 *
 * 画面では、この文字にだけ色を付けて「AIが足したのは色の付いた文字だけ」と見せる。
 * AIが中身を足していないことを、本人がその場で確かめられるようにするため。
 */

export type MarkedChar = { char: string; inserted: boolean };

export function markInsertions(original: string, output: string): MarkedChar[] {
  // 本人の文字列の空白は、整えるときに消えてよいので比べる対象から外す
  const a = Array.from(original.replace(/\s+/g, ""));
  const b = Array.from(output);
  const n = a.length;
  const m = b.length;

  // dp[i][j] = a の i 文字目以降と b の j 文字目以降の最長共通部分列の長さ
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const marked: MarkedChar[] = [];
  let i = 0;
  let j = 0;
  while (j < m) {
    if (i < n && a[i] === b[j]) {
      marked.push({ char: b[j], inserted: false });
      i++;
      j++;
    } else if (i < n && dp[i + 1][j] >= dp[i][j + 1]) {
      // 本人の文字のほうを飛ばす（出力に無い文字。検査を通った出力なら起きない）
      i++;
    } else {
      marked.push({ char: b[j], inserted: true });
      j++;
    }
  }
  return marked;
}

/** 句点などで終わっていなければ「。」を足す（AIを使わない、つなげ方の既定） */
export function withPeriod(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return /[。．.！!？?]$/.test(t) ? t : `${t}。`;
}
