#!/usr/bin/env node
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'docs', 'notes');
const VOID_TAGS = new Set(['br', 'col', 'hr', 'img', 'input', 'link', 'meta']);
let outputJson = false;

// 这个脚本面向人和 AI agent 共同使用：
// - 人需要 `-h/--help` 快速确认用法；
// - AI 需要 `--dry-run --json` 在写文件前预判路径和覆盖风险；
// - 默认不覆盖已有目录，避免一次自动化调用破坏已有资料。
function usage() {
  console.log(`用法:
  node scripts/export-yuque-doc.mjs <语雀文档URL> [选项]
  npm run yuque:export -- <语雀文档URL> [选项]

输出:
  <out>/<name>/<file>
  <out>/<name>/<assets-dir>/

选项:
  --out <目录>          输出根目录，默认是 docs/notes。
  --name <目录名>       输出子目录名，默认使用文档标题。
  --file <文件名>       Markdown 文件名，默认是 README.md。
  --assets-dir <目录名> 图片目录名，位于文档目录下，默认是 assets。
  --force              如果输出目录已存在，先删除再重新导出。
  --dry-run            只读取元数据并打印计划，不写入文件。
  --json               输出机器可读的 JSON 结果，方便 AI agent 调用。
  --skip-images        不下载图片，Markdown 中保留远程图片链接。
  --save-source        把语雀 API JSON 和 Lake HTML 保存到 source/。
  -h, --help           显示这份帮助。

示例:
  npm run yuque:export -- 'https://www.yuque.com/user/book/doc'
  npm run yuque:export -- '<url>' --name ai-game-guide --file guide.md --assets-dir images
  npm run yuque:export -- '<url>' --dry-run --json
`);
}

function fail(message, code = 1) {
  if (outputJson) {
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(message);
  }
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    url: '',
    outDir: DEFAULT_OUT_DIR,
    name: '',
    fileName: 'README.md',
    assetsDirName: 'assets',
    force: false,
    dryRun: false,
    skipImages: false,
    saveSource: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      usage();
      process.exit(0);
    }
    if (arg === '--json') {
      args.json = true;
      outputJson = true;
      continue;
    }
    if (arg === '--force') {
      args.force = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--skip-images') {
      args.skipImages = true;
      continue;
    }
    if (arg === '--save-source') {
      args.saveSource = true;
      continue;
    }
    if (arg === '--out') {
      const value = argv[index + 1];
      if (!value) fail('用法错误：--out 需要一个目录', 2);
      args.outDir = path.resolve(ROOT, value);
      index += 1;
      continue;
    }
    if (arg === '--name') {
      const value = argv[index + 1];
      if (!value) fail('用法错误：--name 需要一个目录名', 2);
      args.name = safePathSegment(value, '--name');
      index += 1;
      continue;
    }
    if (arg === '--file') {
      const value = argv[index + 1];
      if (!value) fail('用法错误：--file 需要一个文件名', 2);
      args.fileName = safePathSegment(value, '--file');
      index += 1;
      continue;
    }
    if (arg === '--assets-dir') {
      const value = argv[index + 1];
      if (!value) fail('用法错误：--assets-dir 需要一个目录名', 2);
      args.assetsDirName = safePathSegment(value, '--assets-dir');
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) fail(`未知选项：${arg}`, 2);
    if (args.url) fail('用法错误：只能提供一个语雀文档 URL', 2);
    args.url = arg;
  }

  if (!args.url) fail('用法错误：缺少语雀文档 URL', 2);
  return args;
}

// 输出文件名、assets 目录名这类参数只能是“单个路径段”。
// 这样可以防止调用者传入 ../、a/b 之类路径，把文件写到预期目录外。
function safePathSegment(value, label) {
  if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    fail(`用法错误：${label} 必须是单个路径名，不能是路径`, 2);
  }
  if (value.trim() !== value || value.trim() === '') {
    fail(`用法错误：${label} 不能为空，也不能包含首尾空格`, 2);
  }
  return value;
}

function parseYuqueUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`无效 URL：${rawUrl}`, 2);
  }

  if (url.hostname !== 'yuque.com' && !url.hostname.endsWith('.yuque.com')) {
    fail(`不是语雀 URL：${rawUrl}`, 2);
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 3) {
    fail('用法错误：URL 应类似 https://www.yuque.com/<user>/<book>/<doc>', 2);
  }

  return {
    origin: url.origin,
    user: parts[0],
    bookSlug: parts[1],
    docSlug: parts[2],
    canonicalUrl: `${url.origin}/${parts[0]}/${parts[1]}/${parts[2]}?singleDoc`,
  };
}

// 语雀页面 HTML 里通常只包含首屏元数据，不直接包含完整正文。
// 这里先拿页面的 appData，主要是为了得到 book.id，再去公开 doc API 拉完整 Lake 正文。
async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) {
    throw new Error(`请求失败：${url}，状态码 ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) {
    throw new Error(`请求失败：${url}，状态码 ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function extractAppData(html) {
  const match = /window\.appData\s*=\s*JSON\.parse\(decodeURIComponent\("([^"]+)"\)\);/s.exec(html);
  if (!match) {
    throw new Error('无法在语雀页面 HTML 中找到 window.appData。');
  }
  return JSON.parse(decodeURIComponent(match[1]));
}

// 把文档标题变成默认目录名。这里不做拼音/翻译，避免引入额外依赖；
// 用户如果需要稳定英文目录，应显式传 --name。
function safeFileName(name, fallback) {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|#%{}^[\]`]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/[.-]+$/g, '');
  return cleaned.slice(0, 80) || fallback;
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

class TextNode {
  constructor(text) {
    this.text = text;
  }
}

class ElementNode {
  constructor(tag, attrs = {}) {
    this.tag = tag;
    this.attrs = attrs;
    this.children = [];
  }
}

// Lake 正文是接近 HTML 的富文本片段，但它包含语雀自定义的 card 节点。
// 为了不引入 DOM/HTML 解析依赖，这里只实现导出所需的最小解析器。
function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttrs(rawAttrs) {
  const attrs = {};
  const attrPattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
  for (const match of rawAttrs.matchAll(attrPattern)) {
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[match[1]] = decodeEntities(value);
  }
  return attrs;
}

function parseLake(html) {
  const root = new ElementNode('root');
  const stack = [root];
  const tokenPattern = /<!doctype[^>]*>|<!--[\s\S]*?-->|<\/?[a-zA-Z0-9:-]+(?:\s+[^<>]*?)?\s*\/?>|[^<]+/g;

  for (const match of html.matchAll(tokenPattern)) {
    const token = match[0];
    if (token.startsWith('<!doctype') || token.startsWith('<!--')) continue;

    if (!token.startsWith('<')) {
      stack.at(-1).children.push(new TextNode(decodeEntities(token)));
      continue;
    }

    const endMatch = /^<\/\s*([a-zA-Z0-9:-]+)\s*>$/.exec(token);
    if (endMatch) {
      const tag = endMatch[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    const startMatch = /^<\s*([a-zA-Z0-9:-]+)([\s\S]*?)\s*(\/?)>$/.exec(token);
    if (!startMatch) {
      throw new Error(`Could not parse Lake token: ${token.slice(0, 80)}`);
    }

    const tag = startMatch[1].toLowerCase();
    const attrs = parseAttrs(startMatch[2]);
    const node = new ElementNode(tag, attrs);
    stack.at(-1).children.push(node);

    if (!startMatch[3] && !VOID_TAGS.has(tag)) {
      stack.push(node);
    }
  }

  return root;
}

// 语雀把图片、书签、代码块等复杂块序列化在 <card value="data:..."> 中。
// 后续新增 card 类型时，优先在 renderInline/renderBlock 里显式支持，不要静默忽略。
function decodeCard(node) {
  const rawValue = node.attrs.value;
  if (!rawValue) throw new Error('Lake card 缺少 value。');
  const encoded = rawValue.startsWith('data:') ? rawValue.slice(5) : rawValue;
  return JSON.parse(decodeURIComponent(encoded));
}

function walk(node, visit) {
  if (node instanceof TextNode) return;
  visit(node);
  for (const child of node.children) walk(child, visit);
}

function collectImageCards(root) {
  const cards = [];
  walk(root, (node) => {
    if (node.tag === 'card' && node.attrs.name === 'image') cards.push(node);
  });
  return cards;
}

// 渲染策略：保留正文语义，弱化语雀私有样式。
// 目标是生成可维护 Markdown，而不是像素级复刻语雀页面。
function collapseSpaces(text) {
  return text
    .replace(/\u200b/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .join('\n')
    .trim();
}

function renderCodeBlock(node) {
  const card = decodeCard(node);
  if (typeof card.code !== 'string') throw new Error('代码块 card 缺少 code。');
  let lang = card.mode || '';
  if (lang === 'javascript' && /[\u4e00-\u9fff]/.test(card.code)) lang = 'text';
  return `\`\`\`${lang}\n${card.code.trimEnd()}\n\`\`\``;
}

// inline 渲染负责一行内的链接、加粗、图片占位和书签卡片。
// 图片在这里使用 imageMap，是为了先统一决定“下载到本地”还是“保留远程链接”。
function renderInline(node, imageMap) {
  if (node instanceof TextNode) return node.text;

  if (['col', 'colgroup', 'meta'].includes(node.tag)) return '';
  if (node.tag === 'br') return '\n';

  if (node.tag === 'card') {
    const name = node.attrs.name;
    if (name === 'image') {
      const image = imageMap.get(node);
      if (!image) throw new Error('图片 card 在渲染前没有完成注册。');
      return `![${image.alt}](${image.ref})`;
    }
    if (name === 'bookmarkInline') {
      const card = decodeCard(node);
      const detail = card.detail ?? {};
      const label = detail.title || card.text || card.src;
      const url = detail.url || card.src;
      if (!label || !url) throw new Error('书签 card 缺少标题或 URL。');
      return `[${label}](${url})`;
    }
    if (name === 'codeblock') return renderCodeBlock(node);
    throw new Error(`暂不支持的 Lake card：${name}`);
  }

  const text = node.children.map((child) => renderInline(child, imageMap)).join('');
  if (node.tag === 'strong' || node.tag === 'b') {
    const value = collapseSpaces(text);
    return value ? `**${value}**` : '';
  }
  if (node.tag === 'em' || node.tag === 'i') {
    const value = collapseSpaces(text);
    return value ? `*${value}*` : '';
  }
  if (node.tag === 'a') {
    const href = node.attrs.href;
    const label = collapseSpaces(text) || href;
    return href ? `[${label}](${href})` : label;
  }
  return text;
}

function renderChildrenAsBlocks(children, imageMap) {
  return children
    .map((child) => renderBlock(child, imageMap).trim())
    .filter(Boolean)
    .join('\n\n');
}

function renderBlockquote(node, imageMap) {
  const body = renderChildrenAsBlocks(node.children, imageMap).trim();
  if (!body) return '';
  return body
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

function renderTable(node, imageMap) {
  const rows = [];

  function collectRows(current) {
    if (current instanceof TextNode) return;
    if (current.tag === 'tr') {
      const cells = current.children
        .filter((child) => child instanceof ElementNode && ['td', 'th'].includes(child.tag))
        .map((cell) => collapseSpaces(renderBlock(cell, imageMap)).replace(/\n+/g, '<br>'));
      if (cells.length > 0) rows.push(cells);
      return;
    }
    for (const child of current.children) collectRows(child);
  }

  collectRows(node);
  if (rows.length === 0) return '';

  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => [...row, ...Array(width - row.length).fill('')]);
  const lines = [
    `| ${padded[0].join(' | ')} |`,
    `| ${Array(width).fill('---').join(' | ')} |`,
  ];

  for (const row of padded.slice(1)) {
    lines.push(`| ${row.join(' | ')} |`);
  }
  return lines.join('\n');
}

// block 渲染负责段落、标题、引用、表格和独立 card。
// 未识别结构会继续渲染子节点；未识别 card 会报错，避免导出时悄悄丢内容。
function renderBlock(node, imageMap) {
  if (node instanceof TextNode) return collapseSpaces(node.text);

  if (node.tag === 'root') return renderChildrenAsBlocks(node.children, imageMap);
  if (['col', 'colgroup', 'meta', 'tbody'].includes(node.tag)) {
    return renderChildrenAsBlocks(node.children, imageMap);
  }

  if (/^h[1-6]$/.test(node.tag)) {
    const text = collapseSpaces(renderInline(node, imageMap));
    return text ? `${'#'.repeat(Number.parseInt(node.tag[1], 10))} ${text}` : '';
  }
  if (node.tag === 'p') return collapseSpaces(renderInline(node, imageMap));
  if (node.tag === 'blockquote') return renderBlockquote(node, imageMap);
  if (node.tag === 'table') return renderTable(node, imageMap);
  if (node.tag === 'td' || node.tag === 'th') {
    return renderChildrenAsBlocks(node.children, imageMap) || collapseSpaces(renderInline(node, imageMap));
  }
  if (node.tag === 'card') {
    if (node.attrs.name === 'codeblock') return renderCodeBlock(node);
    return collapseSpaces(renderInline(node, imageMap));
  }

  return renderChildrenAsBlocks(node.children, imageMap) || collapseSpaces(renderInline(node, imageMap));
}

function imageExtension(src) {
  const ext = path.extname(new URL(src).pathname).toLowerCase();
  if (!ext) throw new Error(`无法识别图片扩展名：${src}`);
  return ext;
}

async function downloadFile(url, target) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) {
    throw new Error(`请求失败：${url}，状态码 ${response.status} ${response.statusText}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0) throw new Error(`下载到空图片：${url}`);
  await writeFile(target, body);
  return body.length;
}

// 输出路径可能在仓库外，例如 /tmp 端到端验证。仓库内路径用相对路径更易读。
function displayPath(target) {
  const relative = path.relative(ROOT, target);
  return relative.startsWith('..') ? target : relative;
}

function frontmatterValue(value) {
  return JSON.stringify(value ?? '');
}

function buildMarkdown(data, sourceUrl, body, imageCount) {
  const frontmatter = [
    '---',
    `title: ${frontmatterValue(data.title)}`,
    `source: ${frontmatterValue(sourceUrl)}`,
    `created_at: ${frontmatterValue(data.created_at)}`,
    `published_at: ${frontmatterValue(data.published_at)}`,
    `content_updated_at: ${frontmatterValue(data.content_updated_at)}`,
    `word_count: ${data.word_count ?? 0}`,
    `image_count: ${imageCount}`,
    '---',
    '',
  ].join('\n');

  return `${frontmatter}# ${data.title}\n\n${body.trim()}\n`;
}

// 最小验证只检查 Markdown 中的本地图片引用是否都能落到非空文件。
// 这能抓住最常见的导出损坏：下载失败、路径拼错、assets 目录名不一致。
async function verifyImageRefs(readmePath) {
  const markdown = await readFile(readmePath, 'utf8');
  const refs = [...markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)].map((match) => match[1]);
  const missing = [];
  const empty = [];
  let totalBytes = 0;

  for (const ref of refs) {
    const target = path.join(path.dirname(readmePath), ref);
    try {
      const info = await stat(target);
      if (info.size === 0) empty.push(ref);
      totalBytes += info.size;
    } catch (error) {
      if (error?.code === 'ENOENT') missing.push(ref);
      else throw error;
    }
  }

  if (missing.length > 0 || empty.length > 0) {
    throw new Error(`图片校验失败。缺失=${missing.join(',')} 空文件=${empty.join(',')}`);
  }

  return { refs: refs.length, totalBytes };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const docUrl = parseYuqueUrl(args.url);

  const html = await fetchText(docUrl.canonicalUrl);
  const appData = extractAppData(html);
  const bookId = appData?.book?.id;
  if (!bookId) throw new Error('无法在 window.appData 中找到 book.id。');

  const apiUrl = new URL(`/api/docs/${docUrl.docSlug}`, docUrl.origin);
  apiUrl.searchParams.set('book_id', String(bookId));
  apiUrl.searchParams.set('merge_dynamic_data', 'false');

  const payload = await fetchJson(apiUrl);
  const data = payload?.data;
  if (!data?.content) throw new Error('语雀 API 响应缺少 data.content。');

  // 输出路径全部在这里集中计算，供 dry-run、真实导出和 JSON 结果共用。
  // 这样 AI agent 可以先 dry-run 读取同一份路径计划，再决定是否加 --force。
  const title = data.title || appData?.doc?.title || docUrl.docSlug;
  const outputName = args.name || safeFileName(title, docUrl.docSlug);
  const documentDir = path.join(args.outDir, outputName);
  const assetsDir = path.join(documentDir, args.assetsDirName);
  const readmePath = path.join(documentDir, args.fileName);
  const sourceDir = path.join(documentDir, 'source');
  const documentExists = await exists(documentDir);
  const root = parseLake(data.content);
  const images = collectImageCards(root);

  const plan = {
    ok: true,
    mode: args.dryRun ? 'dry-run' : 'export',
    title,
    source: docUrl.canonicalUrl,
    outputName,
    documentDir,
    markdownPath: readmePath,
    assetsDir: args.skipImages ? null : assetsDir,
    sourceDir: args.saveSource ? sourceDir : null,
    imageCount: images.length,
    skipImages: args.skipImages,
    saveSource: args.saveSource,
    exists: documentExists,
    force: args.force,
    wouldOverwrite: documentExists && args.force && !args.dryRun,
  };

  // dry-run 会联网读取文档元数据和图片数量，但不会创建目录或下载图片。
  // 这是给 agent 的预检模式：确认路径、标题、是否会覆盖，再执行真实导出。
  if (args.dryRun) {
    if (args.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(`Title: ${title}`);
      console.log(`Markdown: ${displayPath(readmePath)}`);
      if (!args.skipImages) console.log(`Assets: ${displayPath(assetsDir)}`);
      if (args.saveSource) console.log(`Source: ${displayPath(sourceDir)}`);
      console.log(`Images: ${images.length}`);
      console.log(`Exists: ${documentExists ? 'yes' : 'no'}`);
    }
    return;
  }

  if (documentExists) {
    if (!args.force) {
      throw new Error(`输出目录已存在：${documentDir}\n如需覆盖，请显式传入 --force。`);
    }
    await rm(documentDir, { recursive: true, force: true });
  }

  await mkdir(path.dirname(readmePath), { recursive: true });
  if (!args.skipImages) await mkdir(assetsDir, { recursive: true });
  if (args.saveSource) {
    await mkdir(sourceDir, { recursive: true });
    await writeFile(path.join(sourceDir, 'yuque-api.json'), JSON.stringify(payload, null, 2), 'utf8');
    await writeFile(path.join(sourceDir, 'lake.html'), data.content, 'utf8');
  }

  const imageMap = new Map();
  let downloadedBytes = 0;
  for (const [index, node] of images.entries()) {
    const card = decodeCard(node);
    if (!card.src) throw new Error(`第 ${index + 1} 张图片缺少 src。`);
    const serial = String(index + 1).padStart(2, '0');
    const fileName = `image-${serial}${imageExtension(card.src)}`;
    const ref = args.skipImages ? card.src : `${args.assetsDirName}/${fileName}`;
    // --skip-images 用于只做文本迁移或网络受限环境。默认仍下载图片，保证离线可读。
    if (!args.skipImages) {
      downloadedBytes += await downloadFile(card.src, path.join(assetsDir, fileName));
    }
    imageMap.set(node, {
      alt: card.title || card.name || `image-${serial}`,
      ref,
    });
  }

  const body = renderBlock(root, imageMap);
  const markdown = buildMarkdown(data, docUrl.canonicalUrl, body, images.length);
  await writeFile(readmePath, markdown, 'utf8');

  const verification = args.skipImages
    ? { refs: images.length, totalBytes: 0 }
    : await verifyImageRefs(readmePath);
  const result = {
    ...plan,
    exists: true,
    downloadedBytes,
    verifiedImageRefs: verification.refs,
    verifiedImageBytes: verification.totalBytes,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Exported: ${displayPath(readmePath)}`);
    if (!args.skipImages) console.log(`Assets: ${displayPath(assetsDir)}`);
    if (args.saveSource) console.log(`Source: ${displayPath(sourceDir)}`);
    console.log(`Images: ${verification.refs}`);
    console.log(`Image bytes: ${downloadedBytes}`);
  }
}

main().catch((error) => {
  fail(error?.message ?? String(error), 1);
});
