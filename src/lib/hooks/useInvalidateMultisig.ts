import {useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';

export function useInvalidateMultisig() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async (redirect = true) => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ['transactions']}),
      queryClient.invalidateQueries({queryKey: ['multisig']}),
    ]);
    if (redirect) navigate('/transactions');
  };
}
