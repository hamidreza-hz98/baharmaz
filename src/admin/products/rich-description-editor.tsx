"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatStrikethroughIcon from "@mui/icons-material/FormatStrikethrough";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import CodeIcon from "@mui/icons-material/Code";
import DataObjectIcon from "@mui/icons-material/DataObject";
import FormatIndentIncreaseIcon from "@mui/icons-material/FormatIndentIncrease";
import FormatIndentDecreaseIcon from "@mui/icons-material/FormatIndentDecrease";
import SubscriptIcon from "@mui/icons-material/Subscript";
import SuperscriptIcon from "@mui/icons-material/Superscript";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import {
  isRichDescription,
  RICH_DESCRIPTION_PREFIX,
} from "@/shared/rich-description";

function initialContent(value: string) {
  if (isRichDescription(value))
    return value.slice(RICH_DESCRIPTION_PREFIX.length);
  return {
    type: "doc",
    content: value.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}
function normalizeColor(value: string | undefined) {
  if (!value) return "";
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(value);
  const normalized = rgb
    ? `#${rgb
        .slice(1)
        .map((part) => Number(part).toString(16).padStart(2, "0"))
        .join("")}`
    : value.toLowerCase();
  return ["#53191e", "#202020", "#315f48", "#315c84"].includes(normalized)
    ? normalized
    : "";
}
export function RichDescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const last = useRef(value);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: false, defaultProtocol: "https" },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "right",
      }),
      Highlight,
      TextStyleKit,
      TableKit,
      Subscript,
      Superscript,
    ],
    content: initialContent(value),
    editorProps: {
      attributes: {
        dir: "rtl",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "توضیحات محصول",
        class: "rich-editor-content",
      },
    },
    onUpdate: ({ editor: active }) => {
      const next = active.isEmpty
        ? ""
        : RICH_DESCRIPTION_PREFIX + active.getHTML();
      last.current = next;
      onChange(next);
    },
  });
  useEffect(() => {
    if (editor && value !== last.current) {
      editor.commands.setContent(initialContent(value), { emitUpdate: false });
      last.current = value;
    }
  }, [editor, value]);
  if (!editor)
    return (
      <Box className="rich-editor-loading">در حال آماده‌سازی ویرایشگر…</Box>
    );
  const buttons = [
    {
      label: "درشت",
      icon: <FormatBoldIcon />,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "کج",
      icon: <FormatItalicIcon />,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "زیرخط",
      icon: <FormatUnderlinedIcon />,
      active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "خط‌خورده",
      icon: <FormatStrikethroughIcon />,
      active: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "فهرست نشانه‌دار",
      icon: <FormatListBulletedIcon />,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "فهرست شماره‌دار",
      icon: <FormatListNumberedIcon />,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "نقل‌قول",
      icon: <FormatQuoteIcon />,
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "برجسته‌سازی",
      icon: <BorderColorIcon />,
      active: editor.isActive("highlight"),
      run: () => editor.chain().focus().toggleHighlight().run(),
    },
    ...(
      [
        ["راست‌چین", "right", <FormatAlignRightIcon key="right" />],
        ["وسط‌چین", "center", <FormatAlignCenterIcon key="center" />],
        ["چپ‌چین", "left", <FormatAlignLeftIcon key="left" />],
        ["تراز دوطرفه", "justify", <FormatAlignJustifyIcon key="justify" />],
      ] as const
    ).map(([label, align, icon]) => ({
      label,
      icon,
      active: editor.isActive({ textAlign: align }),
      run: () => editor.chain().focus().setTextAlign(align).run(),
    })),
    {
      label: "درج پیوند",
      icon: <LinkIcon />,
      active: editor.isActive("link"),
      run: () => {
        setLink(editor.getAttributes("link").href || "");
        setLinkError("");
        setLinkOpen(true);
      },
    },
    {
      label: "حذف پیوند",
      icon: <LinkOffIcon />,
      active: false,
      run: () =>
        editor.chain().focus().extendMarkRange("link").unsetLink().run(),
    },
    {
      label: "خط جداکننده",
      icon: <HorizontalRuleIcon />,
      active: false,
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      label: "پاک کردن قالب‌بندی",
      icon: <FormatClearIcon />,
      active: false,
      run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
    {
      label: "زیرنویس",
      icon: <SubscriptIcon />,
      active: editor.isActive("subscript"),
      run: () => editor.chain().focus().toggleSubscript().run(),
    },
    {
      label: "بالانویس",
      icon: <SuperscriptIcon />,
      active: editor.isActive("superscript"),
      run: () => editor.chain().focus().toggleSuperscript().run(),
    },
    {
      label: "کد در متن",
      icon: <CodeIcon />,
      active: editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "بلوک کد",
      icon: <DataObjectIcon />,
      active: editor.isActive("codeBlock"),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: "افزایش تورفتگی فهرست",
      icon: <FormatIndentIncreaseIcon />,
      active: false,
      disabled: !editor.can().sinkListItem("listItem"),
      run: () => editor.chain().focus().sinkListItem("listItem").run(),
    },
    {
      label: "کاهش تورفتگی فهرست",
      icon: <FormatIndentDecreaseIcon />,
      active: false,
      disabled: !editor.can().liftListItem("listItem"),
      run: () => editor.chain().focus().liftListItem("listItem").run(),
    },
    {
      label: "واگرد",
      icon: <UndoIcon />,
      active: false,
      disabled: !editor.can().undo(),
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "بازگردانی",
      icon: <RedoIcon />,
      active: false,
      disabled: !editor.can().redo(),
      run: () => editor.chain().focus().redo().run(),
    },
  ];
  function saveLink() {
    const url = link.trim();
    if (!/^(https?:\/\/|mailto:|\/(?!\/))/i.test(url)) {
      setLinkError("نشانی را با https:// یا http:// یا / آغاز کنید.");
      return;
    }
    editor!
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
    setLinkOpen(false);
  }
  return (
    <Box className="rich-editor" dir="rtl">
      <Typography component="div" className="rich-editor-label">
        توضیحات محصول
      </Typography>
      <Box
        className="rich-editor-toolbar"
        role="toolbar"
        aria-label="ابزار قالب‌بندی توضیحات"
      >
        <FormControl size="small">
          <Select
            aria-label="نوع متن"
            value={
              editor.isActive("heading", { level: 2 })
                ? "2"
                : editor.isActive("heading", { level: 3 })
                  ? "3"
                  : editor.isActive("heading", { level: 4 })
                    ? "4"
                    : "paragraph"
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "paragraph")
                editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: Number(v) as 2 | 3 | 4 })
                  .run();
            }}
          >
            <MenuItem value="paragraph">متن عادی</MenuItem>
            <MenuItem value="2">عنوان بزرگ</MenuItem>
            <MenuItem value="3">عنوان متوسط</MenuItem>
            <MenuItem value="4">عنوان کوچک</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <Select
            aria-label="اندازه متن"
            displayEmpty
            value={
              ["12px", "14px", "16px", "18px", "20px", "24px", "28px"].includes(
                editor.getAttributes("textStyle").fontSize,
              )
                ? editor.getAttributes("textStyle").fontSize
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setFontSize(v).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
          >
            <MenuItem value="">اندازه</MenuItem>
            {[12, 14, 16, 18, 20, 24, 28].map((n) => (
              <MenuItem key={n} value={`${n}px`}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <Select
            aria-label="رنگ متن"
            displayEmpty
            value={normalizeColor(editor.getAttributes("textStyle").color)}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setColor(v).run();
              else editor.chain().focus().unsetColor().run();
            }}
          >
            <MenuItem value="">رنگ</MenuItem>
            <MenuItem value="#53191e">زرشکی</MenuItem>
            <MenuItem value="#202020">تیره</MenuItem>
            <MenuItem value="#315f48">سبز</MenuItem>
            <MenuItem value="#315c84">آبی</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <Select<string>
            aria-label="ابزار جدول"
            value=""
            displayEmpty
            onChange={(event) => {
              const chain = editor.chain().focus();
              switch (event.target.value) {
                case "insert":
                  chain
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run();
                  break;
                case "row":
                  chain.addRowAfter().run();
                  break;
                case "column":
                  chain.addColumnAfter().run();
                  break;
                case "header":
                  chain.toggleHeaderRow().run();
                  break;
                case "merge":
                  chain.mergeCells().run();
                  break;
                case "split":
                  chain.splitCell().run();
                  break;
                case "deleteRow":
                  chain.deleteRow().run();
                  break;
                case "deleteColumn":
                  chain.deleteColumn().run();
                  break;
                case "deleteTable":
                  chain.deleteTable().run();
                  break;
              }
            }}
          >
            <MenuItem value="" disabled>
              جدول
            </MenuItem>
            <MenuItem value="insert" disabled={editor.isActive("table")}>
              درج جدول
            </MenuItem>
            <MenuItem value="row" disabled={!editor.isActive("table")}>
              افزودن ردیف
            </MenuItem>
            <MenuItem value="column" disabled={!editor.isActive("table")}>
              افزودن ستون
            </MenuItem>
            <MenuItem value="header" disabled={!editor.isActive("table")}>
              ردیف عنوان
            </MenuItem>
            <MenuItem value="merge" disabled={!editor.can().mergeCells()}>
              ادغام سلول‌ها
            </MenuItem>
            <MenuItem value="split" disabled={!editor.can().splitCell()}>
              تفکیک سلول
            </MenuItem>
            <MenuItem value="deleteRow" disabled={!editor.isActive("table")}>
              حذف ردیف
            </MenuItem>
            <MenuItem value="deleteColumn" disabled={!editor.isActive("table")}>
              حذف ستون
            </MenuItem>
            <MenuItem value="deleteTable" disabled={!editor.isActive("table")}>
              حذف جدول
            </MenuItem>
          </Select>
        </FormControl>
        {buttons.map(({ label, icon, active, disabled, run }, index) => (
          <Tooltip title={label} key={label}>
            <span>
              <IconButton
                type="button"
                size="small"
                aria-label={label}
                aria-pressed={
                  index < 12 ||
                  ["زیرنویس", "بالانویس", "کد در متن", "بلوک کد"].includes(
                    label,
                  )
                    ? active
                    : undefined
                }
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={run}
                className={active ? "is-active" : undefined}
              >
                {icon}
              </IconButton>
            </span>
          </Tooltip>
        ))}
      </Box>
      <EditorContent editor={editor} />
      <Box className="rich-editor-footer">
        <span>از نوار ابزار برای قالب‌بندی متن استفاده کنید.</span>
        <span>
          حجم متن و قالب: {value.length.toLocaleString("fa-IR")} / ۱۰٬۰۰۰
        </span>
      </Box>
      {value.length > 10000 && (
        <Typography color="error" role="alert" variant="body2">
          حجم توضیحات بیش از حد مجاز است؛ بخشی از متن یا قالب‌بندی را کم کنید.
        </Typography>
      )}
      <Dialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>درج پیوند</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="نشانی پیوند"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            error={Boolean(linkError)}
            helperText={linkError || "نشانی کامل یا مسیر داخلی فروشگاه"}
            sx={{ mt: 1 }}
            dir="ltr"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>انصراف</Button>
          <Button variant="contained" onClick={saveLink}>
            ثبت پیوند
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
