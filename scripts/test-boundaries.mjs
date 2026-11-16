import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const route = join(process.cwd(), "src", "app", "boundary-probe");
let created = false;
try {
  await mkdir(route);
  created = true;
  await writeFile(
    join(route, "page.tsx"),
    '"use client";\nimport { loadShopIntroduction } from "@/server/shop/load-introduction";\nexport default function Probe() { return <button onClick={() => { void loadShopIntroduction(); }}>probe</button>; }\n',
    { flag: "wx" },
  );
  const result = spawnSync(
    process.execPath,
    ["node_modules/next/dist/bin/next", "build"],
    { encoding: "utf8", timeout: 120000 },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.error || result.status === 0 || !/server-only/i.test(output)) {
    console.error(
      "Boundary test failed: build did not reject the server-only import.",
      output,
      result.error ?? "",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Boundary test passed: Next.js rejected a client import of server-only code.",
    );
  }
} finally {
  if (created) await rm(route, { recursive: true, force: true });
}
