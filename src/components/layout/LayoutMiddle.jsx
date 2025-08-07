export default function LayoutMiddle({ children }) {
  return (
    <div className="w-full min-h-screen bg-white">
      {/* pt-[64px] = padding top pour éviter que le contenu passe sous la navbar */}
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
        {/* min-h-[calc(100vh-64px)] = hauteur dispo SANS la navbar (si navbar ≈ 64px) */}
        {children}
      </div>
    </div>
  );
}
