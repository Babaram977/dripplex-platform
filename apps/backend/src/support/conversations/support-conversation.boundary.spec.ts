import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DPX-SUPPORT-002 B2 §9 — the provider boundary, pulled a gate early.
 *
 * Better the wall stands before there is anything to test it against. There is
 * no provider SDK in the dependency tree today, so every assertion here passes
 * trivially right now — and that is the point: it will stop passing the moment
 * somebody adds one and reaches for it from this module, which is exactly when
 * nobody is looking for a wall.
 */

const MODULE_DIR = __dirname;

/** Every non-spec source file in the conversations module. */
function moduleSources(): { file: string; text: string }[] {
  return readdirSync(MODULE_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((file) => ({ file, text: readFileSync(join(MODULE_DIR, file), 'utf8') }));
}

/** Import specifiers, from both `import ... from 'x'` and `import('x')`. */
function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const specifier = m[1];
    if (specifier !== undefined) out.push(specifier);
  }
  for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const specifier = m[1];
    if (specifier !== undefined) out.push(specifier);
  }
  return out;
}

describe('the conversation module reaches nothing financial', () => {
  /**
   * Money movement, in every spelling this repository uses. An assistant saying
   * "refund the customer" is text; this is what makes it text and not an
   * instruction, because the capability is absent rather than merely unused.
   */
  const FORBIDDEN = [
    'wallet',
    'payment',
    'paystack',
    'flutterwave',
    'peyflex',
    'settlement',
    'payout',
    'ledger',
    'commission',
    'bank-account',
    'bank_account',
    'loyalty',
    'referral',
  ];

  it.each(moduleSources())('$file imports nothing financial', ({ text }) => {
    const specifiers = importsOf(text);

    for (const specifier of specifiers) {
      for (const forbidden of FORBIDDEN) {
        expect(specifier.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  it('imports no AI or provider SDK', () => {
    // None of these is in package.json today. Named anyway, because the failure
    // this guards is a future `pnpm add` followed by one convenient import.
    const PROVIDERS = [
      '@anthropic-ai',
      'openai',
      '@google/generative-ai',
      '@google-cloud/aiplatform',
      'cohere',
      'mistralai',
      'langchain',
      'llamaindex',
      'ollama',
      'replicate',
      'huggingface',
    ];

    for (const { text } of moduleSources()) {
      for (const specifier of importsOf(text)) {
        for (const provider of PROVIDERS) {
          expect(specifier.toLowerCase()).not.toContain(provider);
        }
      }
    }
  });

  it('declares no provider credential', () => {
    // A credential read here would mean the provider is a caller rather than a
    // callee — §9's actual distinction, not a naming preference.
    for (const { text } of moduleSources()) {
      expect(text).not.toMatch(/process\.env\[['"][^'"]*(?:API_KEY|SECRET|TOKEN)[^'"]*['"]\]/i);
      expect(text).not.toMatch(/process\.env\.[A-Z_]*(?:API_KEY|SECRET|TOKEN)/i);
    }
  });

  it('depends on exactly three services, all of them local', () => {
    const service = readFileSync(join(MODULE_DIR, 'support-conversation.service.ts'), 'utf8');
    const constructorBlock = service.slice(
      service.indexOf('constructor('),
      service.indexOf(') {}', service.indexOf('constructor(')),
    );

    // Pinned. A fourth dependency is a design change and should require editing
    // this list on purpose rather than arriving as a side effect.
    const injected = [...constructorBlock.matchAll(/private readonly \w+: (\w+)/g)].map(
      (m) => m[1],
    );

    expect(injected.sort()).toEqual(['AuditService', 'PrismaService', 'SupportService']);
  });
});

describe('assistant authorship is unreachable in this increment', () => {
  it('no source in the module writes ASSISTANT', () => {
    for (const { file, text } of moduleSources()) {
      // The enum member may be NAMED (a type import, a comment); it must never
      // be assigned as an authorType.
      // Reported as an object so a failure names the offending file rather than
      // just saying `true !== false`.
      expect({
        file,
        viaEnum: /authorType:\s*SupportMessageAuthorType\.ASSISTANT/.test(text),
        viaLiteral: /authorType:\s*['"]ASSISTANT['"]/.test(text),
      }).toEqual({ file, viaEnum: false, viaLiteral: false });
    }
  });

  it('exposes no method that would let a caller choose an author', () => {
    const service = readFileSync(join(MODULE_DIR, 'support-conversation.service.ts'), 'utf8');
    const publicMethods = [...service.matchAll(/public async (\w+)\(/g)].map((m) => m[1]);

    expect(publicMethods).not.toContain('appendAssistantMessage');
    // The whole public surface, pinned. Adding a method is a surface change and
    // should be a deliberate edit here, reviewed, not a silent widening.
    expect(publicMethods.sort()).toEqual([
      'appendOperatorMessage',
      'appendUserMessage',
      'getTranscriptForOperations',
      'getTranscriptForOwner',
      'transitionByOperator',
      'transitionByOwner',
      'transitionByServer',
    ]);
  });

  it('no public method takes an authorType or an actor from the caller', () => {
    const service = readFileSync(join(MODULE_DIR, 'support-conversation.service.ts'), 'utf8');

    // Each public method's parameter list, up to its return type.
    for (const m of service.matchAll(/public async \w+\(([\s\S]*?)\):\s*Promise</g)) {
      const params = m[1] ?? '';

      expect(params).not.toMatch(/authorType/);
      expect(params).not.toMatch(/authorId/);
      expect(params).not.toMatch(/actor\s*:/);
      expect(params).not.toMatch(/TransitionActor/);
      // Permission names are never accepted from a caller either — they are read
      // from the authenticated user's server-side set.
      expect(params).not.toMatch(/permissions\s*:/);
    }
  });
});

describe('the module is not routable', () => {
  it('declares no controller and no route decorator', () => {
    for (const { text } of moduleSources()) {
      expect(text).not.toMatch(/@Controller\(/);
      expect(text).not.toMatch(/@(Get|Post|Patch|Put|Delete)\(/);
    }
  });

  it('is registered as a provider only — controllers is unchanged', () => {
    const module = readFileSync(join(MODULE_DIR, '..', 'support.module.ts'), 'utf8');

    expect(module).toContain('SupportConversationService');
    const controllers = /controllers:\s*\[([^\]]*)\]/.exec(module)?.[1] ?? '';
    expect(controllers).not.toContain('Conversation');
  });

  it('no controller anywhere in src/ injects the conversation service', () => {
    // The service being exported is fine — B3 and Operations will consume it.
    // A CONTROLLER reaching it is route exposure, which this increment excludes.
    const root = join(MODULE_DIR, '..', '..');
    const hits = execSync(
      `grep -rln "SupportConversationService" ${JSON.stringify(root)} --include=*.controller.ts || true`,
      { encoding: 'utf8' },
    ).trim();

    expect(hits).toBe('');
  });
});
