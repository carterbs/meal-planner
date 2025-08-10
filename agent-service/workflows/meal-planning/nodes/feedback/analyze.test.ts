import { analyzeFeedbackNode } from './analyze';

describe('feedback/analyze node', () => {
    it('parses satisfied JSON response', async () => {
        const deps = {
            nanoLlm: { invoke: jest.fn().mockResolvedValue({ content: '{"satisfied":true,"reasoning":"ok"}' }) },
            extractJsonFromResponse: (s: string) => s,
        } as any;
        const result = await analyzeFeedbackNode([{ content: 'hi' }], deps);
        expect(result.satisfied).toBe(true);
    });
    it('handles unparsable JSON gracefully', async () => {
        const deps = {
            nanoLlm: { invoke: jest.fn().mockResolvedValue({ content: 'not json' }) },
            extractJsonFromResponse: (s: string) => s,
        } as any;
        const result = await analyzeFeedbackNode([{ content: 'hi' }], deps);
        expect(result.satisfied).toBe(false);
        expect(result.reasoning).toContain('Could not parse');
    });
});


