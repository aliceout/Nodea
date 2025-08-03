import React from "react";

export default function UserTable({ users, onDelete, onResetPassword }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-50">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left">Username</th>
            <th className="px-3 py-3 text-left">Rôle</th>
            <th className="px-3 py-3">Password</th>
            <th className="px-3 py-3">Supprimer</th>
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
              <td className="px-3 py-3">{user.role}</td>
              <td className="px-3 py-3">
                <button
                  className="bg-sky-100 text-sky-700 px-3 py-1 rounded hover:bg-sky-200 text-sm"
                  onClick={() => onResetPassword(user)}
                >
                  Reset (mail)
                </button>
              </td>
              <td className="px-3 py-3">
                <button
                  className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 text-sm"
                  onClick={() => onDelete(user.id)}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
