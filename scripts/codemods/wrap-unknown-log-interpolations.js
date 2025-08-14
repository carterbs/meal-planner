'use strict';

// Tree-sitter based codemod that wraps only template-substitution expressions
// inside logging calls that are typed as `unknown` with String(...).
//
// Targets function names: infoLog, debugLog, warnLog, errorLog
//
// Usage:
//   yarn node scripts/codemods/wrap-unknown-log-interpolations.js \
//     --tsconfig agent-service/tsconfig.json \
//     "agent-service/**/*.ts"
//
// Notes:
// - We use Tree-sitter to locate template substitutions.
// - We use the TypeScript compiler API to decide if an expression is `unknown`.

const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const Parser = require('tree-sitter');
const { Query } = require('tree-sitter');
const TSTypescript = require('tree-sitter-typescript');
const ts = require('typescript');

const parser = new Parser();
parser.setLanguage(TSTypescript.typescript);

function parseArgs(argv) {
  const args = { tsconfig: undefined, patterns: [], all: false, aggressive: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tsconfig') {
      args.tsconfig = argv[++i];
    } else if (a === '--all' || a === '-A') {
      args.all = true;
    } else if (a === '--aggressive' || a === '-x') {
      args.aggressive = true;
    } else {
      args.patterns.push(a);
    }
  }
  if (args.patterns.length === 0) {
    args.patterns = ['agent-service/**/*.ts'];
  }
  return args;
}

function loadTsProgram(tsconfigPath) {
  const base = tsconfigPath
    ? path.resolve(tsconfigPath)
    : path.resolve('tsconfig.json');
  let configFile = base;
  if (!fs.existsSync(configFile)) {
    // Fallback: search upwards
    let dir = process.cwd();
    while (dir !== path.parse(dir).root) {
      const tryPath = path.join(dir, 'tsconfig.json');
      if (fs.existsSync(tryPath)) {
        configFile = tryPath;
        break;
      }
      dir = path.dirname(dir);
    }
  }
  const configContent = ts.readConfigFile(configFile, ts.sys.readFile);
  if (configContent.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([configContent.error], {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (f) => f,
      getNewLine: () => '\n',
    }));
  }
  const parsed = ts.parseJsonConfigFileContent(
    configContent.config,
    ts.sys,
    path.dirname(configFile),
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  return { program, checker };
}

