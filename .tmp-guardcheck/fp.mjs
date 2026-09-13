import { GUARD_WORDS } from "../lib/demo/fact-model.ts";
import { guardPolished } from "../lib/survey/polish-guard.ts";
// 提案された判定：出力の「お」「ご」の直後が漢字/カタカナで、その2文字が入力に無ければ落とす
function honorificPrefixOk(input, output){
  const a = Array.from(output);
  for (let i=0;i+1<a.length;i++){
    if ((a[i]==="お"||a[i]==="ご") && /[一-鿿゠-ヿ]/.test(a[i+1])){
      const pair = a[i]+a[i+1];
      if (!input.includes(pair)) return false;
    }
  }
  return true;
}
const cases = [
  ["いちご パフェ 甘さちょうどいい", "いちごパフェは甘さちょうどいい。"],
  ["たまご サンド ボリュームあった", "たまごサンドはボリュームあった。"],
  ["りんご ジュース しぼりたて", "りんごジュースはしぼりたて。"],
];
for (const [i,o] of cases){
  console.log(`現行=${guardPolished(i,o,GUARD_WORDS).ok?"通す":"捨てる"} / 提案の追加判定=${honorificPrefixOk(i,o)?"通す":"捨てる"} | ${i} → ${o}`);
}
