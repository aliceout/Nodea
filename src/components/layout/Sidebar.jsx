// src/components/layout/Sidebar.jsx
import Logo from "../common/LogoLong.jsx";
import Link from "./components/SidebarLink.jsx";

export default function Sidebar({ navigation, current, onSelect }) {
  const topItems = navigation.filter((item) => item.position === "top");
  const bottomItems = navigation.filter((item) => item.position === "bottom");

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col border-r border-gray-200 bg-white">
      <div className="flex grow flex-col overflow-y-auto px-4 pb-4">
        {/* Logo */}
        <div className="flex h-16 items-center">
          <Logo className="w-1/2" />
        </div>

        <nav className="flex flex-1 flex-col">
          <ul className="flex flex-col gap-y-2">
            {topItems.map((item) => (
              <li key={item.id}>
                <Link
                  icon={item.icon}
                  label={item.label}
                  active={current === item.id}
                  onClick={() => onSelect(item.id)}
                />
              </li>
            ))}
          </ul>

          <ul className="mt-auto flex flex-col gap-y-2">
            {bottomItems.map((item) => (
              <li key={item.id}>
                <Link
                  icon={item.icon}
                  label={item.label}
                  active={current === item.id}
                  onClick={() => onSelect(item.id)}
                />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
