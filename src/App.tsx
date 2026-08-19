import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
import { ReportsPage } from '@/pages/ReportsPage';
import { InvoicesPage } from '@/pages/InvoicesPage-2-final-polished-FINAL';
import { SettingsPage } from '@/pages/SettingsPage';
import { DailyCalculatorPage } from '@/pages/DailyCalculatorPage';
import { MonthlyRentalPage } from '@/pages/MonthlyRentalPage';
import { DriversPage } from '@/pages/DriversPage';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname !== '/';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      {showBackButton && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="رجوع"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            left: 14,
            zIndex: 9999,
            width: 44,
            height: 44,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(10, 25, 48, 0.94)',
            color: '#ffffff',
            fontSize: 24,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
      )}

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
