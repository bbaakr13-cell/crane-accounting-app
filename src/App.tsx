import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { AddPage } from '@/pages/AddPage';
import { AddEquipmentPage } from '@/pages/AddEquipmentPage';
import { EditEquipmentPage } from '@/pages/EditEquipmentPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { EquipmentDetailPage } from '@/pages/EquipmentDetailPage';
import { MonthlyPage } from '@/pages/MonthlyPage';
import { MonthlyDetailPage } from '@/pages/MonthlyDetailPage';
import { InvoicesPage } from '@/pages/InvoicesPage-2-fixed';
import { SettingsPage } from '@/pages/SettingsPage';
import { DailyCalculatorPage } from '@/pages/DailyCalculatorPage';
import { MonthlyRentalPage } from '@/pages/MonthlyRentalPage';
import { DriversPage } from '@/pages/DriversPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/add" element={<AddPage />} />
      <Route path="/equipment/add" element={<AddEquipmentPage />} />
      <Route path="/equipment/:id/edit" element={<EditEquipmentPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
      <Route path="/equipment" element={<EquipmentPage />} />
      <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
      <Route path="/monthly" element={<MonthlyPage />} />
      <Route path="/monthly/:id" element={<MonthlyDetailPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/invoices" element={<InvoicesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/daily-calculator" element={<DailyCalculatorPage />} />

      <Route path="/monthly-rental" element={<MonthlyRentalPage />} />
      <Route path="/drivers" element={<DriversPage />} />
    </Routes>
  );
}

export default App;
