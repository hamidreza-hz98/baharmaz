"use client";
import { useState } from "react";
import { Button } from "@mui/material";
import { ProductList } from "@/admin/products/product-list";
import { ProductForm } from "@/admin/products/product-form";
export default function ProductPreview() {
  const [form, setForm] = useState(false);
  return (
    <main style={{ maxWidth: 1000, margin: "auto", padding: 16 }}>
      <Button onClick={() => setForm(!form)}>تغییر نمونه محصول</Button>
      {form ? <ProductForm /> : <ProductList />}
    </main>
  );
}
