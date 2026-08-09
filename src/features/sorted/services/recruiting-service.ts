import { candidates, organization, positions } from '@/features/sorted/fixtures/recruiting';

// Fixtures satisfy the same service contract that database-backed services will implement.
export const recruitingService = {
  getOrganization: async () => organization,
  listPositions: async () => positions,
  getPosition: async (id: string) => positions.find((position) => position.id === id) ?? null,
  listCandidates: async () => candidates,
  getCandidate: async (id: string) => candidates.find((candidate) => candidate.id === id) ?? null,
};

