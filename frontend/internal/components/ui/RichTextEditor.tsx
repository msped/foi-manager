"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useMemo } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** If provided, renders a chip bar so users can click to insert each variable at the cursor. */
  variables?: string[];
  minHeight?: number;
  disabled?: boolean;
}

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        padding: "2px 7px",
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        background: active ? "#1d70b8" : "transparent",
        color: active ? "#fff" : "inherit",
        border: "1px solid #b1b4b6",
        borderRadius: 2,
        cursor: "pointer",
        lineHeight: "20px",
      }}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  variables,
  minHeight = 160,
  disabled = false,
}: Props) {
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    Placeholder.configure({ placeholder: placeholder ?? "" }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: true,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. when a template is injected)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div style={{ border: "2px solid #0b0c0c", background: "#fff" }}>
      {/* Toolbar */}
      {!disabled && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: "6px 8px",
            borderBottom: "1px solid #b1b4b6",
            background: "#f3f2f1",
          }}
        >
          <ToolbarBtn
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolbarBtn>
          <ToolbarBtn
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolbarBtn>
          <ToolbarBtn
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span style={{ textDecoration: "underline" }}>U</span>
          </ToolbarBtn>

          <span style={{ width: 1, background: "#b1b4b6", margin: "0 2px" }} />

          <ToolbarBtn
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarBtn>
          <ToolbarBtn
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </ToolbarBtn>

          <span style={{ width: 1, background: "#b1b4b6", margin: "0 2px" }} />

          <ToolbarBtn
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            ≡
          </ToolbarBtn>
          <ToolbarBtn
            title="Ordered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </ToolbarBtn>

          <span style={{ width: 1, background: "#b1b4b6", margin: "0 2px" }} />

          <ToolbarBtn
            title="Blockquote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            &ldquo;
          </ToolbarBtn>
          <ToolbarBtn
            title="Clear formatting"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          >
            ✕
          </ToolbarBtn>
        </div>
      )}

      {/* Variable chip bar */}
      {!disabled && variables && variables.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: "5px 8px",
            borderBottom: "1px solid #b1b4b6",
            background: "#f8f8f7",
          }}
        >
          <span className="govuk-body-s" style={{ color: "#505a5f", alignSelf: "center", marginRight: 4 }}>
            Insert:
          </span>
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              title={`Insert ${v}`}
              onClick={() => editor.chain().focus().insertContent(v).run()}
              style={{
                fontSize: 11,
                padding: "1px 6px",
                background: "#e8f4fd",
                border: "1px solid #1d70b8",
                borderRadius: 2,
                cursor: "pointer",
                color: "#1d70b8",
                fontFamily: "monospace",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        style={{ minHeight, padding: "8px 10px", fontSize: 16, lineHeight: 1.5 }}
      />
    </div>
  );
}
