#!/usr/bin/env node

// Deterministic codemod for UI test files:
// - Replace explicit `any` with `unknown` in safe contexts
// - Replace `as any` with `as unknown`
// - Replace `any[]` with `unknown[]`
// - Replace `Array<any>` with `Array<unknown>`
//
// Scope: src test files matching .test.ts and .test.tsx

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** @param {string} p */
function isTestFile(p) {
    return (
        (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) &&
        // Only under src
        p.includes(`${path.sep}src${path.sep}`)
    );
}

/**
 * Walk directory recursively and collect files
 * @param {string} dir
 * @param {string[]} acc
 */
function walk(dir, acc) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, acc);
        } else if (entry.isFile()) {
            if (isTestFile(full)) acc.push(full);
        }
    }
}

/**
 * Apply deterministic transforms to file content
 * @param {string} content
 */
function transform(content) {
    let out = content;

    // Replace type annotations `: any` with `: unknown`
    // Handles cases like ": any)" and ": any," and ": any\n"
    out = out.replace(/(:\s*)any(\b)/g, '$1unknown$2');

    // Replace assertions `as any` with `as unknown`
    out = out.replace(/\bas\s+any\b/g, 'as unknown');

    // Replace array any → unknown[]
    out = out.replace(/\bany\[\]/g, 'unknown[]');

    // Replace Array<any> → Array<unknown>
    out = out.replace(/Array<\s*any\s*>/g, 'Array<unknown>');

    // Replace jest.Mock<..., any> second generic to unknown where present
    out = out.replace(/jest\.Mock<(.*?)>\b/g, (m, generics) => {
        // Avoid complex parsing; a simple replacement of trailing `, any` → `, unknown` is enough for common patterns
        const replaced = generics.replace(/,\s*any(\s*>?)$/, ', unknown$1');
        return `jest.Mock<${replaced}>`;
    });

    return out;
}

function main() {
    const files = [];
    if (!fs.existsSync(SRC)) {
        console.error('No src directory found at', SRC);
        process.exit(1);
    }
    walk(SRC, files);
    let changed = 0;
    for (const file of files) {
        const before = fs.readFileSync(file, 'utf8');
        const after = transform(before);
        if (after !== before) {
            fs.writeFileSync(file, after, 'utf8');
            changed++;
            process.stdout.write(`Updated: ${path.relative(ROOT, file)}\n`);
        }
    }
    process.stdout.write(`Done. Files changed: ${changed}\n`);
}

if (require.main === module) {
    main();
}


