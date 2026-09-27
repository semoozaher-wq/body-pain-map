/**
 * muscleMapping.ts
 * ---------------------------------------------------------------------------
 * Central anatomical mapping layer for the interactive body silhouette.
 *
 * This module links every interactive `<path id="...">` fragment rendered by
 * `components/WebBodySilhouette.tsx` to a structured medical record so that the
 * UI layer (and the selection hook in `hooks/useMuscleSelection.ts`) can reason
 * about the human body in anatomical terms instead of raw SVG path ids.
 *
 * The map intentionally covers the 70 clinically meaningful muscle groups that
 * are exposed to the user. Additional decorative / skeletal paths present in
 * the source artwork remain clickable through the silhouette component but are
 * not part of the medical map (see `MAPPED_MUSCLE_IDS`).
 * ---------------------------------------------------------------------------
 */

/* ===========================================================================
 * Types
 * ======================================================================== */

/**
 * High level anatomical regions used to group muscles for navigation,
 * filtering and reporting across the application.
 */
export type BodyRegion =
  | 'head_neck'
  | 'torso_front'
  | 'back'
  | 'upper_limb'
  | 'lower_limb';

/** Which side of the silhouette the muscle belongs to. */
export type BodyView = 'front' | 'back';

/**
 * A single mapped muscle / muscle group.
 */
export interface MuscleEntry {
  /** The SVG `<path id="...">` this entry is bound to. */
  id: string;
  /** Human readable anatomical name (English). */
  name: string;
  /** High level region the muscle belongs to. */
  region: BodyRegion;
  /** Functional muscle group / compartment. */
  muscleGroup: string;
  /** Which silhouette view renders this muscle. */
  view: BodyView;
  /**
   * Conditions that commonly present with pain / dysfunction in this muscle.
   * These are free-form clinical descriptors that downstream services can
   * resolve against the disease library.
   */
  relatedConditions: string[];
}

/** Aggregate statistics returned by {@link getMuscleMapStats}. */
export interface MuscleMapStats {
  total: number;
  byView: Record<BodyView, number>;
  byRegion: Record<BodyRegion, number>;
  mappedIds: string[];
}

/* ===========================================================================
 * The master muscle map (70 entries)
 * ======================================================================== */

