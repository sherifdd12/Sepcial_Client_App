import { useState } from "react";
import Header from "@/components/layout/Header";
import Dashboard from "@/components/dashboard/Dashboard";
import CustomerList from "@/components/customers/CustomerList";
import CustomerForm from "@/components/customers/CustomerForm";
import { Customer } from "@/lib/types";

// Sample data - in a real app, this would come from your database
const sampleCustomers: Customer[] = [
  {
    id: "1",
    sequence_number: "CUS240001",
    full_name: "أحمد محمد الخالد",
    mobile_number: "96599887766",
    civil_id: "289123456789",
    created_at: "2024-01-15",
  },
  {
    id: "2", 
    sequence_number: "CUS240002",
    full_name: "فاطمة علي السالم",
    mobile_number: "96566778899",
    civil_id: "289987654321",
    created_at: "2024-02-10",
  },
];

const Index = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [customers, setCustomers] = useState<Customer[]>(sampleCustomers);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();

  const handleSaveCustomer = (customer: Customer) => {
    if (editingCustomer) {
      setCustomers(customers.map(c => c.id === customer.id ? customer : c));
    } else {
      setCustomers([...customers, customer]);
    }
    setShowCustomerForm(false);
    setEditingCustomer(undefined);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleAddCustomer = () => {
    setEditingCustomer(undefined);
    setShowCustomerForm(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    // TODO: Implement customer detail view
    console.log("View customer:", customer);
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers(customers.filter(c => c.id !== customerId));
  };

  const handleDeleteMultipleCustomers = (customerIds: string[]) => {
    setCustomers(customers.filter(c => !customerIds.includes(c.id)));
  };

  const renderCurrentPage = () => {
    if (showCustomerForm) {
      return (
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          onCancel={() => {
            setShowCustomerForm(false);
            setEditingCustomer(undefined);
          }}
          isLoading={false}
        />
      );
    }

    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "customers":
        return (
          <CustomerList
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onEditCustomer={handleEditCustomer}
            onViewCustomer={handleViewCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onDeleteMultipleCustomers={handleDeleteMultipleCustomers}
          />
        );
      case "transactions":
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground text-lg">
              إدارة المعاملات - قريباً
            </p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-6">
        {renderCurrentPage()}
      </main>
    </div>
  );
};

export default Index;
