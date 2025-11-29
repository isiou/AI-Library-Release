import React, { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "./MarkdownRenderer.css";

const MarkdownRenderer = ({ content, className = "" }) => {
  const renderedHTML = useMemo(() => {
    if (!content) return "";

    marked.setOptions({
      highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.error("代码高亮失败:", err);
          }
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true,
      tables: true,
      sanitize: false,
      smartLists: true,
      smartypants: true,
    });

    try {
      const cleanContent = content.trim().replace(/\n{3,}/g, "\n\n");

      // Markdown 转换为 HTML
      let html = marked.parse(cleanContent);

      html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",
          "br",
          "strong",
          "em",
          "u",
          "s",
          "del",
          "ins",
          "ul",
          "ol",
          "li",
          "blockquote",
          "code",
          "pre",
          "a",
          "img",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "hr",
          "div",
          "span",
        ],
        ALLOWED_ATTR: [
          "href",
          "title",
          "alt",
          "src",
          "width",
          "height",
          "class",
          "id",
        ],
        ALLOW_DATA_ATTR: false,
      });

      html = html.trim().replace(/\s+$/g, "");

      return html;
    } catch (error) {
      console.error("Markdown 渲染失败\n", error);
      return `<p>${content}</p>`;
    }
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHTML }}
    />
  );
};

export default MarkdownRenderer;
