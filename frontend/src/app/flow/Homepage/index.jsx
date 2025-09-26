export default function HomePage() {
  return (
    <div className="flex flex-col min-h-full">
      <Subheader />

      <div className="flex-1 pt-4 bg-white">
        <div className="ml-5">Vide pour le moment</div>
      </div>
    </div>
  );
}

import Subheader from "@/ui/layout/headers/Subheader";