export const MUSCLE_MAP: Record<string, MuscleEntry> = {
  /* ----------------------------- Head & Neck ---------------------------- */
  path847: {
    id: 'path847',
    name: 'Sternocleidomastoid',
    region: 'head_neck',
    muscleGroup: 'Neck flexors / rotators',
    view: 'front',
    relatedConditions: ['Torticollis', 'Cervical strain', 'Neck pain', 'Tension headache'],
  },
  path861: {
    id: 'path861',
    name: 'Trapezius (upper fibers)',
    region: 'head_neck',
    muscleGroup: 'Scapular elevators',
    view: 'front',
    relatedConditions: ['Myofascial trigger points', 'Tension headache', 'Cervicalgia'],
  },
  path2004: {
    id: 'path2004',
    name: 'Splenius capitis',
    region: 'head_neck',
    muscleGroup: 'Neck extensors',
    view: 'back',
    relatedConditions: ['Cervical sprain', 'Occipital neuralgia', 'Neck stiffness'],
  },
  path2024: {
    id: 'path2024',
    name: 'Semispinalis capitis',
    region: 'head_neck',
    muscleGroup: 'Neck extensors',
    view: 'back',
    relatedConditions: ['Cervicogenic headache', 'Whiplash injury', 'Neck pain'],
  },

  /* --------------------------- Torso (front) ---------------------------- */
  path899: {
    id: 'path899',
    name: 'Pectoralis major',
    region: 'torso_front',
    muscleGroup: 'Chest / adductors',
    view: 'front',
    relatedConditions: ['Pectoral strain', 'Costochondritis', 'Shoulder impingement'],
  },
  path908: {
    id: 'path908',
    name: 'Pectoralis minor',
    region: 'torso_front',
    muscleGroup: 'Chest / scapular depressors',
    view: 'front',
    relatedConditions: ['Thoracic outlet syndrome', 'Postural syndrome', 'Chest wall pain'],
  },
  path948: {
    id: 'path948',
    name: 'Serratus anterior',
    region: 'torso_front',
    muscleGroup: 'Scapular protractors',
    view: 'front',
    relatedConditions: ['Winging scapula', 'Rib pain', 'Shoulder dysfunction'],
  },
  path950: {
    id: 'path950',
    name: 'External oblique',
    region: 'torso_front',
    muscleGroup: 'Abdominal wall',
    view: 'front',
    relatedConditions: ['Side stitch', 'Abdominal strain', 'Flank pain'],
  },
  path968: {
    id: 'path968',
    name: 'Rectus abdominis (upper)',
    region: 'torso_front',
    muscleGroup: 'Abdominal wall',
    view: 'front',
    relatedConditions: ['Abdominal strain', 'Rectus diastasis', 'Core weakness'],
  },
  path970: {
    id: 'path970',
    name: 'Rectus abdominis (lower)',
    region: 'torso_front',
    muscleGroup: 'Abdominal wall',
    view: 'front',
    relatedConditions: ['Groin strain', 'Lower abdominal pain', 'Core weakness'],
  },
  path974: {
    id: 'path974',
    name: 'Internal oblique',
    region: 'torso_front',
    muscleGroup: 'Abdominal wall',
    view: 'front',
    relatedConditions: ['Abdominal strain', 'Flank pain', 'Hernia risk'],
  },
  path978: {
    id: 'path978',
    name: 'Transversus abdominis',
    region: 'torso_front',
    muscleGroup: 'Deep core',
    view: 'front',
    relatedConditions: ['Low back instability', 'Core weakness', 'Pelvic instability'],
  },
  path979: {
    id: 'path979',
    name: 'Linea alba',
    region: 'torso_front',
    muscleGroup: 'Abdominal midline',
    view: 'front',
    relatedConditions: ['Rectus diastasis', 'Ventral hernia', 'Abdominal pain'],
  },
  path2205: {
    id: 'path2205',
    name: 'Intercostal muscles',
    region: 'torso_front',
    muscleGroup: 'Respiratory / rib cage',
    view: 'front',
    relatedConditions: ['Intercostal neuralgia', 'Rib fracture', 'Pleuritic pain'],
  },
  /* ----------------------------- Back ----------------------------------- */
  path1152: {
    id: 'path1152',
    name: 'Trapezius (lower fibers)',
    region: 'back',
    muscleGroup: 'Scapular retractors',
    view: 'back',
    relatedConditions: ['Myofascial pain', 'Interscapular pain', 'Postural syndrome'],
  },
  path1191: {
    id: 'path1191',
    name: 'Latissimus dorsi',
    region: 'back',
    muscleGroup: 'Back / shoulder adductors',
    view: 'back',
    relatedConditions: ['Lat strain', 'Low back pain', 'Shoulder pain'],
  },
  path1212: {
    id: 'path1212',
    name: 'Rhomboid major',
    region: 'back',
    muscleGroup: 'Scapular retractors',
    view: 'back',
    relatedConditions: ['Interscapular pain', 'Postural syndrome', 'Myofascial trigger points'],
  },
  path1238: {
    id: 'path1238',
    name: 'Rhomboid minor',
    region: 'back',
    muscleGroup: 'Scapular retractors',
    view: 'back',
    relatedConditions: ['Interscapular pain', 'Scapular dyskinesis', 'Neck-shoulder pain'],
  },
  path1268: {
    id: 'path1268',
    name: 'Erector spinae',
    region: 'back',
    muscleGroup: 'Spinal extensors',
    view: 'back',
    relatedConditions: ['Low back pain', 'Muscle spasm', 'Lumbar strain'],
  },
  path1304: {
    id: 'path1304',
    name: 'Levator scapulae',
    region: 'back',
    muscleGroup: 'Scapular elevators',
    view: 'back',
    relatedConditions: ['Neck stiffness', 'Shoulder pain', 'Trigger points'],
  },
  path1327: {
    id: 'path1327',
    name: 'Teres major',
    region: 'back',
    muscleGroup: 'Shoulder rotators / adductors',
    view: 'back',
    relatedConditions: ['Shoulder pain', 'Rotator cuff dysfunction', 'Posterior shoulder impingement'],
  },
  path1339: {
    id: 'path1339',
    name: 'Teres minor',
    region: 'back',
    muscleGroup: 'Rotator cuff',
    view: 'back',
    relatedConditions: ['Rotator cuff tear', 'Shoulder instability', 'Impingement syndrome'],
  },
  path1343: {
    id: 'path1343',
    name: 'Infraspinatus',
    region: 'back',
    muscleGroup: 'Rotator cuff',
    view: 'back',
    relatedConditions: ['Rotator cuff tear', 'Shoulder impingement', 'Referred arm pain'],
  },
  path1347: {
    id: 'path1347',
    name: 'Supraspinatus',
    region: 'back',
    muscleGroup: 'Rotator cuff',
    view: 'back',
    relatedConditions: ['Rotator cuff tear', 'Subacromial impingement', 'Shoulder pain'],
  },
  path1919: {
    id: 'path1919',
    name: 'Quadratus lumborum',
    region: 'back',
    muscleGroup: 'Deep back / lateral trunk',
    view: 'back',
    relatedConditions: ['Low back pain', 'Flank pain', 'Hip hike'],
  },
  path1955: {
    id: 'path1955',
    name: 'Serratus posterior inferior',
    region: 'back',
    muscleGroup: 'Respiratory / lower ribs',
    view: 'back',
    relatedConditions: ['Lower rib pain', 'Referred abdominal pain', 'Myofascial pain'],
  },
  path2085: {
    id: 'path2085',
    name: 'Interspinales',
    region: 'back',
    muscleGroup: 'Deep spinal stabilizers',
    view: 'back',
    relatedConditions: ['Segmental instability', 'Low back pain', 'Muscle spasm'],
  },

  /* --------------------------- Upper limb (front) ----------------------- */
  path879: {
    id: 'path879',
    name: 'Deltoid (anterior)',
    region: 'upper_limb',
    muscleGroup: 'Shoulder abductors / flexors',
    view: 'front',
    relatedConditions: ['Deltoid strain', 'Shoulder impingement', 'Bursitis'],
  },
  path881: {
    id: 'path881',
    name: 'Deltoid (lateral)',
    region: 'upper_limb',
    muscleGroup: 'Shoulder abductors',
    view: 'front',
    relatedConditions: ['Deltoid strain', 'Subacromial bursitis', 'Shoulder pain'],
  },
  path919: {
    id: 'path919',
    name: 'Biceps brachii',
    region: 'upper_limb',
    muscleGroup: 'Elbow flexors',
    view: 'front',
    relatedConditions: ['Biceps tendinopathy', 'Biceps tear', 'Anterior shoulder pain'],
  },
  path928: {
    id: 'path928',
    name: 'Brachialis',
    region: 'upper_limb',
    muscleGroup: 'Elbow flexors',
    view: 'front',
    relatedConditions: ['Elbow strain', 'Brachial neuritis', 'Arm weakness'],
  },
  path983: {
    id: 'path983',
    name: 'Brachioradialis',
    region: 'upper_limb',
    muscleGroup: 'Forearm flexors',
    view: 'front',
    relatedConditions: ['Tennis elbow', 'Forearm strain', 'Wrist pain'],
  },
  path987: {
    id: 'path987',
    name: 'Flexor carpi radialis',
    region: 'upper_limb',
    muscleGroup: 'Wrist flexors',
    view: 'front',
    relatedConditions: ['Carpal tunnel syndrome', 'Wrist strain', 'Tendinitis'],
  },
  path988: {
    id: 'path988',
    name: 'Flexor carpi ulnaris',
    region: 'upper_limb',
    muscleGroup: 'Wrist flexors',
    view: 'front',
    relatedConditions: ['Cubital tunnel syndrome', 'Wrist strain', 'Tendinitis'],
  },
  path991: {
    id: 'path991',
    name: 'Palmaris longus',
    region: 'upper_limb',
    muscleGroup: 'Wrist flexors',
    view: 'front',
    relatedConditions: ['Wrist strain', 'Palmar pain', 'Tendinitis'],
  },
  path995: {
    id: 'path995',
    name: 'Flexor digitorum',
    region: 'upper_limb',
    muscleGroup: 'Finger flexors',
    view: 'front',
    relatedConditions: ['Trigger finger', 'Tendinopathy', 'Grip weakness'],
  },
  path998: {
    id: 'path998',
    name: 'Thenar muscles',
    region: 'upper_limb',
    muscleGroup: 'Thumb musculature',
    view: 'front',
    relatedConditions: ['Carpal tunnel syndrome', 'Thumb arthritis', 'De Quervain syndrome'],
  },

  /* --------------------------- Upper limb (back) ------------------------ */
  path1376: {
    id: 'path1376',
    name: 'Deltoid (posterior)',
    region: 'upper_limb',
    muscleGroup: 'Shoulder extensors',
    view: 'back',
    relatedConditions: ['Deltoid strain', 'Posterior shoulder pain', 'Impingement'],
  },
  path1432: {
    id: 'path1432',
    name: 'Triceps brachii',
    region: 'upper_limb',
    muscleGroup: 'Elbow extensors',
    view: 'back',
    relatedConditions: ['Triceps tendinopathy', 'Triceps tear', 'Elbow pain'],
  },
  path1452: {
    id: 'path1452',
    name: 'Anconeus',
    region: 'upper_limb',
    muscleGroup: 'Elbow extensors',
    view: 'back',
    relatedConditions: ['Elbow strain', 'Lateral elbow pain', 'Tendinitis'],
  },

  /* --------------------------- Lower limb (front) ----------------------- */
  path1012: {
    id: 'path1012',
    name: 'Adductor longus',
    region: 'lower_limb',
    muscleGroup: 'Hip adductors',
    view: 'front',
    relatedConditions: ['Groin strain', 'Adductor tendinopathy', 'Hip pain'],
  },
  path1017: {
    id: 'path1017',
    name: 'Adductor magnus',
    region: 'lower_limb',
    muscleGroup: 'Hip adductors',
    view: 'front',
    relatedConditions: ['Groin strain', 'Adductor tendinopathy', 'Medial thigh pain'],
  },
  path1047: {
    id: 'path1047',
    name: 'Gracilis',
    region: 'lower_limb',
    muscleGroup: 'Hip adductors',
    view: 'front',
    relatedConditions: ['Groin strain', 'Medial knee pain', 'Adductor tendinopathy'],
  },
  path1065: {
    id: 'path1065',
    name: 'Pectineus',
    region: 'lower_limb',
    muscleGroup: 'Hip adductors',
    view: 'front',
    relatedConditions: ['Groin strain', 'Hip flexor pain', 'Adductor tendinopathy'],
  },
  path1080: {
    id: 'path1080',
    name: 'Tensor fasciae latae',
    region: 'lower_limb',
    muscleGroup: 'Hip abductors / flexors',
    view: 'front',
    relatedConditions: ['IT band syndrome', 'Lateral hip pain', 'Snapping hip'],
  },
  path1100: {
    id: 'path1100',
    name: 'Rectus femoris',
    region: 'lower_limb',
    muscleGroup: 'Quadriceps',
    view: 'front',
    relatedConditions: ['Quadriceps strain', 'Patellar tendinopathy', 'Hip flexor strain'],
  },
  path1101: {
    id: 'path1101',
    name: 'Vastus lateralis',
    region: 'lower_limb',
    muscleGroup: 'Quadriceps',
    view: 'front',
    relatedConditions: ['Quadriceps strain', 'IT band syndrome', 'Knee pain'],
  },
  path1109: {
    id: 'path1109',
    name: 'Vastus medialis',
    region: 'lower_limb',
    muscleGroup: 'Quadriceps',
    view: 'front',
    relatedConditions: ['Patellofemoral pain', 'Quadriceps strain', 'Knee instability'],
  },
  path1115: {
    id: 'path1115',
    name: 'Vastus intermedius',
    region: 'lower_limb',
    muscleGroup: 'Quadriceps',
    view: 'front',
    relatedConditions: ['Quadriceps strain', 'Anterior thigh pain', 'Knee extension weakness'],
  },
  path1122: {
    id: 'path1122',
    name: 'Sartorius',
    region: 'lower_limb',
    muscleGroup: 'Hip flexors / abductors',
    view: 'front',
    relatedConditions: ['Sartorius strain', 'Groin pain', 'Medial knee pain'],
  },
  path1129: {
    id: 'path1129',
    name: 'Iliopsoas',
    region: 'lower_limb',
    muscleGroup: 'Hip flexors',
    view: 'front',
    relatedConditions: ['Iliopsoas syndrome', 'Snapping hip', 'Low back pain'],
  },
  path1157: {
    id: 'path1157',
    name: 'Tibialis anterior',
    region: 'lower_limb',
    muscleGroup: 'Ankle dorsiflexors',
    view: 'front',
    relatedConditions: ['Shin splints', 'Anterior compartment syndrome', 'Foot drop'],
  },
  path1172: {
    id: 'path1172',
    name: 'Peroneus longus',
    region: 'lower_limb',
    muscleGroup: 'Ankle evertors',
    view: 'front',
    relatedConditions: ['Ankle sprain', 'Peroneal tendinopathy', 'Lateral ankle pain'],
  },
  path1182: {
    id: 'path1182',
    name: 'Gastrocnemius (lateral head)',
    region: 'lower_limb',
    muscleGroup: 'Calf / plantarflexors',
    view: 'front',
    relatedConditions: ['Calf strain', 'Achilles tendinopathy', 'Cramp'],
  },
  path1186: {
    id: 'path1186',
    name: 'Soleus',
    region: 'lower_limb',
    muscleGroup: 'Calf / plantarflexors',
    view: 'front',
    relatedConditions: ['Achilles tendinopathy', 'Shin splints', 'Calf strain'],
  },
  path1192: {
    id: 'path1192',
    name: 'Tibialis posterior',
    region: 'lower_limb',
    muscleGroup: 'Ankle invertors',
    view: 'front',
    relatedConditions: ['Posterior tibial tendinopathy', 'Flat foot', 'Medial ankle pain'],
  },
  path1200: {
    id: 'path1200',
    name: 'Flexor hallucis longus',
    region: 'lower_limb',
    muscleGroup: 'Toe flexors',
    view: 'front',
    relatedConditions: ['Hallux rigidus', 'Posterior ankle impingement', 'Tendinopathy'],
  },
  path1202: {
    id: 'path1202',
    name: 'Extensor hallucis longus',
    region: 'lower_limb',
    muscleGroup: 'Toe extensors',
    view: 'front',
    relatedConditions: ['Extensor tendinopathy', 'Anterior ankle pain', 'Foot drop'],
  },

  /* --------------------------- Lower limb (back) ------------------------ */
  path1486: {
    id: 'path1486',
    name: 'Gluteus maximus',
    region: 'lower_limb',
    muscleGroup: 'Hip extensors',
    view: 'back',
    relatedConditions: ['Gluteal strain', 'Low back pain', 'Piriformis syndrome'],
  },
  path1513: {
    id: 'path1513',
    name: 'Gluteus medius',
    region: 'lower_limb',
    muscleGroup: 'Hip abductors',
    view: 'back',
    relatedConditions: ['Gluteal tendinopathy', 'Lateral hip pain', 'Trendelenburg gait'],
  },
  path1542: {
    id: 'path1542',
    name: 'Gluteus minimus',
    region: 'lower_limb',
    muscleGroup: 'Hip abductors',
    view: 'back',
    relatedConditions: ['Gluteal tendinopathy', 'Lateral hip pain', 'Sciatica-like pain'],
  },
  path1556: {
    id: 'path1556',
    name: 'Piriformis',
    region: 'lower_limb',
    muscleGroup: 'Deep hip rotators',
    view: 'back',
    relatedConditions: ['Piriformis syndrome', 'Sciatica', 'Deep gluteal pain'],
  },
  path1598: {
    id: 'path1598',
    name: 'Biceps femoris',
    region: 'lower_limb',
    muscleGroup: 'Hamstrings',
    view: 'back',
    relatedConditions: ['Hamstring strain', 'Hamstring tendinopathy', 'Posterior thigh pain'],
  },
  path1627: {
    id: 'path1627',
    name: 'Semitendinosus',
    region: 'lower_limb',
    muscleGroup: 'Hamstrings',
    view: 'back',
    relatedConditions: ['Hamstring strain', 'Hamstring tendinopathy', 'Posterior knee pain'],
  },
  path1648: {
    id: 'path1648',
    name: 'Semimembranosus',
    region: 'lower_limb',
    muscleGroup: 'Hamstrings',
    view: 'back',
    relatedConditions: ['Hamstring strain', 'Hamstring tendinopathy', 'Posterior knee pain'],
  },
  path1652: {
    id: 'path1652',
    name: 'Adductor magnus (posterior)',
    region: 'lower_limb',
    muscleGroup: 'Hip adductors / extensors',
    view: 'back',
    relatedConditions: ['Groin strain', 'Adductor tendinopathy', 'Medial thigh pain'],
  },
  path1697: {
    id: 'path1697',
    name: 'Gastrocnemius (medial head)',
    region: 'lower_limb',
    muscleGroup: 'Calf / plantarflexors',
    view: 'back',
    relatedConditions: ['Calf strain', 'Achilles tendinopathy', 'Cramp'],
  },
  path1725: {
    id: 'path1725',
    name: 'Soleus (posterior)',
    region: 'lower_limb',
    muscleGroup: 'Calf / plantarflexors',
    view: 'back',
    relatedConditions: ['Achilles tendinopathy', 'Shin splints', 'Calf strain'],
  },
  path1797: {
    id: 'path1797',
    name: 'Achilles tendon',
    region: 'lower_limb',
    muscleGroup: 'Tendon / plantarflexors',
    view: 'back',
    relatedConditions: ['Achilles tendinopathy', 'Achilles rupture', 'Heel pain'],
  },
  path1867: {
    id: 'path1867',
    name: 'Calcaneal region',
    region: 'lower_limb',
    muscleGroup: 'Heel / plantarflexors',
    view: 'back',
    relatedConditions: ['Plantar fasciitis', 'Heel spur', 'Calcaneal pain'],
  },
};

