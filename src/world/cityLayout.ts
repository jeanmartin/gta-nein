/**
 * Data-driven layout of Bad Regelsheim. Coordinates are tile coordinates.
 * Streets are axis-aligned. For horizontal streets the top half of the lanes
 * drives west and the bottom half east (right-hand traffic); for vertical
 * streets the left half drives south and the right half north.
 */
import { Z, type Card, type ZoneId } from './types';

export const MAP_W = 200;
export const MAP_H = 96;

/** Inside this rect: sidewalks and buildings. Outside: countryside. */
export const CITY = { x0: 8, y0: 18, x1: 115, y1: 88 };

export interface StreetDef {
  id: string;
  name: string;
  axis: 'h' | 'v';
  at: number;
  lanes: number;
  from: number;
  to: number;
  zone: ZoneId;
  oneWay?: Card;
}

export const STREETS: StreetDef[] = [
  { id: 'A1', name: 'A 99½', axis: 'h', at: 4, lanes: 4, from: 10, to: 193, zone: Z.AUTOBAHN },
  { id: 'H1', name: 'Hauptstraße', axis: 'h', at: 20, lanes: 2, from: 10, to: 113, zone: Z.Z50 },
  { id: 'LW', name: 'Lindenweg', axis: 'h', at: 32, lanes: 2, from: 58, to: 83, zone: Z.SPIEL },
  { id: 'H2', name: 'Bahnhofstraße', axis: 'h', at: 44, lanes: 2, from: 10, to: 113, zone: Z.Z50 },
  { id: 'AW', name: 'Amselweg', axis: 'h', at: 56, lanes: 2, from: 34, to: 59, zone: Z.Z30 },
  { id: 'H3', name: 'Schulstraße', axis: 'h', at: 66, lanes: 2, from: 10, to: 113, zone: Z.Z30 },
  { id: 'H4', name: 'Ringstraße', axis: 'h', at: 82, lanes: 2, from: 10, to: 193, zone: Z.Z50 },
  { id: 'V1', name: 'Westring', axis: 'v', at: 10, lanes: 2, from: 4, to: 83, zone: Z.Z50 },
  { id: 'V2', name: 'Goethestraße', axis: 'v', at: 34, lanes: 2, from: 20, to: 83, zone: Z.Z50 },
  { id: 'V3n', name: 'Marktstraße', axis: 'v', at: 58, lanes: 2, from: 20, to: 45, zone: Z.Z50, oneWay: 'S' },
  { id: 'V3s', name: 'Marktstraße', axis: 'v', at: 58, lanes: 2, from: 44, to: 83, zone: Z.Z50 },
  { id: 'V4', name: 'Schillerstraße', axis: 'v', at: 82, lanes: 2, from: 20, to: 83, zone: Z.Z50 },
  { id: 'V5', name: 'Ostring', axis: 'v', at: 112, lanes: 2, from: 20, to: 83, zone: Z.Z50 },
  { id: 'A2', name: 'A 99½', axis: 'v', at: 190, lanes: 4, from: 4, to: 83, zone: Z.AUTOBAHN },
];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zone overrides applied to road tiles after rasterising streets. */
export const ZONE_OVERRIDES: { rect: Rect; zone: ZoneId }[] = [
  { rect: { x: 114, y: 82, w: 76, h: 2 }, zone: Z.LAND }, // Ringstraße out of town
  { rect: { x: 10, y: 8, w: 2, h: 12 }, zone: Z.LAND }, // Westring feeder road
];

export const TUNNELS: Rect[] = [{ x: 40, y: 82, w: 31, h: 2 }];

/** Intersection control by "hStreet|vStreet". Default: rechts vor links. */
export const CONTROLS: Record<string, string> = {
  'A1|V1': 'curve',
  'A1|A2': 'curve',
  'H4|A2': 'curve',
  'H4|V1': 'curve',
  'H1|V5': 'curve',
  'H1|V3n': 'light',
  'H1|V4': 'light',
  'H2|V2': 'light',
  'H2|V3n': 'light',
  'H2|V4': 'light',
  'H4|V5': 'light',
  'H1|V1': 'stopH',
  'H1|V2': 'stopV',
  'H2|V1': 'stopH',
  'H2|V5': 'stopH',
  'H3|V1': 'stopH',
  'H3|V5': 'stopH',
  'H3|V4': 'stopH',
  'H4|V2': 'stopV',
  'H4|V3s': 'stopV',
  'H4|V4': 'stopV',
  'LW|V3n': 'stopH',
  'LW|V4': 'stopH',
};

