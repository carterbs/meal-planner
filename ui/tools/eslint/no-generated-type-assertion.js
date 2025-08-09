/**
 * ESLint rule: Warn on TS type assertions that assert to types imported from @mealplanner/generated
 */

module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Warn on TS type assertions that assert to types imported from @mealplanner/generated',
        },
        schema: [],
        messages: {
            avoidGeneratedAssertion:
                'Avoid type assertions to generated types ({{typeName}}). Prefer runtime guards or direct usage of generated classes.',
        },
    },
    create(context) {
        const generatedImports = new Set();

        function trackImport(node) {
            const source = node.source && node.source.value;
            if (typeof source === 'string' && source.startsWith('@mealplanner/generated')) {
                for (const spec of node.specifiers) {
                    if (spec && spec.local && spec.local.name) {
                        generatedImports.add(spec.local.name);
                    }
                }
            }
        }

        function getRootIdentifierName(typeNode) {
            if (!typeNode) return null;
            if (typeNode.type === 'TSTypeReference') {
                const tn = typeNode.typeName;
                if (!tn) return null;
                if (tn.type === 'Identifier') return tn.name;
                if (tn.type === 'TSQualifiedName') {
                    let left = tn.left;
                    while (left && left.type === 'TSQualifiedName') left = left.left;
                    return left && left.type === 'Identifier' ? left.name : null;
                }
            }
            return null;
        }

        return {
            ImportDeclaration: trackImport,
            TSAsExpression(node) {
                const name = getRootIdentifierName(node.typeAnnotation);
                if (name && generatedImports.has(name)) {
                    context.report({ node, messageId: 'avoidGeneratedAssertion', data: { typeName: name } });
                }
            },
        };
    },
};


