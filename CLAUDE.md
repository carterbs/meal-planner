- Always start tasks by understanding the user's request, and then deciding if the task should be delegated to a specialized sub agent. Never handle complex work directly - always create Tasks for sub agents.
- When you learn something new about how to work inside of this repo, make sure you update @CLAUDE.md, but keep it brief. For example if you run commands multiple times before learning the correct command, then that file should be updated.
- DO NOT IMPLEMENT PLACEHOLDERS OR SIMPLE IMPLEMENTATIONS. WE WANT FULL IMPLEMENTATIONS. I WILL YELL AT YOU IF YOU VIOLATE THIS.
- Only use yarn when operating on typescript packages.

## TypeScript Guidelines
- Casting types to `any` in typescript files should be avoided at all costs. If you believe you need to cast as any, you need to justify it.

## Takeaways
- Confidence comes from clear, effective contracts (when testing, designing APIs, and working with agents and stakeholders).
- Communicate clearly so that each agent has exactly the context it needs to succeed in its role, be it research, framing, coding, monitoring, or debugging.- Align early so that you can continue autonomously.