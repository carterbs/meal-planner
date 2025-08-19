'use strict';

// Tree-sitter based codemod that fixes Express middleware mock type issues
// Replaces `(req: any, res: any, next: any) => next()` with proper Express types
//
// Usage:
//   node scripts/codemods/fix-express-mock-types.js "mcp-service/**/*.test.ts"

const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const Parser = require('tree-sitter');
const TSTypescript = require('tree-sitter-typescript');

const parser = new Parser();
parser.setLanguage(TSTypescript.typescript);

function parseArgs(argv) {
  const args = { patterns: [] };
  for (let i = 2; i < argv.length; i++) {
    args.patterns.push(argv[i]);
  }
  if (args.patterns.length === 0) {
    args.patterns = ['mcp-service/**/*.test.ts'];
  }
  return args;
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

function addExpressImportIfNeeded(src) {
  // Check if express types are already imported
  if (src.includes("import * as express from 'express'") || 
      src.includes("import express from 'express'") ||
      src.includes("from 'express'") ||
      src.includes("import type") && src.includes("express")) {
    return src;
  }
  
  // Add express import after other imports
  const lines = src.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') && !lines[i].includes('//')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, "import type * as express from 'express';");
    return lines.join('\n');
  }
  
  return src;
}

function processFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const tree = parser.parse(src);
  
  const edits = [];
  const stack = [tree.rootNode];
  let needsExpressImport = false;
  
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    
    // Look for arrow functions with (req: any, res: any, next: any) pattern
    if (node.type === 'arrow_function') {
      const parametersNode = node.namedChild(0);
      if (parametersNode && parametersNode.type === 'formal_parameters') {
        const paramsText = src.slice(parametersNode.startIndex, parametersNode.endIndex);
        
        // Check for the Express middleware pattern
        if (paramsText.includes('req: any') && paramsText.includes('res: any') && paramsText.includes('next: any')) {
          // Replace with proper Express types
          const newParams = paramsText
            .replace('req: any', 'req: express.Request')
            .replace('res: any', 'res: express.Response')
            .replace('next: any', 'next: express.NextFunction');
          
          edits.push({
            start: parametersNode.startIndex,
            end: parametersNode.endIndex,
            text: newParams
          });
          needsExpressImport = true;
        }
      }
    }
    
    for (let i = 0; i < node.namedChildCount; i++) {
      const ch = node.namedChild(i);
      if (ch) stack.push(ch);
    }
  }

  if (edits.length === 0) return null;
  
  let out = replaceRanges(src, edits);
  
  // Add Express import if needed
  if (needsExpressImport) {
    out = addExpressImportIfNeeded(out);
  }
  
  if (out !== src) {
    fs.writeFileSync(absPath, out, 'utf8');
    return edits.length;
  }
  return null;
}

async function main() {
  const { patterns } = parseArgs(process.argv);
  const files = await fg(patterns, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    onlyFiles: true,
    dot: false,
  });
  
  let totalFixed = 0;
  for (const file of files) {
    const abs = path.resolve(file);
    try {
      const count = processFile(abs);
      if (typeof count === 'number') {
        totalFixed += count;
        console.log(`Fixed ${count} Express mock type issues in ${file}`);
      }
    } catch (e) {
      console.warn(`Skipped ${file}: ${e && e.message ? e.message : e}`);
    }
  }
  
  console.log(`Fixed ${totalFixed} Express mock type issues total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});