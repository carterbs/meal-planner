'use strict';

// Tree-sitter based codemod that fixes Jest mock type safety issues
// Replaces `jest.MockedFunction<any>` with proper typed mocks
//
// Usage:
//   node scripts/codemods/fix-jest-mock-types.js "mcp-service/**/*.test.ts"

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

function processFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const tree = parser.parse(src);
  
  const edits = [];
  const stack = [tree.rootNode];
  
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    
    // Look for type_assertion patterns: (something as jest.MockedFunction<any>)
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
        if (typeText.includes('jest.MockedFunction<any>')) {
          // Extract the variable name from the expression
          const exprText = src.slice(expressionNode.startIndex, expressionNode.endIndex);
          
          // Replace with proper typing
          const newType = typeText.replace('jest.MockedFunction<any>', `jest.MockedFunction<typeof ${exprText}>`);
          edits.push({
            start: typeAnnotationNode.startIndex,
            end: typeAnnotationNode.endIndex,
            text: newType
          });
        }
      }
    }
    
    // Look for direct jest.MockedFunction<any> in variable declarations
    if (node.type === 'generic_type') {
      const typeText = src.slice(node.startIndex, node.endIndex);
      if (typeText === 'jest.MockedFunction<any>') {
        // Find the variable name from parent context
        let parent = node.parent;
        let varName = null;
        
        while (parent && !varName) {
          if (parent.type === 'variable_declarator') {
            for (let i = 0; i < parent.namedChildCount; i++) {
              const child = parent.namedChild(i);
              if (child && child.type === 'identifier') {
                varName = src.slice(child.startIndex, child.endIndex);
                break;
              }
            }
          }
          parent = parent.parent;
        }
        
        if (varName) {
          edits.push({
            start: node.startIndex,
            end: node.endIndex,
            text: `jest.MockedFunction<typeof ${varName}>`
          });
        }
      }
    }
    
    for (let i = 0; i < node.namedChildCount; i++) {
      const ch = node.namedChild(i);
      if (ch) stack.push(ch);
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
        console.log(`Fixed ${count} mock type issues in ${file}`);
      }
    } catch (e) {
      console.warn(`Skipped ${file}: ${e && e.message ? e.message : e}`);
    }
  }
  
  console.log(`Fixed ${totalFixed} Jest mock type issues total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});