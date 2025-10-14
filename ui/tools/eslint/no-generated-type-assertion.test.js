const { RuleTester } = require('eslint');
const rule = require('./no-generated-type-assertion');

const tester = new RuleTester({
    languageOptions: {
        parser: require('@typescript-eslint/parser'),
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

tester.run('no-generated-type-assertion', rule, {
    valid: [
        {
            filename: 'file.ts',
            code: `
      const x = (navigator.clipboard as any);
      const y = foo as unknown;
      import * as gen from 'not-generated';
      const z = bar as gen.Type;
      `,
        },
        {
            filename: 'file.ts',
            code: `
      import type { MealPlan } from '@mealplanner/generated';
      // no assertion to generated type, so fine
      const fn = (p: MealPlan) => p;
      `,
        },
        {
            filename: 'file.ts',
            code: `
      import type { AgentStartRequest } from '@mealplanner/generated';
      async function f(item: unknown){
        await (navigator.clipboard as any).write([item]);
      }
      `,
        },
    ],
    invalid: [
        {
            filename: 'file.ts',
            code: `
      import type { MealPlan } from '@mealplanner/generated';
      const plan = {} as MealPlan;
      `,
            errors: [{ messageId: 'avoidGeneratedAssertion' }],
        },
        {
            filename: 'file.ts',
            code: `
      import * as gen from '@mealplanner/generated';
      const plan = {} as gen.MealPlan;
      `,
            errors: [{ messageId: 'avoidGeneratedAssertion' }],
        },
        {
            filename: 'file.ts',
            code: `
      import type { AgentStartRequest } from '@mealplanner/generated';
      const blah = {} as AgentStartRequest;
      `,
            errors: [{ messageId: 'avoidGeneratedAssertion' }],
        },
    ],
});

