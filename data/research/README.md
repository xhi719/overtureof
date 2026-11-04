# Research metadata review

Five source records are stored in `sources.json`; title, named authors, date and URL were checked against the official publication pages on 2026-10-31. The fields contain bibliographic metadata and concise paraphrases, not copied reports, occupation-specific metrics, or forecasts. License details are recorded where identified; the 2026 indicator brief remains unspecified pending review.

- ILO, [Generative AI and Jobs: A Refined Global Index of Occupational Exposure](https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure), 2025; its [ILO repository record](https://researchrepository.ilo.org/esploro/outputs/encyclopediaEntry/Generative-AI-and-jobs-a-refined/995653520102676) specifies CC BY 4.0.
- ILO, [Workers’ exposure to AI: What indicators tell us – and what they don’t](https://www.ilo.org/publications/workers%E2%80%99-exposure-ai-what-indicators-tell-us-%E2%80%93-and-what-they-don%E2%80%99t), 2026.
- OECD, [OECD Employment Outlook 2023](https://www.oecd.org/en/publications/oecd-employment-outlook-2023_08785bba-en/full-report.html), 2023. Its publication sets out OECD terms and conditions.
- ILO, [Generative AI and Jobs: A global analysis of potential effects on job quantity and quality](https://www.ilo.org/publications/generative-ai-and-jobs-global-analysis-potential-effects-job-quantity-and), 2023; its [ILO repository record](https://researchrepository.ilo.org/esploro/outputs/encyclopediaEntry/995326516102676) specifies CC BY 4.0.
- ILO, [The impact of GenAI on jobs, productivity and work organization](https://www.ilo.org/publications/impact-genai-jobs-productivity-and-work-organization-review-empirical), 2026; its [ILO repository record](https://researchrepository.ilo.org/esploro/outputs/encyclopediaEntry/The-impact-of-GenAI-on-jobs/995703566902676) specifies CC BY 4.0.

`npx tsx scripts/import-research.ts` inserts missing URLs only, with `pending` review status and an audit record. Existing records, including their review status, are never overwritten. It makes no job or model links. Public display requires the separate review and approval workflow.
