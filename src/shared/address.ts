export type Coordinates = { lat: number; lng: number };
export type AddressInput = {
  label: string;
  postalCode: string;
  recipient: string;
  mobile: string;
  address: string;
  coordinates: Coordinates | null;
};
export type AddressItem = AddressInput & { id: string; revision: number };
