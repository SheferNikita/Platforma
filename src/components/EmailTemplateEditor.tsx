import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Eye, Code2
} from 'lucide-react';

interface EmailTemplateEditorProps {
  content: string;
  onChange: (html: string) => void;
  variables?: string[];
}

function isFullHtmlDocument(content: string): boolean {
  const lower = content.toLowerCase().trim();
  return lower.includes('<!doctype') || lower.includes('<html') || lower.includes('<head') || lower.includes('<body');
}

function VisualEditor({ content, onChange, variables, onShowPreview, onShowSource }: {
  content: string;
  onChange: (html: string) => void;
  variables: string[];
  onShowPreview: () => void;
  onShowSource: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[#a67c52] underline' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-stone max-w-none focus:outline-none min-h-[250px] px-4 py-3',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (editor) {
      editor.chain().focus().unsetLink().run();
    }
  }, [editor]);

  const insertVariable = (variable: string) => {
    if (editor) {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
  };

  if (!editor) return null;

  const ToolbarButton = ({ onClick, isActive = false, children, title }: { 
    onClick: () => void; isActive?: boolean; children: React.ReactNode; title: string;
  }) => (
    <button type="button" onClick={onClick} title={title}
      className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-[#a67c52] text-white' : 'text-[#3d3527] hover:bg-[#ebe8dc]'}`}>
      {children}
    </button>
  );

  return (
    <div className="border border-[#d4c9b0] rounded-xl overflow-hidden bg-white">
      <div className="flex flex-wrap gap-1 p-2 border-b border-[#d4c9b0] bg-[#f5f3ed]">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Жирный">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Курсив">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Подчеркнутый">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-[#d4c9b0] mx-1 self-center" />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="По левому краю">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="По центру">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="По правому краю">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-[#d4c9b0] mx-1 self-center" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Маркированный список">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Нумерованный список">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-[#d4c9b0] mx-1 self-center" />

        <div className="relative">
          <ToolbarButton onClick={() => setShowLinkInput(!showLinkInput)} isActive={editor.isActive('link')} title="Ссылка">
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          {showLinkInput && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-[#d4c9b0] rounded-lg shadow-lg p-2 flex gap-2">
              <input type="url" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                className="px-2 py-1 border border-[#d4c9b0] rounded text-sm w-48" onKeyDown={(e) => e.key === 'Enter' && setLink()} />
              <button type="button" onClick={setLink} className="px-2 py-1 bg-[#a67c52] text-white rounded text-sm hover:bg-[#8b6a47]">OK</button>
              {editor.isActive('link') && (
                <button type="button" onClick={removeLink} className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">✕</button>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-[#d4c9b0] mx-1 self-center" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Отменить">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Повторить">
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <button type="button" onClick={onShowPreview} title="Предпросмотр"
          className="flex items-center gap-1 px-3 py-1 text-sm text-[#3d3527] hover:bg-[#ebe8dc] rounded-lg">
          <Eye className="w-4 h-4" /><span className="hidden sm:inline">Предпросмотр</span>
        </button>
        <button type="button" onClick={onShowSource} title="HTML-код"
          className="flex items-center gap-1 px-3 py-1 text-sm text-[#3d3527] hover:bg-[#ebe8dc] rounded-lg">
          <Code2 className="w-4 h-4" /><span className="hidden sm:inline">HTML</span>
        </button>
      </div>

      <EditorContent editor={editor} 
        className="[&_.ProseMirror]:min-h-[250px] [&_.ProseMirror_p]:my-2 [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:my-4 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:my-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6" />

      {variables.length > 0 && (
        <div className="px-4 py-3 border-t border-[#d4c9b0] bg-[#f5f3ed]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#3d3527]/70">Вставить переменную:</span>
            {variables.map(v => (
              <button key={v} type="button" onClick={() => insertVariable(v)}
                className="px-2 py-1 text-xs bg-white border border-[#d4c9b0] rounded-lg hover:bg-[#ebe8dc] text-[#a67c52] font-mono">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailTemplateEditor({ content, onChange, variables = [] }: EmailTemplateEditorProps) {
  const isFullHtml = isFullHtmlDocument(content);
  const [mode, setMode] = useState<'visual' | 'source' | 'preview'>(isFullHtml ? 'source' : 'visual');

  useEffect(() => {
    if (isFullHtml && mode === 'visual') {
      setMode('source');
    }
  }, [isFullHtml, mode]);

  const previewContent = useMemo(() => {
    let html = content;
    variables.forEach(v => {
      const regex = new RegExp(`\\{\\{${v}\\}\\}`, 'g');
      const placeholder = v === 'name' ? 'Иван' : 
                         v === 'email' ? 'example@email.com' :
                         v === 'password' ? '********' :
                         v === 'role' ? 'Администратор' :
                         v === 'productName' ? 'Название продукта' :
                         v === 'amount' ? '1000 ₽' :
                         v === 'lessonTitle' ? 'Название урока' :
                         v === 'moduleName' ? 'Название модуля' :
                         v === 'platformUrl' ? 'https://platform.example.com' :
                         v === 'loginUrl' ? 'https://platform.example.com/login' :
                         v === 'lessonUrl' ? 'https://platform.example.com/lessons/1' :
                         `[${v}]`;
      html = html.replace(regex, placeholder);
    });
    return html;
  }, [content, variables]);

  if (mode === 'preview') {
    return (
      <div className="border border-[#d4c9b0] rounded-xl overflow-hidden bg-white">
        <div className="flex items-center justify-between p-2 border-b border-[#d4c9b0] bg-[#f5f3ed]">
          <span className="text-sm text-[#3d3527]/70 px-2">Предпросмотр письма</span>
          <button type="button" onClick={() => setMode(isFullHtml ? 'source' : 'visual')}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-[#a67c52] text-white rounded-lg hover:bg-[#8b6a47]">
            Редактировать
          </button>
        </div>
        <div className="p-4 bg-gray-100 min-h-[300px]">
          <iframe srcDoc={previewContent} title="Email Preview" sandbox="allow-same-origin"
            className="w-full bg-white shadow-lg mx-auto max-w-[600px] rounded-lg min-h-[400px] border-0" />
        </div>
      </div>
    );
  }

  if (mode === 'source' || isFullHtml) {
    return (
      <div className="border border-[#d4c9b0] rounded-xl overflow-hidden bg-white">
        <div className="flex items-center justify-between p-2 border-b border-[#d4c9b0] bg-[#f5f3ed]">
          <span className="text-sm text-[#3d3527]/70 px-2">HTML-код письма</span>
          {isFullHtml ? (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              Полный HTML-документ
            </span>
          ) : (
            <button type="button" onClick={() => setMode('visual')}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-[#a67c52] text-white rounded-lg hover:bg-[#8b6a47]">
              <Eye className="w-4 h-4" />Визуальный редактор
            </button>
          )}
        </div>
        <textarea value={content} onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 font-mono text-sm min-h-[300px] focus:outline-none resize-y" spellCheck={false} />
        <div className="px-4 py-3 border-t border-[#d4c9b0] bg-[#f5f3ed] flex items-center justify-between">
          {variables.length > 0 && (
            <p className="text-xs text-[#3d3527]/70">
              Переменные: {variables.map(v => `{{${v}}}`).join(', ')}
            </p>
          )}
          <button type="button" onClick={() => setMode('preview')}
            className="flex items-center gap-1 px-3 py-1 text-sm text-[#3d3527] hover:bg-[#ebe8dc] rounded-lg ml-auto">
            <Eye className="w-4 h-4" />Предпросмотр
          </button>
        </div>
      </div>
    );
  }

  return (
    <VisualEditor
      content={content}
      onChange={onChange}
      variables={variables}
      onShowPreview={() => setMode('preview')}
      onShowSource={() => setMode('source')}
    />
  );
}
