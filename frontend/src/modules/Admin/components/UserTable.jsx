import React from "react";

export default function UserTable({ users, onDelete, onResetPassword }) {
  return (
    <SettingsCard className=" border-gray-200 hover:border-gray-300 ">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left">Username</th>
            <th className="px-3 py-3 text-left hidden md:table-cell">Rôle</th>
            <th className="px-3 py-3">Supprimer compte</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <tr
              key={user.id}
              className={`${
                i % 2 === 1 ? "bg-gray-50" : "bg-white"
              } hover:bg-sky-50`}
            >
              <td className="px-3 py-3 font-medium">{user.username}</td>
              <td className="px-3 py-3 hidden md:table-cell">{user.role}</td>
              <td className="px-3 py-3 text-center">
                <button
                  className=" text-red-600 hover:text-red-700 px-3 py-1 rounded text-sm"
                  onClick={() => onDelete(user.id)}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsCard>
  );
}

import SettingsCard from "@/components/shared/SettingsCard";