/* ===========================================================================
 * Derived collections
 * ======================================================================== */

/**
 * Set of every `<path id>` that has an associated {@link MuscleEntry}.
 * Useful for fast membership checks without touching the map object.
 */
export const MAPPED_MUSCLE_IDS: Set<string> = new Set(Object.keys(MUSCLE_MAP));

/** All mapped entries materialised once for reuse. */
const ALL_MUSCLES: MuscleEntry[] = Object.values(MUSCLE_MAP);

/* ===========================================================================
 * Query helpers
 * ======================================================================== */

/**
 * Returns the muscle entry bound to a given SVG path id, or `undefined` when
 * the id is not part of the medical map.
 */
export function getMuscleById(id: string): MuscleEntry | undefined {
  return MUSCLE_MAP[id];
}

/**
 * Returns every mapped muscle rendered on the requested silhouette view.
 */
export function getMusclesByView(view: BodyView): MuscleEntry[] {
  return ALL_MUSCLES.filter((muscle) => muscle.view === view);
}

/**
 * Returns every mapped muscle belonging to the requested anatomical region.
 */
export function getMusclesByRegion(region: BodyRegion): MuscleEntry[] {
  return ALL_MUSCLES.filter((muscle) => muscle.region === region);
}

/**
 * Returns aggregate statistics about the muscle map. Handy for diagnostics,
 * dashboards and tests.
 */