/** Zebra crossings: tile of the first lane and the axis of the road they cross. */
export const ZEBRAS: { x: number; y: number; axis: 'h' | 'v' }[] = [
  { x: 46, y: 66, axis: 'h' }, // Schulstraße at the school
  { x: 100, y: 44, axis: 'h' }, // Bahnhofstraße at the station
  { x: 34, y: 60, axis: 'v' }, // Goethestraße at the park
];

/** Bike lanes painted onto the sidewalk area of Bahnhofstraße. */
export const BIKE_STRIPS: { bike: Rect; walk: Rect }[] = [
  { bike: { x: 62, y: 43, w: 18, h: 1 }, walk: { x: 61, y: 42, w: 20, h: 1 } },
  { bike: { x: 62, y: 46, w: 18, h: 1 }, walk: { x: 61, y: 47, w: 20, h: 1 } },
];

export interface LotDef extends Rect {
  /** Side of the lot that faces the street. */
  street: Card;
}

export interface PoiDef {
  id: string;
  name: string;
  label: string;
  rect: Rect;
  color: string;
  door: { x: number; y: number };
  lot?: LotDef;
}

export const POIS: PoiDef[] = [
  {
    id: 'home',
    name: 'Your flat',
    label: 'WOHNUNG',
    rect: { x: 46, y: 59, w: 7, h: 6 },
    color: '#b5734a',
    door: { x: 48, y: 58 },
    lot: { x: 40, y: 59, w: 6, h: 3, street: 'N' },
  },
  {
    id: 'buergeramt',
    name: 'Bürgeramt',
    label: 'BÜRGERAMT',
    rect: { x: 40, y: 30, w: 13, h: 13 },
    color: '#7d8a99',
    door: { x: 46, y: 43 },
    lot: { x: 53, y: 40, w: 4, h: 3, street: 'S' },
  },
  {
    id: 'ordnungsamt',
    name: 'Ordnungsamt',
    label: 'ORDNUNGSAMT',
    rect: { x: 40, y: 47, w: 13, h: 8 },
    color: '#8c7b6b',
    door: { x: 46, y: 46 },
  },
  {
    id: 'zulassung',
    name: 'Kfz-Zulassungsstelle',
    label: 'KFZ-ZULASSUNG',
    rect: { x: 92, y: 69, w: 13, h: 10 },
    color: '#6f7f6a',
    door: { x: 98, y: 68 },
    lot: { x: 85, y: 69, w: 6, h: 3, street: 'N' },
  },
  {
    id: 'tuev',
    name: 'TÜV',
    label: 'TÜV',
    rect: { x: 92, y: 23, w: 13, h: 12 },
    color: '#2f5f9e',
    door: { x: 97, y: 22 },
    lot: { x: 85, y: 23, w: 6, h: 3, street: 'N' },
  },
  {
    id: 'oma',
    name: "Oma's house",
    label: 'OMA',
    rect: { x: 66, y: 35, w: 6, h: 6 },
    color: '#c27c7c',
    door: { x: 68, y: 34 },
    lot: { x: 72, y: 35, w: 6, h: 3, street: 'N' },
  },
  {
    id: 'finanzamt',
    name: 'Finanzamt',
    label: 'FINANZAMT',
    rect: { x: 20, y: 28, w: 12, h: 15 },
    color: '#5b5f6b',
    door: { x: 25, y: 43 },
    lot: { x: 13, y: 40, w: 6, h: 3, street: 'S' },
  },
  {
    id: 'wertstoff',
    name: 'Wertstoffinsel',
    label: '',
    rect: { x: 20, y: 73, w: 0, h: 0 },
    color: '#777',
    door: { x: 25, y: 71 },
    lot: { x: 13, y: 69, w: 6, h: 3, street: 'N' },
  },
  {
    id: 'schule',
    name: 'Grundschule',
    label: 'GRUNDSCHULE',
    rect: { x: 38, y: 70, w: 18, h: 10 },
    color: '#c9a35a',
    door: { x: 46, y: 68 },
  },
  {
    id: 'kirche',
    name: 'Kirche St. Bürokratius',
    label: 'KIRCHE',
    rect: { x: 66, y: 70, w: 9, h: 10 },
    color: '#9a8f86',
    door: { x: 70, y: 68 },
    lot: { x: 61, y: 69, w: 4, h: 3, street: 'N' },
  },
  {
    id: 'bahnhof',
    name: 'Bahnhof',
    label: 'BAHNHOF',
    rect: { x: 88, y: 47, w: 19, h: 7 },
    color: '#a0523d',
    door: { x: 97, y: 46 },
    lot: { x: 107, y: 47, w: 4, h: 3, street: 'N' },
  },
  {
    id: 'rathaus',
    name: 'Rathaus',
    label: 'RATHAUS',
    rect: { x: 62, y: 48, w: 11, h: 9 },
    color: '#b49a5e',
    door: { x: 67, y: 47 },
  },
  {
    id: 'landesamt',
    name: 'Landesamt für Formularwesen',
    label: 'LANDESAMT',
    rect: { x: 153, y: 85, w: 10, h: 7 },
    color: '#646e78',
    door: { x: 152, y: 87 },
    lot: { x: 144, y: 85, w: 8, h: 3, street: 'N' },
  },
];

