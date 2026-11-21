import type { SampleCase } from '../types';

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: 'safe',
    label: 'Safe example',
    shortHint: 'Real paypal.com link',
    expectedVerdict: 'safe',
    content:
      'Hi Jordan, here is the PayPal link for Friday’s workshop invoice ($120): https://www.paypal.com/paypalme/studioledger/120 — no rush, whenever you have a moment.',
  },
  {
    id: 'suspicious',
    label: 'Suspicious example',
    shortHint: 'Shortened bit.ly link + urgent wording',
    expectedVerdict: 'caution',
    content:
      'URGENT: Your parcel customs fee ($14.80) is overdue! Pay immediately within 2 hours or your shipment will be returned to sender: https://bit.ly/3xPayNotice',
  },
  {
    id: 'scam',
    label: 'Obvious scam',
    shortHint: 'paypa1 lookalike + seed phrase request',
    expectedVerdict: 'danger',
    content:
      'PayPal Security Alert: Your account is locked. To verify your wallet and unlock your $2,450 balance, send a $50 verification deposit or enter your 12-word seed phrase immediately at http://paypa1-wallet-verify.xyz/confirm before permanent closure!',
  },
];
