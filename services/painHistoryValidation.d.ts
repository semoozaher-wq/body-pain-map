import type { Checkup } from '../types';

export function isCheckup(value: unknown): value is Checkup;
export function validateCheckupList(value: unknown, maxItems?: number): Checkup[];
export function isValidIsoDate(value: unknown): value is string;
