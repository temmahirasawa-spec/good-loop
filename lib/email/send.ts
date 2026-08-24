import "server-only";

/**
 * メール送信（Resend）。2026-08-24 に接続した。
 *
 * ⚠ **GOOD REVIEW からメールを送る経路は2つある。混同しないこと。**
 *
 * | 経路 | 送るもの | 設定場所 |
 * |---|---|---|
 * | **Supabase の SMTP** | パスワード再設定など、Supabase が自分で送るもの | Supabase の管理画面（コードからは触らない） |
 * | **このファイル** | GOOD REVIEW が自分で送るもの（確認メール・低評価アラート） | `RESEND_API_KEY` |
 *
 * どちらも最終的には Resend から出ていくが、**鍵が別**（`supabase-smtp` と `goodreview-app`）。
 * 片方を作り直しても、もう片方は止まらない。
 *
 * ⚠ **送信の失敗で処理全体を止めないこと。** メールは「届けば良い」ものであって、
 *   契約先の作成や回答の保存より優先度が低い。失敗は false を返してログに残す。
 */

/** 差出人。Resend で認証済みのドメインでなければ送れない（2026-08-24 天真の決定） */
export const MAIL_FROM = "GOOD REVIEW <noreply@mail.good-review.jp>";

export type SendResult = { ok: boolean; id?: string; error?: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * メールを1通送る。
 *
 * 例外を投げない。呼び出し側が「送れたかどうか」で分岐できるように結果を返す。
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  /** 本文（プレーンテキスト）。HTMLメールは作らない ── 下記の理由 */
  text: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[email] RESEND_API_KEY が未設定のため送信していない");
    return { ok: false, error: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [params.to],
        subject: params.subject,
        // HTMLではなくテキストで送る。店舗の方はスマホの標準メールアプリで読むことが多く、
        // 画像やCSSが崩れるより、確実に読めるほうがよい。迷惑メール判定にも有利。
        text: params.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] 送信に失敗 (${res.status}) ${body}`);
      return { ok: false, error: `http_${res.status}` };
    }

    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: data?.id };
  } catch (error) {
    console.error("[email] 送信で例外", error);
    return { ok: false, error: "exception" };
  }
}
