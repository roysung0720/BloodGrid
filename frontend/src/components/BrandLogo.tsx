/** The BloodGrid mark on its white disc, as used on the HackGT deck. */
export function BrandLogo({ size = 44 }: { size?: number }) {
  return (
    // A plain <img> keeps the mark crisp at small sizes without extra image tooling.
    <img
      alt="BloodGrid logo"
      className="brand-logo"
      height={size}
      src="/brand/bloodgrid-logo.png"
      style={{ height: size, width: size }}
      width={size}
    />
  );
}
