import { LegalCaseImporter } from '@/components/legal/LegalCaseImporter';

const LegalCasesPage = () => {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8 text-right">إدارة القضايا القانونية</h1>
            <LegalCaseImporter />
        </div>
    );
};

export default LegalCasesPage;
