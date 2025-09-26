import Subheader from "@/ui/layout/headers/subheader/Subheader.jsx";
import ModulesManager from "./components/ModulesManager.jsx";

export default function Settings() {
  return (
    <div className="h-full">
      <Subheader />
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-600">
            Active ou désactive les modules disponibles.
          </p>
        </div>

        <ModulesManager />
      </div>
    </div>
  );
}
