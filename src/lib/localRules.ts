import type {
  AiOpinionResult,
  DetectedAddress,
  ExtractedUrl,
  LocalAnalysisResult,
  PassedCheck,
  RuleFinding,
  Verdict,
} from '../types';

interface BrandEntry {
  name: string;
  keyword: string;
  officialDomains: string[];
}

const PROTECTED_BRANDS: BrandEntry[] = [
  { name: 'PayPal', keyword: 'paypal', officialDomains: ['paypal.com', 'paypal.me'] },
  { name: 'Google', keyword: 'google', officialDomains: ['google.com', 'pay.google.com'] },
  { name: 'Apple', keyword: 'apple', officialDomains: ['apple.com', 'icloud.com'] },
  { name: 'Amazon', keyword: 'amazon', officialDomains: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de'] },
  { name: 'Stripe', keyword: 'stripe', officialDomains: ['stripe.com', 'buy.stripe.com', 'invoice.stripe.com'] },
  { name: 'Venmo', keyword: 'venmo', officialDomains: ['venmo.com'] },
  { name: 'Cash App', keyword: 'cashapp', officialDomains: ['cash.app'] },
  { name: 'Coinbase', keyword: 'coinbase', officialDomains: ['coinbase.com'] },
  { name: 'Binance', keyword: 'binance', officialDomains: ['binance.com', 'binance.us'] },
  { name: 'MetaMask', keyword: 'metamask', officialDomains: ['metamask.io'] },
  { name: 'Chase', keyword: 'chase', officialDomains: ['chase.com'] },
  { name: 'Zelle', keyword: 'zelle', officialDomains: ['zellepay.com'] },
  { name: 'Wise', keyword: 'wise', officialDomains: ['wise.com'] },
  { name: 'Revolut', keyword: 'revolut', officialDomains: ['revolut.com'] },
  { name: 'Bank of America', keyword: 'bankofamerica', officialDomains: ['bankofamerica.com'] },
  { name: 'Wells Fargo', keyword: 'wellsfargo', officialDomains: ['wellsfargo.com'] },
  { name: 'Microsoft', keyword: 'microsoft', officialDomains: ['microsoft.com'] },
  { name: 'Square', keyword: 'squareup', officialDomains: ['squareup.com', 'square.site'] },
];

const URL_SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rb.gy',
  'cutt.ly',
  'shorturl.at',
  'rebrand.ly',
  'tiny.cc',
  'v.gd',
  'bl.ink',
  't.ly',
  'short.io',
  'lnkd.in',
  's.id',
  'clck.ru',
]);

const RISKY_TLDS = new Set([
  '.xyz',
  '.top',
  '.click',
  '.loan',
  '.work',
  '.gq',
  '.tk',
  '.ml',
  '.cf',
  '.ga',
  '.buzz',
  '.icu',
  '.vip',
  '.cfd',
  '.sbs',
  '.rest',
  '.zip',
  '.mov',
]);

// 8 core link/message rules + 10 additional checks ported from the
// PayShield Hybrid rule engine (raw-IP hosts, @-hidden destinations,
// crypto addresses, QR-to-receive scams, ID-document asks,
// wallet-verify lures, airdrop lures, fake-support routing,
// gift-card/wire demands, secrecy coaching).
const TOTAL_LOCAL_RULES = 18;

