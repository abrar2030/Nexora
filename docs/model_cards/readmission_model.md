# Readmission Risk Model Card

## Model Details
- **Version**: 2.3.0
- **Training Data**: CMS 2018-2022 Inpatient Claims
- **Update Frequency**: Quarterly
- **Architecture**: Deep Survival Transformer

## Intended Use
- **Primary Purpose**: Predict 30-day readmission risk
- **Target Population**: Adult inpatients
- **Exclusions**: Psychiatric, maternity cases

## Performance
| Metric | Value |
|--------|-------|
| AUC-ROC | 0.82 |
| Sensitivity | 0.75 |
| Specificity | 0.84 |
| Calibration Slope | 1.02 |

## Fairness Analysis
| Subgroup | AUC | FPR Difference |
|----------|-----|----------------|
| Male | 0.81 | +0.03 |
| Female | 0.83 | -0.02 |
| ≥65 yrs | 0.79 | +0.05 |

## Clinical Validation
- **PPV**: 0.68 (95% CI 0.65-0.71)
- **NPV**: 0.88 (95% CI 0.85-0.91)
- **Clinician Agreement**: κ=0.62

## Ethical Considerations
- **Risk Stratification**: Should not be sole discharge criterion
- **Human Oversight**: Required for high-risk predictions