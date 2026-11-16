import { StorefrontShell } from "@/storefront/storefront-shell";
import { ContactForm } from "@/storefront/content/contact-form";
import { contentPage, metadataFor } from "@/server/content/pages";
import { normalizeDigits } from "@/shared/locale";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadataFor(await contentPage(), "contact");
}
export default async function ContactPage() {
  const { contact } = await contentPage();
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
            {contact.mapUrl && (
              <a
                href={contact.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                مشاهده نقشه
              </a>
            )}
          </section>
          <ContactForm />
        </div>
      </main>
    </StorefrontShell>
  );
}
