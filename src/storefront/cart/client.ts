export async function cartRequest(body: object) {
  const response = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "عملیات سبد خرید ممکن نشد.");
  return data;
}
export async function syncCart() {
  const raw = localStorage.getItem("lamsechi-cart-draft-v1");
  if (raw) {
    let draft: unknown;
    try {
      draft = JSON.parse(raw);
    } catch {
      throw new Error(
        "سبد قدیمی خوانده نشد؛ اطلاعات آن در مرورگر حفظ شده است.",
      );
    }
    let draftId = localStorage.getItem("lamsechi-cart-draft-id");
    if (!draftId) {
      draftId = crypto.randomUUID().replaceAll("-", "");
      localStorage.setItem("lamsechi-cart-draft-id", draftId);
    }
    await cartRequest({ action: "import", draftId, draft });
    localStorage.removeItem("lamsechi-cart-draft-v1");
    localStorage.removeItem("lamsechi-cart-draft-id");
  } else await cartRequest({ action: "merge" });
}
