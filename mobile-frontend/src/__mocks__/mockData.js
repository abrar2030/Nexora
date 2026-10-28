export const mockPatient = {
  id: "test123",
  name: "John Test Doe",
  age: 65,
  mrn: "MRN123456",
  risk: 0.75,
  riskLevel: "high",
  status: "active",
  lastUpdated: new Date().toISOString(),
  last_update: new Date().toISOString().split("T")[0],
};

export const mockPatients = [
  {
    id: "p001",
    name: "John Doe",
    age: 65,
    mrn: "MRN001",
    risk: 0.75,
    riskLevel: "high",
    status: "active",
    lastUpdated: "2024-04-28T10:00:00Z",
    last_update: "2024-04-28",
  },
  {
    id: "p002",
    name: "Jane Smith",
    age: 72,
    mrn: "MRN002",
    risk: 0.4,
    riskLevel: "low",
    status: "active",
    lastUpdated: "2024-04-29T14:30:00Z",
    last_update: "2024-04-29",
  },
  {
    id: "p003",
    name: "Robert Johnson",
    age: 58,
    mrn: "MRN003",
    risk: 0.85,
    riskLevel: "high",
    status: "critical",
    lastUpdated: "2024-04-27T08:15:00Z",
    last_update: "2024-04-27",
  },
];

// Shape returned by GET /patients/{id} (see code/backend/app/schemas/patient.py).
export const mockPatientDetails = {
  id: "p001",
  name: "John Doe",
  age: 65,
  dob: "1959-03-02",
  gender: "Male",
  primaryDiagnosis: "Type 2 Diabetes",
  riskScore: 0.75,
  riskBand: "high",
  labResults: [{ date: "2024-04-11", glucose: 190, hemoglobin: 12.8 }],
  diagnoses: [{ name: "Type 2 Diabetes", code: "E11.9", date: "2019-01-01" }],
  riskFactors: [
    { name: "Age", impact: 0.3 },
    { name: "Prior admissions", impact: 0.2 },
  ],
  interventions: [
    {
      name: "Medication review",
      description: "Review regimen",
      priority: "High",
    },
  ],
  medications: [
    { name: "Metformin", dosage: "1000mg", frequency: "Twice daily" },
  ],
  timeline: [
    { title: "Admission", date: "2024-04-10", description: "Admitted" },
    { title: "Discharge", date: "2024-04-18", description: "Discharged" },
  ],
};
