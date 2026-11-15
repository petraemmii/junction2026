// Storage on Node: the JSON files under data/ (store.ts), as the scripts read and write them.
import { readApplicants, readCompanies, saveApplicant, writeData } from './store.ts'
import type { Storage } from './storage.ts'

export const fileStorage = (): Storage => ({
  applicants: async () => readApplicants(),
  companies: async () => readCompanies(),
  saveApplicant: async (applicant) => saveApplicant(applicant),
  saveDocument: async (name, value) => writeData(`${name}.json`, value),
  // One process serves every request, so its own count is complete.
  reserveRead: async () => true,
})
