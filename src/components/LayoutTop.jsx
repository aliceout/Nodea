export default function LayoutTop({ children }) {
  return (
    <div className="w-full min-h-screen bg-white pt-[64px]">
      {/* pt-[64px] = padding top pour éviter que le contenu passe sous la navbar */}
      <div className="w-full min-h-[calc(100vh-64px)] flex flex-col justify-start items-center">
        {/* min-h-[calc(100vh-64px)] = hauteur dispo SANS la navbar (si navbar ≈ 64px) */}
        {children}
      </div>
    </div>
  );
}
