export default function Hamburger({ menuOpen, setMenuOpen }) {
  return (
    <button
      className="md:hidden flex flex-col justify-center items-center w-12 h-12 z-50"
      onClick={() => setMenuOpen(!menuOpen)}
      aria-label="Ouvrir le menu"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <rect y="5" width="24" height="3" rx="1.5" fill="white" />
        <rect y="11" width="24" height="3" rx="1.5" fill="white" />
        <rect y="17" width="24" height="3" rx="1.5" fill="white" />
      </svg>
    </button>
  );
}
