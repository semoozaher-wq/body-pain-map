import React, { createContext, useContext, useState, type ReactNode } from 'react';

// ============================================================================
// سياق الألم الموحّد (Shared Pain Context)
// ----------------------------------------------------------------------------
// مصدر حقيقة واحد لعلامة الألم المحدَّدة على خريطة الجسم والعضو الداخلي المختار.
// يُستهلك من:
//   • MainApp.tsx            → لتمرير selectedPainLocation إلى المساعد المركزي.
//   • screens/BodyPickerScreen.tsx → لعرض العلامة/العضو وتحديثهما.
//
// ملاحظة مهمّة حول حساسية حالة الأحرف (Case-Sensitivity):
//   اسم الملف هو  context/PainContext.tsx  (P كبيرة)
//   لذلك يجب أن يكون الاستيراد دائمًا:
//     import { usePainContext } from '../context/PainContext';
//   أي تغيير في حالة الأحرف (painContext) سيكسر البناء على Linux/Vercel.
// ============================================================================

/** علامة الألم على خريطة الجسم: إحداثيات نسبية + العرض (أمامي/خلفي). */
export interface PainMarkerData {
  x: number;
  y: number;
  view: 'front' | 'back';
}

interface PainContextType {
  painMarker: PainMarkerData | null;
  setPainMarker: (marker: PainMarkerData | null) => void;
  /** معرّف العضو الداخلي المحدَّد حاليًا على الخريطة (أو null). */
  selectedOrganId: string | null;
  setSelectedOrganId: (organId: string | null) => void;
}

const PainContext = createContext<PainContextType | undefined>(undefined);

export const PainProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [painMarker, setPainMarker] = useState<PainMarkerData | null>(null);
  const [selectedOrganId, setSelectedOrganId] = useState<string | null>(null);

  return (
    <PainContext.Provider value={{ painMarker, setPainMarker, selectedOrganId, setSelectedOrganId }}>
      {children}
    </PainContext.Provider>
  );
};

export const usePainContext = (): PainContextType => {
  const context = useContext(PainContext);
  if (!context) {
    throw new Error('usePainContext must be used within a PainProvider');
  }
  return context;
};

export default PainContext;
