
import React, { useRef, useEffect } from 'react';
import { Undo, Redo, Type, Bold, Italic, Underline, AlignLeft, List, ListOrdered, Indent, Outdent, Quote, Paperclip, Link, Strikethrough } from 'lucide-react';

interface MessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onAttach?: (file: File) => void;
}

export const MessageEditor: React.FC<MessageEditorProps> = ({ value, onChange, error, onAttach }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const exec = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="w-full space-y-2 mt-4 bg-gray-50 rounded-lg p-1">
      <div className={`rounded-lg overflow-hidden bg-gray-50 transition-colors pt-12 relative ${
        error ? 'border border-red-500' : 'border border-gray-200 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent'
      }`}>
        
        {/* Editor Toolbar matching mockup (floating pill) */}
        <div className="absolute top-2 left-2 right-2 flex items-center bg-white rounded-full px-4 py-1.5 shadow-sm border border-gray-100 overflow-x-auto text-gray-500 z-10 space-x-1">
          <button type="button" onClick={() => exec('undo')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Undo className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec('redo')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Redo className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-gray-200 mx-2 shrink-0"></div>
          
          <button type="button" className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex items-center">
            <Type className="w-4 h-4" />
            <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className="w-px h-5 bg-gray-200 mx-2 shrink-0"></div>
          
          <button type="button" onClick={() => exec('bold')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Bold className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec('italic')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Italic className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec('underline')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Underline className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-gray-200 mx-2 shrink-0"></div>
          
          <button type="button" onClick={() => exec('justifyLeft')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex items-center">
            <AlignLeft className="w-4 h-4" />
            <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className="w-px h-5 bg-gray-200 mx-2 shrink-0"></div>
          
          <button type="button" onClick={() => exec('insertOrderedList')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><ListOrdered className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec('insertUnorderedList')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><List className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec('outdent')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Outdent className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec('indent')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Indent className="w-4 h-4" /></button>
          <button type="button" onClick={() => exec('formatBlock', 'BLOCKQUOTE')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Quote className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-gray-200 mx-2 shrink-0"></div>
          
          <div className="relative">
            <label className="p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer flex items-center justify-center text-gray-500">
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                className="hidden"
                accept=".csv,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && onAttach) {
                    onAttach(f);
                  }
                }}
              />
            </label>
          </div>
          
          <button type="button" onClick={() => exec('strikeThrough')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><Strikethrough className="w-4 h-4" /></button>
        </div>

        {/* Content Editable */}
        <div className="relative">
          {!value && (
            <div className="absolute top-4 left-4 text-sm text-gray-400 pointer-events-none">
              Type Your Reply...
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            onInput={(e) => onChange(e.currentTarget.innerHTML)}
            onBlur={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
            className="w-full min-h-[250px] p-4 text-sm bg-transparent resize-y focus:outline-none text-gray-900"
            style={{ minHeight: '250px' }}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};
