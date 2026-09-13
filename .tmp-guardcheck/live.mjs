import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { GUARD_WORDS } from "/Users/temma/Dev/Apps/UTUTU/GOOD_LOOP/lib/demo/fact-model.ts";
import { guardPolished } from "/Users/temma/Dev/Apps/UTUTU/GOOD_LOOP/lib/survey/polish-guard.ts";
import { POLISH_SYSTEM_PROMPT, POLISH_MODEL, POLISH_MAX_TOKENS, buildPolishUserPrompt } from "./prompt.ts";

const env = fs.readFileSync("/Users/temma/Dev/Apps/UTUTU/GOOD_LOOP/.env.local","utf8");
const key = env.split("\n").find(l=>l.startsWith("ANTHROPIC_API_KEY")).split("=").slice(1).join("=").trim().replace(/^["']|["']$/g,"");
const client = new Anthropic({ apiKey: key });

// 美化語を最も誘発しそうな入力（お料理・ご案内・お会計・お店・ご予約・お名前）
const inputs = [
  "店の雰囲気いい 客層おちついてる",
  "会計スムーズ 領収書すぐ",
  "茶うまい 菓子もついてきた",
  "子ども連れokだった 席も広い",
  "電話対応よかった 予約変更も快く",
  "土産もらった 手紙も入ってた",
  "食事まんぞく 酒の種類おおい",
  "風呂ひろい 湯かげんちょうどいい",
];
const _old = [
  "料理おいしかった 店きれい",
  "予約スムーズ 案内よかった",
  "会計はやい 店員さん親切",
  "名前おぼえててくれた 気づかいうれしい",
  "店ひろい 席ゆったり",
  "案内ていねい 説明わかりやすい",
  "料理あつあつ 皿かわいい",
  "予約とれた 待ち時間みじかい",
];
for (const input of inputs) {
  const m = await client.messages.create({ model: POLISH_MODEL, max_tokens: POLISH_MAX_TOKENS, system: POLISH_SYSTEM_PROMPT, messages:[{role:"user",content:buildPolishUserPrompt(input)}] });
  const raw = m.content.map(b=>b.type==="text"?b.text:"").join("").trim();
  let text=""; try{ const s=raw.indexOf("{"),e=raw.lastIndexOf("}"); text=JSON.parse(raw.slice(s,e+1)).text ?? ""; }catch{ text="(parse fail) "+raw; }
  const v = guardPolished(input, text, GUARD_WORDS);
  const flag = /[おご][一-鿿゠-ヿ]/.test(text) ? "  <<< お/ご+漢字" : "";
  console.log(`${v.ok?"通す":"捨てる("+v.reason+")"} | ${input} → ${text}${flag}`);
}
