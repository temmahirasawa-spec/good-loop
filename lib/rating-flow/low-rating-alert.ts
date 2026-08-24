import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { PUBLIC_APP_URL } from "@/lib/site-url";

/**
 * 低評価アラート（supabase/0015、2026-08-24 天真の決定）。
 *
 * ★3以下の回答が入った瞬間に、店舗へメールで知らせる。
 * **これが GOOD REVIEW の製品価値の中心。** 低評価を公開レビューに出さないだけでなく、
 * 「気づいてその場で手を打てる」ところまでが価値になる。
 *
 * ⚠⚠ **回答の保存を絶対に妨げないこと。** ⚠⚠
 *   来店客は目の前で送信ボタンを押して待っている。メールの送信に失敗したり
 *   時間がかかったりしても、**回答が保存されなかったことにしてはいけない。**
 *   そのため呼び出し側は `await` せず、この関数も例外を投げない。
 *
 * ⚠ **来店客の個人情報は載せない。** アンケートは記名を求めていないので、
 *   そもそも名前もメールアドレスも持っていない。自由記述だけを載せる。
 */

/** ★いくつ以下でアラートを送るか（画面の説明文「★3以下」と揃える） */
export const LOW_RATING_THRESHOLD = 3;

type Args = {
  supabase: SupabaseClient;
  storeId: string;
  rating: number;
  tags: string[];
  freeText: string;
};

export async function sendLowRatingAlert({ supabase, storeId, rating, tags, freeText }: Args): Promise<void> {
  try {
    if (rating > LOW_RATING_THRESHOLD) return;

    const { data: store } = await supabase
      .from("stores")
      .select("name, notify_email, notify_low_rating")
      .eq("id", storeId)
      .maybeSingle<{ name: string; notify_email: string | null; notify_low_rating: boolean }>();

    // 設定していない・切っている店舗には送らない
    if (!store?.notify_low_rating || !store.notify_email) return;

    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const body = [
      `${store.name} で、${rating}段階の評価が入りました。`,
      "",
      `　評価　　：${stars}（${rating} / 5）`,
      tags.length > 0 ? `　挙がった点：${tags.join("・")}` : "　挙がった点：（選択なし）",
      "",
      "　いただいたご意見：",
      freeText.trim() ? indent(freeText.trim()) : "　　（記入なし）",
      "",
      "───────────────",
      "この内容は Google マップには投稿されていません。店内向けのアンケートとして届いています。",
      "",
      `回答の一覧はこちら：${PUBLIC_APP_URL}/admin/responses`,
      "",
      "通知を止めるには、管理画面の「設定 ＞ 通知」からオフにしてください。",
      "",
      "株式会社UTUTU / GOOD REVIEW",
    ].join("\n");

    const result = await sendEmail({
      to: store.notify_email,
      // 件名だけで何が起きたか分かるようにする。通知は開かれないことも多い
      subject: `【GOOD REVIEW】${store.name} に ${stars}（${rating}）の評価が入りました`,
      text: body,
    });

    if (!result.ok) {
      console.error(`[alert] 低評価アラートを送れなかった store=${storeId} reason=${result.error}`);
    }
  } catch (error) {
    // ここで投げると、呼び出し元の未処理の拒否になる。握って記録するだけにする
    console.error("[alert] 低評価アラートで例外", error);
  }
}

/** 自由記述を引用らしく見せる。長い文章でも件名や本文が崩れないように行ごとに字下げする */
function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `　　${line}`)
    .join("\n");
}
