import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <EmptyState title="That vault doesn't exist. It may have been taken down." actionLabel="Back to the Board" onAction={() => navigate('/board')} />
    </div>
  );
}