function deLeet(input: string): string {
  return input
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function isOfficialDomain(hostname: string, officialDomains: string[]): boolean {
  const lower = hostname.toLowerCase();
  return officialDomains.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`),
  );
}

function findTrustedBrand(hostname: string): string | undefined {
  for (const brand of PROTECTED_BRANDS) {
    if (isOfficialDomain(hostname, brand.officialDomains)) {
      return brand.name;
    }
  }
  return undefined;
}

function extractTld(hostname: string): string {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return '';
  return `.${parts[parts.length - 1]}`;
}

function extractUrls(text: string): ExtractedUrl[] {
  const results: ExtractedUrl[] = [];
  const seen = new Set<string>();

  // Match explicit http(s) URLs first, plus bare domain links like bit.ly/abc or paypa1.xyz
  const urlPattern =
    /(?:https?:\/\/[^\s<>"')]+)|(?:\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|app|me|co|uk|ca|de|ly|xyz|top|click|loan|work|gq|tk|ml|cf|ga|buzz|icu|vip|cfd|sbs|rest|site|online|shop|zip|mov|at|gd|cc|gl|ru|us)(?:\/[^\s<>"')]*)?)/gi;

  const matches = text.match(urlPattern) ?? [];

  for (const rawMatch of matches) {
    const cleaned = rawMatch.replace(/[.,!?;:)\]]+$/, '');
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;

    // Avoid matching email addresses like user@paypal.com
    const idx = text.indexOf(cleaned);
    if (idx > 0 && text[idx - 1] === '@') continue;

    const hasProtocol = /^https?:\/\//i.test(cleaned);
    const parseTarget = hasProtocol ? cleaned : `https://${cleaned}`;

    try {
      const parsed = new URL(parseTarget);
      const hostname = parsed.hostname.toLowerCase();
      if (!hostname.includes('.')) continue;

      seen.add(cleaned.toLowerCase());
      const tld = extractTld(hostname);
      const trustedBrandName = findTrustedBrand(hostname);
      const isShortener =
        URL_SHORTENERS.has(hostname) ||
        Array.from(URL_SHORTENERS).some((shortener) => hostname.endsWith(`.${shortener}`));

      results.push({
        raw: cleaned,
        protocol: hasProtocol ? parsed.protocol : 'implicit:',
        hostname,
        tld,
        isHttps: hasProtocol ? parsed.protocol === 'https:' : true,
        isShortener,
        isTrustedBrand: Boolean(trustedBrandName),
        trustedBrandName,
        hidesDestination: Boolean(parsed.username),
      });
    } catch {
      // Ignore malformed URL-like fragments
    }
  }

  return results;
}

