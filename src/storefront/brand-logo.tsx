import Image from "next/image";

export function BrandLogo({
  size = 56,
  full = false,
}: {
  size?: number;
  full?: boolean;
}) {
  return (
    <Image
      src={full ? "/brand/baharmaz-logo.png" : "/brand/baharmaz-mark.png"}
      width={size}
      height={
        full
          ? Math.round((size * 1501) / 1735)
          : Math.round((size * 1160) / 875)
      }
      alt={full ? "لوگوی بهارمز" : ""}
      style={{ width: size, height: "auto", maxWidth: "100%" }}
    />
  );
}
