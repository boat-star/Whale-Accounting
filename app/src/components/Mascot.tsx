import happyImg from "../assets/mascot-happy.png";
import sleepImg from "../assets/mascot-sleep.png";
import headImg from "../assets/mascot-head.png";
import logoImg from "../assets/logo.png";

const BODY_RATIO = 514 / 720;

/**
 * 鲸鱼娘形象。
 * 小尺寸（<=64px）用头像，保证在列表与角标里看得清五官；
 * 大尺寸用全身立绘，mood 决定是精神满满还是睡着了。
 */
export function Mascot({
  size = 40,
  mood = "happy",
}: {
  size?: number;
  mood?: "happy" | "sleep" | "rich";
}) {
  if (size <= 64) {
    return (
      <img
        src={headImg}
        width={size}
        height={size}
        alt="鲸鱼娘"
        draggable={false}
        className="mascot-img"
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }
  const src = mood === "sleep" ? sleepImg : happyImg;
  return (
    <img
      src={src}
      width={Math.round(size * BODY_RATIO)}
      height={size}
      alt="鲸鱼娘"
      draggable={false}
      className="mascot-img"
      style={{ height: size, width: "auto", maxWidth: "none" }}
    />
  );
}

export function WhaleLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src={logoImg}
      width={size}
      height={size}
      alt="鲸鱼记账"
      draggable={false}
      className="whale-logo-img"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    />
  );
}