function detectLookalikeBrand(
  hostname: string,
): { brand: string; reason: string } | null {
  const lowerHost = hostname.toLowerCase();

  // Official brand domains are never lookalikes
  if (findTrustedBrand(lowerHost)) {
    return null;
  }

  // Punycode internationalized domain spoof check
  if (lowerHost.includes('xn--')) {
    return {
      brand: 'internationalized lookalike',
      reason:
        'This address uses hidden punycode characters (xn--) that can disguise fake letters as a real brand.',
    };
  }

  const hostWithoutTld = lowerHost.replace(/\.[a-z]{2,}$/, '');
  const tokens = hostWithoutTld
    .split(/[.\-_]+/)
    .filter((token) => token.length >= 4);

  const normalizedHost = deLeet(hostWithoutTld);

  for (const brand of PROTECTED_BRANDS) {
    // 1. Subdomain or hyphenated impersonation, e.g., paypal-verify.xyz or paypa1-wallet.com
    if (normalizedHost.includes(brand.keyword)) {
      return {
        brand: brand.name,
        reason: `"${hostname}" imitates ${brand.name} but is not an official ${brand.officialDomains[0]} domain.`,
      };
    }

    // 2. Typo / character-swap lookalike against individual domain tokens
    for (const token of tokens) {
      const normalizedToken = deLeet(token);
      if (normalizedToken === brand.keyword) {
        return {
          brand: brand.name,
          reason: `"${hostname}" swaps characters to look like ${brand.name} (${brand.officialDomains[0]}).`,
        };
      }
      if (
        brand.keyword.length >= 5 &&
        Math.abs(normalizedToken.length - brand.keyword.length) <= 1 &&
        levenshtein(normalizedToken, brand.keyword) === 1
      ) {
        return {
          brand: brand.name,
          reason: `"${hostname}" is a near-miss spelling of ${brand.name} (${brand.officialDomains[0]}).`,
        };
      }
    }
  }

  return null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Crypto address detection (ported from the PayShield Hybrid rule engine).
// Shape-only detection: an address string alone carries no reputation, and
// this engine is offline, so a pasted address is never called "safe".
// ---------------------------------------------------------------------------

const EVM_ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/;
const BTC_ADDRESS_RE =
  /\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/;
const SOL_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

export function detectAddresses(
  text: string,
  urls: ExtractedUrl[] = [],
): DetectedAddress[] {
  const found: DetectedAddress[] = [];
  const seen = new Set<string>();
  const insideUrl = (candidate: string) =>
    urls.some((u) => u.raw.includes(candidate));

  for (const m of text.match(new RegExp(EVM_ADDRESS_RE.source, 'g')) || []) {
    if (!seen.has(m) && !insideUrl(m)) {
      seen.add(m);
      found.push({ raw: m, kind: 'evm' });
    }
  }
  for (const m of text.match(new RegExp(BTC_ADDRESS_RE.source, 'g')) || []) {
    if (!seen.has(m) && !insideUrl(m)) {
      seen.add(m);
      found.push({ raw: m, kind: 'bitcoin' });
    }
  }
  // Solana: base58 strings of the right length that are not already
  // claimed as Bitcoin addresses and are not part of a URL.
  for (const m of text.match(new RegExp(SOL_ADDRESS_RE.source, 'g')) || []) {
    if (seen.has(m) || insideUrl(m)) continue;
    if (/^\d+$/.test(m)) continue; // plain numbers are not addresses
    if (!/[a-zA-Z]/.test(m)) continue;
    seen.add(m);
    found.push({ raw: m, kind: 'solana' });
  }
  return found;
}

const ADDRESS_KIND_NAMES: Record<DetectedAddress['kind'], string> = {
  evm: 'Ethereum / BNB Chain style (EVM)',
  bitcoin: 'Bitcoin',
  solana: 'Solana style (base58)',
};

export function runLocalRules(rawText: string): LocalAnalysisResult {
  const startedAt = performance.now();
  const text = rawText.trim();
  const urls = extractUrls(text);
  const findings: RuleFinding[] = [];

  // 1. Lookalike brand domains (check URLs first, then bare brand typos in text)
  let foundLookalike = false;
  for (const url of urls) {
    const lookalike = detectLookalikeBrand(url.hostname);
    if (lookalike) {
      foundLookalike = true;
      findings.push({
        id: `lookalike-${url.hostname}`,
        ruleKey: 'lookalike-domain',
        category: 'Lookalike brand domain',
        severity: 'danger',
        title: `Fake ${lookalike.brand} lookalike address detected`,
        explanation: `${lookalike.reason} Scammers swap letters for numbers (like "paypa1" or "g00gle") or add extra words to steal logins and payments.`,
        matchedSnippet: url.hostname,
      });
    }
  }

  if (!foundLookalike) {
    const textLookalike = firstMatch(text, [
      /\bpaypa1\b/i,
      /\bg00gle\b/i,
      /\bapp1e\b/i,
      /\barnazon\b/i,
      /\bvenm0\b/i,
      /\bstr1pe\b/i,
      /\bc0inbase\b/i,
    ]);
    if (textLookalike) {
      foundLookalike = true;
      findings.push({
        id: 'lookalike-text',
        ruleKey: 'lookalike-domain',
        category: 'Lookalike brand domain',
        severity: 'danger',
        title: 'Disguised brand spelling detected',
        explanation: `The message contains "${textLookalike}", which swaps letters for numbers to imitate a trusted brand.`,
        matchedSnippet: textLookalike,
      });
    }
  }

  // 2. Unencrypted HTTP links
  for (const url of urls) {
    if (url.protocol === 'http:') {
      findings.push({
        id: `http-${url.hostname}`,
        ruleKey: 'unencrypted-http',
        category: 'Unencrypted HTTP link',
        severity: 'caution',
        title: 'Link uses unencrypted http:// instead of https://',
        explanation:
          'Legitimate payment pages always encrypt your connection with https://. Plain http:// links are frequently used on hastily set up scam pages and do not protect your data in transit.',
        matchedSnippet: url.raw,
      });
    }
  }

  // 3. URL shorteners hiding the destination
  for (const url of urls) {
    if (url.isShortener) {
      findings.push({
        id: `shortener-${url.hostname}`,
        ruleKey: 'url-shortener',
        category: 'Hidden destination link',
        severity: 'caution',
        title: `Shortened link (${url.hostname}) hides the real website`,
        explanation:
          'URL shorteners mask where a payment link actually sends you. Scammers rely on shortened links so you cannot see a fake domain before clicking.',
        matchedSnippet: url.raw,
      });
    }
  }

  // 4. Cheap risky domain endings
  for (const url of urls) {
    if (RISKY_TLDS.has(url.tld)) {
      findings.push({
        id: `tld-${url.hostname}`,
        ruleKey: 'risky-tld',
        category: 'High-risk domain ending',
        severity: 'caution',
        title: `Unusual low-cost domain ending (${url.tld})`,
        explanation: `Established banks and payment providers rarely collect payments on "${url.tld}" domains. Scammers buy these endings in bulk because they are cheap and disposable.`,
        matchedSnippet: url.hostname,
      });
    }
  }

  // 5. Raw IP address destinations
  for (const url of urls) {
    if (
      /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) ||
      url.hostname.includes(':')
    ) {
      findings.push({
        id: `ip-${url.hostname}`,
        ruleKey: 'ip-literal',
        category: 'Raw IP address link',
        severity: 'danger',
        title: 'Link points to a raw IP address instead of a named website',
        explanation:
          'Legitimate payment services use named domains, not bare IP addresses. An IP-address payment link is a strong sign of a throwaway scam page.',
        matchedSnippet: url.raw,
      });
    }
  }

  // 6. Destination hidden behind an @ sign (https://brand@evil.tld/...)
  for (const url of urls) {
    if (url.hidesDestination) {
      findings.push({
        id: `hidden-${url.hostname}`,
        ruleKey: 'hidden-destination',
        category: 'Hidden real destination',
        severity: 'danger',
        title: 'Link hides its real destination behind an @ sign',
        explanation:
          'In a link like "paypal.com@some-other-site", everything before the @ is ignored by the browser — you would land on the site after it. Scammers use this to make a fake address look familiar.',
        matchedSnippet: url.raw,
      });
    }
  }

  // 7. Requests for a seed phrase or private key
  const seedMatch = firstMatch(text, [
    /\b(?:12|18|24)[-\s]?word\s+(?:recovery\s+|secret\s+|backup\s+)?(?:seed\s+)?phrase\b/i,
    /\b(?:seed|recovery|secret|mnemonic)\s+phrase\b/i,
    /\bprivate\s+key\b/i,
    /\bwallet\s+(?:secret|recovery|private)\s+key\b/i,
    /\b(?:enter|share|confirm|provide|verify)\s+(?:your\s+)?(?:seed|mnemonic|private\s+key|recovery\s+phrase)\b/i,
    /\b(?:12|24)\s+words\b/i,
  ]);
  if (seedMatch) {
    findings.push({
      id: 'seed-phrase',
      ruleKey: 'seed-phrase',
      category: 'Wallet credentials request',
      severity: 'danger',
      title: 'Asks for your seed phrase or private key',
      explanation:
        'No legitimate company, support agent, or payment service will ever ask for your recovery seed phrase or private key to "verify" a wallet. Anyone who gets it can drain all funds permanently.',
      matchedSnippet: seedMatch,
    });
  }

  // 8. 'Send money first to unlock' wording (advance-fee scam)
  const advanceFeeMatch = firstMatch(text, [
    /\bsend\s+(?:a\s+)?(?:\$?\d[\d,.]*\s+)?(?:money|funds|crypto|btc|eth|usdt|payment|verification\s+deposit|deposit|fee)\s+(?:first\s+)?to\s+(?:unlock|verify|release|claim|activate|receive)\b/i,
    /\b(?:verification|activation|unlock|clearance|processing)\s+(?:deposit|fee)\b/i,
    /\bpay\s+(?:a\s+)?(?:small\s+)?(?:fee|deposit|\$?\d[\d,.]*)\s+(?:first\s+)?to\s+(?:unlock|release|claim|receive|withdraw)\b/i,
    /\b(?:send|transfer|deposit)\s+money\s+first\b/i,
    /\bto\s+unlock\s+your\s+(?:\$?\d[\d,.]*\s+)?(?:balance|funds|payout|winnings|account)\b/i,
    // Broader form (from the PayShield Hybrid engine): "send <anything> first /
    // before / to verify|unlock|..." — the decimal-aware gap lets it cross
    // amounts like "0.05" in "Send 0.05 BNB first to unlock…".
    /\bsend\b(?:[^.]|\.(?=\d)){0,60}\b(?:first|before|to\s+(?:verify|unlock|activate|release|confirm))\b/i,
  ]);
  if (advanceFeeMatch) {
    findings.push({
      id: 'advance-fee',
      ruleKey: 'advance-fee',
      category: 'Advance-fee payment trap',
      severity: 'danger',
      title: 'Asks you to send money first to unlock funds',
      explanation:
        'Being told to pay a deposit or fee to "unlock" or "verify" a larger balance is a classic advance-fee scam. Real payment platforms never require an upfront transfer to release your own money.',
      matchedSnippet: advanceFeeMatch,
    });
  }

  // 9. Guaranteed-return promises
  const guaranteedReturnMatch = firstMatch(text, [
    /\bguaranteed\s+(?:daily\s+|weekly\s+|monthly\s+|instant\s+)?(?:returns?|profits?|income|payouts?|roi)\b/i,
    /\b100%\s+(?:guaranteed|risk[-\s]?free)\s*(?:returns?|profits?|profit|payout|safe)?\b/i,
    /\b(?:double|triple)\s+your\s+(?:money|deposit|crypto|investment|btc|eth)\b/i,
    /\brisk[-\s]?free\s+(?:profit|returns?|investment|income)\b/i,
    /\b(?:5x|10x|100x)\s+(?:your\s+money|guaranteed|returns?|profit)\b/i,
    /\bturn\s+\$?\d[\d,.]*\s+into\s+\$?\d[\d,.]*\b/i,
    /\b(?:guaranteed|risk[-\s]?free|100%)\b[^.]{0,40}\b(?:returns?|profits?|income|gains?|money\s+back)\b/i,
    /\b(?:double|triple|2x|3x|10x)\b[^.]{0,30}\b(?:your\s+)?(?:money|crypto|btc|eth|bnb|deposit|investment)\b/i,
  ]);
  if (guaranteedReturnMatch) {
    findings.push({
      id: 'guaranteed-return',
      ruleKey: 'guaranteed-return',
      category: 'Unrealistic profit promise',
      severity: 'danger',
      title: 'Promises guaranteed or multiplied financial returns',
      explanation:
        'No legitimate investment or payment request can guarantee risk-free profits or promise to double your money. This phrasing is a hallmark of crypto and investment scams.',
      matchedSnippet: guaranteedReturnMatch,
    });
  }

  // 10. Urgency pressure
  const urgencyMatch = firstMatch(text, [
    /\burgent(?:ly)?\b/i,
    /\bpay\s+immediately\b/i,
    /\bimmediately\b/i,
    /\bwithin\s+\d+\s*(?:minutes?|mins?|hours?|hrs?)\b/i,
    /\b(?:final\s+notice|final\s+warning|last\s+chance)\b/i,
    /\b(?:permanent\s+closure|account\s+(?:will\s+be\s+)?(?:suspended|locked|closed|terminated)|account\s+is\s+locked)\b/i,
    /\bact\s+now\b/i,
    /\boverdue\b/i,
    /\bexpires?\s+(?:in|today|tonight|soon)\b/i,
    /\bbefore\s+(?:midnight|permanent\s+closure|suspension)\b/i,
  ]);
  if (urgencyMatch) {
    findings.push({
      id: 'urgency-pressure',
      ruleKey: 'urgency-pressure',
      category: 'Urgency pressure',
      severity: 'caution',
      title: 'Creates artificial time pressure to rush payment',
      explanation:
        'Scammers use threats of overdue penalties, deadlines, or locked accounts so you pay before pausing to double-check the sender or link.',
      matchedSnippet: urgencyMatch,
    });
  }

  // 11. Scan/pay a QR code to RECEIVE money (payment-reversal scam)
  const qrReceiveMatch = firstMatch(text, [
    /\b(?:scan|pay)\b[^.]{0,30}\b(?:qr|code)\b[^.]{0,40}\b(?:receive|refund|collect|get)\b/i,
  ]);
  if (qrReceiveMatch) {
    findings.push({
      id: 'qr-receive',
      ruleKey: 'qr-receive',
      category: 'QR code reversal scam',
      severity: 'danger',
      title: 'Asks you to scan or pay a QR code to receive money',
      explanation:
        'Receiving money never requires scanning a QR code and entering a PIN or paying. That flow sends money OUT of your account — a well-known payment-app reversal scam.',
      matchedSnippet: qrReceiveMatch,
    });
  }

  // 12. Identity documents requested up front
  const idDocsMatch = firstMatch(text, [
    /\b(?:upload|send|share|photograph)\b[^.]{0,40}\b(?:passport|id\s+card|driver'?s\s+licen[cs]e|aadhaar|ssn|social\s+security)\b/i,
  ]);
  if (idDocsMatch) {
    findings.push({
      id: 'id-documents',
      ruleKey: 'id-documents',
      category: 'Identity document request',
      severity: 'danger',
      title: 'Asks for identity documents up front',
      explanation:
        'Being asked to send ID photos inside a chat or to an unknown page, outside a regulated service\u2019s normal onboarding, risks identity theft.',
      matchedSnippet: idDocsMatch,
    });
  }

  // 13. "Verify / validate / sync your wallet" drainer wording
  const walletVerifyMatch = firstMatch(text, [
    /\b(?:verify|validate|restore|sync|rectify)\b[^.]{0,30}\b(?:your\s+)?(?:wallet|account)\b/i,
  ]);
  if (walletVerifyMatch) {
    findings.push({
      id: 'wallet-verify-lure',
      ruleKey: 'wallet-verify-lure',
      category: 'Wallet verification lure',
      severity: 'caution',
      title: 'Asks you to "verify" or "validate" your wallet',
      explanation:
        'Wallets do not need to be verified, validated or rectified through a link. This wording is a staple of wallet-drainer pages.',
      matchedSnippet: walletVerifyMatch,
    });
  }

  // 14. Unsolicited prize / airdrop claim
  const airdropMatch = firstMatch(text, [
    /\b(?:claim|collect|redeem)\b[^.]{0,30}\b(?:airdrop|reward|bonus|prize|gift|free\s+tokens?)\b/i,
  ]);
  if (airdropMatch) {
    findings.push({
      id: 'airdrop-lure',
      ruleKey: 'airdrop-lure',
      category: 'Unsolicited prize claim',
      severity: 'caution',
      title: 'Unsolicited prize or airdrop that must be claimed',
      explanation:
        'Unexpected rewards that must be claimed through a link are a leading way to get a wallet connected to a malicious page.',
      matchedSnippet: airdropMatch,
    });
  }

  // 15. "Support team" routing inside chat
  const supportMatch = firstMatch(text, [
    /\b(?:support\s+team|admin|official\s+team|customer\s+care|help\s+desk|moderator)\b[^.]{0,60}\b(?:contact|dm|message|reply|send)\b/i,
  ]);
  if (supportMatch) {
    findings.push({
      id: 'support-impersonation',
      ruleKey: 'support-impersonation',
      category: 'Fake support routing',
      severity: 'caution',
      title: 'Directs you to "support" inside a chat',
      explanation:
        'Real support does not operate through chat DMs asking you to act on a link. Treat unsolicited support outreach as hostile.',
      matchedSnippet: supportMatch,
    });
  }

  // 16. Payment by gift card or wire transfer
  const giftCardMatch = firstMatch(text, [
    /\b(?:gift\s+cards?|wire\s+transfer|western\s+union|moneygram)\b/i,
  ]);
  if (giftCardMatch) {
    findings.push({
      id: 'gift-card-wire',
      ruleKey: 'gift-card-wire',
      category: 'Untraceable payment method',
      severity: 'caution',
      title: 'Asks for payment by gift card or wire transfer',
      explanation:
        'Requests to pay by gift card or wire transfer are untraceable and unrecoverable, which is exactly why scammers ask for them.',
      matchedSnippet: giftCardMatch,
    });
  }

  // 17. Secrecy coaching ("do not tell anyone")
  const secrecyMatch = firstMatch(text, [
    /\bdo\s+not\s+(?:tell|share|inform)\b[^.]{0,30}\b(?:anyone|bank|family)\b/i,
  ]);
  if (secrecyMatch) {
    findings.push({
      id: 'secrecy-demand',
      ruleKey: 'secrecy-demand',
      category: 'Secrecy coaching',
      severity: 'caution',
      title: 'Asks you to keep the payment secret',
      explanation:
        'Being told to hide a payment from your bank or family is a hallmark of fraud coaching.',
      matchedSnippet: secrecyMatch,
    });
  }

  // 18. Bare crypto addresses — shape is valid, ownership is unverifiable
  const addresses = detectAddresses(text, urls);
  for (const address of addresses.slice(0, 3)) {
    findings.push({
      id: `address-${address.raw}`,
      ruleKey: 'crypto-address',
      category: 'Unverifiable crypto address',
      severity: 'caution',
      title: `Pasted ${ADDRESS_KIND_NAMES[address.kind]} address cannot be verified offline`,
      explanation:
        'This checker cannot see the address\u2019s history, its owner, or whether it was copied correctly. Compare it character-by-character with the address from the official source, and send a tiny test amount first if you decide to pay.',
      matchedSnippet: address.raw,
    });
  }

  // Build positive passed-checks summary so safe messages show transparent verification
  const triggeredKeys = new Set(findings.map((f) => f.ruleKey));
  const passedChecks: PassedCheck[] = [];

  const trustedUrls = urls.filter((u) => u.isTrustedBrand);
  if (!triggeredKeys.has('lookalike-domain')) {
    passedChecks.push({
      id: 'pass-domain',
      label: 'Brand & domain check',
      detail:
        trustedUrls.length > 0
          ? `Recognized official ${trustedUrls[0].trustedBrandName} domain (${trustedUrls[0].hostname}).`
          : 'No brand-impersonation or lookalike domains detected.',
    });
  }

  if (!triggeredKeys.has('unencrypted-http') && !triggeredKeys.has('url-shortener') && !triggeredKeys.has('risky-tld') && !triggeredKeys.has('ip-literal') && !triggeredKeys.has('hidden-destination')) {
    passedChecks.push({
      id: 'pass-link-hygiene',
      label: 'Link hygiene & encryption',
      detail:
        urls.length > 0
          ? 'Link uses HTTPS encryption, avoids URL shorteners and IP addresses, and uses a standard domain ending.'
          : 'No risky, shortened, or unencrypted payment links found.',
    });
  }

  if (!triggeredKeys.has('seed-phrase') && !triggeredKeys.has('advance-fee') && !triggeredKeys.has('guaranteed-return') && !triggeredKeys.has('qr-receive') && !triggeredKeys.has('id-documents') && !triggeredKeys.has('wallet-verify-lure') && !triggeredKeys.has('airdrop-lure')) {
    passedChecks.push({
      id: 'pass-scam-phrases',
      label: 'Wallet & payment-trap language',
      detail: 'No requests for seed phrases, upfront unlock fees, guaranteed-return promises, QR-to-receive tricks, or ID documents.',
    });
  }

  if (!triggeredKeys.has('crypto-address')) {
    passedChecks.push({
      id: 'pass-address',
      label: 'Crypto address check',
      detail: 'No bare wallet addresses pasted — nothing unverifiable to pay directly.',
    });
  }

  if (!triggeredKeys.has('urgency-pressure') && !triggeredKeys.has('support-impersonation') && !triggeredKeys.has('secrecy-demand') && !triggeredKeys.has('gift-card-wire')) {
    passedChecks.push({
      id: 'pass-urgency',
      label: 'Tone & pressure check',
      detail: 'No threatening deadlines, fake-support routing, secrecy demands, or artificial urgency detected.',
    });
  }

  const dangerCount = findings.filter((f) => f.severity === 'danger').length;
  const cautionCount = findings.filter((f) => f.severity === 'caution').length;

  let verdict: Verdict = 'safe';
  if (dangerCount > 0) {
    verdict = 'danger';
  } else if (cautionCount > 0) {
    verdict = 'caution';
  }

  // Hybrid auto-routing decision:
  // If on-device checks already found clear Danger (high-confidence scam signals),
  // Hybrid mode resolves privately on-device without needing to send the text to the cloud.
  // For Safe or Caution inputs, Hybrid consults Cloud Gemini AI for a nuanced second opinion.
  const shouldResolveLocallyInHybrid = dangerCount >= 1;
  const hybridRoutingReason = shouldResolveLocallyInHybrid
    ? 'High-confidence scam signals were already caught privately on your device, so Hybrid mode resolved this locally without sending your text to the cloud.'
    : verdict === 'caution'
      ? 'Local checks found warning signs that benefit from context analysis, so Hybrid mode requested a Gemini AI second opinion.'
      : 'Local checks passed, so Hybrid mode requested a Gemini AI second opinion to screen for subtle social engineering.';

  const durationMs = Math.max(0.2, Number((performance.now() - startedAt).toFixed(1)));

  return {
    verdict,
    findings,
    passedChecks,
    urls,
    addresses,
    checkedRuleCount: TOTAL_LOCAL_RULES,
    durationMs,
    shouldResolveLocallyInHybrid,
    hybridRoutingReason,
  };
}

/**
 * Generates an on-device plain-English assessment strictly from local rule checks
 * when running in "On-device only" mode or when "Hybrid (auto)" resolves locally.
 */
export function buildOnDeviceOpinion(
  local: LocalAnalysisResult,
  routingNote: string,
): AiOpinionResult {
  if (local.verdict === 'danger') {
    const dangerFindings = local.findings.filter((f) => f.severity === 'danger');
    const topCategories = dangerFindings.map((f) => f.category.toLowerCase());
    const joined =
      topCategories.length > 1
        ? `${topCategories.slice(0, -1).join(', ')} and ${topCategories[topCategories.length - 1]}`
        : topCategories[0] ?? 'high-risk scam patterns';

    return {
      verdict: 'danger',
      headline: 'High-confidence payment scam blocked locally',
      explanation: `On-device rules flagged critical scam indicators including ${joined}. Do not click any links, transfer funds, or enter wallet credentials from this message.`,
      keyRisks: local.findings.slice(0, 4).map((f) => `${f.title} (${f.matchedSnippet})`),
      recommendedAction:
        'Delete or ignore this message. If you want to check an account, open the official website or app yourself.',
      source: 'on-device',
      routingNote,
    };
  }

  if (local.verdict === 'caution') {
    const categories = local.findings.map((f) => f.category.toLowerCase()).join(', ');
    return {
      verdict: 'caution',
      headline: 'Suspicious signals need verification before paying',
      explanation: `On-device rules detected warning signs (${categories}). This message hides key details or tries to rush your decision, which is common in payment phishing.`,
      keyRisks: local.findings.slice(0, 4).map((f) => `${f.title} (${f.matchedSnippet})`),
      recommendedAction:
        'Pause before clicking. Contact the sender or company using a phone number or website you already trust.',
      source: 'on-device',
      routingNote,
    };
  }

  const trustedLink = local.urls.find((u) => u.isTrustedBrand);
  return {
    verdict: 'safe',
    headline: 'No local scam indicators detected',
    explanation: trustedLink
      ? `The link points to an official ${trustedLink.trustedBrandName} address over HTTPS, and the message contains none of the common scam triggers checked on this device.`
      : `None of the ${local.checkedRuleCount} on-device scam rules were triggered. Always confirm you recognize the person or business requesting payment before sending funds.`,
    keyRisks: local.passedChecks.slice(0, 3).map((p) => p.detail),
    recommendedAction:
      'Double-check the recipient name and amount on the payment screen before confirming.',
    source: 'on-device',
    routingNote,
  };
}
