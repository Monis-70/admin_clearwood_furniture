import type { EnquiryStatus } from '@shared/enums';

import type { StatusRegistry } from '@/components/patterns/status-badge';

export const ENQUIRY_STATUS: StatusRegistry<EnquiryStatus> = {
  NEW: { label: 'New', tone: 'info', description: 'Nobody has replied yet.' },
  CONTACTED: { label: 'Contacted', tone: 'warning', description: 'Someone got in touch.' },
  QUOTED: { label: 'Quoted', tone: 'brand', description: 'A quote was sent.' },
  CLOSED: { label: 'Closed', tone: 'success', description: 'Finished: won, lost or not needed.' },
  SPAM: { label: 'Spam', tone: 'neutral', description: 'Not a real enquiry.' },
};

export const CONTRACT_WORK_FORM = 'contract-work';

const FORM_LABELS: Record<string, string> = {
  'contract-work': 'Contract work',
  'home-interiors': 'Home interiors',
};

export const formLabel = (key: string) => FORM_LABELS[key] ?? key.replace(/-/g, ' ');