export function getMuscleMapStats(): MuscleMapStats {
  const byView: Record<BodyView, number> = { front: 0, back: 0 };
  const byRegion: Record<BodyRegion, number> = {
    head_neck: 0,
    torso_front: 0,
    back: 0,
    upper_limb: 0,
    lower_limb: 0,
  };

  for (const muscle of ALL_MUSCLES) {
    byView[muscle.view] += 1;
    byRegion[muscle.region] += 1;
  }

  return {
    total: ALL_MUSCLES.length,
    byView,
    byRegion,
    mappedIds: Array.from(MAPPED_MUSCLE_IDS),
  };
}

/** Human readable labels for each region (used by UI filters). */
export const BODY_REGION_LABELS: Record<BodyRegion, { ar: string; en: string }> = {
  head_neck: { ar: 'الرأس والرقبة', en: 'Head & Neck' },
  torso_front: { ar: 'الجذع الأمامي', en: 'Torso (front)' },
  back: { ar: 'الظهر', en: 'Back' },
  upper_limb: { ar: 'الطرف العلوي', en: 'Upper limb' },
  lower_limb: { ar: 'الطرف السفلي', en: 'Lower limb' },
};

/** Human readable labels for each view. */
export const BODY_VIEW_LABELS: Record<BodyView, { ar: string; en: string }> = {
  front: { ar: 'أمامي', en: 'Front' },
  back: { ar: 'خلفي', en: 'Back' },
};

export default MUSCLE_MAP;
