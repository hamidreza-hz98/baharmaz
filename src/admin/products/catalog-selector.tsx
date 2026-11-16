"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Radio,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { AdminThumbnail } from "@/admin/media/admin-thumbnail";
type Entry = {
  id: string;
  name: string;
  parentName?: string | null;
  imageId?: string | null;
  iconId?: string | null;
};
export function CatalogSelector({
  kind,
  selected,
  onChange,
}: {
  kind: "categories" | "ingredients";
  selected: Entry[];
  onChange: (entries: Entry[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const singular = kind === "categories" ? "دسته‌بندی" : "ماده اولیه";
  function change(nextQuery: string, nextPage: number) {
    setLoading(true);
    setError(false);
    setQuery(nextQuery);
    setPage(nextPage);
    if (query === nextQuery && page === nextPage) setVersion((x) => x + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, page: String(page) });
    fetch(`/api/admin/catalog/${kind}?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [kind, page, query, version]);
  return (
    <Box
      component="fieldset"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        minWidth: 0,
      }}
    >
      <Typography component="legend">
        {kind === "categories" ? "انتخاب دسته‌بندی" : "انتخاب مواد اولیه"}
      </Typography>
      <Typography variant="body2">
        انتخاب‌شده: {selected.length ? "" : "هیچ‌کدام"}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, my: 1 }}>
        {selected.map((entry) => (
          <Box
            key={entry.id}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <AdminThumbnail
              id={entry.imageId ?? entry.iconId}
              name={entry.name}
              size={36}
            />
            <Typography variant="body2">{entry.name}</Typography>
          </Box>
        ))}
      </Box>
      <Box
        className="catalog-search-controls"
        sx={{ display: "flex", gap: 1, flexWrap: "wrap", my: 1 }}
      >
        <TextField
          size="small"
          label={`جست‌وجوی ${singular}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 80 } }}
          sx={{ maxWidth: 300 }}
        />
        <Button type="button" size="small" onClick={() => change(draft, 1)}>
          جست‌وجو
        </Button>
        <Button
          type="button"
          size="small"
          onClick={() => {
            setDraft("");
            change("", 1);
          }}
        >
          پاک‌کردن
        </Button>
      </Box>
      {loading ? (
        <Typography role="status">در حال دریافت…</Typography>
      ) : error ? (
        <Alert
          severity="error"
          action={
            <Button onClick={() => change(query, page)}>تلاش دوباره</Button>
          }
        >
          دریافت موارد ممکن نشد.
        </Alert>
      ) : items.length ? (
        <Box
          role="group"
          aria-label={kind === "categories" ? "دسته‌بندی‌ها" : "مواد اولیه"}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
              xl: "repeat(5, minmax(0, 1fr))",
            },
            gap: 1,
          }}
        >
          {items.map((item) => {
            const checked = selected.some((entry) => entry.id === item.id);
            return (
              <FormControlLabel
                key={item.id}
                sx={{
                  width: "100%",
                  minWidth: 0,
                  minHeight: 64,
                  m: 0,
                  p: 0.75,
                  border: "1px solid",
                  borderColor: checked ? "primary.main" : "divider",
                  borderRadius: 1.5,
                  bgcolor: checked ? "action.selected" : "background.paper",
                  transition:
                    "border-color 140ms ease, background-color 140ms ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: checked ? "action.selected" : "action.hover",
                  },
                  "& .MuiFormControlLabel-label": {
                    flex: 1,
                    minWidth: 0,
                  },
                  "& .MuiRadio-root, & .MuiCheckbox-root": { p: 0.5 },
                }}
                control={
                  kind === "categories" ? (
                    <Radio
                      name="product-category"
                      checked={checked}
                      onChange={() => onChange([item])}
                    />
                  ) : (
                    <Checkbox
                      checked={checked}
                      onChange={(event) => {
                        onChange(
                          event.target.checked
                            ? [...selected, item]
                            : selected.filter((entry) => entry.id !== item.id),
                        );
                      }}
                    />
                  )
                }
                label={
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      minWidth: 0,
                      width: "100%",
                    }}
                  >
                    <AdminThumbnail
                      id={item.imageId ?? item.iconId}
                      name={item.name}
                      size={48}
                    />
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {item.parentName
                        ? `${item.parentName} / ${item.name}`
                        : item.name}
                    </Typography>
                  </Box>
                }
              />
            );
          })}
        </Box>
      ) : (
        <Typography>موردی پیدا نشد.</Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => change(query, page - 1)}
        >
          صفحه قبل
        </Button>
        <Typography>
          صفحه {new Intl.NumberFormat("fa-IR").format(page)}
        </Typography>
        <Button
          type="button"
          disabled={loading || page * 24 >= total}
          onClick={() => change(query, page + 1)}
        >
          صفحه بعد
        </Button>
      </Box>
    </Box>
  );
}
