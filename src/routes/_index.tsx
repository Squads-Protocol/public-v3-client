import RenderMultisigRoute from '@/components/RenderMultisigRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Suspense } from 'react';

const Index = () => {
    return (
        <ErrorBoundary>
            <Suspense>
                <RenderMultisigRoute />
            </Suspense>
        </ErrorBoundary>
    );
};

export default Index;
