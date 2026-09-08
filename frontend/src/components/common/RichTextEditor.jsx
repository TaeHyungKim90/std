import './richTextEditor.css';

import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useState } from 'react';

const FONT_FAMILIES = [
	{ label: '기본', value: '' },
	{ label: 'Arial', value: 'Arial, sans-serif' },
	{ label: 'Georgia', value: 'Georgia, serif' },
	{ label: '맑은 고딕', value: '"Malgun Gothic", sans-serif' },
	{ label: '나눔고딕', value: '"Nanum Gothic", sans-serif' },
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

const FontSize = Extension.create({
	name: 'fontSize',
	addOptions() {
		return { types: ['textStyle'] };
	},
	addGlobalAttributes() {
		return [
			{
				types: this.options.types,
				attributes: {
					fontSize: {
						default: null,
						parseHTML: (element) => element.style.fontSize || null,
						renderHTML: (attributes) => {
							if (!attributes.fontSize) return {};
							return { style: `font-size: ${attributes.fontSize}` };
						},
					},
				},
			},
		];
	},
	addCommands() {
		return {
			setFontSize:
				(fontSize) =>
				({ chain }) =>
					chain().setMark('textStyle', { fontSize }).run(),
			unsetFontSize:
				() =>
				({ chain }) =>
					chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
		};
	},
});

function ToolbarButton({ active, disabled, onClick, title, children }) {
	return (
		<button
			type="button"
			className={`rte-btn${active ? ' is-active' : ''}`}
			title={title}
			aria-label={title}
			disabled={disabled}
			onMouseDown={(e) => e.preventDefault()}
			onClick={onClick}
		>
			{children}
		</button>
	);
}

function ToolbarDivider() {
	return <span className="rte-divider" aria-hidden="true" />;
}

const PRESET_FEATURES = {
	compact: {
		history: false,
		font: false,
		heading: false,
		basic: true,
		color: true,
		highlight: false,
		script: false,
		clear: false,
		align: false,
		indent: false,
		list: true,
		hr: false,
		table: false,
		link: true,
		image: false,
		video: false,
		codeView: false,
		fullscreen: false,
	},
	todo: {
		history: true,
		font: true,
		heading: true,
		basic: true,
		color: true,
		highlight: false,
		script: false,
		clear: false,
		align: false,
		indent: false,
		list: true,
		hr: false,
		table: false,
		link: true,
		image: false,
		video: false,
		codeView: false,
		fullscreen: false,
	},
	template: {
		history: false,
		font: true,
		heading: false,
		basic: true,
		color: true,
		highlight: true,
		script: false,
		clear: false,
		align: true,
		indent: false,
		list: true,
		hr: false,
		table: true,
		link: true,
		image: false,
		video: false,
		codeView: false,
		fullscreen: false,
	},
	message: {
		history: true,
		font: true,
		heading: true,
		basic: true,
		color: true,
		highlight: true,
		script: true,
		clear: true,
		align: true,
		indent: true,
		list: true,
		hr: true,
		table: true,
		link: true,
		image: true,
		video: false,
		codeView: false,
		fullscreen: false,
	},
	full: {
		history: true,
		font: true,
		heading: true,
		basic: true,
		color: true,
		highlight: true,
		script: true,
		clear: true,
		align: true,
		indent: true,
		list: true,
		hr: true,
		table: true,
		link: true,
		image: true,
		video: true,
		codeView: true,
		fullscreen: true,
	},
};

/**
 * SunEditor 대체용 TipTap 에디터.
 * @param {'compact'|'todo'|'template'|'message'|'full'} preset
 */
const RichTextEditor = ({
	content = '',
	onChange,
	height = '250px',
	preset = 'message',
	editable = true,
}) => {
	const features = PRESET_FEATURES[preset] || PRESET_FEATURES.message;
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showCode, setShowCode] = useState(false);
	const [codeValue, setCodeValue] = useState('');

	const extensions = useMemo(
		() => [
			StarterKit.configure({
				heading: features.heading ? { levels: [1, 2, 3] } : false,
				horizontalRule: features.hr ? {} : false,
				bulletList: features.list ? {} : false,
				orderedList: features.list ? {} : false,
			}),
			Underline,
			TextStyle,
			Color,
			FontFamily,
			FontSize,
			Highlight.configure({ multicolor: true }),
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
			Link.configure({
				openOnClick: false,
				autolink: true,
				HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
			}),
			...(features.script ? [Subscript, Superscript] : []),
			...(features.table
				? [
						Table.configure({ resizable: false }),
						TableRow,
						TableHeader,
						TableCell,
					]
				: []),
			...(features.image ? [Image.configure({ allowBase64: true })] : []),
			...(features.video
				? [Youtube.configure({ controls: true, nocookie: true, width: 640, height: 360 })]
				: []),
		],
		[features],
	);

	const editor = useEditor({
		extensions,
		content: content || '',
		editable,
		editorProps: {
			attributes: {
				class: 'rte-prose',
			},
		},
		onUpdate: ({ editor: ed }) => {
			onChange?.(ed.getHTML());
		},
	});

	useEffect(() => {
		if (!editor) return;
		editor.setEditable(editable);
	}, [editor, editable]);

	useEffect(() => {
		if (!editor || showCode) return;
		const next = content || '';
		if (next === editor.getHTML()) return;
		editor.commands.setContent(next, { emitUpdate: false });
	}, [content, editor, showCode]);

	if (!editor) return null;

	const askUrl = (label) => {
		const value = window.prompt(label);
		return value?.trim() || '';
	};

	const setLink = () => {
		const previous = editor.getAttributes('link').href || '';
		const url = window.prompt('링크 URL', previous);
		if (url === null) return;
		if (!url.trim()) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
	};

	const insertImage = () => {
		const url = askUrl('이미지 URL');
		if (!url) return;
		editor.chain().focus().setImage({ src: url }).run();
	};

	const insertVideo = () => {
		const url = askUrl('YouTube URL');
		if (!url) return;
		editor.commands.setYoutubeVideo({ src: url });
	};

	const insertTable = () => {
		editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
	};

	const toggleCodeView = () => {
		if (!showCode) {
			setCodeValue(editor.getHTML());
			setShowCode(true);
			return;
		}
		editor.commands.setContent(codeValue || '', { emitUpdate: true });
		onChange?.(editor.getHTML());
		setShowCode(false);
	};

	return (
		<div className={`rte-root${isFullscreen ? ' is-fullscreen' : ''}`}>
			<div className="rte-toolbar" role="toolbar">
				{features.history && (
					<>
						<ToolbarButton title="실행 취소" onClick={() => editor.chain().focus().undo().run()}>
							↶
						</ToolbarButton>
						<ToolbarButton title="다시 실행" onClick={() => editor.chain().focus().redo().run()}>
							↷
						</ToolbarButton>
						<ToolbarDivider />
					</>
				)}

				{features.font && (
					<>
						<select
							className="rte-select"
							title="글꼴"
							value={editor.getAttributes('textStyle').fontFamily || ''}
							onChange={(e) => {
								const value = e.target.value;
								if (!value) editor.chain().focus().unsetFontFamily().run();
								else editor.chain().focus().setFontFamily(value).run();
							}}
						>
							{FONT_FAMILIES.map((f) => (
								<option key={f.label} value={f.value}>
									{f.label}
								</option>
							))}
						</select>
						<select
							className="rte-select"
							title="글자 크기"
							value={editor.getAttributes('textStyle').fontSize || ''}
							onChange={(e) => {
								const value = e.target.value;
								if (!value) editor.chain().focus().unsetFontSize().run();
								else editor.chain().focus().setFontSize(value).run();
							}}
						>
							<option value="">크기</option>
							{FONT_SIZES.map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
					</>
				)}

				{features.heading && (
					<select
						className="rte-select"
						title="문단 형식"
						value={
							editor.isActive('heading', { level: 1 })
								? 'h1'
								: editor.isActive('heading', { level: 2 })
									? 'h2'
									: editor.isActive('heading', { level: 3 })
										? 'h3'
										: 'p'
						}
						onChange={(e) => {
							const value = e.target.value;
							if (value === 'p') editor.chain().focus().setParagraph().run();
							else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) }).run();
						}}
					>
						<option value="p">본문</option>
						<option value="h1">제목 1</option>
						<option value="h2">제목 2</option>
						<option value="h3">제목 3</option>
					</select>
				)}

				{features.basic && (
					<>
						<ToolbarButton
							title="굵게"
							active={editor.isActive('bold')}
							onClick={() => editor.chain().focus().toggleBold().run()}
						>
							B
						</ToolbarButton>
						<ToolbarButton
							title="밑줄"
							active={editor.isActive('underline')}
							onClick={() => editor.chain().focus().toggleUnderline().run()}
						>
							U
						</ToolbarButton>
						<ToolbarButton
							title="기울임"
							active={editor.isActive('italic')}
							onClick={() => editor.chain().focus().toggleItalic().run()}
						>
							I
						</ToolbarButton>
						{(features.script || features.clear) && (
							<ToolbarButton
								title="취소선"
								active={editor.isActive('strike')}
								onClick={() => editor.chain().focus().toggleStrike().run()}
							>
								S
							</ToolbarButton>
						)}
					</>
				)}

				{features.script && (
					<>
						<ToolbarButton
							title="아래 첨자"
							active={editor.isActive('subscript')}
							onClick={() => editor.chain().focus().toggleSubscript().run()}
						>
							x₂
						</ToolbarButton>
						<ToolbarButton
							title="위 첨자"
							active={editor.isActive('superscript')}
							onClick={() => editor.chain().focus().toggleSuperscript().run()}
						>
							x²
						</ToolbarButton>
					</>
				)}

				{features.color && (
					<label className="rte-color" title="글자색">
						<span>A</span>
						<input
							type="color"
							value={editor.getAttributes('textStyle').color || '#141414'}
							onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
						/>
					</label>
				)}

				{features.highlight && (
					<label className="rte-color" title="형광펜">
						<span>H</span>
						<input
							type="color"
							value={editor.getAttributes('highlight').color || '#fff59d'}
							onChange={(e) =>
								editor.chain().focus().toggleHighlight({ color: e.target.value }).run()
							}
						/>
					</label>
				)}

				{features.clear && (
					<ToolbarButton title="서식 지우기" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
						Tx
					</ToolbarButton>
				)}

				{(features.align || features.indent || features.list || features.hr) && <ToolbarDivider />}

				{features.align && (
					<>
						<ToolbarButton
							title="왼쪽 정렬"
							active={editor.isActive({ textAlign: 'left' })}
							onClick={() => editor.chain().focus().setTextAlign('left').run()}
						>
							≣
						</ToolbarButton>
						<ToolbarButton
							title="가운데 정렬"
							active={editor.isActive({ textAlign: 'center' })}
							onClick={() => editor.chain().focus().setTextAlign('center').run()}
						>
							≡
						</ToolbarButton>
						<ToolbarButton
							title="오른쪽 정렬"
							active={editor.isActive({ textAlign: 'right' })}
							onClick={() => editor.chain().focus().setTextAlign('right').run()}
						>
							☰
						</ToolbarButton>
					</>
				)}

				{features.indent && (
					<>
						<ToolbarButton title="내어쓰기" onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
							⇤
						</ToolbarButton>
						<ToolbarButton title="들여쓰기" onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
							⇥
						</ToolbarButton>
					</>
				)}

				{features.list && (
					<>
						<ToolbarButton
							title="글머리 기호"
							active={editor.isActive('bulletList')}
							onClick={() => editor.chain().focus().toggleBulletList().run()}
						>
							•
						</ToolbarButton>
						<ToolbarButton
							title="번호 목록"
							active={editor.isActive('orderedList')}
							onClick={() => editor.chain().focus().toggleOrderedList().run()}
						>
							1.
						</ToolbarButton>
					</>
				)}

				{features.hr && (
					<ToolbarButton title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
						―
					</ToolbarButton>
				)}

				{(features.table || features.link || features.image || features.video) && <ToolbarDivider />}

				{features.table && (
					<ToolbarButton title="표 삽입" onClick={insertTable}>
						▦
					</ToolbarButton>
				)}
				{features.link && (
					<ToolbarButton title="링크" active={editor.isActive('link')} onClick={setLink}>
						Link
					</ToolbarButton>
				)}
				{features.image && (
					<ToolbarButton title="이미지" onClick={insertImage}>
						Img
					</ToolbarButton>
				)}
				{features.video && (
					<ToolbarButton title="영상" onClick={insertVideo}>
						YT
					</ToolbarButton>
				)}

				{(features.codeView || features.fullscreen) && <ToolbarDivider />}

				{features.codeView && (
					<ToolbarButton title="HTML 보기" active={showCode} onClick={toggleCodeView}>
						&lt;/&gt;
					</ToolbarButton>
				)}
				{features.fullscreen && (
					<ToolbarButton title="전체 화면" active={isFullscreen} onClick={() => setIsFullscreen((v) => !v)}>
						⛶
					</ToolbarButton>
				)}
			</div>

			{showCode ? (
				<textarea
					className="rte-code"
					style={{ minHeight: height }}
					value={codeValue}
					onChange={(e) => {
						setCodeValue(e.target.value);
						onChange?.(e.target.value);
					}}
				/>
			) : (
				<EditorContent editor={editor} style={{ minHeight: height }} className="rte-content" />
			)}
		</div>
	);
};

export default RichTextEditor;