function replaceRanges(src, edits) {
  if (edits.length === 0) return src;
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

function getTsNodeAtPosition(sourceFile, start, end) {
  let best = sourceFile;
  function visit(node) {
    const s = node.getStart(sourceFile, false);
    const e = node.getEnd();
    if (s <= start && end <= e) {
      if (best === sourceFile || (e - s) < (best.getEnd() - best.getStart(sourceFile, false))) {
        best = node;
      }
      ts.forEachChild(node, visit);
    }
  }
  ts.forEachChild(sourceFile, visit);
  return best;
}

function isUnknownType(checker, node) {
  try {
    const type = checker.getTypeAtLocation(node);
    if (!type) return false;
    const Unknown = ts.TypeFlags.Unknown;
    const Union = ts.TypeFlags.Union;
    if (type.flags & Unknown) return true;
    if (type.flags & Union) {
      const types = type.types || [];
      return types.some((t) => (t.flags & Unknown) !== 0);
    }
    return false;
  } catch {
    return false;
  }
}

function processFile(absPath, program, checker, options) {
  const src = fs.readFileSync(absPath, 'utf8');
  const tree = parser.parse(src);
  // Manual traversal (more robust than query across TS variants)
  const captures = [];
  const stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (!options.all && node.type === 'call_expression') {
      // Find identifier callee
      let fnIdent = null;
      for (let i = 0; i < node.namedChildCount; i++) {
        const ch = node.namedChild(i);
        if (!ch) continue;
        if (ch.type === 'identifier') {
          fnIdent = ch;
          break;
        }
      }
      if (fnIdent) {
        const fnName = src.slice(fnIdent.startIndex, fnIdent.endIndex);
        if (/^(infoLog|debugLog|warnLog|errorLog)$/.test(fnName)) {
          // Find arguments -> template_string
          for (let i = 0; i < node.namedChildCount; i++) {
            const ch = node.namedChild(i);
            if (ch && ch.type === 'arguments') {
              for (let j = 0; j < ch.namedChildCount; j++) {
                const arg = ch.namedChild(j);
                if (arg && arg.type === 'template_string') {
                  captures.push({ name: 'tpl', node: arg });
                }
              }
            }
          }
        }
      }
    } else if (options.all && node.type === 'template_string') {
      captures.push({ name: 'tpl', node });
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const ch = node.namedChild(i);
      if (ch) stack.push(ch);
    }
  }
  if (captures.length === 0) return null;

  // Get TS SourceFile from program for type queries
  const tsSource = program.getSourceFile(absPath);
  const localAggressive = options.aggressive || /agent-service[\/\\]main\.ts$/.test(absPath) || /agent-service[\/\\]workflows[\/\\]meal-planning\.ts$/.test(absPath);

  const edits = [];
  for (const tplCap of captures) {
    const tplNode = tplCap.node;
    // Iterate template_substitution children
    for (let i = 0; i < tplNode.namedChildCount; i++) {
      const child = tplNode.namedChild(i);
      if (!child) continue;
      if (child.type === 'template_substitution') {
        const expr = child.namedChild(0);
        if (!expr) continue;
        const start = expr.startIndex;
        const end = expr.endIndex;
        const text = src.slice(start, end);
        if (/^\s*String\s*\(/.test(text)) continue;
        let shouldWrap = false;
        if (tsSource) {
          const tsNode = getTsNodeAtPosition(tsSource, start, end);
          // Wrap if TS says unknown OR if inside a catch clause and identifier equals the catch parameter
          shouldWrap = isUnknownType(checker, tsNode);
          if (!shouldWrap && expr.type === 'identifier') {
            // Check if within catch_clause and matches parameter name
            let p = child;
            let catchParamName = null;
            while (p) {
              if (p.type === 'catch_clause') {
                for (let k = 0; k < p.namedChildCount; k++) {
                  const cc = p.namedChild(k);
                  if (!cc) continue;
                  if (cc.type === 'identifier') {
                    catchParamName = src.slice(cc.startIndex, cc.endIndex);
                    break;
                  }
                }
                break;
              }
              p = p.parent;
            }
            if (catchParamName) {
              const identName = text.trim();
              if (identName === catchParamName) {
                shouldWrap = true;
              }
            }
          }
        }
        // Aggressive fallback: wrap if expression is clearly not a literal/template and we couldn't prove string type
        if (!shouldWrap && localAggressive) {
          const nonLiteral = !/^(?:`|'.*'|".*"|\d+(?:\.\d+)?|true|false|null|undefined)$/.test(text.trim());
          if (nonLiteral) shouldWrap = true;
        }
        if (shouldWrap) {
          edits.push({ start, end, text: `String(${text})` });
        }
      }
    }
  }

  if (edits.length === 0) return null;
  const out = replaceRanges(src, edits);
  if (out !== src) {
    fs.writeFileSync(absPath, out, 'utf8');
    return edits.length;
  }
  return null;
}

async function main() {
  const { tsconfig, patterns, all } = parseArgs(process.argv);
  const { program, checker } = loadTsProgram(tsconfig);
  const files = await fg(patterns, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.generated/**'],
    onlyFiles: true,
    dot: false,
  });
  let totalWrapped = 0;
  for (const file of files) {
    const abs = path.resolve(file);
    try {
      const count = processFile(abs, program, checker, { all });
      if (typeof count === 'number') totalWrapped += count;
    } catch (e) {
      // Non-fatal; continue
      // eslint-disable-next-line no-console
      console.warn(`codemod skipped ${file}: ${e && e.message ? e.message : e}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Wrapped ${totalWrapped} template substitutions with String(...)`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


