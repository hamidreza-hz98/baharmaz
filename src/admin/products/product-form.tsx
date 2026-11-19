"use client";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CollectionsOutlinedIcon from "@mui/icons-material/CollectionsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { MediaPicker } from "@/admin/media/media-picker";
import { PriceField } from "@/admin/price-field";
import {
  formatPersianGroupedInput,
  parseLocalizedInteger,
  rialsToTomans,
  tomansToRials,
} from "@/shared/locale";
import type { ProductItem } from "@/shared/products";
import { RichDescriptionEditor } from "./rich-description-editor";
import { CatalogSelector } from "./catalog-selector";
type Choice = {
  id: string;
  name: string;
  imageId?: string | null;
  iconId?: string | null;
};
function FormSectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="product-form-section-title">
      <span aria-hidden="true">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
function amount(value: string): number {
  try {
    return tomansToRials(parseLocalizedInteger(value));
  } catch {
    throw new RangeError("قیمت را به تومان و به‌صورت عدد صحیح وارد کنید.");
  }
}
export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(productId));
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [available, setAvailable] = useState(true);
  const [promoted, setPromoted] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [category, setCategory] = useState<Choice[]>([]);
  const [ingredients, setIngredients] = useState<Choice[]>([]);
  const [revision, setRevision] = useState(0);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    fetch(`/api/admin/products?id=${encodeURIComponent(productId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(({ item }: { item: ProductItem }) => {
        setTitle(item.title);
        setExcerpt(item.excerpt);
        setDescription(item.description);
        setPrice(
          formatPersianGroupedInput(String(rialsToTomans(item.priceRials))),
        );
        setDiscount(
          item.discountPriceRials === null
            ? ""
            : formatPersianGroupedInput(
                String(rialsToTomans(item.discountPriceRials)),
              ),
        );
        setAvailable(item.available);
        setPromoted(item.promoted);
        setGallery(item.gallery);
        setCategory([
          {
            id: item.categoryId,
            name: item.category?.name ?? "دسته‌بندی در دسترس نیست",
            imageId: item.category?.imageId,
            iconId: item.category?.iconId,
          },
        ]);
        const names = new Map(
          (item.ingredients ?? []).map((entry) => [entry.id, entry]),
        );
        setIngredients(
          item.ingredientIds.map((id) => ({
            id,
            name: names.get(id)?.name ?? "ماده اولیه در دسترس نیست",
            iconId: names.get(id)?.iconId,
          })),
        );
        setRevision(item.revision);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError("دریافت محصول ممکن نشد.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [productId, reload]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function change<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setDirty(true);
  }
  function leave() {
    if (!dirty || window.confirm("تغییرات ذخیره نشده‌اند. مایل به خروج هستید؟"))
      router.push("/admin/products");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (!category[0]) throw new RangeError("دسته‌بندی را انتخاب کنید.");
      if (description.length > 10000)
        throw new RangeError("حجم توضیحات بیش از حد مجاز است.");
      const priceRials = amount(price);
      const discountPriceRials = discount.trim() ? amount(discount) : null;
      if (
        priceRials <= 0 ||
        (discountPriceRials !== null &&
          (discountPriceRials <= 0 || discountPriceRials >= priceRials))
      )
        throw new RangeError(
          "قیمت تخفیف‌خورده باید مثبت و کمتر از قیمت اصلی باشد.",
        );
      setBusy(true);
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: productId ? "update" : "create",
          ...(productId ? { id: productId, revision } : {}),
          title,
          excerpt,
          description,
          gallery,
          categoryId: category[0].id,
          ingredientIds: ingredients.map((item) => item.id),
          priceRials,
          discountPriceRials,
          promoted,
          available,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "ذخیره انجام نشد.");
        return;
      }
      setDirty(false);
      router.push("/admin/products");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof RangeError
          ? cause.message
          : "ارتباط برقرار نشد. دوباره تلاش کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return <Typography role="status">در حال دریافت محصول…</Typography>;
  if (loadError)
    return (
      <Alert
        severity="error"
        action={
          <Button
            onClick={() => {
              setLoadError("");
              setLoading(true);
              setReload((value) => value + 1);
            }}
          >
            تلاش دوباره
          </Button>
        }
      >
        {loadError}
      </Alert>
    );
  return (
    <Box
      component="form"
      onSubmit={submit}
      className="admin-product-form"
      sx={{ display: "grid", gap: 2, width: "100%" }}
    >
      <div className="product-form-heading">
        <div className="product-form-heading-title">
          <span className="product-form-heading-icon">
            <Inventory2OutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <Typography component="h1" variant="h5">
              {productId ? "ویرایش محصول" : "افزودن محصول"}
            </Typography>
            <p>اطلاعات محصول را برای نمایش در فروشگاه تکمیل کنید.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outlined"
          startIcon={<ArrowForwardIcon />}
          onClick={leave}
          disabled={busy}
        >
          بازگشت به محصولات
        </Button>
      </div>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      <section className="product-form-card product-form-basic">
        <FormSectionTitle
          icon={<DescriptionOutlinedIcon />}
          title="اطلاعات محصول"
          description="نام و توضیحات محصول را وارد کنید."
        />
        <TextField
          label="نام محصول"
          value={title}
          onChange={(event) => change(setTitle, event.target.value)}
          required
          slotProps={{ htmlInput: { maxLength: 120 } }}
        />
        <TextField
          label="توضیح کوتاه"
          value={excerpt}
          onChange={(event) => change(setExcerpt, event.target.value)}
          multiline
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        <RichDescriptionEditor
          value={description}
          onChange={(value) => change(setDescription, value)}
        />
      </section>
      <section className="product-form-card">
        <FormSectionTitle
          icon={<CollectionsOutlinedIcon />}
          title="تصاویر محصول"
          description="تصویر اول به عنوان تصویر اصلی نمایش داده می‌شود."
        />
        <Box
          component="fieldset"
          className="product-form-gallery"
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            minWidth: 0,
          }}
        >
          <Typography component="legend">گالری تصاویر</Typography>
          <Button
            type="button"
            disabled={gallery.length >= 10}
            onClick={() => setPicker(true)}
            variant="outlined"
            startIcon={<AddPhotoAlternateOutlinedIcon />}
          >
            افزودن تصویر
          </Button>
          <Typography variant="body2">
            حداکثر ۱۰ تصویر؛ تصویر اول تصویر اصلی است.
          </Typography>
          <Box component="ol" sx={{ p: 0, listStyle: "none" }}>
            {gallery.map((id, index) => (
              <Box
                component="li"
                key={id}
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "center",
                  flexWrap: "wrap",
                  my: 1,
                }}
                className="product-gallery-item"
              >
                <Image
                  unoptimized
                  src={`/api/admin/media/${id}`}
                  width={64}
                  height={64}
                  alt={`تصویر ${index + 1}`}
                  style={{ objectFit: "contain" }}
                />
                <Typography>
                  تصویر {new Intl.NumberFormat("fa-IR").format(index + 1)}
                </Typography>
                <Button
                  type="button"
                  startIcon={<ArrowUpwardIcon />}
                  aria-label={`انتقال تصویر ${index + 1} به بالا`}
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...gallery];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    change(setGallery, next);
                  }}
                >
                  بالا
                </Button>
                <Button
                  type="button"
                  startIcon={<ArrowDownwardIcon />}
                  aria-label={`انتقال تصویر ${index + 1} به پایین`}
                  disabled={index === gallery.length - 1}
                  onClick={() => {
                    const next = [...gallery];
                    [next[index + 1], next[index]] = [
                      next[index],
                      next[index + 1],
                    ];
                    change(setGallery, next);
                  }}
                >
                  پایین
                </Button>
                <Button
                  type="button"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  aria-label={`حذف تصویر ${index + 1}`}
                  onClick={() =>
                    change(
                      setGallery,
                      gallery.filter((entry) => entry !== id),
                    )
                  }
                >
                  حذف
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      </section>
      <section className="product-form-card">
        <FormSectionTitle
          icon={<CategoryOutlinedIcon />}
          title="دسته‌بندی و مواد اولیه"
          description="دسته‌بندی و مواد اولیه مرتبط با محصول را انتخاب کنید."
        />
        <div className="product-form-selectors">
          <CatalogSelector
            kind="categories"
            selected={category}
            onChange={(value) => change(setCategory, value)}
          />
          <CatalogSelector
            kind="ingredients"
            selected={ingredients}
            onChange={(value) => change(setIngredients, value)}
          />
        </div>
      </section>
      <section className="product-form-card">
        <FormSectionTitle
          icon={<SellOutlinedIcon />}
          title="قیمت‌گذاری"
          description="قیمت‌ها را به تومان وارد کنید."
        />
        <div className="product-form-prices">
          <PriceField
            label="قیمت اصلی (تومان)"
            value={price}
            onValueChange={(value) => change(setPrice, value)}
            required
          />
          <PriceField
            label="قیمت پس از تخفیف (تومان)"
            value={discount}
            onValueChange={(value) => change(setDiscount, value)}
            helperText="اختیاری؛ باید کمتر از قیمت اصلی باشد."
          />
        </div>
      </section>
      <section className="product-form-card">
        <FormSectionTitle
          icon={<TuneOutlinedIcon />}
          title="وضعیت نمایش و فروش"
          description="موجودی و پیشنهاد ویژه را مشخص کنید."
        />
        <Box className="product-form-options">
          <FormControlLabel
            control={
              <Checkbox
                checked={available}
                onChange={(event) => change(setAvailable, event.target.checked)}
              />
            }
            label="موجود و قابل سفارش"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={promoted}
                onChange={(event) => change(setPromoted, event.target.checked)}
              />
            }
            label="محصول پیشنهادی"
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          نامک و اطلاعات جست‌وجو به‌صورت خودکار ساخته می‌شوند.
        </Typography>
      </section>
      <Box
        className="product-form-actions"
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Button type="button" onClick={leave} disabled={busy}>
          انصراف
        </Button>
        <Button
          type="submit"
          variant="contained"
          size="small"
          startIcon={<SaveOutlinedIcon />}
          disabled={busy}
        >
          {busy ? "در حال ذخیره…" : "ذخیره محصول"}
        </Button>
      </Box>
      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        allowedKind="image"
        onSelect={(item) => {
          if (gallery.includes(item.id)) {
            setError("این تصویر قبلاً انتخاب شده است.");
            return;
          }
          change(setGallery, [...gallery, item.id]);
        }}
      />
    </Box>
  );
}
