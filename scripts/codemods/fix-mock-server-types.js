'use strict';

// Tree-sitter based codemod that fixes mockServer as any patterns
// Replaces `mockServer as any` with proper MCP server typing
//
// Usage:
//   node scripts/codemods/fix-mock-server-types.js "mcp-service/**/*.test.ts"

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

function addMcpServerImportIfNeeded(src) {
  // Check if McpServer is already imported
  if (src.includes('McpServer')) {
    return src;
  }
  
  // Add McpServer import after other imports
  const lines = src.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') && !lines[i].includes('//')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, "import type { McpServer } from '@modelcontextprotocol/sdk/types.js';");
    return lines.join('\n');
  }
  
  return src;
}

function processFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const tree = parser.parse(src);
  
  const edits = [];
  const stack = [tree.rootNode];
  let needsMcpServerImport = false;
  
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    
    // Look for type_assertion patterns: (mockServer as any)
    if (node.type === 'type_assertion') {
      let typeAnnotationNode = null;
      let expressionNode = null;
      
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (!child) continue;
        
        if (child.type === 'type_annotation') {
          typeAnnotationNode = child;
        } else {
          expressionNode = child;
        }
      }
      
      if (typeAnnotationNode && expressionNode) {
        const typeText = src.slice(typeAnnotationNode.startIndex, typeAnnotationNode.endIndex);
        const exprText = src.slice(expressionNode.startIndex, expressionNode.endIndex);
        
        // Check for mockServer as any pattern
        if (typeText.includes('any') && exprText.includes('mockServer')) {
          const newType = typeText.replace('any', 'McpServer');
          edits.push({
            start: typeAnnotationNode.startIndex,
            end: typeAnnotationNode.endIndex,
            text: newType
          });
          needsMcpServerImport = true;
        }
      }
    }
    
    // Also look for direct global.fetch castings
    if (node.type === 'assignment_expression') {
      const text = src.slice(node.startIndex, node.endIndex);
      if (text.includes('global.fetch') && text.includes('as any')) {
        // Replace with proper jest mock type
        const newText = text.replace(' as any', '');
        edits.push({
          start: node.startIndex,
          end: node.endIndex,
          text: newText
        });
      }
    }
    
    for (let i = 0; i < node.namedChildCount; i++) {
      const ch = node.namedChild(i);
      if (ch) stack.push(ch);
    }
  }

  if (edits.length === 0) return null;
  
  let out = replaceRanges(src, edits);
  
  // Add McpServer import if needed
  if (needsMcpServerImport) {
    out = addMcpServerImportIfNeeded(out);
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
        console.log(`Fixed ${count} mock server type issues in ${file}`);
      }
    } catch (e) {
      console.warn(`Skipped ${file}: ${e && e.message ? e.message : e}`);
    }
  }
  
  console.log(`Fixed ${totalFixed} mock server type issues total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});