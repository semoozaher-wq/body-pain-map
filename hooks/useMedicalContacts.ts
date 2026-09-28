// hooks/useMedicalContacts.ts
// إدارة جهات الاتصال الطبية محليًّا (إضافة/تعديل/حذف) عبر AsyncStorage فقط.
//
// لا يوجد حساب ولا خادم: كل ما يُدخله المستخدم يبقى على الجهاز. الربط بزر
// الطوارئ يتم عبر «جهة الاتصال الأساسية» (isPrimary) التي تظهر في لوحة الطوارئ.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONTACTS_STORAGE_KEY,
  sanitizeContact,
  sanitizeContactList,
} from '../services/emergencyCore.js';
import type { MedicalContact } from '../types';
import { createLocalId } from '../services/id';

export interface UseMedicalContacts {
  contacts: MedicalContact[];
  loaded: boolean;
  /** إضافة أو تحديث جهة اتصال. يُعيد رسالة خطأ أو null عند النجاح. */
  saveContact: (input: { id?: string; name: string; phone: string; relation?: string; isPrimary?: boolean }) => string | null;
  /** حذف جهة اتصال بالمعرّف. */
  removeContact: (id: string) => void;
  /** جهة الاتصال الأساسية (أول واحدة مُعلَّمة isPrimary أو أول عنصر). */
  primaryContact: MedicalContact | null;
}


export function useMedicalContacts(): UseMedicalContacts {
  const [contacts, setContacts] = useState<MedicalContact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    AsyncStorage.getItem(CONTACTS_STORAGE_KEY)
      .then((saved) => {
        if (!mounted.current) return;
        if (saved) {
          try {
            setContacts(sanitizeContactList(JSON.parse(saved)));
          } catch {
            /* الإبقاء على قائمة فارغة إذا كان التخزين تالفًا */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => { if (mounted.current) setLoaded(true); });
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts)).catch(() => undefined);
  }, [contacts, loaded]);

  const saveContact = useCallback((input: { id?: string; name: string; phone: string; relation?: string; isPrimary?: boolean }): string | null => {
    const result = sanitizeContact(input);
    if (!result.ok || !result.contact) return result.error || 'invalid';
    const record: MedicalContact = {
      ...result.contact,
      id: result.contact.id || input.id || createLocalId('contact'),
    };
    setContacts((list) => {
      const without = list.filter((item) => item.id !== record.id);
      const next = [record, ...without];
      // جهة أساسية واحدة فقط: إن كانت هذه أساسية، ألغِ العلامة عن الباقي.
      return record.isPrimary ? next.map((item) => ({ ...item, isPrimary: item.id === record.id })) : next;
    });
    return null;
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((list) => list.filter((item) => item.id !== id));
  }, []);

  const primaryContact = useMemo(() => contacts.find((item) => item.isPrimary) || contacts[0] || null, [contacts]);

  return { contacts, loaded, saveContact, removeContact, primaryContact };
}

export default useMedicalContacts;
