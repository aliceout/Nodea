import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";

export default function Header({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8 shadow-sm">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onMenuClick}
        className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 lg:hidden"
      >
        <span className="sr-only">Open sidebar</span>
        <Bars3Icon className="h-6 w-6" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      {/* Page title or breadcrumb placeholder */}
      <div className="flex-1">{/* Put title or breadcrumb here */}</div>

      {/* Right actions */}
      <div className="flex items-center gap-x-4">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
        >
          <span className="sr-only">View notifications</span>
          <BellIcon className="h-6 w-6" />
        </button>

        {/* User profile placeholder */}
        <div className="flex items-center gap-x-2">
          <img
            alt="User avatar"
            src="https://via.placeholder.com/32"
            className="h-8 w-8 rounded-full bg-gray-50"
          />
        </div>
      </div>
    </header>
  );
}
