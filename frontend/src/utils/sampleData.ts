export interface Medicine {
  brandName: string;
  genericName: string;
  category: string;
  commonUses: string;
  howItWorks: string;
  sideEffects: string;
  foodRestrictions: string;
  precautions: string;
}

export interface AbnormalValue {
  parameter: string;
  value: string;
  referenceRange: string;
  explanation: string;
}

export interface DecodedResult {
  summary: string;
  sections: { title: string; content: string }[];
  medicines: Medicine[];
  abnormalValues: AbnormalValue[];
  doctorQuestions: string[];
}

export interface SampleDocument {
  id: string;
  name: string;
  category: 'prescription' | 'blood_report' | 'hospital_bill';
  description: string;
  rawText: string;
  decodedResult: DecodedResult;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'sample-prescription',
    name: 'Dr. Sarah Jenkins — Pharmacy Prescription',
    category: 'prescription',
    description: 'Standard outpatient prescription containing shorthand medication dosing and instructions.',
    rawText: `ST. JUDE MEDICAL CENTER
Patient: Robert Chen (Age 45)
Date: Oct 12, 2025

Rx:
Amoxicillin 500mg capsules
Sig: 1 cap PO TDS x 7 days
Qty: 21 capsules
Refills: 0

Indications: Acute Otitis Media

Signed,
Dr. Sarah Jenkins, MD`,
    decodedResult: {
      summary: 'An outpatient prescription for an antibiotic (Amoxicillin) to treat a middle ear infection (Acute Otitis Media), to be taken three times daily for one week.',
      sections: [
        {
          title: 'Clinical Presentation',
          content: 'The patient, Robert Chen, was diagnosed with an acute middle ear infection (Acute Otitis Media) by Dr. Jenkins.'
        },
        {
          title: 'Dosing Instructions',
          content: 'Take one capsule by mouth (PO) three times daily (TDS) for seven consecutive days. Ensure you finish the entire 21-capsule course even if symptoms disappear early, to prevent antibiotic resistance.'
        }
      ],
      medicines: [
        {
          brandName: 'Amoxicillin 500mg',
          genericName: 'Amoxicillin (Penicillin class antibiotic)',
          category: 'Antibacterial Agent',
          commonUses: 'Used to treat bacterial infections of the ear, nose, throat, urinary tract, and skin.',
          howItWorks: 'Stops the growth and reproduction of bacteria by preventing them from forming their protective cell walls.',
          sideEffects: 'Mild diarrhea, nausea, vomiting, or stomach pain. Contact a doctor if you develop a severe skin rash.',
          foodRestrictions: 'Can be taken with or without food. Taking it with meals reduces the chance of stomach upset.',
          precautions: 'Do not take if you have a known history of severe allergic reactions (anaphylaxis) to penicillin or cephalosporins.'
        }
      ],
      abnormalValues: [],
      doctorQuestions: [
        'Do I have any documented penicillin allergies that might make this medication unsafe?',
        'If my ear pain and fever do not start to improve after 48 to 72 hours, what should my next step be?',
        'Should I take probiotics or active yogurt cultures to support my gut health during this antibiotic course?'
      ]
    }
  },
  {
    id: 'sample-blood-report',
    name: 'MetroLabs — Basic Metabolic & Lipid Panel',
    category: 'blood_report',
    description: 'Laboratory test report detailing cholesterol, lipid levels, and renal filtration metrics.',
    rawText: `METROLABS DIAGNOSTICS
Patient: Jane Doe (Age 62)
Date: Sep 20, 2025

TEST                 RESULT       REFERENCE RANGE
Total Cholesterol    240 mg/dL    < 200 mg/dL (HIGH)
LDL Cholesterol      162 mg/dL    < 100 mg/dL (HIGH)
HDL Cholesterol      45 mg/dL     > 50 mg/dL  (LOW)
Triglycerides        180 mg/dL    < 150 mg/dL (HIGH)
Serum Creatinine     0.9 mg/dL    0.5 - 1.1 mg/dL (NORMAL)
eGFR                 78 mL/min    > 90 mL/min (MILDLY DECREASED)`,
    decodedResult: {
      summary: 'A laboratory blood panel indicating high cholesterol (hyperlipidemia) and mildly decreased kidney filtration rate (eGFR).',
      sections: [
        {
          title: 'Lipid Profile Summary',
          content: 'Your lipid panel shows elevated Total Cholesterol (240 mg/dL) and LDL ("bad") cholesterol (162 mg/dL), along with lower-than-optimal HDL ("good") cholesterol (45 mg/dL). This combination suggests hyperlipidemia, which increases cardiovascular plaque risks.'
        },
        {
          title: 'Renal Function Summary',
          content: 'While your Serum Creatinine (waste product) is in the normal range, the estimated Glomerular Filtration Rate (eGFR) is mildly decreased at 78 mL/min. This indicates early (Stage 2) kidney filtration decline, which is common in older adults but should be monitored.'
        }
      ],
      medicines: [],
      abnormalValues: [
        {
          parameter: 'Total Cholesterol',
          value: '240 mg/dL',
          referenceRange: '< 200 mg/dL',
          explanation: 'The sum of all cholesterol in your blood. High levels can lead to cardiovascular issues.'
        },
        {
          parameter: 'LDL Cholesterol',
          value: '162 mg/dL',
          referenceRange: '< 100 mg/dL',
          explanation: 'Low-Density Lipoprotein, or "bad" cholesterol. It deposits fats inside your artery walls.'
        },
        {
          parameter: 'HDL Cholesterol',
          value: '45 mg/dL',
          referenceRange: '> 50 mg/dL',
          explanation: 'High-Density Lipoprotein, or "good" cholesterol. It helps clear fats from the bloodstream.'
        },
        {
          parameter: 'Triglycerides',
          value: '180 mg/dL',
          referenceRange: '< 150 mg/dL',
          explanation: 'A type of fat found in the blood. Elevated levels increase risk of stroke and heart disease.'
        },
        {
          parameter: 'eGFR',
          value: '78 mL/min',
          referenceRange: '> 90 mL/min',
          explanation: 'Estimated Glomerular Filtration Rate. Measures kidney efficiency. 78 indicates mild filtration reduction.'
        }
      ],
      doctorQuestions: [
        'What dietary changes or aerobic exercise routines would you recommend first to help raise my HDL and lower my LDL?',
        'Do my blood sugar or blood pressure readings require monitoring alongside this lipid panel?',
        'Should we retest my kidney filtration rate (eGFR) in 6 months to track if it remains stable?'
      ]
    }
  },
  {
    id: 'sample-hospital-bill',
    name: 'Mercy General — Emergency Visit Bill',
    category: 'hospital_bill',
    description: 'Emergency department invoice detailing medical service charges and insurance adjustments.',
    rawText: `MERCY GENERAL HOSPITAL
Patient: James Miller
Statement Date: Nov 05, 2025
Admit Date: Oct 28, 2025

CHARGES:
Code 99283 — ED Level 3 Visit    $850.00
Code 36415 — Venipuncture        $45.00
Code 80053 — Comp Metabolic Panel  $120.00
Total Charges:                  $1,015.00

INSURANCE ADJUSTMENTS:
Provider Allowed:                $780.00
Insurance Paid (80%):            $624.00
EOB Denial: Code 50 (Not Covered) $85.00
Patient Copay / Deductible:      $156.00

TOTAL DUE FROM PATIENT:          $241.00`,
    decodedResult: {
      summary: 'A hospital invoice for an emergency room visit, detailing $1,015.00 in charges, with insurance covering $624.00, and a final patient responsibility of $241.00 due to copayments and a partially denied lab service.',
      sections: [
        {
          title: 'Emergency Care Charges',
          content: 'The bill includes the emergency room visit fee (Level 3 for moderate severity), blood draw fee (venipuncture), and a Comprehensive Metabolic Panel laboratory blood test.'
        },
        {
          title: 'Insurance Breakdown & Denial',
          content: 'Your insurance company negotiated the total cost down to $780.00 and paid 80% ($624.00). However, the metabolic panel lab fee ($85.00) was denied entirely (Code 50: Service Not Covered), transferring the cost to you.'
        },
        {
          title: 'Final Patient Due',
          content: 'Your final payment of $241.00 is composed of your standard insurance copayment ($156.00) and the denied lab fee ($85.00).'
        }
      ],
      medicines: [],
      abnormalValues: [
        {
          parameter: 'EOB Denial Code 50',
          value: '$85.00 Denied',
          referenceRange: 'Paid / Covered',
          explanation: 'Denial code 50 means the service is deemed not covered under your insurance policy plan. This can often be appealed.'
        }
      ],
      doctorQuestions: [
        'Can the billing office verify if the Comprehensive Metabolic Panel was coded correctly for my diagnosis?',
        'If the coding was correct, can the hospital provide a letter of medical necessity to help me appeal this $85.00 denial to my insurer?',
        'Is Mercy General willing to offer a prompt-payment discount or standard financial aid adjustment on the patient due amount?'
      ]
    }
  }
];
