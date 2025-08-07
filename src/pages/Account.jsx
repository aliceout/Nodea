import React from "react";
import Layout from "../components/layout/LayoutTop";
import UsernameSection from "../components/Account/ChangeUsername";
import PasswordResetSection from "../components/account/PasswordReset";
import EmailSection from "../components/Account/ChangeEmail";
import DeleteAccountSection from "../components/Account/DeleteAccount";
import ExportData from "../components/Account/ExportData";
import ImportData from "../components/Account/ImportData";
import pb from "../services/pocketbase";

export default function AccountPage() {
  const user = pb.authStore.model;
  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto p-8 rounded-lg">
        <h1 className="text-2xl font-bold text-center mb-8">Mon compte</h1>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Colonne gauche */}
          <div className="flex-1 flex flex-col gap-8">
            <UsernameSection user={user} />
            <EmailSection user={user} />
          </div>
          {/* Colonne droite */}
          <div className="flex-1 flex flex-col gap-8">
            <ExportData user={user} />
            <ImportData user={user} />
            <PasswordResetSection user={user} />
            <DeleteAccountSection user={user} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
