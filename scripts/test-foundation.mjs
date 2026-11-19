import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
const route = join(process.cwd(), "src", "app", "foundation-test-probe");
const accountRoute = join(process.cwd(), "src", "app", "account-test-probe");
const mediaRoute = join(process.cwd(), "src", "app", "media-test-probe");
const catalogRoute = join(process.cwd(), "src", "app", "catalog-test-probe");
const productRoute = join(process.cwd(), "src", "app", "product-test-probe");
const addressRoute = join(process.cwd(), "src", "app", "address-test-probe");
const cartRoute = join(process.cwd(), "src", "app", "cart-test-probe");
const checkoutRoute = join(process.cwd(), "src", "app", "checkout-test-probe");
const reviewRoute = join(process.cwd(), "src", "app", "review-test-probe");
const ordersRoute = join(process.cwd(), "src", "app", "orders-test-probe");
const operationalSettingsRoute = join(
  process.cwd(),
  "src",
  "app",
  "operational-settings-test-probe",
);
const contentSettingsRoute = join(
  process.cwd(),
  "src",
  "app",
  "content-settings-test-probe",
);
const contactSubmissionsRoute = join(
  process.cwd(),
  "src",
  "app",
  "contact-submissions-test-probe",
);
const manualOrderRoute = join(
  process.cwd(),
  "src",
  "app",
  "manual-order-test-probe",
);
const adminOrdersRoute = join(
  process.cwd(),
  "src",
  "app",
  "admin-orders-test-probe",
);
const customersRoute = join(
  process.cwd(),
  "src",
  "app",
  "customers-test-probe",
);
const dashboardRoute = join(
  process.cwd(),
  "src",
  "app",
  "dashboard-test-probe",
);
const publicRoute = join(
  process.cwd(),
  "src",
  "app",
  "public-catalog-test-probe",
);
let created = false;
let accountCreated = false;
let mediaCreated = false;
let catalogCreated = false;
let productCreated = false;
let publicCreated = false;
let addressCreated = false;
let cartCreated = false;
let checkoutCreated = false;
let reviewCreated = false;
let ordersCreated = false;
let operationalSettingsCreated = false;
let contentSettingsCreated = false;
let contactSubmissionsCreated = false;
let manualOrderCreated = false;
let adminOrdersCreated = false;
let dashboardCreated = false;
let customersCreated = false;
try {
  await mkdir(route);
  created = true;
  await writeFile(
    join(route, "page.tsx"),
    'export { default } from "../../../tests/fixtures/foundation-preview";\n',
    { flag: "wx" },
  );
  await mkdir(accountRoute);
  accountCreated = true;
  await writeFile(
    join(accountRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/account-preview";\n',
    { flag: "wx" },
  );
  await mkdir(mediaRoute);
  mediaCreated = true;
  await writeFile(
    join(mediaRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/media-preview";\n',
    { flag: "wx" },
  );
  await mkdir(catalogRoute);
  catalogCreated = true;
  await writeFile(
    join(catalogRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/catalog-preview";\n',
    { flag: "wx" },
  );
  await mkdir(productRoute);
  productCreated = true;
  await writeFile(
    join(productRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/product-preview";\n',
    { flag: "wx" },
  );
  await mkdir(publicRoute);
  publicCreated = true;
  await writeFile(
    join(publicRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/public-catalog-preview";\n',
    { flag: "wx" },
  );
  await mkdir(addressRoute);
  addressCreated = true;
  await writeFile(
    join(addressRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/address-preview";\n',
    { flag: "wx" },
  );
  await mkdir(cartRoute);
  cartCreated = true;
  await writeFile(
    join(cartRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/cart-preview";\n',
    { flag: "wx" },
  );
  await mkdir(checkoutRoute);
  checkoutCreated = true;
  await writeFile(
    join(checkoutRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/checkout-preview";\n',
    { flag: "wx" },
  );
  await mkdir(reviewRoute);
  reviewCreated = true;
  await writeFile(
    join(reviewRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/review-preview";\n',
    { flag: "wx" },
  );
  await mkdir(ordersRoute);
  ordersCreated = true;
  await writeFile(
    join(ordersRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/orders-preview";\n',
    { flag: "wx" },
  );
  await mkdir(operationalSettingsRoute);
  operationalSettingsCreated = true;
  await writeFile(
    join(operationalSettingsRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/operational-settings-preview";\n',
    { flag: "wx" },
  );
  await mkdir(contentSettingsRoute);
  contentSettingsCreated = true;
  await writeFile(
    join(contentSettingsRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/content-settings-preview";\n',
    { flag: "wx" },
  );
  await mkdir(contactSubmissionsRoute);
  contactSubmissionsCreated = true;
  await writeFile(
    join(contactSubmissionsRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/contact-submissions-preview";\n',
    { flag: "wx" },
  );
  await mkdir(manualOrderRoute);
  manualOrderCreated = true;
  await writeFile(
    join(manualOrderRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/manual-order-preview";\n',
    { flag: "wx" },
  );
  await mkdir(adminOrdersRoute);
  adminOrdersCreated = true;
  await writeFile(
    join(adminOrdersRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/admin-orders-preview";\n',
    { flag: "wx" },
  );
  await mkdir(dashboardRoute);
  dashboardCreated = true;
  await writeFile(
    join(dashboardRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/dashboard-preview";\n',
    { flag: "wx" },
  );
  await mkdir(customersRoute);
  customersCreated = true;
  await writeFile(
    join(customersRoute, "page.tsx"),
    'export { default } from "../../../tests/fixtures/customers-preview";\n',
    { flag: "wx" },
  );
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config=playwright.foundation.config.ts",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: process.env },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (operationalSettingsCreated)
    await rm(operationalSettingsRoute, { recursive: true, force: true });
  if (contentSettingsCreated)
    await rm(contentSettingsRoute, { recursive: true, force: true });
  if (contactSubmissionsCreated)
    await rm(contactSubmissionsRoute, { recursive: true, force: true });
  if (manualOrderCreated)
    await rm(manualOrderRoute, { recursive: true, force: true });
  if (adminOrdersCreated)
    await rm(adminOrdersRoute, { recursive: true, force: true });
  if (customersCreated)
    await rm(customersRoute, { recursive: true, force: true });
  if (dashboardCreated)
    await rm(dashboardRoute, { recursive: true, force: true });
  if (ordersCreated) await rm(ordersRoute, { recursive: true, force: true });
  if (checkoutCreated)
    await rm(checkoutRoute, { recursive: true, force: true });
  if (reviewCreated) await rm(reviewRoute, { recursive: true, force: true });
  if (cartCreated) await rm(cartRoute, { recursive: true, force: true });
  if (addressCreated) await rm(addressRoute, { recursive: true, force: true });
  if (publicCreated) await rm(publicRoute, { recursive: true, force: true });
  if (productCreated) await rm(productRoute, { recursive: true, force: true });
  if (catalogCreated) await rm(catalogRoute, { recursive: true, force: true });
  if (mediaCreated) await rm(mediaRoute, { recursive: true, force: true });
  if (accountCreated) await rm(accountRoute, { recursive: true, force: true });
  if (created) {
    await rm(route, { recursive: true, force: true });
    for (const file of ["validator.ts", "routes.d.ts"]) {
      await rm(join(process.cwd(), ".next", "dev", "types", file), {
        force: true,
      });
    }
  }
}
