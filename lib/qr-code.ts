import QRCode from "qrcode";

/**
 * 二次元コード発行画面（launch-plan.md D-7）。
 *
 * SVGでサーバー側生成する（クライアントJSに依存せず、印刷時も劣化しない）。
 * 読み取り信頼性のため、業態テーマに関わらず常に黒/白で生成する
 * （デザイントークンで色をつけると、コントラストが下がりスキャンできない機種が出るため）。
 */
export async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    // design-qa-allow: QRコードは読み取り信頼性のため常に黒/白固定。デザイントークン（業態テーマ）を反映すると機種によっては読み取れなくなる
    color: { dark: "#000000", light: "#ffffff" },
  });
}
