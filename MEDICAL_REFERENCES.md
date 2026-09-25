# Clinical content sources and boundaries

This file lists the sources used for the educational acupressure, self-care, and organ-map additions. The additions are not reviewed as an individualized treatment plan and do not diagnose. A qualified clinician should review all medical text before public clinical deployment. The app uses hand-authored SVG schematics and does not include copied clinical/anatomy illustrations.

## Naming and scope

- The four acupressure point codes in `data/acupressurePoints.json` are drawn from recognized point nomenclature. WHO's *Standard acupuncture nomenclature* describes the 361 classical acupuncture-point names; this app intentionally includes a small, referenced core selection, not all 361 points: https://www.who.int/publications/i/item/9290611057
- The WHO naming reference supports nomenclature only; it does not establish an indication or prove efficacy.
- Every point record stores its location, traditional/educational use, gentle method, caution, evidence note, and clickable primary references. The selection is limited to LI4, PC6, GB20, and SP6 because locations and cautions were verified in a UCI Health manual, and suitable point-specific context was available from institutional/NHS or review sources.

## Acupressure points

- LI4 / Hegu: location and pregnancy/skin cautions from UCI Health and Memorial Sloan Kettering; the latter gives gentle pressure instructions and frames LI4 as complementary for pain/headaches. https://www.ucihealth.org/-/media/files/pdf/samueli-integrative-health-institute/revised-acupressure-manual.pdf · https://www.mskcc.org/cancer-care/patient-education/acupressure-pain-and-headaches
- PC6 / Neiguan: point location from UCI Health and North Bristol NHS; postoperative-nausea evidence and low certainty from Cochrane. https://www.ucihealth.org/-/media/files/pdf/samueli-integrative-health-institute/revised-acupressure-manual.pdf · https://www.nbt.nhs.uk/our-services/a-z-services/anaesthetics/anaesthesia-patient-information/using-pressure-points-relieve-nausea · https://www.cochrane.org/evidence/CD003281_what-are-benefits-and-risks-different-wrist-pc6-acupoint-stimulation-techniques-preventing-nausea
- GB20 / Fengchi: point location and traditional symptom context from UCI Health; headache self-acupressure cautions from VA Portland; ordinary neck self-care and escalation from NHS. Neck pressure in the app is expressly limited to superficial/light touch and says to avoid deep pressure. https://www.ucihealth.org/-/media/files/pdf/samueli-integrative-health-institute/revised-acupressure-manual.pdf · https://www.va.gov/PAINMANAGEMENT/Veteran_Public/Veteran_docs/AcupressureforHeadaches.pdf · https://www.nhs.uk/symptoms/neck-pain-and-stiff-neck/
- SP6 / Sanyinjiao: location and pregnancy caution from UCI Health; evidence and limitations (few/heterogeneous studies) from a systematic review; period-pain self-care and escalation from NHS. The record distinguishes pressure-based evidence from needle-acupuncture evidence. https://www.ucihealth.org/-/media/files/pdf/samueli-integrative-health-institute/revised-acupressure-manual.pdf · https://pmc.ncbi.nlm.nih.gov/articles/PMC3600281/ · https://www.nhs.uk/symptoms/period-pain/
- General stopping/cautions: UCI manual and VA sheet advise avoiding compromised skin and stopping for discomfort/unusual symptoms; NHS headache warning signs are linked in LI4. https://www.ucihealth.org/-/media/files/pdf/samueli-integrative-health-institute/revised-acupressure-manual.pdf · https://www.va.gov/PAINMANAGEMENT/Veteran_Public/Veteran_docs/AcupressureforHeadaches.pdf · https://www.nhs.uk/symptoms/headaches/

## Natural self-care (non-herbal)

`data/naturalRelief.json` contains six symptom-specific, non-drug self-care entries. It does not prescribe herbs or supplement doses.

- Mild sprain/strain: NHS PRICE self-care and escalation. https://www.nhs.uk/conditions/sprains-and-strains/
- Back pain: NHS advises staying active, wrapped ice for pain/swelling, wrapped heat for stiffness/spasm, and urgent/emergency red flags. https://www.nhs.uk/conditions/back-pain/
- Neck pain: NHS advice on wrapped heat/cold and gentle movement, plus warning symptoms. https://www.nhs.uk/symptoms/neck-pain-and-stiff-neck/
- Period pain: NHS self-care choices include warm bath/shower, wrapped heat, gentle massage and exercise; escalating symptoms are linked. https://www.nhs.uk/symptoms/period-pain/
- Common headache: NHS self-care and immediate-help warning signs. https://www.nhs.uk/symptoms/headaches/
- Mild nausea: NHS dehydration advice supports fluid guidance and when to seek care. https://www.nhs.uk/conditions/dehydration/
- Heat/cold safety: Gloucestershire Hospitals NHS guidance covers wrapping, checking skin, and avoiding heat on a new injury. https://www.gloshospitals.nhs.uk/your-visit/patient-information-leaflets/ice-and-heat-treatment/
- Pregnancy, breastfeeding, and supplements: NCCIH warns that supplements may interact with medication and many are untested in pregnancy; this app avoids recommending herbal products. https://www.nccih.nih.gov/health/using-dietary-supplements-wisely
- Anticoagulants: NHS warfarin guidance covers bleeding symptoms and medicine/supplement interactions. https://www.nhs.uk/medicines/warfarin/
- Pregnancy-related abdominal pain: NHS pregnancy triage guidance. https://www.nhs.uk/pregnancy/common-symptoms/stomach-pain/

## Internal-organ map

The internal-organ diagram in `components/InternalOrgansMap.tsx` is original, simplified vector art. It shows approximate surface projection markers for the six already-present organ hotspots, then joins each hotspot to existing data using `relatedGroupSlugs` and `relatedPartIds` in `data/anatomyHotspots.json`. The graphic is explicitly labeled as illustrative and not to scale. Organ pain text is not presented as a localization diagnosis; pain location alone cannot identify the organ or cause. Urgent chest-pain guidance links to NHS: https://www.nhs.uk/conditions/heart-attack/
