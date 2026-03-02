export interface Field {
  id: string;
  label: string;
  type:
    | 'STRING'
    | 'CONCEALED'
    | 'EMAIL'
    | 'URL'
    | 'PHONE'
    | 'ADDRESS'
    | 'DATE'
    | 'MONTH_YEAR'
    | 'CREDIT_CARD_NUMBER'
    | 'CREDIT_CARD_TYPE';
  purpose?: 'USERNAME' | 'PASSWORD' | 'NOTES' | null;
  value?: string; // Only present if field has value
  sectionId?: string;
  passwordDetails?: {
    strength: 'WEAK' | 'TERRIBLE' | 'FAIR' | 'GOOD' | 'STRONG';
    history?: string[];
  };
}

export interface Section {
  id: string;
  label: string;
}

export interface EncryptedEntryData {
  urls?: { primary: boolean; href: string; label?: string }[];
  tags?: string[];
  sections?: Section[];
  fields: Field[];
  additionalInformation?: string;
  passwordHistory?: { password: string; timestamp: string }[];
}

export interface OnePasswordItem {
  id: string;
  title: string;
  category: string;
  fields: any[];
  urls?: any[];
  tags?: string[];
  sections?: any[];
  created_at: string;
  updated_at: string;
  vault: { id: string; name: string };
}
