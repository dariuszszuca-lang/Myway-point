// Adresy i identyfikatory zaplecza na AWS (konto MyWay Produkcja, eu-central-1).
// To identyfikatory publiczne, nie sekrety: przeglądarka i tak je widzi.
export const REGION = 'eu-central-1';
export const API_URL: string =
  import.meta.env.VITE_REZ_API_URL || 'https://glkbxptm1f.execute-api.eu-central-1.amazonaws.com';
export const CLIENT_ID: string =
  import.meta.env.VITE_REZ_CLIENT_ID || '1f4rubtseed2b3l6p82htfv09c';
