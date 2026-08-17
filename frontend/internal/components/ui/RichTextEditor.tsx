"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";

export interface RichTextEditorHandle {
  insertContent: (html: string) => void;
  /** Replace all content, then place the caret where the sentinel was. */
  setContentWithCaret: (html: string, sentinel: string) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** If provided, renders a chip bar so users can click to insert each variable at the cursor. */
  variables?: string[];
  minHeight?: number;
  disabled?: boolean;
  onFocus?: () => void;
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
      className="foi-editor__button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor({
  value,
  onChange,
  placeholder,
  variables,
  minHeight = 160,
  disabled = false,
  onFocus,
}, ref) {
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
    onFocus() {
      onFocus?.();
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

  useImperativeHandle(ref, () => ({
    insertContent: (html: string) => {
      editor?.chain().focus().insertContent(html).run();
    },
    setContentWithCaret: (html: string, sentinel: string) => {
      if (!editor) return;
      editor.commands.setContent(html, { emitUpdate: true });

      // Locate the sentinel in the document, delete it, and leave the caret there.
      // StarterKit strips unknown attributes, so a text token is the only marker
      // that survives setContent.
      let found: { from: number; to: number } | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (found || !node.isText || !node.text) return true;
        const index = node.text.indexOf(sentinel);
        if (index !== -1) {
          found = { from: pos + index, to: pos + index + sentinel.length };
          return false;
        }
        return true;
      });

      if (found) {
        editor.chain().focus().deleteRange(found).run();
      } else {
        editor.chain().focus("end").run();
      }
    },
  }));

  if (!editor) return null;

  return (
    <div className="foi-editor">
      {/* Toolbar */}
      {!disabled && (
        <div className="foi-editor__toolbar">
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

          <span className="foi-editor__divider" aria-hidden="true" />

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

          <span className="foi-editor__divider" aria-hidden="true" />

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

          <span className="foi-editor__divider" aria-hidden="true" />

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
        <div className="foi-editor__toolbar foi-editor__toolbar--secondary">
          <span className="govuk-hint govuk-!-margin-bottom-0">
            Insert:
          </span>
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              title={`Insert ${v}`}
              onClick={() => editor.chain().focus().insertContent(v).run()}
              className="foi-editor__chip foi-mono"
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="foi-editor__content"
        style={{ minHeight }}
      />
    </div>
  );
});

export default RichTextEditor;
