'use strict';

// Tree-sitter based codemod that removes unused variable declarations
// Specifically targets variables that are assigned but never used
//
// Usage:
//   node scripts/codemods/fix-unused-variables.js "mcp-service/**/*.test.ts"

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

function findVariableUsages(rootNode, varName, src) {
  const usages = [];
  const stack = [rootNode];
  
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    
    if (node.type === 'identifier') {
      const text = src.slice(node.startIndex, node.endIndex);
      if (text === varName) {
        usages.push(node);
      }
    }
    
    for (let i = 0; i < node.namedChildCount; i++) {
      const ch = node.namedChild(i);
      if (ch) stack.push(ch);
    }
  }
  
  return usages;
}

function processFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const tree = parser.parse(src);
  
  const edits = [];
  const stack = [tree.rootNode];
  
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    
    // Look for variable declarations
    if (node.type === 'variable_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const declarator = node.namedChild(i);
        if (!declarator || declarator.type !== 'variable_declarator') continue;
        
        // Find the variable name
        let varName = null;
        let varNameNode = null;
        for (let j = 0; j < declarator.namedChildCount; j++) {
          const child = declarator.namedChild(j);
          if (child && child.type === 'identifier') {
            varName = src.slice(child.startIndex, child.endIndex);
            varNameNode = child;
            break;
          }
        }
        
        if (!varName) continue;
        
        // Find all usages of this variable
        const usages = findVariableUsages(tree.rootNode, varName, src);
        
        // Check if variable is only declared (assigned) but never used
        // Usage count of 1 means only the declaration itself
        if (usages.length === 1 && usages[0] === varNameNode) {
          // This variable is unused, mark for removal
          // Find the complete statement to remove
          let statement = node;
          while (statement.parent && statement.parent.type !== 'program' && statement.parent.type !== 'statement_block') {
            statement = statement.parent;
          }
          
          // Include any whitespace/newlines after the statement
          let endPos = statement.endIndex;
          const remainingText = src.slice(endPos);
          const match = remainingText.match(/^[\s\n]*/);
          if (match) {
            endPos += match[0].length;
          }
          
          edits.push({
            start: statement.startIndex,
            end: endPos,
            text: ''
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
        console.log(`Removed ${count} unused variables in ${file}`);
      }
    } catch (e) {
      console.warn(`Skipped ${file}: ${e && e.message ? e.message : e}`);
    }
  }
  
  console.log(`Removed ${totalFixed} unused variables total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});