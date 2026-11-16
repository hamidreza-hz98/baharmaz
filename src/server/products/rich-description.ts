import "server-only";
import sanitizeHtml from "sanitize-html";
import {
  isRichDescription,
  RICH_DESCRIPTION_PREFIX,
} from "../../shared/rich-description.ts";

export function sanitizeRichDescription(value: string): string {
  if (!isRichDescription(value)) return value;
  const html = sanitizeHtml(value.slice(RICH_DESCRIPTION_PREFIX.length), {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "h4",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "hr",
      "a",
      "span",
      "mark",
      "code",
      "pre",
      "sub",
      "sup",
      "table",
      "tbody",
      "thead",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      span: ["style"],
      mark: ["style"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(?:left|right|center|justify)$/],
        color: [
          /^#[0-9a-fA-F]{6}$/,
          /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
        ],
        "font-size": [/^(?:12|14|16|18|20|24|28)px$/],
        "background-color": [/^#[0-9a-fA-F]{6}$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  });
  return RICH_DESCRIPTION_PREFIX + html;
}
