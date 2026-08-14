import React from "react";
import CraneLogo from "../CraneLogo";

type DashboardHeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function DashboardHeader({
  title = "حساب كرينات",
  subtitle = "إدارة أعمالك وحساباتك بسهولة",
}: DashboardHeaderProps) {
  return (
    <header className="dashboard-header" dir="rtl">
      <div className="dashboard-header__logo">
        <CraneLogo />
      </div>

      <div className="dashboard-header__text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}
