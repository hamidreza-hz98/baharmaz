"use client";
import { useState } from "react";
import { Button } from "@mui/material";
import { CatalogAdmin } from "@/admin/catalog/catalog-admin";
export default function CatalogPreview() {
  const [kind, setKind] = useState<"categories" | "ingredients">("categories");
  return (
    <main style={{ maxWidth: 1000, margin: "auto", padding: 16 }}>
      <Button
        onClick={() =>
          setKind(kind === "categories" ? "ingredients" : "categories")
        }
      >
        تغییر بخش نمونه
      </Button>
      <CatalogAdmin key={kind} kind={kind} />
    </main>
  );
}
