import { create } from 'zustand';

export type PackageType = 'basic' | 'standard' | 'professional';

export interface Society {
  id: string;
  name: string;
  registration_no: string | null;
  registration_date: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  pan_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  financial_year: string;
  logo_url: string | null;
  package_type: PackageType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeatureSettings {
  id: string;
  society_id: string;
  enable_tenant_management: boolean;
  enable_committee_management: boolean;
  enable_bank_reconciliation: boolean;
  enable_online_payment: boolean;
  enable_visitor_management: boolean;
  enable_amenity_booking: boolean;
  enable_asset_management: boolean;
  enable_vendor_management: boolean;
  enable_meeting_management: boolean;
  enable_document_management: boolean;
  enable_whatsapp: boolean;
  enable_sms: boolean;
  enable_email: boolean;
  enable_multi_language: boolean;
}

interface SocietyState {
  currentSociety: Society | null;
  societies: Society[];
  features: FeatureSettings | null;
  isLoading: boolean;
  
  // Actions
  setCurrentSociety: (society: Society | null) => void;
  setSocieties: (societies: Society[]) => void;
  setFeatures: (features: FeatureSettings | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
  
  // Feature checks
  isFeatureEnabled: (feature: keyof Omit<FeatureSettings, 'id' | 'society_id'>) => boolean;
}

const initialState = {
  currentSociety: null,
  societies: [],
  features: null,
  isLoading: false,
};

export const useSocietyStore = create<SocietyState>()((set, get) => ({
  ...initialState,
  
  setCurrentSociety: (society) => set({ currentSociety: society }),
  setSocieties: (societies) => set({ societies }),
  setFeatures: (features) => set({ features }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  reset: () => set(initialState),
  
  isFeatureEnabled: (feature) => {
    const { features, currentSociety } = get();
    if (!features || !currentSociety) return false;
    
    // Professional package has all features
    if (currentSociety.package_type === 'professional') {
      return features[feature] ?? false;
    }
    
    // Standard package has core + some advanced
    if (currentSociety.package_type === 'standard') {
      const standardFeatures = [
        'enable_tenant_management',
        'enable_committee_management',
        'enable_document_management',
        'enable_email',
      ];
      if (standardFeatures.includes(feature)) {
        return features[feature] ?? false;
      }
    }
    
    // Basic package - only core features
    const basicFeatures = ['enable_document_management', 'enable_email'];
    if (basicFeatures.includes(feature)) {
      return features[feature] ?? false;
    }
    
    return features[feature] ?? false;
  },
}));
