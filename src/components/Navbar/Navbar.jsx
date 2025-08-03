import { useState } from "react";
import Desktop from "./Desktop";
import Mobile from "./Mobile";
import Hamburger from "./Hamburger";
import useAuth from "../../hooks/useAuth";

export default function Navbar() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-sky-800 text-white px-4 py-3 flex items-center justify-between">
      <Desktop />
      <Hamburger menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Mobile menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
    </nav>
  );
}
