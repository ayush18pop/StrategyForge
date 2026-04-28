import { useQuery } from '@tanstack/react-query';
import { fetchExecution, fetchFamily, fetchHealth, searchFamilies } from '../../lib/api';

export function useHealthQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 20_000,
  });
}

export function useSearchQuery(params: URLSearchParams) {
  return useQuery({
    queryKey: ['search', params.toString()],
    queryFn: () => searchFamilies(params),
  });
}

export function useFamilyQuery(familyId: string) {
  return useQuery({
    queryKey: ['family', familyId],
    queryFn: () => fetchFamily(familyId),
    enabled: familyId.length > 0,
  });
}

export function useExecutionQuery(workflowId: string) {
  return useQuery({
    queryKey: ['execution', workflowId],
    queryFn: () => fetchExecution(workflowId),
    enabled: workflowId.length > 0,
    refetchInterval: 15_000,
  });
}
