import { StorefrontShell } from "@/storefront/storefront-shell";
import type { Entry } from "@/shared/content";
export function ArticlePage({
  title,
  description,
  items,
  empty,
}: {
  title: string;
  description: string;
  items: Entry[];
  empty: string;
}) {
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content info-page">
        <h1>{title}</h1>
        {description && <p className="content-text">{description}</p>}
        {items.length ? (
          <div className="info-accordions">
            {items.map((x) => (
              <details key={x.id}>
                <summary>{x.title || "بدون عنوان"}</summary>
                <p className="content-text">{x.body}</p>
              </details>
            ))}
          </div>
        ) : (
          <p>{empty}</p>
        )}
      </main>
    </StorefrontShell>
  );
}
