import { StorefrontShell } from "@/storefront/storefront-shell";
import { ContactForm } from "@/storefront/content/contact-form";
import { contentPage, metadataFor } from "@/server/content/pages";
import { normalizeDigits } from "@/shared/locale";
export const dynamic = "force-dynamic";
function mapEmbedUrl(mapUrl: string, address: string) {
  try {
    const url = new URL(mapUrl);
    const mapPosition = url.hash.match(
      /(?:^#map=\d+\/)(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/,
    );
    const googlePosition = url.href.match(
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    );
    const queryPosition = (url.searchParams.get("q") ?? "").match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
    );
    const rawLat =
      url.searchParams.get("mlat") ??
      mapPosition?.[1] ??
      googlePosition?.[1] ??
      queryPosition?.[1];
    const rawLon =
      url.searchParams.get("mlon") ??
      mapPosition?.[2] ??
      googlePosition?.[2] ??
      queryPosition?.[2];
    const lat = Number(rawLat);
    const lon = Number(rawLon);
    if (
      rawLat &&
      rawLon &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    ) {
      const params = new URLSearchParams({
        bbox: `${lon - 0.008},${lat - 0.005},${lon + 0.008},${lat + 0.005}`,
        layer: "mapnik",
        marker: `${lat},${lon}`,
      });
      return `https://www.openstreetmap.org/export/embed.html?${params}`;
    }
  } catch {
    return "";
  }
  return address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
    : "";
}
export async function generateMetadata() {
  return metadataFor(await contentPage(), "contact");
}
export default async function ContactPage() {
  const { contact } = await contentPage();
  const mapEmbed = contact.mapUrl
    ? mapEmbedUrl(contact.mapUrl, contact.address)
    : "";
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content info-page">
        <h1>تماس با ما</h1>
        <div className="contact-grid">
          <section>
            <h2>راه‌های ارتباطی</h2>
            {contact.phones.length ? (
              <ul>
                {contact.phones
                  .filter((p) => p.value)
                  .map((p) => (
                    <li key={p.id}>
                      <a
                        dir="ltr"
                        href={`tel:${normalizeDigits(p.value).replace(/[^\d+]/g, "")}`}
                      >
                        {p.value}
                      </a>
                    </li>
                  ))}
              </ul>
            ) : (
              <p>شماره تماسی هنوز ثبت نشده است.</p>
            )}
            {contact.socials.filter((x) => x.label && x.url).length > 0 && (
              <ul>
                {contact.socials
                  .filter((x) => x.label && x.url)
                  .map((x) => (
                    <li key={x.id}>
                      <a href={x.url} target="_blank" rel="noopener noreferrer">
                        {x.label}
                      </a>
                    </li>
                  ))}
              </ul>
            )}
            <h2>نشانی</h2>
            <p className="content-text">
              {contact.address || "نشانی هنوز ثبت نشده است."}
            </p>
            {contact.mapUrl && mapEmbed ? (
              <div className="contact-map">
                <iframe
                  title="موقعیت فروشگاه روی نقشه"
                  src={mapEmbed}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  tabIndex={-1}
                />
                <a
                  href={contact.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="باز کردن موقعیت فروشگاه در برنامه نقشه"
                >
                  <span>باز کردن نقشه و مسیریابی</span>
                </a>
              </div>
            ) : (
              contact.mapUrl && (
                <a
                  href={contact.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  مشاهده نقشه
                </a>
              )
            )}
          </section>
          <ContactForm />
        </div>
      </main>
    </StorefrontShell>
  );
}
