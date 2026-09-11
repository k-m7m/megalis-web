/**
 * 扉の左右に立つ守護者の浮き彫り。
 *
 * どちらも高さ 150、幅 40 の枠に収まるよう描いてある。
 * 小さく表示されるので、細部より輪郭がはっきり出ることを優先した。
 * エジプトの浮き彫りの約束事どおり、顔と脚は横向き、肩は正面を向く。
 */

/** アヌビス（ジャッカル頭の冥界の神）。右を向いて杖を持つ */
export const ANUBIS = `
  <!-- 耳 -->
  <path d="M12 2 L18 24 L9 21 Z" />
  <path d="M21 3 L27 23 L18 24 Z" />
  <!-- 頭と長い鼻先 -->
  <path d="M9 21 Q8 34 19 34 L37 31 L37 26 L24 23 Q16 19 9 21 Z" />
  <circle class="mg-relief-eye" cx="16" cy="27" r="1.8" />
  <!-- 首 -->
  <path d="M14 33 H23 V40 H14 Z" />
  <!-- 肩から胴 -->
  <path d="M6 40 H31 L28 72 H10 Z" />
  <!-- 胸飾り -->
  <path d="M8 42 H29 L28 48 H9 Z" class="mg-relief-inlay" />
  <!-- 杖を握る前腕 -->
  <path d="M27 45 H35 V50 H27 Z" />
  <!-- 腰布 -->
  <path d="M9 72 H29 L33 101 H5 Z" />
  <!-- 脚 -->
  <path d="M11 101 H18 V140 H11 Z" />
  <path d="M21 101 H28 V140 H21 Z" />
  <!-- 足（横向きなので同じ方向を向く） -->
  <path d="M11 140 H18 L27 147 H11 Z" />
  <path d="M21 140 H28 L37 147 H21 Z" />
  <!-- 杖 -->
  <path d="M33 16 H36 V147 H33 Z" />
  <path d="M30 16 H39 L36 8 H33 Z" />
`;

/** ファラオ。左を向き、胸の前で腕を組む */
export const PHARAOH = `
  <!-- ネメス頭巾 -->
  <path d="M9 20 Q9 5 21 5 Q33 5 33 20 L36 41 L26 43 H15 L6 41 Z" />
  <path d="M12 12 H30 V16 H12 Z" class="mg-relief-inlay" />
  <!-- 横顔。頭巾と同色だと溶けるので少し濃くする -->
  <path d="M9 20 L2 27 L4 33 L13 35 L15 22 Z" class="mg-relief-skin" />
  <circle class="mg-relief-eye" cx="9" cy="26" r="1.8" />
  <!-- つけひげ -->
  <path d="M5 33 H10 L9 44 L4 42 Z" class="mg-relief-skin" />
  <!-- 襟飾り -->
  <path d="M6 43 H35 L33 52 H8 Z" />
  <path d="M9 45 H31 L30 50 H10 Z" class="mg-relief-inlay" />
  <!-- 胴 -->
  <path d="M10 52 H31 L28 77 H12 Z" />
  <!-- 胸の前で組んだ腕 -->
  <path d="M9 56 H31 V63 H9 Z" />
  <!-- 腰布 -->
  <path d="M11 77 H29 L33 103 H7 Z" />
  <!-- 脚 -->
  <path d="M12 103 H19 V140 H12 Z" />
  <path d="M22 103 H29 V140 H22 Z" />
  <!-- 足 -->
  <path d="M12 140 H19 V147 H3 Z" />
  <path d="M22 140 H29 V147 H13 Z" />
`;

/**
 * まぐさ石の上に置く有翼日輪。封印の状態をここで示す。
 * 左右に広げた翼と、中央の日輪。翼の後ろ縁を段にして羽根に見せている。
 */
export const WINGED_DISC = `
  <path d="M64 13 C48 5 26 4 4 9 L20 15 L6 18 L24 22 L12 26 L36 29 C50 29 60 23 64 20 Z" />
  <path d="M96 13 C112 5 134 4 156 9 L140 15 L154 18 L136 22 L148 26 L124 29 C110 29 100 23 96 20 Z" />
  <circle class="mg-disc-core" cx="80" cy="17" r="11" />
`;

/**
 * 祭室の中央に座るファラオ像。
 * 実機はここが立体の金色の像になっている。
 * 幅 96、高さ 120 の枠に収まるよう描いてある。
 */
export const SEATED_PHARAOH = `
  <!-- 玉座 -->
  <path d="M14 56 H82 V120 H14 Z" class="mg-throne" />
  <path d="M8 112 H88 V120 H8 Z" class="mg-throne" />
  <!-- ネメス頭巾 -->
  <path d="M28 30 Q28 4 48 4 Q68 4 68 30 L74 56 L58 60 H38 L22 56 Z" />
  <!-- 頭巾の縞 -->
  <path d="M32 14 H64 V20 H32 Z" class="mg-relief-inlay" />
  <path d="M30 26 H66 V31 H30 Z" class="mg-relief-inlay" />
  <!-- 顔 -->
  <path d="M36 30 H60 V54 Q48 62 36 54 Z" class="mg-relief-skin" />
  <circle class="mg-relief-eye" cx="41" cy="40" r="2.4" />
  <circle class="mg-relief-eye" cx="55" cy="40" r="2.4" />
  <!-- つけひげ -->
  <path d="M43 56 H53 L51 72 H45 Z" class="mg-relief-skin" />
  <!-- 襟飾り -->
  <path d="M24 58 H72 L68 74 H28 Z" />
  <path d="M30 62 H66 L64 70 H32 Z" class="mg-relief-inlay" />
  <!-- 胴と膝に置いた腕 -->
  <path d="M28 74 H68 V102 H28 Z" />
  <path d="M22 82 H74 V92 H22 Z" />
  <!-- 脚 -->
  <path d="M30 102 H46 V120 H30 Z" />
  <path d="M50 102 H66 V120 H50 Z" />
`;