export const PARK: Rect = { x: 13, y: 47, w: 20, h: 18 };
export const FOUNTAIN: Rect = { x: 21, y: 54, w: 3, h: 3 };
export const FOUNTAIN_RING: Rect = { x: 20, y: 53, w: 5, h: 5 };

/** Plaza of the recycling point; containers stand in its last row. */
export const WERTSTOFF_PLAZA: Rect = { x: 20, y: 69, w: 11, h: 4 };
export const LANDESAMT_PATH: Rect = { x: 152, y: 84, w: 1, h: 5 };

export interface ContainerDef {
  x: number;
  y: number;
  label: string;
  accepts: string;
  color: string;
}
export const CONTAINERS: ContainerDef[] = [
  { x: 20, y: 72, label: 'Papier', accepts: 'Altpapier', color: '#2f62c9' },
  { x: 22, y: 72, label: 'Gelbe Tonne', accepts: 'Gelber Sack', color: '#e3c62b' },
  { x: 24, y: 72, label: 'Bio', accepts: 'Bioabfall', color: '#7a4f2a' },
  { x: 26, y: 72, label: 'Weißglas', accepts: 'Weißglas', color: '#e8e8e8' },
  { x: 28, y: 72, label: 'Grünglas', accepts: 'Grünglas', color: '#3f8f45' },
  { x: 30, y: 72, label: 'Braunglas', accepts: 'Braunglas', color: '#8a5a2b' },
];

/** Speed cameras (Blitzer) on sidewalk tiles. */
export const BLITZERS: { x: number; y: number }[] = [
  { x: 90, y: 43 },
  { x: 33, y: 62 },
  { x: 100, y: 22 },
  { x: 42, y: 65 },
  { x: 75, y: 31 },
  { x: 90, y: 81 },
  { x: 24, y: 19 },
];

export const RENTNER_NAMES = [
  'Frau Kowalski',
  'Herr Pingelig',
  'Frau Ordentlich',
  'Herr Spießmann',
  'Frau Gründlich',
  'Herr Blockwart',
  'Frau Neugier',
  'Herr Korrekt',
  'Frau Gardine',
  'Herr Paragraf',
  'Frau Schnüffel',
  'Herr Vorschrift',
];

/** Where the Finanzamt does not appreciate loitering. */
export const LOITER_RECT: Rect = { x: 20, y: 43, w: 12, h: 1 };
