import MainLayout from "@/components/layout/MainLayout";
import ExpensesManager from "@/components/expenses/ExpensesManager";

const ExpensesPage = () => {
    return (
        <div className="container mx-auto py-6">
            <ExpensesManager />
        </div>
    );
};

export default ExpensesPage;
