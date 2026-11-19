"use client";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import RemoveShoppingCartOutlinedIcon from "@mui/icons-material/RemoveShoppingCartOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  InputAdornment,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  formatMoney,
  formatPersianGroupedInput,
  formatTehranJalali,
  parseLocalizedInteger,
  tomansToRials,
  rialsToTomans,
} from "@/shared/locale";
import { PriceField } from "@/admin/price-field";
import type { ProductItem, ProductPage } from "@/shared/products";
function amount(value: string): number {
  try {
    return tomansToRials(parseLocalizedInteger(value));
  } catch {
    throw new RangeError("قیمت را به تومان و به‌صورت عدد صحیح وارد کنید.");
  }
}
function Thumbnail({ item }: { item: ProductItem }) {
  const [failed, setFailed] = useState(false);
  return item.gallery[0] && !failed ? (
    <Image
      unoptimized
      src={`/api/admin/media/${item.gallery[0]}`}
      width={64}
      height={64}
      alt={`تصویر ${item.title}`}
      onError={() => setFailed(true)}
      className="admin-product-thumbnail"
    />
  ) : (
    <Box
      sx={{
        width: 64,
        height: 64,
        bgcolor: "#f4e9e1",
        display: "grid",
        placeItems: "center",
      }}
      aria-label="تصویر موجود نیست"
      className="admin-product-thumbnail"
    >
      <ImageOutlinedIcon aria-hidden="true" />
    </Box>
  );
}
function ProductStatus({ item }: { item: ProductItem }) {
  return (
    <span className="admin-product-statuses">
      <span
        className={`admin-product-status ${item.available ? "is-available" : "is-unavailable"}`}
      >
        <span aria-hidden="true" />
        {item.available ? "موجود" : "ناموجود"}
      </span>
      {item.promoted && (
        <span className="admin-product-status is-promoted">
          <StarBorderOutlinedIcon aria-hidden="true" /> پیشنهادی
        </span>
      )}
    </span>
  );
}
function ProductPrice({ item }: { item: ProductItem }) {
  return (
    <Box>
      {item.discountPriceRials !== null ? (
        <>
          <Typography component="del" variant="body2" color="text.secondary">
            {formatMoney(item.priceRials)}
          </Typography>
          <Typography>{formatMoney(item.discountPriceRials)}</Typography>
        </>
      ) : (
        <Typography>{formatMoney(item.priceRials)}</Typography>
      )}
    </Box>
  );
}
export function ProductList() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [promotion, setPromotion] = useState("all");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pricing, setPricing] = useState<ProductItem | null>(null);
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [archiving, setArchiving] = useState<ProductItem | null>(null);
  const [busy, setBusy] = useState(false);
  function refresh() {
    setLoading(true);
    setError("");
    setVersion((value) => value + 1);
  }
  function change(q: string, a: string, p: string, next: number) {
    setLoading(true);
    setError("");
    setQuery(q);
    setAvailability(a);
    setPromotion(p);
    setPage(next);
    if (q === query && a === availability && p === promotion && next === page)
      setVersion((value) => value + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: query,
      availability,
      promotion,
      page: String(page),
    });
    fetch(`/api/admin/products?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: ProductPage) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("دریافت محصولات ممکن نشد.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, availability, promotion, page, version]);
  async function post(body: object) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return response.ok
        ? { ok: true, data }
        : { ok: false, message: data.error || "درخواست انجام نشد." };
    } catch {
      return { ok: false, message: "ارتباط برقرار نشد. دوباره تلاش کنید." };
    } finally {
      setBusy(false);
    }
  }
  function openPrice(item: ProductItem) {
    setPricing(item);
    setPrice(formatPersianGroupedInput(String(rialsToTomans(item.priceRials))));
    setDiscount(
      item.discountPriceRials === null
        ? ""
        : formatPersianGroupedInput(
            String(rialsToTomans(item.discountPriceRials)),
          ),
    );
    setDialogError("");
  }
  async function savePrice(event: React.FormEvent) {
    event.preventDefault();
    if (!pricing) return;
    try {
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
      const response = await post({
        action: "price",
        id: pricing.id,
        revision: pricing.revision,
        priceRials,
        discountPriceRials,
      });
      if (!response.ok) {
        setDialogError(response.message);
        return;
      }
      setPricing(null);
      refresh();
    } catch (cause) {
      setDialogError(
        cause instanceof RangeError ? cause.message : "ذخیره قیمت ممکن نشد.",
      );
    }
  }
  async function archive() {
    if (!archiving) return;
    const response = await post({
      action: "archive",
      id: archiving.id,
      revision: archiving.revision,
    });
    if (!response.ok) {
      setDialogError(response.message);
      return;
    }
    setArchiving(null);
    if (page > 1 && result?.items.length === 1)
      change(query, availability, promotion, page - 1);
    else refresh();
  }
  function actions(item: ProductItem) {
    return (
      <Box
        className="admin-product-actions"
        sx={{ display: "flex", flexWrap: "wrap" }}
      >
        <Button
          component={Link}
          startIcon={<EditOutlinedIcon />}
          href={`/admin/products/${item.id}/edit`}
          aria-label={`ویرایش ${item.title}`}
        >
          ویرایش
        </Button>
        <Button
          onClick={() => openPrice(item)}
          startIcon={<SellOutlinedIcon />}
          aria-label={`ویرایش قیمت ${item.title}`}
        >
          قیمت
        </Button>
        <Button
          onClick={() => {
            setDialogError("");
            setArchiving(item);
          }}
          startIcon={<ArchiveOutlinedIcon />}
          aria-label={`بایگانی ${item.title}`}
        >
          بایگانی
        </Button>
      </Box>
    );
  }
  return (
    <Box className="admin-products-page">
      <Box className="admin-products-heading">
        <div className="admin-products-title">
          <span className="admin-products-heading-icon">
            <Inventory2OutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <Typography component="h1" variant="h5">
              محصولات
            </Typography>
            <p>مدیریت محصولات و موجودی فروشگاه</p>
          </div>
        </div>
        <Button
          component={Link}
          href="/admin/products/new"
          variant="contained"
          size="small"
          startIcon={<AddOutlinedIcon />}
        >
          افزودن محصول
        </Button>
      </Box>
      {result && (
        <div className="admin-product-stats">
          {[
            {
              label: "کل محصولات",
              count: result.counts.all,
              icon: <Inventory2OutlinedIcon />,
              style: "all",
            },
            {
              label: "موجود",
              count: result.counts.available,
              icon: <CheckCircleOutlineOutlinedIcon />,
              style: "available",
            },
            {
              label: "ناموجود",
              count: result.counts.unavailable,
              icon: <RemoveShoppingCartOutlinedIcon />,
              style: "unavailable",
            },
            {
              label: "پیشنهادی",
              count: result.counts.promoted,
              icon: <StarBorderOutlinedIcon />,
              style: "promoted",
            },
          ].map((stat) => (
            <div className="admin-product-stat" key={stat.style}>
              <span
                className={`admin-product-stat-icon is-${stat.style}`}
                aria-hidden="true"
              >
                {stat.icon}
              </span>
              <div>
                <span>{stat.label}</span>
                <strong>
                  {new Intl.NumberFormat("fa-IR").format(stat.count)}
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="admin-products-panel">
        <div className="admin-products-panel-title">
          <span>
            <Inventory2OutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>فهرست محصولات</h2>
            <p>جست‌وجو و مدیریت محصولات فروشگاه</p>
          </div>
        </div>
        <Box
          component="form"
          className="admin-products-filters"
          onSubmit={(event) => {
            event.preventDefault();
            change(draft, availability, promotion, 1);
          }}
          sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}
        >
          <TextField
            label="جست‌وجوی محصول"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            slotProps={{
              htmlInput: { maxLength: 80 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ maxWidth: 260 }}
          />
          <Button type="submit" variant="outlined" startIcon={<SearchIcon />}>
            جست‌وجو
          </Button>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="product-availability-label">موجودی</InputLabel>
            <Select
              labelId="product-availability-label"
              label="موجودی"
              value={availability}
              onChange={(event) =>
                change(query, event.target.value, promotion, 1)
              }
            >
              <MenuItem value="all">همه</MenuItem>
              <MenuItem value="available">موجود</MenuItem>
              <MenuItem value="unavailable">ناموجود</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="product-promotion-label">پیشنهادی</InputLabel>
            <Select
              labelId="product-promotion-label"
              label="پیشنهادی"
              value={promotion}
              onChange={(event) =>
                change(query, availability, event.target.value, 1)
              }
            >
              <MenuItem value="all">همه</MenuItem>
              <MenuItem value="promoted">پیشنهادی</MenuItem>
              <MenuItem value="not-promoted">عادی</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<FilterAltOffOutlinedIcon />}
            onClick={() => {
              setDraft("");
              change("", "all", "all", 1);
            }}
          >
            پاک‌کردن
          </Button>
        </Box>
        {loading ? (
          <Typography role="status">در حال دریافت محصولات…</Typography>
        ) : error ? (
          <Alert
            severity="error"
            action={<Button onClick={refresh}>تلاش دوباره</Button>}
          >
            {error}
          </Alert>
        ) : !result?.items.length ? (
          <Typography className="admin-products-empty">
            {query || availability !== "all" || promotion !== "all"
              ? "محصولی با این فیلتر پیدا نشد."
              : "هنوز محصولی ثبت نشده است."}
          </Typography>
        ) : (
          <>
            <TableContainer
              component={Box}
              role="region"
              aria-label="جدول محصولات؛ قابل پیمایش افقی"
              className="admin-products-table"
              tabIndex={0}
              sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>محصول</TableCell>
                    <TableCell>دسته‌بندی</TableCell>
                    <TableCell>قیمت</TableCell>
                    <TableCell>وضعیت</TableCell>
                    <TableCell>تاریخ ایجاد</TableCell>
                    <TableCell>عملیات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Thumbnail item={item} />
                          <Typography>{item.title}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {item.category?.name ?? "دسته‌بندی ناموجود"}
                      </TableCell>
                      <TableCell>
                        <ProductPrice item={item} />
                      </TableCell>
                      <TableCell>
                        <ProductStatus item={item} />
                      </TableCell>
                      <TableCell>
                        {formatTehranJalali(item.createdAt)}
                      </TableCell>
                      <TableCell>{actions(item)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box
              className="admin-products-mobile"
              sx={{ display: { xs: "grid", md: "none" }, gap: 2 }}
            >
              {result.items.map((item) => (
                <Box
                  key={item.id}
                  component="article"
                  className="admin-product-mobile-card"
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Thumbnail item={item} />
                    <Typography component="h2" variant="h6">
                      {item.title}
                    </Typography>
                  </Box>
                  <Typography>
                    {item.category?.name ?? "دسته‌بندی ناموجود"}
                  </Typography>
                  <ProductPrice item={item} />
                  <ProductStatus item={item} />
                  <Typography variant="body2">
                    {formatTehranJalali(item.createdAt)}
                  </Typography>
                  {actions(item)}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 2 }}>
              <Button
                disabled={page <= 1}
                onClick={() => change(query, availability, promotion, page - 1)}
              >
                صفحه قبل
              </Button>
              <Typography>
                صفحه {new Intl.NumberFormat("fa-IR").format(page)} ·{" "}
                {new Intl.NumberFormat("fa-IR").format(result.total)} نتیجه
              </Typography>
              <Button
                disabled={page * result.limit >= result.total}
                onClick={() => change(query, availability, promotion, page + 1)}
              >
                صفحه بعد
              </Button>
            </Box>
          </>
        )}
      </div>
      <Dialog
        open={Boolean(pricing)}
        onClose={() => {
          if (!busy) setPricing(null);
        }}
        fullWidth
        maxWidth="xs"
        aria-labelledby="product-price-title"
      >
        <DialogTitle id="product-price-title">
          ویرایش قیمت {pricing?.title}
        </DialogTitle>
        <Box component="form" onSubmit={savePrice}>
          <DialogContent sx={{ display: "grid", gap: 2 }}>
            {pricing && <Thumbnail item={pricing} />}
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <PriceField
              label="قیمت اصلی (تومان)"
              value={price}
              onValueChange={setPrice}
              required
            />
            <PriceField
              label="قیمت پس از تخفیف (تومان)"
              value={discount}
              onValueChange={setDiscount}
              helperText="اختیاری؛ کمتر از قیمت اصلی"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPricing(null)} disabled={busy}>
              انصراف
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              ذخیره قیمت
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={Boolean(archiving)}
        onClose={() => {
          if (!busy) setArchiving(null);
        }}
        aria-labelledby="product-archive-title"
      >
        <DialogTitle id="product-archive-title">بایگانی محصول</DialogTitle>
        <DialogContent>
          {archiving && <Thumbnail item={archiving} />}
          {dialogError && <Alert severity="error">{dialogError}</Alert>}
          <Typography>
            «{archiving?.title}» از فهرست فعال حذف می‌شود و برای سوابق تاریخی
            باقی می‌ماند.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiving(null)} disabled={busy}>
            انصراف
          </Button>
          <Button onClick={archive} disabled={busy} color="error">
            بایگانی
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
