#!/usr/bin/env node

// Codemod to tighten test typing without using `any`:
// - Replace `new <Type>({...} as unknown)` with `new <Type>({...} as PartialMessage<<Type>>)`
//   for protobuf-generated types: Meal, Ingredient, Step, MealPlanEntry, MealPlan, ShoppingListItem.
// - Ensure `import type { PartialMessage } from '@bufbuild/protobuf'` is present when needed.
// - Replace `resumeData: null` with `resumeData: undefined` in tests.
// - Fix promise resolver typing in useAgentSession tests.
// - Fix DnD mock prop types and mockOnDragEnd typing in StepsEditor tests.
// - Fix clipboard tests casting of navigator.clipboard to a structural type.
// - Fix mealPlanConverter tests input typing from unknown to GoMealPlanItem[] shape.
//
// Scope: ui/src/**/*.test.ts and ui/src/**/*.test.tsx

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** @param {string} p */
function isTestFile(p) {
    return (
        (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) &&
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
 * Ensure PartialMessage import exists at top-level
 * @param {string} source
 */
function ensurePartialMessageImport(source) {
    if (source.includes("PartialMessage")) return source; // assume present
    const importLine = "import type { PartialMessage } from '@bufbuild/protobuf';\n";
    // Place after existing imports, before other code
    const lines = source.split(/\r?\n/);
    let insertIdx = 0;
    while (insertIdx < lines.length && lines[insertIdx].startsWith('import')) {
        insertIdx++;
    }
    lines.splice(insertIdx, 0, importLine.trimEnd());
    return lines.join('\n');
}

/**
 * Transform constructor assertions
 * @param {string} content
 */
function transformConstructors(content) {
    const types = [
        'Meal',
        'Ingredient',
        'Step',
        'MealPlanEntry',
        'MealPlan',
        'ShoppingListItem',
    ];

    let out = content;
    let changed = false;
    for (const t of types) {
        // Case 1: new Type(args) as unknown
        const pattern1 = new RegExp(
            String.raw`new\s+${t}\s*\(([^)]*?)\)\s+as\s+unknown`,
            'g',
        );
        out = out.replace(pattern1, (m, inner) => {
            changed = true;
            return `new ${t}(${inner}) as PartialMessage<${t}>`;
        });

        // Case 2: new Type({...} as unknown)
        const pattern2 = new RegExp(
            String.raw`new\s+${t}\s*\((\{[\s\S]*?\})\s+as\s+unknown\)`,
            'g',
        );
        out = out.replace(pattern2, (m, obj) => {
            changed = true;
            return `new ${t}(${obj} as PartialMessage<${t}>)`;
        });
    }
    if (changed) {
        out = ensurePartialMessageImport(out);
    }
    return out;
}

function transformResumeData(content) {
    // Replace literal resumeData: null with undefined in tests
    return content.replace(/resumeData:\s*null\b/g, 'resumeData: undefined');
}

function transformPromiseResolverType(filePath, content) {
    if (!/useAgentSession\.test\.ts$/.test(filePath)) return content;
    // Replace resolver type unknown with precise union type
    return content.replace(
        /let\s+resolvePromise:\s*\(value:\s*unknown\)\s*=>\s*void;?/,
        "let resolvePromise!: (value: import('../../../api').StartSessionResult | PromiseLike<import('../../../api').StartSessionResult>) => void;",
    );
}

function transformLibraryPanel(content) {
    let out = content;
    out = out.replace(/mealType:\s*undefined\s+as\s+unknown/g, 'mealType: undefined');
    out = out.replace(
        /mealType:\s*null\s+as\s+unknown/g,
        'mealType: null as unknown as string | undefined',
    );
    return out;
}

function transformClipboard(content) {
    let out = content;
    out = out.replace(
        /\(navigator\.clipboard\s+as\s+unknown\)\.write\s+as\s+jest\.Mock/g,
        '(navigator.clipboard as { write: jest.Mock }).write',
    );
    out = out.replace(
        /\(navigator\.clipboard\s+as\s+unknown\)\.writeText\s+as\s+jest\.Mock/g,
        '(navigator.clipboard as { writeText: jest.Mock }).writeText',
    );
    return out;
}

function transformMealPlanConverterTest(filePath, content) {
    if (!/mealPlanConverter\.test\.ts$/.test(filePath)) return content;
    return content.replace(
        /as\s+unknown;?/g,
        "as { items?: import('@mealplanner/generated/dist/gateway/types.gen').GoMealPlanItem[] };",
    );
}

function transformStepsEditorTest(filePath, content) {
    if (!/StepsEditor\.test\.tsx$/.test(filePath)) return content;
    let out = content;
    // mockOnDragEnd typing
    out = out.replace(
        /let\s+mockOnDragEnd:\s*unknown\s*=\s*null;/,
        'let mockOnDragEnd: ((e: unknown) => void) | null = null;',
    );
    // DndContext props typing
    out = out.replace(
        /DndContext:\s*\(\{\s*children,\s*onDragEnd\s*\}:\s*unknown\)/,
        'DndContext: ({ children, onDragEnd }: { children?: React.ReactNode; onDragEnd?: (e: unknown) => void })',
    );
    // SortableContext props typing
    out = out.replace(
        /SortableContext:\s*\(\{\s*children\s*\}:\s*unknown\)/,
        'SortableContext: ({ children }: { children?: React.ReactNode })',
    );
    return out;
}

function run() {
    const files = [];
    if (!fs.existsSync(SRC)) {
        console.error('No src directory found at', SRC);
        process.exit(1);
    }
    walk(SRC, files);
    let changedCount = 0;
    for (const file of files) {
        const before = fs.readFileSync(file, 'utf8');
        let after = before;
        after = transformConstructors(after);
        after = transformResumeData(after);
        after = transformPromiseResolverType(file, after);
        after = transformStepsEditorTest(file, after);
        after = transformClipboard(after);
        after = transformMealPlanConverterTest(file, after);
        if (/LibraryPanel\.test\.tsx$/.test(file)) {
            after = transformLibraryPanel(after);
        }
        if (after !== before) {
            fs.writeFileSync(file, after, 'utf8');
            changedCount++;
            process.stdout.write(`Updated: ${path.relative(ROOT, file)}\n`);
        }
    }
    process.stdout.write(`Done. Files changed: ${changedCount}\n`);
}

if (require.main === module) {
    run();
}

