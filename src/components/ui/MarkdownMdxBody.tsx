"use client";

import { useEffect, useRef } from "react";
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertTable,
  Separator,
  diffSourcePlugin,
  codeBlockPlugin,
  CodeToggle,
  imagePlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

export type MarkdownViewMode = "rich-text" | "source";

type MarkdownMdxBodyProps = {
  value: string;
  onChange: (value: string) => void;
  mode: MarkdownViewMode;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
};

export function MarkdownMdxBody({
  value,
  onChange,
  mode,
  placeholder,
  className,
  contentClassName,
}: MarkdownMdxBodyProps) {
  const ref = useRef<MDXEditorMethods>(null);
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    ref.current?.setMarkdown(value);
    lastEmitted.current = value;
  }, [value]);

  return (
    <MDXEditor
      key={mode}
      ref={ref}
      markdown={value}
      placeholder={placeholder}
      className={className}
      contentEditableClassName={contentClassName}
      onChange={(md) => {
        lastEmitted.current = md;
        onChange(md);
      }}
      plugins={[
        headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4, 5, 6] }),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        markdownShortcutPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        // 笔记里的图片（如健身动作示意图 /exercises/*.svg）
        imagePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
        diffSourcePlugin({ viewMode: mode }),
        toolbarPlugin({
          toolbarContents: () =>
            mode === "source" ? (
              <span className="text-xs text-zinc-400 px-1">源码编辑</span>
            ) : (
              <>
                <UndoRedo />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
                <InsertTable />
              </>
            ),
        }),
      ]}
    />
  );
}
