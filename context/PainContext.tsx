import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PainMarkerData {
  x: number;
  y: number;
  intensity: number;
}

interface PainContextType {
  painMarker: PainMarkerData | null;
  setPainMarker: (marker: PainMarkerData | null) => void;
  selectedOrgan: any;
  setSelectedOrgan: (organ: any) => void;
}

const PainContext = createContext<PainContextType | undefined>(undefined);

export const PainProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [painMarker, setPainMarker] = useState<PainMarkerData | null>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<any>(null);

  return (
    <PainContext.Provider value={{ painMarker, setPainMarker, selectedOrgan, setSelectedOrgan }}>
      {children}
    </PainContext.Provider>
  );
};

export const usePainContext = () => {
  const context = useContext(PainContext);
  if (!context) {
    throw new Error('usePainContext must be used within a PainProvider');
  }
  return context;
};

export default PainContext;
