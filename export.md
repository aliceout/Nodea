# Project Structure

```
public/
  favicon.svg
  LogoDaily.svg
src/
  components/
    Account/
      ChangeEmail.jsx
      ChangeUsername.jsx
      DeleteAccount.jsx
      ExportData.jsx
      ImportData.jsx
      PasswordReset.jsx
    Admin/
      ExportUserData.jsx
      InviteCode.jsx
      UserTable.jsx
    Graph/
      GraphChart.jsx
    Historique/
      HistoryEntry.jsx
      HistoryFilters.jsx
      HistoryList.jsx
    Journal/
      Comment.jsx
      Mood.jsx
      Positives.jsx
      Question.jsx
    Navbar/
      Desktop.jsx
      Hamburger.jsx
      Mobile.jsx
      Navbar.jsx
    LayoutMiddle.jsx
    LayoutTop.jsx
    LogoDaily.jsx
    ProtectedRoute.jsx
  data/
    questions.json
  hooks/
    useAuth.js
    useJournalEntries.js
    useMainKey.jsx
    useUsers.js
  pages/
    Account.jsx
    Admin.jsx
    ChangePassword.jsx
    Graph.jsx
    History.jsx
    JournalForm.jsx
    Login.jsx
    NotFound.jsx
    Register.jsx
  services/
    crypto.js
    pocketbase.js
  App.jsx
  index.css
  main.jsx
.env
.gitignore
eslint.config.js
index.html
package-lock.json
package.json
README.md
vite.config.js
```


## public\favicon.svg

```svg
<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="40" cy="40" r="38" fill="url(#paint0_linear)"></circle>
  <text x="17" y="55" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="bold" fill="#f8fafc">
    D
  </text>
  <text x="40" y="55" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="bold" fill="#f8fafc">
    y
  </text>
  <defs>
    <linearGradient id="paint0_linear" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0ea5e9"></stop>
      <stop offset="1" stop-color="#0284c7"></stop>
    </linearGradient>
  </defs>
</svg>
```


## public\LogoDaily.svg

```svg
<svg width="180" height="54" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="54" rx="16" fill="#f8fafc"></rect>
  <text x="20" y="36" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="bold" letter-spacing="1" fill="url(#paint0_linear)">
    Daily
  </text>
  <circle cx="135" cy="22" r="6" fill="#38bdf8"></circle>
  <defs>
    <linearGradient id="paint0_linear" x1="0" y1="0" x2="180" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0284c7"></stop>
      <stop offset="1" stop-color="#0ea5e9"></stop>
    </linearGradient>
  </defs>
</svg>
```


## src\components\Account\ChangeEmail.jsx

```jsx
import React, { useState } from "react";
import pb from "../../services/pocketbase";
import { useNavigate } from "react-router-dom";

export default function EmailSection({ user }) {
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const navigate = useNavigate();

  const handleEmail = async (e) => {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");
    if (!newEmail) {
      setEmailError("Renseigne un nouvel email");
      return;
    }
    try {
      await pb.collection("users").requestEmailChange(newEmail);
      setEmailSuccess(
        "Un email de confirmation a été envoyé, la session va être déconnectée. La reconnexion sera possible après validation."
      );
      setTimeout(() => {
        pb.authStore.clear();
        navigate("/login");
      }, 6000);
      setNewEmail("");
    } catch (err) {
      if (err.data?.email) {
        setEmailError("Cet email est déjà utilisé.");
      } else {
        setEmailError("Erreur lors de la demande");
      }
    }
  };

  return (
    <section className="rounded p-4 shadow bg-white">
      <form onSubmit={handleEmail}>
        <label className="block mb-1 font-semibold">Changer l'email</label>
        <input
          type="email"
          placeholder="Nouvel email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        {emailSuccess && <div className="text-green-600">{emailSuccess}</div>}
        {emailError && <div className="text-red-500">{emailError}</div>}
        <div className="flex items-center justify-between mt-2">
          <button
            type="submit"
            className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 basis-4/10"
          >
            Modifier l'email
          </button>
          <span className="text-gray-500 text-xs basis-6/10 text-left ml-3">
            Tu vas recevoir un mail de confirmation pour valider ce changement.
          </span>
        </div>
      </form>
    </section>
  );
}
```


## src\components\Account\ChangeUsername.jsx

```jsx
import React, { useState } from "react";
import pb from "../../services/pocketbase";

export default function UsernameSection({ user }) {
  const [username, setUsername] = useState(user?.username || "");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const handleUsername = async (e) => {
    e.preventDefault();
    setUsernameSuccess("");
    setUsernameError("");
    try {
      await pb.collection("users").update(user.id, { username });
      setUsernameSuccess("Nom d'utilisateur mis à jour");
    } catch {
      setUsernameError("Erreur lors de la modification");
    }
  };

  return (
    <section className="p-4 shadow bg-white rounded">
      <form onSubmit={handleUsername}>
        <label className="block mb-1 font-semibold">
          Modifier le nom d'utilisateur
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        {usernameSuccess && (
          <div className="text-green-600">{usernameSuccess}</div>
        )}
        {usernameError && <div className="text-red-500">{usernameError}</div>}
        <button
          type="submit"
          className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 mt-2"
        >
          Modifier
        </button>
      </form>
    </section>
  );
}
```


## src\components\Account\DeleteAccount.jsx

```jsx
import React, { useState } from "react";
import pb from "../../services/pocketbase";
import { useNavigate } from "react-router-dom";

export default function DeleteAccountSection({ user }) {
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleteError("");
    if (
      !window.confirm(
        "Attention : cette action est irréversible. Supprimer définitivement ce compte ?"
      )
    )
      return;
    try {
      const journals = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
      });
      for (const entry of journals) {
        await pb.collection("journal_entries").delete(entry.id);
      }
      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      navigate("/login");
    } catch {
      setDeleteError("Erreur lors de la suppression");
    }
  };

  return (
    <section className="p-4 shadow bg-white rounded">
      <label className="block mb-1 font-semibold">Suppression du compte</label>
      <button
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full"
        onClick={handleDelete}
      >
        Supprimer mon compte
      </button>
      {deleteError && <div className="text-red-500 mt-2">{deleteError}</div>}
      <div className="text-gray-500 text-xs mt-2">
        La suppression est définitive
      </div>
    </section>
  );
}
```


## src\components\Account\ExportData.jsx

```jsx
import React, { useState } from "react";
import pb from "../../services/pocketbase";
import CryptoJS from "crypto-js";
import { useMainKey } from "../../hooks/useMainKey";

export default function ExportDataSection({ user }) {
  const { mainKey } = useMainKey();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const decryptField = (cipherText) => {
    if (!mainKey) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, mainKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  };

  const handleExport = async () => {
    setSuccess("");
    setError("");
    setLoading(true);

    try {
      const entries = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
        sort: "date",
        $autoCancel: false,
      });

      if (entries.length === 0) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

      const decrypted = entries.map((e) => ({
        id: e.id,
        date: e.date,
        mood_score: decryptField(e.mood_score),
        mood_emoji: decryptField(e.mood_emoji),
        positive1: decryptField(e.positive1),
        positive2: decryptField(e.positive2),
        positive3: decryptField(e.positive3),
        question: decryptField(e.question),
        answer: decryptField(e.answer),
        comment: decryptField(e.comment),
      }));

      const data = JSON.stringify(decrypted, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${user.username || user.email}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setSuccess("Export terminé");
    } catch (e) {
      setError("Erreur lors de l’export");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <section className="p-4 shadow bg-white rounded flex flex-col">
      <label className="block mb-1 font-semibold">
        Exporter les données du compte
      </label>
      <button
        className="px-4 py-2 rounded bg-green-400 hover:bg-green-500 text-white w-full"
        onClick={handleExport}
        type="button"
        disabled={loading}
      >
        {loading ? "Chargement…" : "Exporter"}
      </button>
      {success && <div className="text-green-600 mt-2">{success}</div>}
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </section>
  );
}
```


## src\components\Account\ImportData.jsx

```jsx
import React, { useState } from "react";
import pb from "../../services/pocketbase";
import CryptoJS from "crypto-js";
import { useMainKey } from "../../hooks/useMainKey";

export default function ExportDataSection({ user }) {
  const { mainKey } = useMainKey();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const decryptField = (cipherText) => {
    if (!mainKey) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, mainKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  };

  const handleExport = async () => {
    setSuccess("");
    setError("");
    setLoading(true);

    try {
      const entries = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
        sort: "date",
        $autoCancel: false,
      });

      if (entries.length === 0) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

      const decrypted = entries.map((e) => ({
        id: e.id,
        date: e.date,
        mood_score: decryptField(e.mood_score),
        mood_emoji: decryptField(e.mood_emoji),
        positive1: decryptField(e.positive1),
        positive2: decryptField(e.positive2),
        positive3: decryptField(e.positive3),
        question: decryptField(e.question),
        answer: decryptField(e.answer),
        comment: decryptField(e.comment),
      }));

      const data = JSON.stringify(decrypted, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${user.username || user.email}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setSuccess("Export terminé");
    } catch (e) {
      setError("Erreur lors de l’export");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <section className="p-4 shadow bg-white rounded flex flex-col">
      <label className="block mb-1 font-semibold">
        Exporter les données du compte
      </label>
      <button
        className="px-4 py-2 rounded bg-green-400 hover:bg-green-500 text-white w-full"
        onClick={handleExport}
        type="button"
        disabled={loading}
      >
        {loading ? "Chargement…" : "Exporter"}
      </button>
      {success && <div className="text-green-600 mt-2">{success}</div>}
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </section>
  );
}
```


## src\components\Account\PasswordReset.jsx

```jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function PasswordResetSection() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/change-password");
  };

  return (
    <section className="p-4 shadow bg-white rounded flex flex-col">
      <label className="block mb-1 font-semibold">
        Changer le mot de passe en toute sécurité
      </label>
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
        onClick={handleClick}
        type="button"
      >
        Changer mon mot de passe
      </button>
      <div className="text-gray-500 text-xs mt-2">
        Ce bouton te permet de modifier ton mot de passe sans perdre l'accès à
        tes données chiffrées.
      </div>
    </section>
  );
}
```


## src\components\Admin\ExportUserData.jsx

```jsx
import React, { useState } from "react";
import pb from "../../services/pocketbase";

export default function ExportUserDataButton({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setLoading(true);
    setError("");
    try {
      const entries = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
        sort: "date",
        $autoCancel: false,
      });
      // Crée le blob et télécharge
      const data = JSON.stringify(entries, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${user.username}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      setError("Erreur lors de l’export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        className="bg-green-200 px-3 py-1 rounded hover:bg-green-300 text-sm text-green-700"
        onClick={handleExport}
        disabled={loading}
      >
        {loading ? "Chargement…" : "Exporter"}
      </button>
      {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
    </div>
  );
}
```


## src\components\Admin\InviteCode.jsx

```jsx
import React from "react";

export default function InviteCodeManager({
  inviteCodes,
  generating,
  onGenerate,
  copySuccess,
  onCopy,
}) {
  return (
    <div className="mt-8 px-12">
      <div className="flex gap-3 items-center justify-center">
        <button
          onClick={onGenerate}
          className="bg-sky-700 text-white px-4 py-2 rounded hover:bg-sky-800"
          disabled={generating}
        >
          {generating ? "Génération..." : "Générer un code d’invitation"}
        </button>
      </div>
      {copySuccess && (
        <div className="mt-2 text-green-600 font-medium">{copySuccess}</div>
      )}
      {inviteCodes.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold mb-2">Codes d’invitation valides :</div>
          <ul className="flex flex-wrap gap-3">
            {inviteCodes.map((c) => (
              <li
                key={c.id || c.code}
                className="bg-gray-100 px-3 py-2 rounded flex items-center gap-2"
              >
                <span className="font-mono">{c.code}</span>
                <button
                  className="text-sky-700 text-xs hover:underline"
                  onClick={() => onCopy(c.code)}
                >
                  Copier
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```


## src\components\Admin\UserTable.jsx

```jsx
import React from "react";
import ExportUserData from "./ExportUserData";

export default function UserTable({ users, onDelete, onResetPassword }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-50">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-3 py-3 text-left">Username</th>
            <th className="px-3 py-3 text-left hidden md:table-cell">Rôle</th>
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
              <td className="px-3 py-3 hidden md:table-cell">{user.role}</td>
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
```


## src\components\Graph\GraphChart.jsx

```jsx
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Format dd.mm
const formatDDMM = (isoDate) => {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
};

export default function GraphChart({ data }) {
  return (
    <div className="h-[60vh] min-h-[400px] md:min-h-[600px] w-full flex justify-center items-center">
      <ResponsiveContainer width="95%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 30, right: 30, left: 30, bottom: 30 }}
        >
          <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDDMM}
            interval={0}
            tick={(props) => {
              const { x, y, payload, index } = props;
              return (
                <g>
                  <text
                    x={x}
                    y={y + 15}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize={12}
                  >
                    {formatDDMM(payload.value)}
                  </text>
                  <text x={x} y={y + 32} textAnchor="middle" fontSize={18}>
                    {data[index] ? data[index].emoji : ""}
                  </text>
                </g>
              );
            }}
          />
          <YAxis domain={[-2, 3]} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const { mood, emoji } = payload[0].payload;
                return (
                  <div className="bg-white border rounded p-2 shadow text-sm">
                    <div>
                      <span className="font-bold">Date :</span>{" "}
                      {formatDDMM(label)}
                    </div>
                    <div>
                      <span className="font-bold">Mood :</span> {mood} {emoji}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 6, fill: "#fbbf24" }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```


## src\components\Historique\HistoryEntry.jsx

```jsx
import React from "react";

export default function HistoryEntry({ entry, onDelete, decryptField }) {
  const dateObj = new Date(entry.date);
  const jours = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const jour = jours[dateObj.getDay()];
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");

  return (
    <li className="relative mb-6 p-4 bg-white rounded shadow min-w-[250px] max-w-xs flex-1">
      <div className="flex items-center mb-2 justify-between">
        <span className="font-bold">
          {jour.charAt(0).toUpperCase() + jour.slice(1)}
          <span className="mx-1 text-gray-500"></span>
          {dd}.{mm}
        </span>
        <div className="flex items-center justify-center pr-8 ">
          <span className="text-xl mr-3">{decryptField(entry.mood_emoji)}</span>
          <span className="ml-auto px-2 py-1 rounded bg-sky-50">
            {decryptField(entry.mood_score)}
          </span>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="absolute top-2 right-2 bg-white rounded-full p-1 hover:bg-red-100 transition group"
          title="Supprimer"
          tabIndex={-1}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            className="block"
          >
            <circle cx="10" cy="10" r="10" fill="#F87171" opacity="0.20" />
            <path
              d="M7 7L13 13M13 7L7 13"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {decryptField(entry.positive1)}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {decryptField(entry.positive2)}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          + {decryptField(entry.positive3)}
        </div>
      </div>
      {/* Question du jour */}
      {entry.question && (
        <div className="mt-2 text-gray-800 text-sm font-semibold">
          Question du jour : <span>{decryptField(entry.question)}</span>
        </div>
      )}
      {/* Réponse à la question */}
      {entry.answer && (
        <div className="mb-1 ml-2 italic text-sky-900 text-sm">
          ↳ {decryptField(entry.answer)}
        </div>
      )}
      {/* Commentaire */}
      {entry.comment && (
        <div className="mt-2 text-gray-800 text-sm font-semibold">
          Commentaire :{" "}
          <span className=" font-normal text-gray-700 italic">
            {decryptField(entry.comment)}
          </span>
        </div>
      )}
    </li>
  );
}
```


## src\components\Historique\HistoryFilters.jsx

```jsx
import React from "react";

export default function HistoryFilters({
  month,
  setMonth,
  year,
  setYear,
  years,
}) {
  return (
    <div className="flex gap-4 mb-6">
      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="border rounded p-1"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {new Date(0, i).toLocaleString("fr-FR", { month: "long" })}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="border rounded p-1"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
```


## src\components\Historique\HistoryList.jsx

```jsx
import React from "react";
import HistoryEntry from "./HistoryEntry";

export default function HistoryList({ entries, onDelete, decryptField }) {
  if (entries.length === 0) {
    return (
      <div className="text-gray-500">Aucune entrée pour cette période.</div>
    );
  }
  return (
    <ul className="flex flex-wrap gap-8 w-full px-10 ">
      {entries.map((entry) => (
        <HistoryEntry
          key={entry.id}
          entry={entry}
          onDelete={onDelete}
          decryptField={decryptField}
        />
      ))}
    </ul>
  );
}
```


## src\components\Journal\Comment.jsx

```jsx
import React from "react";

export default function JournalComment({ comment, setComment }) {
  return (
    <div className="flex flex-col justify-center gap-1">
      <label className="text-sm font-semibold">Commentaire :</label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full p-3 border rounded min-h-50"
        placeholder="Réponse optionnelle"
      />
    </div>
  );
}
```


## src\components\Journal\Mood.jsx

```jsx
import React from "react";
import EmojiPicker from "emoji-picker-react";

export default function JournalMood({
  moodScore,
  setMoodScore,
  moodEmoji,
  setMoodEmoji,
  showPicker,
  setShowPicker,
  emojiBtnRef,
  pickerRef,
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-row items-end justify-between">
        <div className="flex items-center gap-4">
          <span>Résumé</span>
          <button
            type="button"
            className="text-2xl border rounded h-10 w-10 flex items-center justify-center"
            ref={emojiBtnRef}
            onClick={() => setShowPicker(!showPicker)}
            style={{ lineHeight: 1 }}
          >
            {moodEmoji || "🙂"}
          </button>
          {showPicker && (
            <div
              ref={pickerRef}
              className="absolute z-50 top-16 left-1/2 -translate-x-1/2 shadow-xl"
            >
              <EmojiPicker
                onEmojiClick={(e) => {
                  setMoodEmoji(e.emoji);
                  setShowPicker(false);
                }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Note</span>
          <select
            value={moodScore}
            onChange={(e) => setMoodScore(e.target.value)}
            className="p-1 h-10 border rounded text-base"
            required
          >
            <option value="" disabled>
              Sélectionner
            </option>
            <option value="2">🤩 2</option>
            <option value="1">😊 1</option>
            <option value="0">😐 0</option>
            <option value="-1">😓 -1</option>
            <option value="-2">😭 -2</option>
          </select>
        </div>
      </div>
    </div>
  );
}
```


## src\components\Journal\Positives.jsx

```jsx
import React from "react";

export default function JournalPositives({
  positive1,
  setPositive1,
  positive2,
  setPositive2,
  positive3,
  setPositive3,
  required = false,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Premier point positif du jour :
        </label>
        <textarea
          value={positive1}
          onChange={(e) => setPositive1(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Deuxième point positif du jour :
        </label>
        <textarea
          value={positive2}
          onChange={(e) => setPositive2(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
      <div className="flex flex-col justify-center gap-1">
        <label className="text-sm font-semibold">
          Troisième point positif du jour :
        </label>
        <textarea
          value={positive3}
          onChange={(e) => setPositive3(e.target.value)}
          className="w-full p-3 border rounded min-h-18 resize-none align-top"
          rows={2}
          required={required}
        />
      </div>
    </div>
  );
}
```


## src\components\Journal\Question.jsx

```jsx
import React from "react";

export default function JournalQuestion({
  question,
  answer,
  setAnswer,
  loading,
}) {
  return (
    <div className="flex flex-col w-full basis-full md:basis-3/5 ">
      <div className="text-sm font-semibold">Question du jour :</div>
      <div className="mb-2 italic text-gray-800 text-sm">
        {loading ? <span className="opacity-50">Chargement…</span> : question}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="w-full mb-0 p-3 border rounded min-h-18 resize-none align-top"
        rows={2}
        placeholder="Réponse optionnelle"
        disabled={loading}
      />
    </div>
  );
}
```


## src\components\Navbar\Desktop.jsx

```jsx
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function Desktop() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="md:px-10 hidden md:flex w-full items-center justify-between">
      {/* Liens à gauche */}
      <div className="flex items-center gap-6">
        <Link to="/journal" className="hover:underline">
          Journal
        </Link>
        <Link to="/history" className="hover:underline">
          Historique
        </Link>
        <Link to="/graph" className="hover:underline">
          Graphique
        </Link>
        {user.role === "admin" && (
          <Link to="/admin" className="hover:underline">
            Admin
          </Link>
        )}
      </div>
      {/* User + bouton à droite */}
      <div className="flex items-center gap-6">
        <span className="italic">{user.username || user.email}</span>
        <Link to="/account" className="hover:underline">
          Mon compte
        </Link>
        <button
          onClick={handleLogout}
          className="bg-gray-200 text-sky-900 px-3 py-1 rounded hover:bg-gray-300"
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}
```


## src\components\Navbar\Hamburger.jsx

```jsx
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
```


## src\components\Navbar\Mobile.jsx

```jsx
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import React, { useEffect } from "react";

export default function Mobile({ menuOpen, setMenuOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Bloque le scroll du body quand menuOpen
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // Clean up si unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMenuOpen(false);
  };

  if (!menuOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-sky-900/95 flex flex-col items-center justify-center gap-8 z-40 md:hidden"
      onClick={() => setMenuOpen(false)}
    >
      <Link
        to="/journal"
        className="text-xl"
        onClick={() => setMenuOpen(false)}
      >
        Journal
      </Link>
      <Link
        to="/history"
        className="text-xl"
        onClick={() => setMenuOpen(false)}
      >
        Historique
      </Link>
      {user.role === "admin" && (
        <Link
          to="/admin"
          className="text-xl"
          onClick={() => setMenuOpen(false)}
        >
          Admin
        </Link>
      )}
      <Link
        to="/account"
        className="text-xl mt-5"
        onClick={() => setMenuOpen(false)}
      >
        Mon compte
      </Link>
      <button
        onClick={handleLogout}
        className="bg-gray-200 text-sky-900 px-5 py-2 rounded hover:bg-gray-300"
      >
        Déconnexion
      </button>
    </div>
  );
}
```


## src\components\Navbar\Navbar.jsx

```jsx
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
```


## src\components\LayoutMiddle.jsx

```jsx
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
```


## src\components\LayoutTop.jsx

```jsx
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
```


## src\components\LogoDaily.jsx

```jsx
export default function LogoDaily({ className = "" }) {
  return <img src="/LogoDaily.svg" alt="Daily logo" className={className} />;
}
```


## src\components\ProtectedRoute.jsx

```jsx
import { Navigate } from "react-router-dom";
import pb from "../services/pocketbase";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const user = pb.authStore.model;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/journal" replace />;
  }

  return children;
}
```


## src\data\questions.json

```json
[
  "Qu’est-ce qui t’a fait sourire aujourd’hui ?",
  "Un moment où tu t’es sentie pleinement vivante aujourd’hui ?",
  "Quel geste ou parole t’a touchée ?",
  "Qu’as-tu fait qui demandait du courage, même petit ?",
  "As-tu eu une surprise, agréable ou pas, aujourd’hui ?",
  "Qu’est-ce qui t’a apaisée dans ta journée ?",
  "Quel lien t’a nourrie, ou au contraire t’a pesé ?",
  "Un moment où tu as ressenti de la fierté ?",
  "Qu’as-tu appris de neuf sur toi ou sur le monde ?",
  "Un sentiment qui a traversé ta journée, et que tu nommes ici ?",
  "Un endroit où tu as respiré ou pris le temps d’exister ?",
  "Quelque chose dont tu voudrais te souvenir ?",
  "As-tu croisé la tendresse quelque part aujourd’hui ?",
  "Une envie que tu as eue, réalisée ou non ?",
  "Un moment où tu t’es sentie alignée avec tes valeurs ?",
  "Qu’as-tu laissé derrière toi aujourd’hui ?",
  "Qu’est-ce qui t’a aidée à traverser un passage difficile ?",
  "As-tu ressenti de la gratitude aujourd’hui ? Pour quoi, qui ?",
  "Un détail anodin mais important à tes yeux ?",
  "Quelque chose que tu aurais aimé dire et que tu n’as pas dit ?",
  "Un moment où tu t’es sentie en lien avec la nature ?",
  "Qu’as-tu choisi de faire pour toi, et pas pour les autres ?",
  "Une peur ressentie aujourd’hui ? Qu’as-tu fait avec ?",
  "Un rêve ou une pensée qui t’a accompagnée ?",
  "Qu’est-ce qui t’a mise en colère ?",
  "Un geste de soin, envers toi-même ou autrui ?",
  "Une sensation physique marquante (douleur, plaisir, chaleur…) ?",
  "As-tu pris un risque, petit ou grand ?",
  "Une musique ou un son qui t’a accompagnée ?",
  "Un moment où tu t’es sentie libre ?",
  "As-tu ressenti de la honte ou du doute ?",
  "Une décision prise, même minime ?",
  "Un espace où tu t’es sentie en sécurité ?",
  "Un moment de beauté dans ta journée ?",
  "As-tu accordé du temps à quelqu’un qui en avait besoin ?",
  "Qu’as-tu créé ou transformé ?",
  "As-tu fait preuve de patience ?",
  "Un souvenir qui t’a traversée aujourd’hui ?",
  "Un mot ou une phrase que tu veux garder de ce jour ?",
  "As-tu laissé une place à l’imprévu ?",
  "Qu’est-ce qui t’a fait rire ?",
  "Une personne à qui tu penses, et pourquoi ?",
  "Un lieu où tu aimerais retourner ?",
  "As-tu ressenti de la joie simple ?",
  "Un geste ou un mot que tu regrettes ?",
  "Qu’est-ce que tu voudrais faire différemment demain ?",
  "Qu’as-tu refusé ou posé comme limite ?",
  "Un moment de partage, même bref ?",
  "As-tu été attentive à un besoin qui s’exprimait en toi ?",
  "Un geste de révolte ou d’insoumission aujourd’hui ?",
  "As-tu ressenti de la fatigue ou de l’énergie ?",
  "Une petite victoire à célébrer ?",
  "As-tu fait une rencontre, même brève ou étrange ?",
  "Un échec ou une déception ? Comment l’as-tu vécue ?",
  "Un instant de paix intérieure ?",
  "Une question que tu te poses ce soir ?",
  "As-tu donné ou reçu de l’aide ?",
  "Qu’as-tu lâché prise aujourd’hui ?",
  "Un aliment ou une saveur marquante ?",
  "Une envie non satisfaite ?",
  "Qu’as-tu fait aujourd’hui qui allait dans le sens de ta liberté ?",
  "Un souvenir d’enfance qui est remonté ?",
  "Une peur qui t’a retenue ou poussée à agir ?",
  "Un compliment reçu ou donné ?",
  "Un moment où tu t’es sentie invisible ou vue ?",
  "Qu’as-tu observé chez les autres ?",
  "Un instant de silence, choisi ou subi ?",
  "Qu’as-tu perdu ou laissé filer ?",
  "As-tu découvert un nouvel endroit ou un nouveau visage ?",
  "Qu’as-tu ressenti en début et en fin de journée ?",
  "Un moment où tu as pris soin de ton corps ?",
  "Qu’as-tu évité ou reporté aujourd’hui ?",
  "Un geste ou une parole pour résister à la norme ?",
  "Une émotion qui domine ce soir ?",
  "Une chose qui te manque en ce moment ?",
  "Qu’as-tu trouvé de beau dans le banal ?",
  "Une question à laquelle tu n’as pas de réponse ?",
  "As-tu pris le temps de rêver ?",
  "Un engagement tenu, ou non tenu ?",
  "Un souvenir à laisser derrière toi ?",
  "Qu’as-tu accepté aujourd’hui, en toi ou autour de toi ?",
  "Un moment où tu t’es sentie déplacée, étrangère ?",
  "Une sensation d’être à ta place, ou non ?",
  "Qu’as-tu donné sans attendre en retour ?",
  "Une parole ou un silence important ?",
  "Un projet, même petit, que tu as avancé ?",
  "Qu’as-tu envie de remercier, ce soir ?",
  "As-tu pu exprimer qui tu es, vraiment ?",
  "Qu’as-tu observé du monde autour de toi ?",
  "Un instant d’humilité ou de remise en question ?",
  "Un moment où tu as accueilli l’inconnu ?",
  "As-tu choisi la facilité ou la difficulté ?",
  "Un moment où tu as ressenti l’injustice ?",
  "Qu’as-tu fait pour faire de la place à la joie ?",
  "Un geste de solidarité, de soutien ?",
  "Une pensée persistante aujourd’hui ?",
  "As-tu éprouvé de la peur, de l’envie, du désir ?",
  "Qu’as-tu envie de changer dans ta vie ?",
  "Un instant où tu t’es sentie chez toi ?",
  "Un mot pour résumer ta journée ?"
]
```


## src\hooks\useAuth.js

```js
import { useState, useEffect } from 'react'
import pb from '../services/pocketbase'

export default function useAuth() {
  const [user, setUser] = useState(pb.authStore.model)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
    })
    return unsub
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    await pb.collection('users').authWithPassword(email, password)
    setUser(pb.authStore.model)
    setLoading(false)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  return { user, login, logout, loading }
}
```


## src\hooks\useJournalEntries.js

```js

```


## src\hooks\useMainKey.jsx

```jsx
import { createContext, useContext, useState } from "react";

const MainKeyContext = createContext();

export function MainKeyProvider({ children }) {
  const [mainKey, setMainKey] = useState(null);
  return (
    <MainKeyContext.Provider value={{ mainKey, setMainKey }}>
      {children}
    </MainKeyContext.Provider>
  );
}

export function useMainKey() {
  return useContext(MainKeyContext);
}
```


## src\hooks\useUsers.js

```js

```


## src\pages\Account.jsx

```jsx
import React from "react";
import Layout from "../components/LayoutTop";
import UsernameSection from "../components/Account/ChangeUsername";
import PasswordResetSection from "../components/Account/PasswordReset";
import EmailSection from "../components/Account/ChangeEmail";
import DeleteAccountSection from "../components/Account/DeleteAccount";
import ExportData from "../components/Account/ExportData";
import pb from "../services/pocketbase";

export default function AccountPage() {
  const user = pb.authStore.model;
  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto p-8 rounded-lg">
        <h1 className="text-2xl font-bold text-center mb-8">Mon compte</h1>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Colonne gauche */}
          <div className="flex-1 flex flex-col gap-8">
            <UsernameSection user={user} />
            <EmailSection user={user} />
          </div>
          {/* Colonne droite */}
          <div className="flex-1 flex flex-col gap-8">
            <ExportData user={user} />
            <PasswordResetSection user={user} />
            <DeleteAccountSection user={user} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
```


## src\pages\Admin.jsx

```jsx
import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";
import UserTable from "../components/Admin/UserTable";
import InviteCodeManager from "../components/Admin/InviteCode";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteCodes, setInviteCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");
  const [lastCode, setLastCode] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("users").getFullList({
          sort: "email",
          $autoCancel: false,
        });
        setUsers(result);
      } catch (err) {
        setError("Erreur chargement users: " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchCodes = async () => {
      try {
        const result = await pb.collection("invites_codes").getFullList({
          sort: "-created",
          $autoCancel: false,
        });
        setInviteCodes(result);
      } catch (err) {}
    };
    fetchCodes();
  }, [generating, lastCode]);

  // Suppression user + ses entrées journal
  const handleDelete = async (userId) => {
    if (
      !window.confirm(
        "Supprimer cet utilisateur ? Toutes ses entrées journal seront aussi supprimées."
      )
    )
      return;
    try {
      const journals = await pb.collection("journal_entries").getFullList({
        filter: `user="${userId}"`,
      });
      for (const entry of journals) {
        await pb.collection("journal_entries").delete(entry.id);
      }
      await pb.collection("users").delete(userId);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      alert("Erreur suppression : " + (err?.message || ""));
    }
  };

  const handleResetPassword = async (user) => {
    const email = user.email;
    if (!window.confirm(`Envoyer un mail de reset à ${email} ?`)) return;
    try {
      await pb.collection("users").requestPasswordReset(email);
      alert("Mail de réinitialisation envoyé");
    } catch (err) {
      alert("Erreur reset : " + (err?.message || ""));
    }
  };

  // Code d'invitation
  function randomCode(len = 8) {
    return Math.random()
      .toString(36)
      .replace(/[^a-z0-9]+/g, "")
      .slice(-len)
      .toUpperCase();
  }

  const handleGenerateCode = async () => {
    setGenerating(true);
    setCopySuccess("");
    const code = randomCode(8);
    try {
      const record = await pb.collection("invites_codes").create({ code });
      setLastCode(code);
      setInviteCodes([record, ...inviteCodes]);
      setCopySuccess("");
    } catch (err) {
      setCopySuccess("Erreur lors de la création du code");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(`Code copié : ${code}`);
      setTimeout(() => setCopySuccess(""), 2000);
    } catch {
      setCopySuccess("Erreur lors de la copie");
    }
  };

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mt-10 mb-6">
        Gestion des utilisateur·ice·s
      </h1>
      <UserTable
        users={users}
        onDelete={handleDelete}
        onResetPassword={handleResetPassword}
      />
      <InviteCodeManager
        inviteCodes={inviteCodes}
        generating={generating}
        onGenerate={handleGenerateCode}
        copySuccess={copySuccess}
        onCopy={handleCopy}
      />
    </Layout>
  );
}
```


## src\pages\ChangePassword.jsx

```jsx
import React, { useState } from "react";
import pb from "../services/pocketbase";
import { useNavigate } from "react-router-dom";
import { useMainKey } from "../hooks/useMainKey";
import {
  deriveProtectionKey,
  decryptKey,
  encryptKey,
} from "../services/crypto";

import Layout from "../components/LayoutMiddle";

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { mainKey, setMainKey } = useMainKey();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== newPasswordConfirm) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    if (!pb.authStore.isValid) {
      setError("Vous devez être connecté·e.");
      return;
    }

    try {
      const user = pb.authStore.model;
      const encryptedKey = user.encrypted_key;
      const salt = user.encryption_salt;

      // Dérive la clé protection avec l'ancien mot de passe
      const oldProtectionKey = deriveProtectionKey(oldPassword, salt);

      // Déchiffre la clé principale avec l'ancien mot de passe
      const decryptedMainKey = decryptKey(encryptedKey, oldProtectionKey);

      if (!decryptedMainKey) {
        setError("Ancien mot de passe incorrect.");
        return;
      }

      // Dérive la clé protection avec le nouveau mot de passe
      const newProtectionKey = deriveProtectionKey(newPassword, salt);

      // Rechiffre la clé principale avec la nouvelle clé protection
      const newEncryptedKey = encryptKey(decryptedMainKey, newProtectionKey);

      // Mets à jour la clé chiffrée, le mot de passe et l'ancien mot de passe dans PocketBase
      await pb.collection("users").update(user.id, {
        encrypted_key: newEncryptedKey,
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: oldPassword, // <-- ajout ici pour satisfaire la validation serveur
      });

      // Mets à jour la clé principale dans le contexte
      setMainKey(decryptedMainKey);

      setSuccess("Mot de passe changé avec succès.");
      // Optionnel : rediriger vers journal ou page d’accueil
      // navigate("/journal");
    } catch (err) {
      setError("Erreur lors du changement de mot de passe : " + err.message);
    }
  };

  return (
    <Layout>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
      >
        <h1 className="text-2xl font-bold mb-6">Changer de mot de passe</h1>

        <input
          type="password"
          placeholder="Ancien mot de passe"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Confirmez le nouveau mot de passe"
          value={newPasswordConfirm}
          onChange={(e) => setNewPasswordConfirm(e.target.value)}
          className="w-full mb-6 p-3 border rounded"
          required
        />

        {error && (
          <div className="text-red-500 mb-4 w-full text-center">{error}</div>
        )}
        {success && (
          <div className="text-green-600 mb-4 w-full text-center">
            {success}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-sky-600 text-white py-3 rounded hover:bg-sky-700 font-semibold"
        >
          Valider
        </button>
      </form>
    </Layout>
  );
}
```


## src\pages\Graph.jsx

```jsx
import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";
import GraphChart from "../components/Graph/GraphChart";
import { useMainKey } from "../hooks/useMainKey";
import CryptoJS from "crypto-js";

export default function GraphPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { mainKey } = useMainKey();

  function decryptField(cipherText) {
    if (!mainKey) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, mainKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("journal_entries").getFullList({
          filter: `user="${pb.authStore.model.id}"`,
          sort: "date",
          $autoCancel: false,
        });

        // Filtrer sur les 6 derniers mois glissants
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const filtered = result.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= sixMonthsAgo && entryDate <= now;
        });

        setData(
          filtered.map((entry) => ({
            date: entry.date,
            mood: Number(decryptField(entry.mood_score)), // déchiffré et cast en number
            emoji: decryptField(entry.mood_emoji), // déchiffré
          }))
        );
      } catch (err) {
        setError("Erreur de chargement : " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mainKey]); // <-- ajoute mainKey en dépendance pour recharger quand la clé change

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!mainKey) {
    return (
      <div className="p-8 text-red-600 font-semibold">
        ⚠️ Clé de chiffrement absente. Merci de vous reconnecter pour afficher
        le graphique.
      </div>
    );
  }
  if (!data.length) return <div className="p-8">Aucune donnée.</div>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mt-10 mb-4">Évolution</h1>
      <GraphChart data={data} />
    </Layout>
  );
}
```


## src\pages\History.jsx

```jsx
import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import { useMainKey } from "../hooks/useMainKey";
import CryptoJS from "crypto-js";
import Layout from "../components/LayoutTop";
import HistoryFilters from "../components/Historique/HistoryFilters";
import HistoryList from "../components/Historique/HistoryList";

export default function HistoryPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("journal_entries").getFullList({
          filter: `user="${pb.authStore.model.id}"`,
          sort: "-date",
          $autoCancel: false,
        });
        setEntries(result);
      } catch (err) {
        setError("Erreur lors du chargement : " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, []);

  const { mainKey } = useMainKey();

  function decryptField(cipherText) {
    if (!mainKey) return ""; // clé non chargée
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, mainKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette entrée ?")) return;
    try {
      await pb.collection("journal_entries").delete(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Erreur lors de la suppression : " + (err?.message || ""));
    }
  };

  // Liste des années présentes dans les données
  const years = [
    ...new Set(entries.map((e) => new Date(e.date).getFullYear())),
  ].sort((a, b) => b - a);

  // Filtrer les entrées sur le mois/année choisi
  const filtered = entries.filter((entry) => {
    const date = new Date(entry.date);
    return (
      date.getMonth() + 1 === Number(month) &&
      date.getFullYear() === Number(year)
    );
  });
  if (!mainKey) {
    return (
      <div className="flex items-center justify-center h-64 text-red-700 text-lg font-semibold">
        ⚠️ Clé de chiffrement absente. Merci de vous reconnecter pour afficher
        l’historique.
      </div>
    );
  }
  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4 mt-10">Historique</h1>
      <HistoryFilters
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        years={years}
      />
      <HistoryList
        entries={filtered}
        onDelete={handleDelete}
        decryptField={decryptField}
      />{" "}
    </Layout>
  );
}
```


## src\pages\JournalForm.jsx

```jsx
import React, { useState, useEffect, useRef } from "react";
import pb from "../services/pocketbase";
import { useMainKey } from "../hooks/useMainKey";
import CryptoJS from "crypto-js";
import Layout from "../components/LayoutTop";
import PositivePoint from "../components/Journal/Positives";
import MoodSelector from "../components/Journal/Mood";
import QuestionBlock from "../components/Journal/Question";
import CommentBlock from "../components/Journal/Comment";
import questions from "../data/questions.json";

export default function JournalEntryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [positive1, setPositive1] = useState("");
  const [positive2, setPositive2] = useState("");
  const [positive3, setPositive3] = useState("");
  const [moodScore, setMoodScore] = useState("");
  const [moodEmoji, setMoodEmoji] = useState("");
  const [comment, setComment] = useState("");
  const [answer, setAnswer] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [randomQuestion, setRandomQuestion] = useState("");
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const { mainKey } = useMainKey();
  const [showPicker, setShowPicker] = useState(false);
  const emojiBtnRef = useRef(null);
  const pickerRef = useRef(null);

  function encryptField(value) {
    if (!mainKey) return ""; // Sécurité, cas anormal
    return CryptoJS.AES.encrypt(value, mainKey).toString();
  }

  useEffect(() => {
    // Aller chercher les questions utilisées sur les 30 derniers jours
    const fetchQuestion = async () => {
      setLoadingQuestion(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);

        // Prend les entrées du user sur les 30 derniers jours
        const entries = await pb.collection("journal_entries").getFullList({
          filter: `user="${pb.authStore.model.id}" && date >= "${sinceStr}"`,
        });
        const alreadyUsedQuestions = entries.map((e) => e.question);

        // Filtre les questions jamais (ou pas récemment) posées
        const availableQuestions = questions.filter(
          (q) => !alreadyUsedQuestions.includes(q)
        );
        let chosen = "";
        if (availableQuestions.length > 0) {
          chosen =
            availableQuestions[
              Math.floor(Math.random() * availableQuestions.length)
            ];
        } else {
          // fallback : prend n’importe quelle question au hasard
          chosen = questions[Math.floor(Math.random() * questions.length)];
        }
        setRandomQuestion(chosen);
      } catch {
        // fallback
        setRandomQuestion(
          questions[Math.floor(Math.random() * questions.length)]
        );
      } finally {
        setLoadingQuestion(false);
      }
    };
    fetchQuestion();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!mainKey) {
      setError(
        "Erreur : clé de chiffrement absente. Reconnecte-toi pour pouvoir enregistrer."
      );
      return;
    }
    if (!positive1.trim() || !positive2.trim() || !positive3.trim()) {
      setError("Merci de remplir les trois points positifs.");
      return;
    }
    if (moodScore === "" || moodScore === null) {
      setError("Merci de choisir une note d'humeur.");
      return;
    }
    if (!moodEmoji) {
      setError("Merci de choisir un emoji.");
      return;
    }
    try {
      await pb.collection("journal_entries").create({
        user: pb.authStore.model.id,
        date,
        positive1: encryptField(positive1),
        positive2: encryptField(positive2),
        positive3: encryptField(positive3),
        mood_score: encryptField(String(moodScore)), // Chiffré
        mood_emoji: encryptField(moodEmoji), // Chiffré
        comment: encryptField(comment),
        question: encryptField(randomQuestion), // Chiffré
        answer: encryptField(answer), // Chiffré
      });

      setSuccess("Entrée enregistrée !");
      setPositive1("");
      setPositive2("");
      setPositive3("");
      setMoodScore("");
      setMoodEmoji("");
      setComment("");
      setAnswer("");
    } catch (err) {
      setError("Erreur lors de l’enregistrement : " + (err?.message || ""));
    }
  };

  return (
    <Layout>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl mx-auto rounded-lg mt-5 px-5 md:px-0"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
          <h1 className="text-2xl font-bold text-center md:text-left">
            Mon journal du jour
          </h1>
          <div className="flex-shrink-0 flex items-center justify-center md:justify-end w-full md:w-85 mt-5">
            <input
              id="journal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded p-2 w-full"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 mb-4">
          <div className="flex flex-col w-full md:w-1/2">
            <PositivePoint
              positive1={positive1}
              setPositive1={setPositive1}
              positive2={positive2}
              setPositive2={setPositive2}
              positive3={positive3}
              setPositive3={setPositive3}
              required
            />
          </div>
          <div className="flex flex-col w-full md:w-1/2 gap-4">
            <MoodSelector
              moodScore={moodScore}
              setMoodScore={setMoodScore}
              moodEmoji={moodEmoji}
              setMoodEmoji={setMoodEmoji}
              showPicker={showPicker}
              setShowPicker={setShowPicker}
              emojiBtnRef={emojiBtnRef}
              pickerRef={pickerRef}
            />
            <CommentBlock comment={comment} setComment={setComment} />
          </div>
        </div>
        <div className="mb-6 flex flex-col md:flex-row items-end gap-3">
          <QuestionBlock
            question={randomQuestion}
            answer={answer}
            setAnswer={setAnswer}
            loading={loadingQuestion}
          />
          <button
            type="submit"
            className="w-full md:w-1/2 bg-sky-600 text-white py-3 rounded hover:bg-sky-700 font-semibold"
          >
            Enregistrer
          </button>
        </div>
        {error && (
          <div className="text-red-500 mb-2 w-full text-center">{error}</div>
        )}
        {success && (
          <div className="text-green-600 mb-2 w-full text-center">
            {success}
          </div>
        )}
        <div className="flex justify-center"></div>
      </form>
    </Layout>
  );
}
```


## src\pages\Login.jsx

```jsx
import React, { useState } from "react";
import pb from "../services/pocketbase";
import { useNavigate } from "react-router-dom";
import { useMainKey } from "../hooks/useMainKey";
import { deriveProtectionKey, decryptKey } from "../services/crypto";

import Layout from "../components/LayoutMiddle";
import LogoDaily from "../components/LogoDaily";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setMainKey } = useMainKey();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await pb.collection("users").authWithPassword(email, password);

      const user = pb.authStore.model;
      const encryptedKey = user.encrypted_key;
      const salt = user.encryption_salt;

      // Dérive la clé de protection avec le mot de passe saisi + salt
      const protectionKey = deriveProtectionKey(password, salt);

      // Déchiffre la clé principale
      const mainKey = decryptKey(encryptedKey, protectionKey);

      if (!mainKey) {
        setError(
          "Erreur de déchiffrement de la clé (mot de passe incorrect ou données corrompues)"
        );
        return;
      }
      setMainKey(mainKey);
      navigate("/journal");
    } catch (err) {
      setError("Identifiants invalides");
    }
  };

  return (
    <Layout>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
      >
        <LogoDaily className="mx-auto mb-6 w-44 h-16" />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 p-3 border rounded"
          required
        />
        {error && (
          <div className="text-red-500 mb-4 w-full text-center">{error}</div>
        )}
        <button
          type="submit"
          className="w-full bg-sky-600 text-white py-3 rounded hover:bg-sky-700 font-semibold"
        >
          Se connecter
        </button>
      </form>
      <div className="mt-6 text-center w-full">
        <span className="text-gray-600">Pas de compte ?</span>{" "}
        <a
          href="/register"
          className="text-sky-700 underline hover:text-sky-900"
        >
          Créer un compte
        </a>
      </div>
    </Layout>
  );
}
```


## src\pages\NotFound.jsx

```jsx
export default function NotFound() {
  return (
    <div>
      <h1>Not found</h1>
    </div>
  );
}
```


## src\pages\Register.jsx

```jsx
import React, { useState } from "react";
import {
  generateRandomKey,
  generateSalt,
  deriveProtectionKey,
  encryptKey,
} from "../services/crypto";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutMiddle";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    // 1. Vérification du code d'invitation
    try {
      const codeResult = await pb.collection("invites_codes").getFullList({
        filter: `code="${inviteCode}"`,
      });
      if (!codeResult.length) {
        setError("Code d’invitation invalide ou déjà utilisé");
        return;
      }
    } catch (err) {
      setError("Erreur lors de la vérification du code");
      return;
    }

    // 2. Création du compte + suppression du code
    try {
      // 1. Clé principale de chiffrement (unique par user)
      const mainKey = generateRandomKey(32);

      // 2. Salt unique (pour la dérivation PBKDF2)
      const salt = generateSalt(16);

      // 3. Dérivation d'une clé de protection à partir du password et du salt
      const protectionKey = deriveProtectionKey(password, salt);

      // 4. Chiffre la clé principale avec la clé dérivée
      const encrypted_key = encryptKey(mainKey, protectionKey);
      const encryption_salt = salt;
      await pb.collection("users").create({
        username,
        email,
        password,
        passwordConfirm,
        role: "user",
        encrypted_key,
        encryption_salt,
      });

      // Suppression du code d'invitation après usage
      try {
        const codeRecord = await pb
          .collection("invites_codes")
          .getFirstListItem(`code="${inviteCode}"`);
        if (codeRecord && codeRecord.id) {
          await pb.collection("invites_codes").delete(codeRecord.id);
        }
      } catch (e) {
        // On log, mais on n'affiche rien à l'utilisateur·ice
        console.warn("Erreur suppression code invitation :", e);
      }

      setSuccess("Utilisateur créé avec succès");
      setUsername("");
      setInviteCode("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
    } catch (err) {
      setError("Erreur lors de la création du compte");
    }
  };

  return (
    <Layout>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
      >
        <h1 className="text-2xl font-bold mb-6 text-center w-full">
          Créer un compte
        </h1>
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="text"
          placeholder="Code d’invitation"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Confirme le mot de passe"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="w-full mb-6 p-3 border rounded"
          required
        />
        {error && (
          <div className="text-red-500 mb-4 w-full text-center">{error}</div>
        )}
        {success && (
          <div className="text-green-600 mb-4 w-full text-center">
            {success}
          </div>
        )}
        <button
          type="submit"
          className="w-full bg-sky-600 text-white py-3 rounded hover:bg-sky-700 font-semibold"
        >
          Créer le compte
        </button>
      </form>
      <div className="mt-6 text-center w-full">
        <span className="text-gray-600">Déjà un compte ?</span>{" "}
        <a href="/login" className="text-sky-700 underline hover:text-sky-900">
          Se connecter
        </a>
      </div>
    </Layout>
  );
}
```


## src\services\crypto.js

```js
import CryptoJS from "crypto-js";

// Génère une clé aléatoire (clé principale AES, 32 bytes => 256 bits)
export function generateRandomKey(len = 32) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < len; i++) {
    key += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return key;
}

// Génère un salt (pour PBKDF2)
export function generateSalt(len = 16) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let salt = "";
  for (let i = 0; i < len; i++) {
    salt += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return salt;
}

// Dérive une clé de protection depuis le mot de passe et le salt (pour chiffrer la clé principale)
export function deriveProtectionKey(password, salt) {
  return CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32 }).toString();
}

// Chiffre la clé principale avec la clé dérivée
export function encryptKey(mainKey, protectionKey) {
  return CryptoJS.AES.encrypt(mainKey, protectionKey).toString();
}

// Déchiffre la clé principale avec la clé dérivée
export function decryptKey(encryptedKey, protectionKey) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, protectionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
}
```


## src\services\pocketbase.js

```js
import PocketBase from "pocketbase";
const baseUrl = import.meta.env.VITE_PB_URL;
const pb = new PocketBase(baseUrl);

export default pb;
```


## src\App.jsx

```jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import JournalForm from "./pages/JournalForm";
import History from "./pages/History";
import Graph from "./pages/Graph";
import Admin from "./pages/Admin";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import ChangePasswordPage from "./pages/ChangePassword";

import Navbar from "./components/Navbar/Navbar";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/journal"
              element={
                <ProtectedRoute>
                  <JournalForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/graph"
              element={
                <ProtectedRoute>
                  <Graph />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            {/* À ajouter pour la page changement de mot de passe */}
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  {/* Importe et mets ici ton composant ChangePasswordPage */}
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
```


## src\index.css

```css
@import "tailwindcss";
```


## src\main.jsx

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { MainKeyProvider } from "./hooks/useMainKey";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainKeyProvider>
      <App />
    </MainKeyProvider>
  </StrictMode>
);
```


## .env

```
VITE_PB_URL=https://daily.backlice.dev
```


## .gitignore

```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
/package-lock.json
/.env
```


## eslint.config.js

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
```


## index.html

```html
<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily</title>
</head>

<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>

</html>
```


## package-lock.json

```json
{
  "name": "project_name",
  "version": "0.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "project_name",
      "version": "0.0.0",
      "dependencies": {
        "@tailwindcss/vite": "^4.1.11",
        "chart.js": "^4.5.0",
        "crypto-js": "^4.2.0",
        "dayjs": "^1.11.13",
        "emoji-picker-react": "^4.13.2",
        "pocketbase": "^0.26.2",
        "react": "^19.1.0",
        "react-chartjs-2": "^5.3.0",
        "react-dom": "^19.1.0",
        "react-router-dom": "^7.7.1",
        "recharts": "^3.1.0",
        "tailwindcss": "^4.1.11"
      },
      "devDependencies": {
        "@eslint/js": "^9.30.1",
        "@types/react": "^19.1.8",
        "@types/react-dom": "^19.1.6",
        "@vitejs/plugin-react": "^4.6.0",
        "eslint": "^9.30.1",
        "eslint-plugin-react-hooks": "^5.2.0",
        "eslint-plugin-react-refresh": "^0.4.20",
        "globals": "^16.3.0",
        "vite": "^7.0.4"
      }
    },
    "node_modules/@ampproject/remapping": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/@ampproject/remapping/-/remapping-2.3.0.tgz",
      "integrity": "sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==",
      "license": "Apache-2.0",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.5",
        "@jridgewell/trace-mapping": "^0.3.24"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/code-frame": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.27.1.tgz",
      "integrity": "sha512-cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-validator-identifier": "^7.27.1",
        "js-tokens": "^4.0.0",
        "picocolors": "^1.1.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/compat-data": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.28.0.tgz",
      "integrity": "sha512-60X7qkglvrap8mn1lh2ebxXdZYtUcpd7gsmy9kLaBJ4i/WdY8PqTSdxyA8qraikqKQK5C1KRBKXqznrVapyNaw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/core": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.28.0.tgz",
      "integrity": "sha512-UlLAnTPrFdNGoFtbSXwcGFQBtQZJCNjaN6hQNP3UPvuNXT1i82N26KL3dZeIpNalWywr9IuQuncaAfUaS1g6sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@ampproject/remapping": "^2.2.0",
        "@babel/code-frame": "^7.27.1",
        "@babel/generator": "^7.28.0",
        "@babel/helper-compilation-targets": "^7.27.2",
        "@babel/helper-module-transforms": "^7.27.3",
        "@babel/helpers": "^7.27.6",
        "@babel/parser": "^7.28.0",
        "@babel/template": "^7.27.2",
        "@babel/traverse": "^7.28.0",
        "@babel/types": "^7.28.0",
        "convert-source-map": "^2.0.0",
        "debug": "^4.1.0",
        "gensync": "^1.0.0-beta.2",
        "json5": "^2.2.3",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/babel"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.28.0.tgz",
      "integrity": "sha512-lJjzvrbEeWrhB4P3QBsH7tey117PjLZnDbLiQEKjQ/fNJTjuq4HSqgFA+UNSwZT8D7dxxbnuSBMsa1lrWzKlQg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.28.0",
        "@babel/types": "^7.28.0",
        "@jridgewell/gen-mapping": "^0.3.12",
        "@jridgewell/trace-mapping": "^0.3.28",
        "jsesc": "^3.0.2"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-compilation-targets": {
      "version": "7.27.2",
      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.27.2.tgz",
      "integrity": "sha512-2+1thGUUWWjLTYTHZWK1n8Yga0ijBz1XAhUXcKy81rd5g6yh7hGqMp45v7cadSbEHc9G3OTv45SyneRN3ps4DQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/compat-data": "^7.27.2",
        "@babel/helper-validator-option": "^7.27.1",
        "browserslist": "^4.24.0",
        "lru-cache": "^5.1.1",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-globals": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.28.0.tgz",
      "integrity": "sha512-+W6cISkXFa1jXsDEdYA8HeevQT/FULhxzR99pxphltZcVaugps53THCeiWA8SguxxpSp3gKPiuYfSWopkLQ4hw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-imports": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.27.1.tgz",
      "integrity": "sha512-0gSFWUPNXNopqtIPQvlD5WgXYI5GY2kP2cCvoT8kczjbfcfuIljTbcWrulD1CIPIX2gt1wghbDy08yE1p+/r3w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/traverse": "^7.27.1",
        "@babel/types": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-transforms": {
      "version": "7.27.3",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.27.3.tgz",
      "integrity": "sha512-dSOvYwvyLsWBeIRyOeHXp5vPj5l1I011r52FM1+r1jCERv+aFXYk4whgQccYEGYxK2H3ZAIA8nuPkQ0HaUo3qg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-imports": "^7.27.1",
        "@babel/helper-validator-identifier": "^7.27.1",
        "@babel/traverse": "^7.27.3"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-plugin-utils": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-plugin-utils/-/helper-plugin-utils-7.27.1.tgz",
      "integrity": "sha512-1gn1Up5YXka3YYAHGKpbideQ5Yjf1tDa9qYcgysz+cNCXukyLl6DjPXhD3VRwSb8c0J9tA4b2+rHEZtc6R0tlw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz",
      "integrity": "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.27.1.tgz",
      "integrity": "sha512-D2hP9eA+Sqx1kBZgzxZh0y1trbuU+JoDkiEwqhQ36nodYqJwyEIhPSdMNd7lOm/4io72luTPWH20Yda0xOuUow==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-option": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-option/-/helper-validator-option-7.27.1.tgz",
      "integrity": "sha512-YvjJow9FxbhFFKDSuFnVCe2WxXk1zWc22fFePVNEaWJEu8IrZVlda6N0uHwzZrUM1il7NC9Mlp4MaJYbYd9JSg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helpers": {
      "version": "7.28.2",
      "resolved": "https://registry.npmjs.org/@babel/helpers/-/helpers-7.28.2.tgz",
      "integrity": "sha512-/V9771t+EgXz62aCcyofnQhGM8DQACbRhvzKFsXKC9QM+5MadF8ZmIm0crDMaz3+o0h0zXfJnd4EhbYbxsrcFw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/template": "^7.27.2",
        "@babel/types": "^7.28.2"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.28.0.tgz",
      "integrity": "sha512-jVZGvOxOuNSsuQuLRTh13nU0AogFlw32w/MT+LV6D3sP5WdbW61E77RnkbaO2dUvmPAYrBDJXGn5gGS6tH4j8g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.28.0"
      },
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/plugin-transform-react-jsx-self": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-react-jsx-self/-/plugin-transform-react-jsx-self-7.27.1.tgz",
      "integrity": "sha512-6UzkCs+ejGdZ5mFFC/OCUrv028ab2fp1znZmCZjAOBKiBK2jXD1O+BPSfX8X2qjJ75fZBMSnQn3Rq2mrBJK2mw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-react-jsx-source": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-react-jsx-source/-/plugin-transform-react-jsx-source-7.27.1.tgz",
      "integrity": "sha512-zbwoTsBruTeKB9hSq73ha66iFeJHuaFkUbwvqElnygoNbj/jHRsSeokowZFN3CZ64IvEqcmmkVe89OPXc7ldAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/template": {
      "version": "7.27.2",
      "resolved": "https://registry.npmjs.org/@babel/template/-/template-7.27.2.tgz",
      "integrity": "sha512-LPDZ85aEJyYSd18/DkjNh4/y1ntkE5KwUHWTiqgRxruuZL2F1yuHligVHLvcHY2vMHXttKFpJn6LwfI7cw7ODw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/parser": "^7.27.2",
        "@babel/types": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/traverse": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-7.28.0.tgz",
      "integrity": "sha512-mGe7UK5wWyh0bKRfupsUchrQGqvDbZDbKJw+kcRGSmdHVYrv+ltd0pnpDTVpiTqnaBru9iEvA8pz8W46v0Amwg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/generator": "^7.28.0",
        "@babel/helper-globals": "^7.28.0",
        "@babel/parser": "^7.28.0",
        "@babel/template": "^7.27.2",
        "@babel/types": "^7.28.0",
        "debug": "^4.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.28.2",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.28.2.tgz",
      "integrity": "sha512-ruv7Ae4J5dUYULmeXw1gmb7rYRz57OWCPM57pHojnLq/3Z1CK2lNSLTCVjxVk1F/TZHwOZZrOWi0ur95BbLxNQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.27.1",
        "@babel/helper-validator-identifier": "^7.27.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@esbuild/aix-ppc64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.25.8.tgz",
      "integrity": "sha512-urAvrUedIqEiFR3FYSLTWQgLu5tb+m0qZw0NBEasUeo6wuqatkMDaRT+1uABiGXEu5vqgPd7FGE1BhsAIy9QVA==",
      "cpu": [
        "ppc64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "aix"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm/-/android-arm-0.25.8.tgz",
      "integrity": "sha512-RONsAvGCz5oWyePVnLdZY/HHwA++nxYWIX1atInlaW6SEkwq6XkP3+cb825EUcRs5Vss/lGh/2YxAb5xqc07Uw==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm64/-/android-arm64-0.25.8.tgz",
      "integrity": "sha512-OD3p7LYzWpLhZEyATcTSJ67qB5D+20vbtr6vHlHWSQYhKtzUYrETuWThmzFpZtFsBIxRvhO07+UgVA9m0i/O1w==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/android-x64/-/android-x64-0.25.8.tgz",
      "integrity": "sha512-yJAVPklM5+4+9dTeKwHOaA+LQkmrKFX96BM0A/2zQrbS6ENCmxc4OVoBs5dPkCCak2roAD+jKCdnmOqKszPkjA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.25.8.tgz",
      "integrity": "sha512-Jw0mxgIaYX6R8ODrdkLLPwBqHTtYHJSmzzd+QeytSugzQ0Vg4c5rDky5VgkoowbZQahCbsv1rT1KW72MPIkevw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.25.8.tgz",
      "integrity": "sha512-Vh2gLxxHnuoQ+GjPNvDSDRpoBCUzY4Pu0kBqMBDlK4fuWbKgGtmDIeEC081xi26PPjn+1tct+Bh8FjyLlw1Zlg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-arm64/-/freebsd-arm64-0.25.8.tgz",
      "integrity": "sha512-YPJ7hDQ9DnNe5vxOm6jaie9QsTwcKedPvizTVlqWG9GBSq+BuyWEDazlGaDTC5NGU4QJd666V0yqCBL2oWKPfA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-x64/-/freebsd-x64-0.25.8.tgz",
      "integrity": "sha512-MmaEXxQRdXNFsRN/KcIimLnSJrk2r5H8v+WVafRWz5xdSVmWLoITZQXcgehI2ZE6gioE6HirAEToM/RvFBeuhw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm/-/linux-arm-0.25.8.tgz",
      "integrity": "sha512-FuzEP9BixzZohl1kLf76KEVOsxtIBFwCaLupVuk4eFVnOZfU+Wsn+x5Ryam7nILV2pkq2TqQM9EZPsOBuMC+kg==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.25.8.tgz",
      "integrity": "sha512-WIgg00ARWv/uYLU7lsuDK00d/hHSfES5BzdWAdAig1ioV5kaFNrtK8EqGcUBJhYqotlUByUKz5Qo6u8tt7iD/w==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ia32": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ia32/-/linux-ia32-0.25.8.tgz",
      "integrity": "sha512-A1D9YzRX1i+1AJZuFFUMP1E9fMaYY+GnSQil9Tlw05utlE86EKTUA7RjwHDkEitmLYiFsRd9HwKBPEftNdBfjg==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-loong64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-loong64/-/linux-loong64-0.25.8.tgz",
      "integrity": "sha512-O7k1J/dwHkY1RMVvglFHl1HzutGEFFZ3kNiDMSOyUrB7WcoHGf96Sh+64nTRT26l3GMbCW01Ekh/ThKM5iI7hQ==",
      "cpu": [
        "loong64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-mips64el": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-mips64el/-/linux-mips64el-0.25.8.tgz",
      "integrity": "sha512-uv+dqfRazte3BzfMp8PAQXmdGHQt2oC/y2ovwpTteqrMx2lwaksiFZ/bdkXJC19ttTvNXBuWH53zy/aTj1FgGw==",
      "cpu": [
        "mips64el"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ppc64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ppc64/-/linux-ppc64-0.25.8.tgz",
      "integrity": "sha512-GyG0KcMi1GBavP5JgAkkstMGyMholMDybAf8wF5A70CALlDM2p/f7YFE7H92eDeH/VBtFJA5MT4nRPDGg4JuzQ==",
      "cpu": [
        "ppc64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-riscv64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-riscv64/-/linux-riscv64-0.25.8.tgz",
      "integrity": "sha512-rAqDYFv3yzMrq7GIcen3XP7TUEG/4LK86LUPMIz6RT8A6pRIDn0sDcvjudVZBiiTcZCY9y2SgYX2lgK3AF+1eg==",
      "cpu": [
        "riscv64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-s390x": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-s390x/-/linux-s390x-0.25.8.tgz",
      "integrity": "sha512-Xutvh6VjlbcHpsIIbwY8GVRbwoviWT19tFhgdA7DlenLGC/mbc3lBoVb7jxj9Z+eyGqvcnSyIltYUrkKzWqSvg==",
      "cpu": [
        "s390x"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.25.8.tgz",
      "integrity": "sha512-ASFQhgY4ElXh3nDcOMTkQero4b1lgubskNlhIfJrsH5OKZXDpUAKBlNS0Kx81jwOBp+HCeZqmoJuihTv57/jvQ==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-arm64/-/netbsd-arm64-0.25.8.tgz",
      "integrity": "sha512-d1KfruIeohqAi6SA+gENMuObDbEjn22olAR7egqnkCD9DGBG0wsEARotkLgXDu6c4ncgWTZJtN5vcgxzWRMzcw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-x64/-/netbsd-x64-0.25.8.tgz",
      "integrity": "sha512-nVDCkrvx2ua+XQNyfrujIG38+YGyuy2Ru9kKVNyh5jAys6n+l44tTtToqHjino2My8VAY6Lw9H7RI73XFi66Cg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-arm64/-/openbsd-arm64-0.25.8.tgz",
      "integrity": "sha512-j8HgrDuSJFAujkivSMSfPQSAa5Fxbvk4rgNAS5i3K+r8s1X0p1uOO2Hl2xNsGFppOeHOLAVgYwDVlmxhq5h+SQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-x64/-/openbsd-x64-0.25.8.tgz",
      "integrity": "sha512-1h8MUAwa0VhNCDp6Af0HToI2TJFAn1uqT9Al6DJVzdIBAd21m/G0Yfc77KDM3uF3T/YaOgQq3qTJHPbTOInaIQ==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openharmony-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/openharmony-arm64/-/openharmony-arm64-0.25.8.tgz",
      "integrity": "sha512-r2nVa5SIK9tSWd0kJd9HCffnDHKchTGikb//9c7HX+r+wHYCpQrSgxhlY6KWV1nFo1l4KFbsMlHk+L6fekLsUg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/sunos-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/sunos-x64/-/sunos-x64-0.25.8.tgz",
      "integrity": "sha512-zUlaP2S12YhQ2UzUfcCuMDHQFJyKABkAjvO5YSndMiIkMimPmxA+BYSBikWgsRpvyxuRnow4nS5NPnf9fpv41w==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "sunos"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-arm64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.25.8.tgz",
      "integrity": "sha512-YEGFFWESlPva8hGL+zvj2z/SaK+pH0SwOM0Nc/d+rVnW7GSTFlLBGzZkuSU9kFIGIo8q9X3ucpZhu8PDN5A2sQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-ia32": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-ia32/-/win32-ia32-0.25.8.tgz",
      "integrity": "sha512-hiGgGC6KZ5LZz58OL/+qVVoZiuZlUYlYHNAmczOm7bs2oE1XriPFi5ZHHrS8ACpV5EjySrnoCKmcbQMN+ojnHg==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-x64": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.25.8.tgz",
      "integrity": "sha512-cn3Yr7+OaaZq1c+2pe+8yxC8E144SReCQjN6/2ynubzYjvyqZjTXfQJpAcQpsdJq3My7XADANiYGHoFC69pLQw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@eslint-community/eslint-utils": {
      "version": "4.7.0",
      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.7.0.tgz",
      "integrity": "sha512-dyybb3AcajC7uha6CvhdVRJqaKyn7w2YKqKyAN37NKYgZT36w+iRb0Dymmc5qEJ549c/S31cMMSFd75bteCpCw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "eslint-visitor-keys": "^3.4.3"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      },
      "peerDependencies": {
        "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys": {
      "version": "3.4.3",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz",
      "integrity": "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint-community/regexpp": {
      "version": "4.12.1",
      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.1.tgz",
      "integrity": "sha512-CCZCDJuduB9OUkFkY2IgppNZMi2lBQgD2qzwXkEia16cge2pijY/aXi96CJMquDMn3nJdlPV1A5KrJEXwfLNzQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.0.0 || ^14.0.0 || >=16.0.0"
      }
    },
    "node_modules/@eslint/config-array": {
      "version": "0.21.0",
      "resolved": "https://registry.npmjs.org/@eslint/config-array/-/config-array-0.21.0.tgz",
      "integrity": "sha512-ENIdc4iLu0d93HeYirvKmrzshzofPw6VkZRKQGe9Nv46ZnWUzcF1xV01dcvEg/1wXUR61OmmlSfyeyO7EvjLxQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/object-schema": "^2.1.6",
        "debug": "^4.3.1",
        "minimatch": "^3.1.2"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/config-helpers": {
      "version": "0.3.0",
      "resolved": "https://registry.npmjs.org/@eslint/config-helpers/-/config-helpers-0.3.0.tgz",
      "integrity": "sha512-ViuymvFmcJi04qdZeDc2whTHryouGcDlaxPqarTD0ZE10ISpxGUVZGZDx4w01upyIynL3iu6IXH2bS1NhclQMw==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/core": {
      "version": "0.15.1",
      "resolved": "https://registry.npmjs.org/@eslint/core/-/core-0.15.1.tgz",
      "integrity": "sha512-bkOp+iumZCCbt1K1CmWf0R9pM5yKpDv+ZXtvSyQpudrI9kuFLp+bM2WOPXImuD/ceQuaa8f5pj93Y7zyECIGNA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@types/json-schema": "^7.0.15"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/eslintrc": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/@eslint/eslintrc/-/eslintrc-3.3.1.tgz",
      "integrity": "sha512-gtF186CXhIl1p4pJNGZw8Yc6RlshoePRvE0X91oPGb3vZ8pM3qOS9W9NGPat9LziaBV7XrJWGylNQXkGcnM3IQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ajv": "^6.12.4",
        "debug": "^4.3.2",
        "espree": "^10.0.1",
        "globals": "^14.0.0",
        "ignore": "^5.2.0",
        "import-fresh": "^3.2.1",
        "js-yaml": "^4.1.0",
        "minimatch": "^3.1.2",
        "strip-json-comments": "^3.1.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint/eslintrc/node_modules/globals": {
      "version": "14.0.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-14.0.0.tgz",
      "integrity": "sha512-oahGvuMGQlPw/ivIYBjVSrWAfWLBeku5tpPE2fOPLi+WHffIWbuh2tCjhyQhTBPMf5E9jDEH4FOmTYgYwbKwtQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@eslint/js": {
      "version": "9.32.0",
      "resolved": "https://registry.npmjs.org/@eslint/js/-/js-9.32.0.tgz",
      "integrity": "sha512-BBpRFZK3eX6uMLKz8WxFOBIFFcGFJ/g8XuwjTHCqHROSIsopI+ddn/d5Cfh36+7+e5edVS8dbSHnBNhrLEX0zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      }
    },
    "node_modules/@eslint/object-schema": {
      "version": "2.1.6",
      "resolved": "https://registry.npmjs.org/@eslint/object-schema/-/object-schema-2.1.6.tgz",
      "integrity": "sha512-RBMg5FRL0I0gs51M/guSAj5/e14VQ4tpZnQNWwuDT66P14I43ItmPfIZRhO9fUVIPOAQXU47atlywZ/czoqFPA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@eslint/plugin-kit": {
      "version": "0.3.4",
      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.3.4.tgz",
      "integrity": "sha512-Ul5l+lHEcw3L5+k8POx6r74mxEYKG5kOb6Xpy2gCRW6zweT6TEhAf8vhxGgjhqrd/VO/Dirhsb+1hNpD1ue9hw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^0.15.1",
        "levn": "^0.4.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      }
    },
    "node_modules/@humanfs/core": {
      "version": "0.19.1",
      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.1.tgz",
      "integrity": "sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/node": {
      "version": "0.16.6",
      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.6.tgz",
      "integrity": "sha512-YuI2ZHQL78Q5HbhDiBA1X4LmYdXCKCMQIfw0pw7piHJwyREFebJUvrQN4cMssyES6x+vfUbx1CIpaQUKYdQZOw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanfs/core": "^0.19.1",
        "@humanwhocodes/retry": "^0.3.0"
      },
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/node/node_modules/@humanwhocodes/retry": {
      "version": "0.3.1",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/retry/-/retry-0.3.1.tgz",
      "integrity": "sha512-JBxkERygn7Bv/GbN5Rv8Ul6LVknS+5Bp6RgDC/O8gEBU/yeH5Ui5C/OlWrTb6qct7LjjfT6Re2NxB0ln0yYybA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/module-importer": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz",
      "integrity": "sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.22"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/retry": {
      "version": "0.4.3",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/retry/-/retry-0.4.3.tgz",
      "integrity": "sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@isaacs/fs-minipass": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/@isaacs/fs-minipass/-/fs-minipass-4.0.1.tgz",
      "integrity": "sha512-wgm9Ehl2jpeqP3zw/7mo3kRHFp5MEDhqAdwy1fTGkHAwnkGOVsgpvQhL8B5n1qlb01jV3n/bI0ZfZp5lWA1k4w==",
      "license": "ISC",
      "dependencies": {
        "minipass": "^7.0.4"
      },
      "engines": {
        "node": ">=18.0.0"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.12",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.12.tgz",
      "integrity": "sha512-OuLGC46TjB5BbN1dH8JULVVZY4WTdkF7tV9Ys6wLL1rubZnCMstOhNHueU5bLCrnRuDhKPDM4g6sw4Bel5Gzqg==",
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.4",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.4.tgz",
      "integrity": "sha512-VT2+G1VQs/9oz078bLrYbecdZKs912zQlkelYpuf+SXF+QvZDYJlbx/LSx+meSAwdDFnF8FVXW92AVjjkVmgFw==",
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.29",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.29.tgz",
      "integrity": "sha512-uw6guiW/gcAGPDhLmd77/6lW8QLeiV5RUTsAX46Db6oLhGaVj4lhnPwb184s1bkc8kdVg/+h988dro8GRDpmYQ==",
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@kurkle/color": {
      "version": "0.3.4",
      "resolved": "https://registry.npmjs.org/@kurkle/color/-/color-0.3.4.tgz",
      "integrity": "sha512-M5UknZPHRu3DEDWoipU6sE8PdkZ6Z/S+v4dD+Ke8IaNlpdSQah50lz1KtcFBa2vsdOnwbbnxJwVM4wty6udA5w==",
      "license": "MIT"
    },
    "node_modules/@reduxjs/toolkit": {
      "version": "2.8.2",
      "resolved": "https://registry.npmjs.org/@reduxjs/toolkit/-/toolkit-2.8.2.tgz",
      "integrity": "sha512-MYlOhQ0sLdw4ud48FoC5w0dH9VfWQjtCjreKwYTT3l+r427qYC5Y8PihNutepr8XrNaBUDQo9khWUwQxZaqt5A==",
      "license": "MIT",
      "dependencies": {
        "@standard-schema/spec": "^1.0.0",
        "@standard-schema/utils": "^0.3.0",
        "immer": "^10.0.3",
        "redux": "^5.0.1",
        "redux-thunk": "^3.1.0",
        "reselect": "^5.1.0"
      },
      "peerDependencies": {
        "react": "^16.9.0 || ^17.0.0 || ^18 || ^19",
        "react-redux": "^7.2.1 || ^8.1.3 || ^9.0.0"
      },
      "peerDependenciesMeta": {
        "react": {
          "optional": true
        },
        "react-redux": {
          "optional": true
        }
      }
    },
    "node_modules/@rolldown/pluginutils": {
      "version": "1.0.0-beta.27",
      "resolved": "https://registry.npmjs.org/@rolldown/pluginutils/-/pluginutils-1.0.0-beta.27.tgz",
      "integrity": "sha512-+d0F4MKMCbeVUJwG96uQ4SgAznZNSq93I3V+9NHA4OpvqG8mRCpGdKmK8l/dl02h2CCDHwW2FqilnTyDcAnqjA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@rollup/rollup-android-arm-eabi": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.46.2.tgz",
      "integrity": "sha512-Zj3Hl6sN34xJtMv7Anwb5Gu01yujyE/cLBDB2gnHTAHaWS1Z38L7kuSG+oAh0giZMqG060f/YBStXtMH6FvPMA==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-android-arm64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.46.2.tgz",
      "integrity": "sha512-nTeCWY83kN64oQ5MGz3CgtPx8NSOhC5lWtsjTs+8JAJNLcP3QbLCtDDgUKQc/Ro/frpMq4SHUaHN6AMltcEoLQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-darwin-arm64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-arm64/-/rollup-darwin-arm64-4.46.2.tgz",
      "integrity": "sha512-HV7bW2Fb/F5KPdM/9bApunQh68YVDU8sO8BvcW9OngQVN3HHHkw99wFupuUJfGR9pYLLAjcAOA6iO+evsbBaPQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-darwin-x64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-4.46.2.tgz",
      "integrity": "sha512-SSj8TlYV5nJixSsm/y3QXfhspSiLYP11zpfwp6G/YDXctf3Xkdnk4woJIF5VQe0of2OjzTt8EsxnJDCdHd2xMA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-arm64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-arm64/-/rollup-freebsd-arm64-4.46.2.tgz",
      "integrity": "sha512-ZyrsG4TIT9xnOlLsSSi9w/X29tCbK1yegE49RYm3tu3wF1L/B6LVMqnEWyDB26d9Ecx9zrmXCiPmIabVuLmNSg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-x64": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-x64/-/rollup-freebsd-x64-4.46.2.tgz",
      "integrity": "sha512-pCgHFoOECwVCJ5GFq8+gR8SBKnMO+xe5UEqbemxBpCKYQddRQMgomv1104RnLSg7nNvgKy05sLsY51+OVRyiVw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-gnueabihf": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-gnueabihf/-/rollup-linux-arm-gnueabihf-4.46.2.tgz",
      "integrity": "sha512-EtP8aquZ0xQg0ETFcxUbU71MZlHaw9MChwrQzatiE8U/bvi5uv/oChExXC4mWhjiqK7azGJBqU0tt5H123SzVA==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-musleabihf": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-musleabihf/-/rollup-linux-arm-musleabihf-4.46.2.tgz",
      "integrity": "sha512-qO7F7U3u1nfxYRPM8HqFtLd+raev2K137dsV08q/LRKRLEc7RsiDWihUnrINdsWQxPR9jqZ8DIIZ1zJJAm5PjQ==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-gnu/-/rollup-linux-arm64-gnu-4.46.2.tgz",
      "integrity": "sha512-3dRaqLfcOXYsfvw5xMrxAk9Lb1f395gkoBYzSFcc/scgRFptRXL9DOaDpMiehf9CO8ZDRJW2z45b6fpU5nwjng==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-musl": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-musl/-/rollup-linux-arm64-musl-4.46.2.tgz",
      "integrity": "sha512-fhHFTutA7SM+IrR6lIfiHskxmpmPTJUXpWIsBXpeEwNgZzZZSg/q4i6FU4J8qOGyJ0TR+wXBwx/L7Ho9z0+uDg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-loongarch64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-loongarch64-gnu/-/rollup-linux-loongarch64-gnu-4.46.2.tgz",
      "integrity": "sha512-i7wfGFXu8x4+FRqPymzjD+Hyav8l95UIZ773j7J7zRYc3Xsxy2wIn4x+llpunexXe6laaO72iEjeeGyUFmjKeA==",
      "cpu": [
        "loong64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-ppc64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-ppc64-gnu/-/rollup-linux-ppc64-gnu-4.46.2.tgz",
      "integrity": "sha512-B/l0dFcHVUnqcGZWKcWBSV2PF01YUt0Rvlurci5P+neqY/yMKchGU8ullZvIv5e8Y1C6wOn+U03mrDylP5q9Yw==",
      "cpu": [
        "ppc64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-gnu/-/rollup-linux-riscv64-gnu-4.46.2.tgz",
      "integrity": "sha512-32k4ENb5ygtkMwPMucAb8MtV8olkPT03oiTxJbgkJa7lJ7dZMr0GCFJlyvy+K8iq7F/iuOr41ZdUHaOiqyR3iQ==",
      "cpu": [
        "riscv64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-musl": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-musl/-/rollup-linux-riscv64-musl-4.46.2.tgz",
      "integrity": "sha512-t5B2loThlFEauloaQkZg9gxV05BYeITLvLkWOkRXogP4qHXLkWSbSHKM9S6H1schf/0YGP/qNKtiISlxvfmmZw==",
      "cpu": [
        "riscv64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-s390x-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-s390x-gnu/-/rollup-linux-s390x-gnu-4.46.2.tgz",
      "integrity": "sha512-YKjekwTEKgbB7n17gmODSmJVUIvj8CX7q5442/CK80L8nqOUbMtf8b01QkG3jOqyr1rotrAnW6B/qiHwfcuWQA==",
      "cpu": [
        "s390x"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-gnu": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-gnu/-/rollup-linux-x64-gnu-4.46.2.tgz",
      "integrity": "sha512-Jj5a9RUoe5ra+MEyERkDKLwTXVu6s3aACP51nkfnK9wJTraCC8IMe3snOfALkrjTYd2G1ViE1hICj0fZ7ALBPA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-musl": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-musl/-/rollup-linux-x64-musl-4.46.2.tgz",
      "integrity": "sha512-7kX69DIrBeD7yNp4A5b81izs8BqoZkCIaxQaOpumcJ1S/kmqNFjPhDu1LHeVXv0SexfHQv5cqHsxLOjETuqDuA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-win32-arm64-msvc": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-arm64-msvc/-/rollup-win32-arm64-msvc-4.46.2.tgz",
      "integrity": "sha512-wiJWMIpeaak/jsbaq2HMh/rzZxHVW1rU6coyeNNpMwk5isiPjSTx0a4YLSlYDwBH/WBvLz+EtsNqQScZTLJy3g==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-ia32-msvc": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-ia32-msvc/-/rollup-win32-ia32-msvc-4.46.2.tgz",
      "integrity": "sha512-gBgaUDESVzMgWZhcyjfs9QFK16D8K6QZpwAaVNJxYDLHWayOta4ZMjGm/vsAEy3hvlS2GosVFlBlP9/Wb85DqQ==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-x64-msvc": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-4.46.2.tgz",
      "integrity": "sha512-CvUo2ixeIQGtF6WvuB87XWqPQkoFAFqW+HUo/WzHwuHDvIwZCtjdWXoYCcr06iKGydiqTclC4jU/TNObC/xKZg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@standard-schema/spec": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/@standard-schema/spec/-/spec-1.0.0.tgz",
      "integrity": "sha512-m2bOd0f2RT9k8QJx1JN85cZYyH1RqFBdlwtkSlf4tBDYLCiiZnv1fIIwacK6cqwXavOydf0NPToMQgpKq+dVlA==",
      "license": "MIT"
    },
    "node_modules/@standard-schema/utils": {
      "version": "0.3.0",
      "resolved": "https://registry.npmjs.org/@standard-schema/utils/-/utils-0.3.0.tgz",
      "integrity": "sha512-e7Mew686owMaPJVNNLs55PUvgz371nKgwsc4vxE49zsODpJEnxgxRo2y/OKrqueavXgZNMDVj3DdHFlaSAeU8g==",
      "license": "MIT"
    },
    "node_modules/@tailwindcss/node": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/node/-/node-4.1.11.tgz",
      "integrity": "sha512-yzhzuGRmv5QyU9qLNg4GTlYI6STedBWRE7NjxP45CsFYYq9taI0zJXZBMqIC/c8fViNLhmrbpSFS57EoxUmD6Q==",
      "license": "MIT",
      "dependencies": {
        "@ampproject/remapping": "^2.3.0",
        "enhanced-resolve": "^5.18.1",
        "jiti": "^2.4.2",
        "lightningcss": "1.30.1",
        "magic-string": "^0.30.17",
        "source-map-js": "^1.2.1",
        "tailwindcss": "4.1.11"
      }
    },
    "node_modules/@tailwindcss/oxide": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide/-/oxide-4.1.11.tgz",
      "integrity": "sha512-Q69XzrtAhuyfHo+5/HMgr1lAiPP/G40OMFAnws7xcFEYqcypZmdW8eGXaOUIeOl1dzPJBPENXgbjsOyhg2nkrg==",
      "hasInstallScript": true,
      "license": "MIT",
      "dependencies": {
        "detect-libc": "^2.0.4",
        "tar": "^7.4.3"
      },
      "engines": {
        "node": ">= 10"
      },
      "optionalDependencies": {
        "@tailwindcss/oxide-android-arm64": "4.1.11",
        "@tailwindcss/oxide-darwin-arm64": "4.1.11",
        "@tailwindcss/oxide-darwin-x64": "4.1.11",
        "@tailwindcss/oxide-freebsd-x64": "4.1.11",
        "@tailwindcss/oxide-linux-arm-gnueabihf": "4.1.11",
        "@tailwindcss/oxide-linux-arm64-gnu": "4.1.11",
        "@tailwindcss/oxide-linux-arm64-musl": "4.1.11",
        "@tailwindcss/oxide-linux-x64-gnu": "4.1.11",
        "@tailwindcss/oxide-linux-x64-musl": "4.1.11",
        "@tailwindcss/oxide-wasm32-wasi": "4.1.11",
        "@tailwindcss/oxide-win32-arm64-msvc": "4.1.11",
        "@tailwindcss/oxide-win32-x64-msvc": "4.1.11"
      }
    },
    "node_modules/@tailwindcss/oxide-android-arm64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-android-arm64/-/oxide-android-arm64-4.1.11.tgz",
      "integrity": "sha512-3IfFuATVRUMZZprEIx9OGDjG3Ou3jG4xQzNTvjDoKmU9JdmoCohQJ83MYd0GPnQIu89YoJqvMM0G3uqLRFtetg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-darwin-arm64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-darwin-arm64/-/oxide-darwin-arm64-4.1.11.tgz",
      "integrity": "sha512-ESgStEOEsyg8J5YcMb1xl8WFOXfeBmrhAwGsFxxB2CxY9evy63+AtpbDLAyRkJnxLy2WsD1qF13E97uQyP1lfQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-darwin-x64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-darwin-x64/-/oxide-darwin-x64-4.1.11.tgz",
      "integrity": "sha512-EgnK8kRchgmgzG6jE10UQNaH9Mwi2n+yw1jWmof9Vyg2lpKNX2ioe7CJdf9M5f8V9uaQxInenZkOxnTVL3fhAw==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-freebsd-x64": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-freebsd-x64/-/oxide-freebsd-x64-4.1.11.tgz",
      "integrity": "sha512-xdqKtbpHs7pQhIKmqVpxStnY1skuNh4CtbcyOHeX1YBE0hArj2romsFGb6yUmzkq/6M24nkxDqU8GYrKrz+UcA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm-gnueabihf": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm-gnueabihf/-/oxide-linux-arm-gnueabihf-4.1.11.tgz",
      "integrity": "sha512-ryHQK2eyDYYMwB5wZL46uoxz2zzDZsFBwfjssgB7pzytAeCCa6glsiJGjhTEddq/4OsIjsLNMAiMlHNYnkEEeg==",
      "cpu": [
        "arm"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm64-gnu": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm64-gnu/-/oxide-linux-arm64-gnu-4.1.11.tgz",
      "integrity": "sha512-mYwqheq4BXF83j/w75ewkPJmPZIqqP1nhoghS9D57CLjsh3Nfq0m4ftTotRYtGnZd3eCztgbSPJ9QhfC91gDZQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-arm64-musl": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-arm64-musl/-/oxide-linux-arm64-musl-4.1.11.tgz",
      "integrity": "sha512-m/NVRFNGlEHJrNVk3O6I9ggVuNjXHIPoD6bqay/pubtYC9QIdAMpS+cswZQPBLvVvEF6GtSNONbDkZrjWZXYNQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-x64-gnu": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-x64-gnu/-/oxide-linux-x64-gnu-4.1.11.tgz",
      "integrity": "sha512-YW6sblI7xukSD2TdbbaeQVDysIm/UPJtObHJHKxDEcW2exAtY47j52f8jZXkqE1krdnkhCMGqP3dbniu1Te2Fg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-linux-x64-musl": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-linux-x64-musl/-/oxide-linux-x64-musl-4.1.11.tgz",
      "integrity": "sha512-e3C/RRhGunWYNC3aSF7exsQkdXzQ/M+aYuZHKnw4U7KQwTJotnWsGOIVih0s2qQzmEzOFIJ3+xt7iq67K/p56Q==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-wasm32-wasi": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-wasm32-wasi/-/oxide-wasm32-wasi-4.1.11.tgz",
      "integrity": "sha512-Xo1+/GU0JEN/C/dvcammKHzeM6NqKovG+6921MR6oadee5XPBaKOumrJCXvopJ/Qb5TH7LX/UAywbqrP4lax0g==",
      "bundleDependencies": [
        "@napi-rs/wasm-runtime",
        "@emnapi/core",
        "@emnapi/runtime",
        "@tybys/wasm-util",
        "@emnapi/wasi-threads",
        "tslib"
      ],
      "cpu": [
        "wasm32"
      ],
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/core": "^1.4.3",
        "@emnapi/runtime": "^1.4.3",
        "@emnapi/wasi-threads": "^1.0.2",
        "@napi-rs/wasm-runtime": "^0.2.11",
        "@tybys/wasm-util": "^0.9.0",
        "tslib": "^2.8.0"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/@tailwindcss/oxide-win32-arm64-msvc": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-win32-arm64-msvc/-/oxide-win32-arm64-msvc-4.1.11.tgz",
      "integrity": "sha512-UgKYx5PwEKrac3GPNPf6HVMNhUIGuUh4wlDFR2jYYdkX6pL/rn73zTq/4pzUm8fOjAn5L8zDeHp9iXmUGOXZ+w==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/oxide-win32-x64-msvc": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/oxide-win32-x64-msvc/-/oxide-win32-x64-msvc-4.1.11.tgz",
      "integrity": "sha512-YfHoggn1j0LK7wR82TOucWc5LDCguHnoS879idHekmmiR7g9HUtMw9MI0NHatS28u/Xlkfi9w5RJWgz2Dl+5Qg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@tailwindcss/vite": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/@tailwindcss/vite/-/vite-4.1.11.tgz",
      "integrity": "sha512-RHYhrR3hku0MJFRV+fN2gNbDNEh3dwKvY8XJvTxCSXeMOsCRSr+uKvDWQcbizrHgjML6ZmTE5OwMrl5wKcujCw==",
      "license": "MIT",
      "dependencies": {
        "@tailwindcss/node": "4.1.11",
        "@tailwindcss/oxide": "4.1.11",
        "tailwindcss": "4.1.11"
      },
      "peerDependencies": {
        "vite": "^5.2.0 || ^6 || ^7"
      }
    },
    "node_modules/@types/babel__core": {
      "version": "7.20.5",
      "resolved": "https://registry.npmjs.org/@types/babel__core/-/babel__core-7.20.5.tgz",
      "integrity": "sha512-qoQprZvz5wQFJwMDqeseRXWv3rqMvhgpbXFfVyWhbx9X47POIA6i/+dXefEmZKoAgOaTdaIgNSMqMIU61yRyzA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.20.7",
        "@babel/types": "^7.20.7",
        "@types/babel__generator": "*",
        "@types/babel__template": "*",
        "@types/babel__traverse": "*"
      }
    },
    "node_modules/@types/babel__generator": {
      "version": "7.27.0",
      "resolved": "https://registry.npmjs.org/@types/babel__generator/-/babel__generator-7.27.0.tgz",
      "integrity": "sha512-ufFd2Xi92OAVPYsy+P4n7/U7e68fex0+Ee8gSG9KX7eo084CWiQ4sdxktvdl0bOPupXtVJPY19zk6EwWqUQ8lg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__template": {
      "version": "7.4.4",
      "resolved": "https://registry.npmjs.org/@types/babel__template/-/babel__template-7.4.4.tgz",
      "integrity": "sha512-h/NUaSyG5EyxBIp8YRxo4RMe2/qQgvyowRwVMzhYhBCONbW8PUsg4lkFMrhgZhUe5z3L3MiLDuvyJ/CaPa2A8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.1.0",
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__traverse": {
      "version": "7.20.7",
      "resolved": "https://registry.npmjs.org/@types/babel__traverse/-/babel__traverse-7.20.7.tgz",
      "integrity": "sha512-dkO5fhS7+/oos4ciWxyEyjWe48zmG6wbCheo/G2ZnHx4fs3EU6YC6UM8rk56gAjNJ9P3MTH2jo5jb92/K6wbng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.20.7"
      }
    },
    "node_modules/@types/d3-array": {
      "version": "3.2.1",
      "resolved": "https://registry.npmjs.org/@types/d3-array/-/d3-array-3.2.1.tgz",
      "integrity": "sha512-Y2Jn2idRrLzUfAKV2LyRImR+y4oa2AntrgID95SHJxuMUrkNXmanDSed71sRNZysveJVt1hLLemQZIady0FpEg==",
      "license": "MIT"
    },
    "node_modules/@types/d3-color": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/@types/d3-color/-/d3-color-3.1.3.tgz",
      "integrity": "sha512-iO90scth9WAbmgv7ogoq57O9YpKmFBbmoEoCHDB2xMBY0+/KVrqAaCDyCE16dUspeOvIxFFRI+0sEtqDqy2b4A==",
      "license": "MIT"
    },
    "node_modules/@types/d3-ease": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/@types/d3-ease/-/d3-ease-3.0.2.tgz",
      "integrity": "sha512-NcV1JjO5oDzoK26oMzbILE6HW7uVXOHLQvHshBUW4UMdZGfiY6v5BeQwh9a9tCzv+CeefZQHJt5SRgK154RtiA==",
      "license": "MIT"
    },
    "node_modules/@types/d3-interpolate": {
      "version": "3.0.4",
      "resolved": "https://registry.npmjs.org/@types/d3-interpolate/-/d3-interpolate-3.0.4.tgz",
      "integrity": "sha512-mgLPETlrpVV1YRJIglr4Ez47g7Yxjl1lj7YKsiMCb27VJH9W8NVM6Bb9d8kkpG/uAQS5AmbA48q2IAolKKo1MA==",
      "license": "MIT",
      "dependencies": {
        "@types/d3-color": "*"
      }
    },
    "node_modules/@types/d3-path": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/@types/d3-path/-/d3-path-3.1.1.tgz",
      "integrity": "sha512-VMZBYyQvbGmWyWVea0EHs/BwLgxc+MKi1zLDCONksozI4YJMcTt8ZEuIR4Sb1MMTE8MMW49v0IwI5+b7RmfWlg==",
      "license": "MIT"
    },
    "node_modules/@types/d3-scale": {
      "version": "4.0.9",
      "resolved": "https://registry.npmjs.org/@types/d3-scale/-/d3-scale-4.0.9.tgz",
      "integrity": "sha512-dLmtwB8zkAeO/juAMfnV+sItKjlsw2lKdZVVy6LRr0cBmegxSABiLEpGVmSJJ8O08i4+sGR6qQtb6WtuwJdvVw==",
      "license": "MIT",
      "dependencies": {
        "@types/d3-time": "*"
      }
    },
    "node_modules/@types/d3-shape": {
      "version": "3.1.7",
      "resolved": "https://registry.npmjs.org/@types/d3-shape/-/d3-shape-3.1.7.tgz",
      "integrity": "sha512-VLvUQ33C+3J+8p+Daf+nYSOsjB4GXp19/S/aGo60m9h1v6XaxjiT82lKVWJCfzhtuZ3yD7i/TPeC/fuKLLOSmg==",
      "license": "MIT",
      "dependencies": {
        "@types/d3-path": "*"
      }
    },
    "node_modules/@types/d3-time": {
      "version": "3.0.4",
      "resolved": "https://registry.npmjs.org/@types/d3-time/-/d3-time-3.0.4.tgz",
      "integrity": "sha512-yuzZug1nkAAaBlBBikKZTgzCeA+k1uy4ZFwWANOfKw5z5LRhV0gNA7gNkKm7HoK+HRN0wX3EkxGk0fpbWhmB7g==",
      "license": "MIT"
    },
    "node_modules/@types/d3-timer": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/@types/d3-timer/-/d3-timer-3.0.2.tgz",
      "integrity": "sha512-Ps3T8E8dZDam6fUyNiMkekK3XUsaUEik+idO9/YjPtfj2qruF8tFBXS7XhtE4iIXBLxhmLjP3SXpLhVf21I9Lw==",
      "license": "MIT"
    },
    "node_modules/@types/estree": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/@types/estree/-/estree-1.0.8.tgz",
      "integrity": "sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==",
      "license": "MIT"
    },
    "node_modules/@types/json-schema": {
      "version": "7.0.15",
      "resolved": "https://registry.npmjs.org/@types/json-schema/-/json-schema-7.0.15.tgz",
      "integrity": "sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/react": {
      "version": "19.1.9",
      "resolved": "https://registry.npmjs.org/@types/react/-/react-19.1.9.tgz",
      "integrity": "sha512-WmdoynAX8Stew/36uTSVMcLJJ1KRh6L3IZRx1PZ7qJtBqT3dYTgyDTx8H1qoRghErydW7xw9mSJ3wS//tCRpFA==",
      "devOptional": true,
      "license": "MIT",
      "dependencies": {
        "csstype": "^3.0.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "19.1.7",
      "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.1.7.tgz",
      "integrity": "sha512-i5ZzwYpqjmrKenzkoLM2Ibzt6mAsM7pxB6BCIouEVVmgiqaMj1TjaK7hnA36hbW5aZv20kx7Lw6hWzPWg0Rurw==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^19.0.0"
      }
    },
    "node_modules/@types/use-sync-external-store": {
      "version": "0.0.6",
      "resolved": "https://registry.npmjs.org/@types/use-sync-external-store/-/use-sync-external-store-0.0.6.tgz",
      "integrity": "sha512-zFDAD+tlpf2r4asuHEj0XH6pY6i0g5NeAHPn+15wk3BV6JA69eERFXC1gyGThDkVa1zCyKr5jox1+2LbV/AMLg==",
      "license": "MIT"
    },
    "node_modules/@vitejs/plugin-react": {
      "version": "4.7.0",
      "resolved": "https://registry.npmjs.org/@vitejs/plugin-react/-/plugin-react-4.7.0.tgz",
      "integrity": "sha512-gUu9hwfWvvEDBBmgtAowQCojwZmJ5mcLn3aufeCsitijs3+f2NsrPtlAWIR6OPiqljl96GVCUbLe0HyqIpVaoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/core": "^7.28.0",
        "@babel/plugin-transform-react-jsx-self": "^7.27.1",
        "@babel/plugin-transform-react-jsx-source": "^7.27.1",
        "@rolldown/pluginutils": "1.0.0-beta.27",
        "@types/babel__core": "^7.20.5",
        "react-refresh": "^0.17.0"
      },
      "engines": {
        "node": "^14.18.0 || >=16.0.0"
      },
      "peerDependencies": {
        "vite": "^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0"
      }
    },
    "node_modules/acorn": {
      "version": "8.15.0",
      "resolved": "https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz",
      "integrity": "sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "acorn": "bin/acorn"
      },
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/acorn-jsx": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/acorn-jsx/-/acorn-jsx-5.3.2.tgz",
      "integrity": "sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0"
      }
    },
    "node_modules/ajv": {
      "version": "6.12.6",
      "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.12.6.tgz",
      "integrity": "sha512-j3fVLgvTo527anyYyJOGTYJbG+vnnQYvE0m5mmkc1TK+nxAppkCLMIL0aZ4dblVCNoGShhm+kzE4ZUykBoMg4g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.1",
        "fast-json-stable-stringify": "^2.0.0",
        "json-schema-traverse": "^0.4.1",
        "uri-js": "^4.2.2"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/epoberezkin"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/argparse": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/argparse/-/argparse-2.0.1.tgz",
      "integrity": "sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==",
      "dev": true,
      "license": "Python-2.0"
    },
    "node_modules/balanced-match": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz",
      "integrity": "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/brace-expansion": {
      "version": "1.1.12",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.12.tgz",
      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^1.0.0",
        "concat-map": "0.0.1"
      }
    },
    "node_modules/browserslist": {
      "version": "4.25.1",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.25.1.tgz",
      "integrity": "sha512-KGj0KoOMXLpSNkkEI6Z6mShmQy0bc1I+T7K9N81k4WWMrfz+6fQ6es80B/YLAeRoKvjYE1YSHHOW1qe9xIVzHw==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "caniuse-lite": "^1.0.30001726",
        "electron-to-chromium": "^1.5.173",
        "node-releases": "^2.0.19",
        "update-browserslist-db": "^1.1.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/callsites": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/callsites/-/callsites-3.1.0.tgz",
      "integrity": "sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001731",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001731.tgz",
      "integrity": "sha512-lDdp2/wrOmTRWuoB5DpfNkC0rJDU8DqRa6nYL6HK6sytw70QMopt/NIc/9SM7ylItlBWfACXk0tEn37UWM/+mg==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/chart.js": {
      "version": "4.5.0",
      "resolved": "https://registry.npmjs.org/chart.js/-/chart.js-4.5.0.tgz",
      "integrity": "sha512-aYeC/jDgSEx8SHWZvANYMioYMZ2KX02W6f6uVfyteuCGcadDLcYVHdfdygsTQkQ4TKn5lghoojAsPj5pu0SnvQ==",
      "license": "MIT",
      "dependencies": {
        "@kurkle/color": "^0.3.0"
      },
      "engines": {
        "pnpm": ">=8"
      }
    },
    "node_modules/chownr": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/chownr/-/chownr-3.0.0.tgz",
      "integrity": "sha512-+IxzY9BZOQd/XuYPRmrvEVjF/nqj5kgT4kEq7VofrDoM1MxoRjEWkrCC3EtLi59TVawxTAn+orJwFQcrqEN1+g==",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/clsx": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/clsx/-/clsx-2.1.1.tgz",
      "integrity": "sha512-eYm0QWBtUrBWZWG0d386OGAw16Z995PiOVo2B7bjWSbHedGl5e0ZWaq65kOGgUSNesEIDkB9ISbTg/JK9dhCZA==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/concat-map": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
      "integrity": "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/convert-source-map": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
      "integrity": "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cookie": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/cookie/-/cookie-1.0.2.tgz",
      "integrity": "sha512-9Kr/j4O16ISv8zBBhJoi4bXOYNTkFLOqSL3UDB0njXxCXNezjeyVrJyGOWtgfs/q2km1gwBcfH8q1yEGoMYunA==",
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/cross-spawn": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
      "integrity": "sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.1.0",
        "shebang-command": "^2.0.0",
        "which": "^2.0.1"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/crypto-js": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/crypto-js/-/crypto-js-4.2.0.tgz",
      "integrity": "sha512-KALDyEYgpY+Rlob/iriUtjV6d5Eq+Y191A5g4UqLAi8CyGP9N1+FdVbkc1SxKc2r4YAYqG8JzO2KGL+AizD70Q==",
      "license": "MIT"
    },
    "node_modules/csstype": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/csstype/-/csstype-3.1.3.tgz",
      "integrity": "sha512-M1uQkMl8rQK/szD0LNhtqxIPLpimGm8sOBwU7lLnCpSbTyY3yeU1Vc7l4KT5zT4s/yOxHH5O7tIuuLOCnLADRw==",
      "devOptional": true,
      "license": "MIT"
    },
    "node_modules/d3-array": {
      "version": "3.2.4",
      "resolved": "https://registry.npmjs.org/d3-array/-/d3-array-3.2.4.tgz",
      "integrity": "sha512-tdQAmyA18i4J7wprpYq8ClcxZy3SC31QMeByyCFyRt7BVHdREQZ5lpzoe5mFEYZUWe+oq8HBvk9JjpibyEV4Jg==",
      "license": "ISC",
      "dependencies": {
        "internmap": "1 - 2"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-color": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-color/-/d3-color-3.1.0.tgz",
      "integrity": "sha512-zg/chbXyeBtMQ1LbD/WSoW2DpC3I0mpmPdW+ynRTj/x2DAWYrIY7qeZIHidozwV24m4iavr15lNwIwLxRmOxhA==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-ease": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/d3-ease/-/d3-ease-3.0.1.tgz",
      "integrity": "sha512-wR/XK3D3XcLIZwpbvQwQ5fK+8Ykds1ip7A2Txe0yxncXSdq1L9skcG7blcedkOX+ZcgxGAmLX1FrRGbADwzi0w==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-format": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-format/-/d3-format-3.1.0.tgz",
      "integrity": "sha512-YyUI6AEuY/Wpt8KWLgZHsIU86atmikuoOmCfommt0LYHiQSPjvX2AcFc38PX0CBpr2RCyZhjex+NS/LPOv6YqA==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-interpolate": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/d3-interpolate/-/d3-interpolate-3.0.1.tgz",
      "integrity": "sha512-3bYs1rOD33uo8aqJfKP3JWPAibgw8Zm2+L9vBKEHJ2Rg+viTR7o5Mmv5mZcieN+FRYaAOWX5SJATX6k1PWz72g==",
      "license": "ISC",
      "dependencies": {
        "d3-color": "1 - 3"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-path": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-path/-/d3-path-3.1.0.tgz",
      "integrity": "sha512-p3KP5HCf/bvjBSSKuXid6Zqijx7wIfNW+J/maPs+iwR35at5JCbLUT0LzF1cnjbCHWhqzQTIN2Jpe8pRebIEFQ==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-scale": {
      "version": "4.0.2",
      "resolved": "https://registry.npmjs.org/d3-scale/-/d3-scale-4.0.2.tgz",
      "integrity": "sha512-GZW464g1SH7ag3Y7hXjf8RoUuAFIqklOAq3MRl4OaWabTFJY9PN/E1YklhXLh+OQ3fM9yS2nOkCoS+WLZ6kvxQ==",
      "license": "ISC",
      "dependencies": {
        "d3-array": "2.10.0 - 3",
        "d3-format": "1 - 3",
        "d3-interpolate": "1.2.0 - 3",
        "d3-time": "2.1.1 - 3",
        "d3-time-format": "2 - 4"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-shape": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/d3-shape/-/d3-shape-3.2.0.tgz",
      "integrity": "sha512-SaLBuwGm3MOViRq2ABk3eLoxwZELpH6zhl3FbAoJ7Vm1gofKx6El1Ib5z23NUEhF9AsGl7y+dzLe5Cw2AArGTA==",
      "license": "ISC",
      "dependencies": {
        "d3-path": "^3.1.0"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-time": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/d3-time/-/d3-time-3.1.0.tgz",
      "integrity": "sha512-VqKjzBLejbSMT4IgbmVgDjpkYrNWUYJnbCGo874u7MMKIWsILRX+OpX/gTk8MqjpT1A/c6HY2dCA77ZN0lkQ2Q==",
      "license": "ISC",
      "dependencies": {
        "d3-array": "2 - 3"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-time-format": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/d3-time-format/-/d3-time-format-4.1.0.tgz",
      "integrity": "sha512-dJxPBlzC7NugB2PDLwo9Q8JiTR3M3e4/XANkreKSUxF8vvXKqm1Yfq4Q5dl8budlunRVlUUaDUgFt7eA8D6NLg==",
      "license": "ISC",
      "dependencies": {
        "d3-time": "1 - 3"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/d3-timer": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/d3-timer/-/d3-timer-3.0.1.tgz",
      "integrity": "sha512-ndfJ/JxxMd3nw31uyKoY2naivF+r29V+Lc0svZxe1JvvIRmi8hUsrMvdOwgS1o6uBHmiz91geQ0ylPP0aj1VUA==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/dayjs": {
      "version": "1.11.13",
      "resolved": "https://registry.npmjs.org/dayjs/-/dayjs-1.11.13.tgz",
      "integrity": "sha512-oaMBel6gjolK862uaPQOVTA7q3TZhuSvuMQAAglQDOWYO9A91IrAOUJEyKVlqJlHE0vq5p5UXxzdPfMH/x6xNg==",
      "license": "MIT"
    },
    "node_modules/debug": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.1.tgz",
      "integrity": "sha512-KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/decimal.js-light": {
      "version": "2.5.1",
      "resolved": "https://registry.npmjs.org/decimal.js-light/-/decimal.js-light-2.5.1.tgz",
      "integrity": "sha512-qIMFpTMZmny+MMIitAB6D7iVPEorVw6YQRWkvarTkT4tBeSLLiHzcwj6q0MmYSFCiVpiqPJTJEYIrpcPzVEIvg==",
      "license": "MIT"
    },
    "node_modules/deep-is": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/deep-is/-/deep-is-0.1.4.tgz",
      "integrity": "sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/detect-libc": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.0.4.tgz",
      "integrity": "sha512-3UDv+G9CsCKO1WKMGw9fwq/SWJYbI0c5Y7LU1AXYoDdbhE2AHQ6N6Nb34sG8Fj7T5APy8qXDCKuuIHd1BR0tVA==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.193",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.193.tgz",
      "integrity": "sha512-eePuBZXM9OVCwfYUhd2OzESeNGnWmLyeu0XAEjf7xjijNjHFdeJSzuRUGN4ueT2tEYo5YqjHramKEFxz67p3XA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/emoji-picker-react": {
      "version": "4.13.2",
      "resolved": "https://registry.npmjs.org/emoji-picker-react/-/emoji-picker-react-4.13.2.tgz",
      "integrity": "sha512-azaJQLTshEOZVhksgU136izJWJyZ4Clx6xQ6Vctzk1gOdPPAUbTa/JYDwZJ8rh97QxnjpyeftXl99eRlYr3vNA==",
      "license": "MIT",
      "dependencies": {
        "flairup": "1.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "peerDependencies": {
        "react": ">=16"
      }
    },
    "node_modules/enhanced-resolve": {
      "version": "5.18.2",
      "resolved": "https://registry.npmjs.org/enhanced-resolve/-/enhanced-resolve-5.18.2.tgz",
      "integrity": "sha512-6Jw4sE1maoRJo3q8MsSIn2onJFbLTOjY9hlx4DZXmOKvLRd1Ok2kXmAGXaafL2+ijsJZ1ClYbl/pmqr9+k4iUQ==",
      "license": "MIT",
      "dependencies": {
        "graceful-fs": "^4.2.4",
        "tapable": "^2.2.0"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/es-toolkit": {
      "version": "1.39.8",
      "resolved": "https://registry.npmjs.org/es-toolkit/-/es-toolkit-1.39.8.tgz",
      "integrity": "sha512-A8QO9TfF+rltS8BXpdu8OS+rpGgEdnRhqIVxO/ZmNvnXBYgOdSsxukT55ELyP94gZIntWJ+Li9QRrT2u1Kitpg==",
      "license": "MIT",
      "workspaces": [
        "docs",
        "benchmarks"
      ]
    },
    "node_modules/esbuild": {
      "version": "0.25.8",
      "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.25.8.tgz",
      "integrity": "sha512-vVC0USHGtMi8+R4Kz8rt6JhEWLxsv9Rnu/lGYbPR8u47B+DCBksq9JarW0zOO7bs37hyOK1l2/oqtbciutL5+Q==",
      "hasInstallScript": true,
      "license": "MIT",
      "bin": {
        "esbuild": "bin/esbuild"
      },
      "engines": {
        "node": ">=18"
      },
      "optionalDependencies": {
        "@esbuild/aix-ppc64": "0.25.8",
        "@esbuild/android-arm": "0.25.8",
        "@esbuild/android-arm64": "0.25.8",
        "@esbuild/android-x64": "0.25.8",
        "@esbuild/darwin-arm64": "0.25.8",
        "@esbuild/darwin-x64": "0.25.8",
        "@esbuild/freebsd-arm64": "0.25.8",
        "@esbuild/freebsd-x64": "0.25.8",
        "@esbuild/linux-arm": "0.25.8",
        "@esbuild/linux-arm64": "0.25.8",
        "@esbuild/linux-ia32": "0.25.8",
        "@esbuild/linux-loong64": "0.25.8",
        "@esbuild/linux-mips64el": "0.25.8",
        "@esbuild/linux-ppc64": "0.25.8",
        "@esbuild/linux-riscv64": "0.25.8",
        "@esbuild/linux-s390x": "0.25.8",
        "@esbuild/linux-x64": "0.25.8",
        "@esbuild/netbsd-arm64": "0.25.8",
        "@esbuild/netbsd-x64": "0.25.8",
        "@esbuild/openbsd-arm64": "0.25.8",
        "@esbuild/openbsd-x64": "0.25.8",
        "@esbuild/openharmony-arm64": "0.25.8",
        "@esbuild/sunos-x64": "0.25.8",
        "@esbuild/win32-arm64": "0.25.8",
        "@esbuild/win32-ia32": "0.25.8",
        "@esbuild/win32-x64": "0.25.8"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/escape-string-regexp": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-4.0.0.tgz",
      "integrity": "sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/eslint": {
      "version": "9.32.0",
      "resolved": "https://registry.npmjs.org/eslint/-/eslint-9.32.0.tgz",
      "integrity": "sha512-LSehfdpgMeWcTZkWZVIJl+tkZ2nuSkyyB9C27MZqFWXuph7DvaowgcTvKqxvpLW1JZIk8PN7hFY3Rj9LQ7m7lg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.2.0",
        "@eslint-community/regexpp": "^4.12.1",
        "@eslint/config-array": "^0.21.0",
        "@eslint/config-helpers": "^0.3.0",
        "@eslint/core": "^0.15.0",
        "@eslint/eslintrc": "^3.3.1",
        "@eslint/js": "9.32.0",
        "@eslint/plugin-kit": "^0.3.4",
        "@humanfs/node": "^0.16.6",
        "@humanwhocodes/module-importer": "^1.0.1",
        "@humanwhocodes/retry": "^0.4.2",
        "@types/estree": "^1.0.6",
        "@types/json-schema": "^7.0.15",
        "ajv": "^6.12.4",
        "chalk": "^4.0.0",
        "cross-spawn": "^7.0.6",
        "debug": "^4.3.2",
        "escape-string-regexp": "^4.0.0",
        "eslint-scope": "^8.4.0",
        "eslint-visitor-keys": "^4.2.1",
        "espree": "^10.4.0",
        "esquery": "^1.5.0",
        "esutils": "^2.0.2",
        "fast-deep-equal": "^3.1.3",
        "file-entry-cache": "^8.0.0",
        "find-up": "^5.0.0",
        "glob-parent": "^6.0.2",
        "ignore": "^5.2.0",
        "imurmurhash": "^0.1.4",
        "is-glob": "^4.0.0",
        "json-stable-stringify-without-jsonify": "^1.0.1",
        "lodash.merge": "^4.6.2",
        "minimatch": "^3.1.2",
        "natural-compare": "^1.4.0",
        "optionator": "^0.9.3"
      },
      "bin": {
        "eslint": "bin/eslint.js"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      },
      "peerDependencies": {
        "jiti": "*"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-plugin-react-hooks": {
      "version": "5.2.0",
      "resolved": "https://registry.npmjs.org/eslint-plugin-react-hooks/-/eslint-plugin-react-hooks-5.2.0.tgz",
      "integrity": "sha512-+f15FfK64YQwZdJNELETdn5ibXEUQmW1DZL6KXhNnc2heoy/sg9VJJeT7n8TlMWouzWqSWavFkIhHyIbIAEapg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "peerDependencies": {
        "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0"
      }
    },
    "node_modules/eslint-plugin-react-refresh": {
      "version": "0.4.20",
      "resolved": "https://registry.npmjs.org/eslint-plugin-react-refresh/-/eslint-plugin-react-refresh-0.4.20.tgz",
      "integrity": "sha512-XpbHQ2q5gUF8BGOX4dHe+71qoirYMhApEPZ7sfhF/dNnOF1UXnCMGZf79SFTBO7Bz5YEIT4TMieSlJBWhP9WBA==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "eslint": ">=8.40"
      }
    },
    "node_modules/eslint-scope": {
      "version": "8.4.0",
      "resolved": "https://registry.npmjs.org/eslint-scope/-/eslint-scope-8.4.0.tgz",
      "integrity": "sha512-sNXOfKCn74rt8RICKMvJS7XKV/Xk9kA7DyJr8mJik3S7Cwgy3qlkkmyS2uQB3jiJg6VNdZd/pDBJu0nvG2NlTg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "esrecurse": "^4.3.0",
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/eslint-visitor-keys": {
      "version": "4.2.1",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-4.2.1.tgz",
      "integrity": "sha512-Uhdk5sfqcee/9H/rCOJikYz67o0a2Tw2hGRPOG2Y1R2dg7brRe1uG0yaNQDHu+TO/uQPF/5eCapvYSmHUjt7JQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/espree": {
      "version": "10.4.0",
      "resolved": "https://registry.npmjs.org/espree/-/espree-10.4.0.tgz",
      "integrity": "sha512-j6PAQ2uUr79PZhBjP5C5fhl8e39FmRnOjsD5lGnWrFU8i2G776tBK7+nP8KuQUTTyAZUwfQqXAgrVH5MbH9CYQ==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "acorn": "^8.15.0",
        "acorn-jsx": "^5.3.2",
        "eslint-visitor-keys": "^4.2.1"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/esquery": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/esquery/-/esquery-1.6.0.tgz",
      "integrity": "sha512-ca9pw9fomFcKPvFLXhBKUK90ZvGibiGOvRJNbjljY7s7uq/5YO4BOzcYtJqExdx99rF6aAcnRxHmcUHcz6sQsg==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "estraverse": "^5.1.0"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/esrecurse": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/esrecurse/-/esrecurse-4.3.0.tgz",
      "integrity": "sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estraverse": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz",
      "integrity": "sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/esutils": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz",
      "integrity": "sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/eventemitter3": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/eventemitter3/-/eventemitter3-5.0.1.tgz",
      "integrity": "sha512-GWkBvjiSZK87ELrYOSESUYeVIc9mvLLf/nXalMOS5dYrgZq9o5OVkbZAVM06CVxYsCwH9BDZFPlQTlPA1j4ahA==",
      "license": "MIT"
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-json-stable-stringify": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.1.0.tgz",
      "integrity": "sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-levenshtein": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz",
      "integrity": "sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fdir": {
      "version": "6.4.6",
      "resolved": "https://registry.npmjs.org/fdir/-/fdir-6.4.6.tgz",
      "integrity": "sha512-hiFoqpyZcfNm1yc4u8oWCf9A2c4D3QjCrks3zmoVKVxpQRzmPNar1hUJcBG2RQHvEVGDN+Jm81ZheVLAQMK6+w==",
      "license": "MIT",
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/file-entry-cache": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/file-entry-cache/-/file-entry-cache-8.0.0.tgz",
      "integrity": "sha512-XXTUwCvisa5oacNGRP9SfNtYBNAMi+RPwBFmblZEF7N7swHYQS6/Zfk7SRwx4D5j3CH211YNRco1DEMNVfZCnQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flat-cache": "^4.0.0"
      },
      "engines": {
        "node": ">=16.0.0"
      }
    },
    "node_modules/find-up": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/find-up/-/find-up-5.0.0.tgz",
      "integrity": "sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "locate-path": "^6.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/flairup": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/flairup/-/flairup-1.0.0.tgz",
      "integrity": "sha512-IKlE+pNvL2R+kVL1kEhUYqRxVqeFnjiIvHWDMLFXNaqyUdFXQM2wte44EfMYJNHkW16X991t2Zg8apKkhv7OBA==",
      "license": "MIT"
    },
    "node_modules/flat-cache": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/flat-cache/-/flat-cache-4.0.1.tgz",
      "integrity": "sha512-f7ccFPK3SXFHpx15UIGyRJ/FJQctuKZ0zVuN3frBo4HnK3cay9VEW0R6yPYFHC0AgqhukPzKjq22t5DmAyqGyw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flatted": "^3.2.9",
        "keyv": "^4.5.4"
      },
      "engines": {
        "node": ">=16"
      }
    },
    "node_modules/flatted": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/flatted/-/flatted-3.3.3.tgz",
      "integrity": "sha512-GX+ysw4PBCz0PzosHDepZGANEuFCMLrnRTiEy9McGjmkCQYwRq4A/X786G/fjM/+OjsWSU1ZrY5qyARZmO/uwg==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/gensync": {
      "version": "1.0.0-beta.2",
      "resolved": "https://registry.npmjs.org/gensync/-/gensync-1.0.0-beta.2.tgz",
      "integrity": "sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz",
      "integrity": "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/globals": {
      "version": "16.3.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-16.3.0.tgz",
      "integrity": "sha512-bqWEnJ1Nt3neqx2q5SFfGS8r/ahumIakg3HcwtNlrVlwXIeNumWn/c7Pn/wKzGhf6SaW6H6uWXLqC30STCMchQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
      "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
      "license": "ISC"
    },
    "node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/immer": {
      "version": "10.1.1",
      "resolved": "https://registry.npmjs.org/immer/-/immer-10.1.1.tgz",
      "integrity": "sha512-s2MPrmjovJcoMaHtx6K11Ra7oD05NT97w1IC5zpMkT6Atjr7H8LjaDd81iIxUYpMKSRRNMJE703M1Fhr/TctHw==",
      "license": "MIT",
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/immer"
      }
    },
    "node_modules/import-fresh": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/import-fresh/-/import-fresh-3.3.1.tgz",
      "integrity": "sha512-TR3KfrTZTYLPB6jUjfx6MF9WcWrHL9su5TObK4ZkYgBdWKPOFoSoQIdEuTuR82pmtxH2spWG9h6etwfr1pLBqQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "parent-module": "^1.0.0",
        "resolve-from": "^4.0.0"
      },
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/imurmurhash": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/imurmurhash/-/imurmurhash-0.1.4.tgz",
      "integrity": "sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.8.19"
      }
    },
    "node_modules/internmap": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/internmap/-/internmap-2.0.3.tgz",
      "integrity": "sha512-5Hh7Y1wQbvY5ooGgPbDaL5iYLAPzMTUrjMulskHLH6wnv/A+1q5rgEaiuqEjB+oxGXIVZs1FF+R/KPN3ZSQYYg==",
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/isexe": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
      "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/jiti": {
      "version": "2.5.1",
      "resolved": "https://registry.npmjs.org/jiti/-/jiti-2.5.1.tgz",
      "integrity": "sha512-twQoecYPiVA5K/h6SxtORw/Bs3ar+mLUtoPSc7iMXzQzK8d7eJ/R09wmTwAjiamETn1cXYPGfNnu7DMoHgu12w==",
      "license": "MIT",
      "bin": {
        "jiti": "lib/jiti-cli.mjs"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz",
      "integrity": "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/js-yaml": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.0.tgz",
      "integrity": "sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "argparse": "^2.0.1"
      },
      "bin": {
        "js-yaml": "bin/js-yaml.js"
      }
    },
    "node_modules/jsesc": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-3.1.0.tgz",
      "integrity": "sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/json-buffer": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/json-buffer/-/json-buffer-3.0.1.tgz",
      "integrity": "sha512-4bV5BfR2mqfQTJm+V5tPPdf+ZpuhiIvTuAB5g8kcrXOZpTT/QwwVRWBywX1ozr6lEuPdbHxwaJlm9G6mI2sfSQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-schema-traverse": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-0.4.1.tgz",
      "integrity": "sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-stable-stringify-without-jsonify": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/json-stable-stringify-without-jsonify/-/json-stable-stringify-without-jsonify-1.0.1.tgz",
      "integrity": "sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json5": {
      "version": "2.2.3",
      "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
      "integrity": "sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "json5": "lib/cli.js"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/keyv": {
      "version": "4.5.4",
      "resolved": "https://registry.npmjs.org/keyv/-/keyv-4.5.4.tgz",
      "integrity": "sha512-oxVHkHR/EJf2CNXnWxRLW6mg7JyCCUcG0DtEGmL2ctUo1PNTin1PUil+r/+4r5MpVgC/fn1kjsx7mjSujKqIpw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "json-buffer": "3.0.1"
      }
    },
    "node_modules/levn": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/levn/-/levn-0.4.1.tgz",
      "integrity": "sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1",
        "type-check": "~0.4.0"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/lightningcss": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss/-/lightningcss-1.30.1.tgz",
      "integrity": "sha512-xi6IyHML+c9+Q3W0S4fCQJOym42pyurFiJUHEcEyHS0CeKzia4yZDEsLlqOFykxOdHpNy0NmvVO31vcSqAxJCg==",
      "license": "MPL-2.0",
      "dependencies": {
        "detect-libc": "^2.0.3"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      },
      "optionalDependencies": {
        "lightningcss-darwin-arm64": "1.30.1",
        "lightningcss-darwin-x64": "1.30.1",
        "lightningcss-freebsd-x64": "1.30.1",
        "lightningcss-linux-arm-gnueabihf": "1.30.1",
        "lightningcss-linux-arm64-gnu": "1.30.1",
        "lightningcss-linux-arm64-musl": "1.30.1",
        "lightningcss-linux-x64-gnu": "1.30.1",
        "lightningcss-linux-x64-musl": "1.30.1",
        "lightningcss-win32-arm64-msvc": "1.30.1",
        "lightningcss-win32-x64-msvc": "1.30.1"
      }
    },
    "node_modules/lightningcss-darwin-arm64": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-arm64/-/lightningcss-darwin-arm64-1.30.1.tgz",
      "integrity": "sha512-c8JK7hyE65X1MHMN+Viq9n11RRC7hgin3HhYKhrMyaXflk5GVplZ60IxyoVtzILeKr+xAJwg6zK6sjTBJ0FKYQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-darwin-x64": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-x64/-/lightningcss-darwin-x64-1.30.1.tgz",
      "integrity": "sha512-k1EvjakfumAQoTfcXUcHQZhSpLlkAuEkdMBsI/ivWw9hL+7FtilQc0Cy3hrx0AAQrVtQAbMI7YjCgYgvn37PzA==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-freebsd-x64": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-freebsd-x64/-/lightningcss-freebsd-x64-1.30.1.tgz",
      "integrity": "sha512-kmW6UGCGg2PcyUE59K5r0kWfKPAVy4SltVeut+umLCFoJ53RdCUWxcRDzO1eTaxf/7Q2H7LTquFHPL5R+Gjyig==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm-gnueabihf": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm-gnueabihf/-/lightningcss-linux-arm-gnueabihf-1.30.1.tgz",
      "integrity": "sha512-MjxUShl1v8pit+6D/zSPq9S9dQ2NPFSQwGvxBCYaBYLPlCWuPh9/t1MRS8iUaR8i+a6w7aps+B4N0S1TYP/R+Q==",
      "cpu": [
        "arm"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-gnu": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-gnu/-/lightningcss-linux-arm64-gnu-1.30.1.tgz",
      "integrity": "sha512-gB72maP8rmrKsnKYy8XUuXi/4OctJiuQjcuqWNlJQ6jZiWqtPvqFziskH3hnajfvKB27ynbVCucKSm2rkQp4Bw==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-musl": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-musl/-/lightningcss-linux-arm64-musl-1.30.1.tgz",
      "integrity": "sha512-jmUQVx4331m6LIX+0wUhBbmMX7TCfjF5FoOH6SD1CttzuYlGNVpA7QnrmLxrsub43ClTINfGSYyHe2HWeLl5CQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-gnu": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-gnu/-/lightningcss-linux-x64-gnu-1.30.1.tgz",
      "integrity": "sha512-piWx3z4wN8J8z3+O5kO74+yr6ze/dKmPnI7vLqfSqI8bccaTGY5xiSGVIJBDd5K5BHlvVLpUB3S2YCfelyJ1bw==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-musl": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-musl/-/lightningcss-linux-x64-musl-1.30.1.tgz",
      "integrity": "sha512-rRomAK7eIkL+tHY0YPxbc5Dra2gXlI63HL+v1Pdi1a3sC+tJTcFrHX+E86sulgAXeI7rSzDYhPSeHHjqFhqfeQ==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-arm64-msvc": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-arm64-msvc/-/lightningcss-win32-arm64-msvc-1.30.1.tgz",
      "integrity": "sha512-mSL4rqPi4iXq5YVqzSsJgMVFENoa4nGTT/GjO2c0Yl9OuQfPsIfncvLrEW6RbbB24WtZ3xP/2CCmI3tNkNV4oA==",
      "cpu": [
        "arm64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-x64-msvc": {
      "version": "1.30.1",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-x64-msvc/-/lightningcss-win32-x64-msvc-1.30.1.tgz",
      "integrity": "sha512-PVqXh48wh4T53F/1CCu8PIPCxLzWyCnn/9T5W1Jpmdy5h9Cwd+0YQS6/LwhHXSafuc61/xg9Lv5OrCby6a++jg==",
      "cpu": [
        "x64"
      ],
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/locate-path": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/locate-path/-/locate-path-6.0.0.tgz",
      "integrity": "sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-locate": "^5.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/lodash.merge": {
      "version": "4.6.2",
      "resolved": "https://registry.npmjs.org/lodash.merge/-/lodash.merge-4.6.2.tgz",
      "integrity": "sha512-0KpjqXRVvrYyCsX1swR/XTK0va6VQkQM6MNo7PqW77ByjAhoARA8EfrP1N4+KlKj8YS0ZUCtRT/YUuhyYDujIQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/lru-cache": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-5.1.1.tgz",
      "integrity": "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "yallist": "^3.0.2"
      }
    },
    "node_modules/magic-string": {
      "version": "0.30.17",
      "resolved": "https://registry.npmjs.org/magic-string/-/magic-string-0.30.17.tgz",
      "integrity": "sha512-sNPKHvyjVf7gyjwS4xGTaW/mCnF8wnjtifKBEhxfZ7E/S8tQ0rssrwGNn6q8JH/ohItJfSQp9mBtQYuTlH5QnA==",
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0"
      }
    },
    "node_modules/minimatch": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz",
      "integrity": "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "brace-expansion": "^1.1.7"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/minipass": {
      "version": "7.1.2",
      "resolved": "https://registry.npmjs.org/minipass/-/minipass-7.1.2.tgz",
      "integrity": "sha512-qOOzS1cBTWYF4BH8fVePDBOO9iptMnGUEZwNc/cMWnTV2nVLZ7VoNWEPHkYczZA0pdoA7dl6e7FL659nX9S2aw==",
      "license": "ISC",
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/minizlib": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/minizlib/-/minizlib-3.0.2.tgz",
      "integrity": "sha512-oG62iEk+CYt5Xj2YqI5Xi9xWUeZhDI8jjQmC5oThVH5JGCTgIjr7ciJDzC7MBzYd//WvR1OTmP5Q38Q8ShQtVA==",
      "license": "MIT",
      "dependencies": {
        "minipass": "^7.1.2"
      },
      "engines": {
        "node": ">= 18"
      }
    },
    "node_modules/mkdirp": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/mkdirp/-/mkdirp-3.0.1.tgz",
      "integrity": "sha512-+NsyUUAZDmo6YVHzL/stxSu3t9YS1iljliy3BSDrXJ/dkn1KYdmtZODGGjLcc9XLgVVpH4KshHB8XmZgMhaBXg==",
      "license": "MIT",
      "bin": {
        "mkdirp": "dist/cjs/src/bin.js"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/nanoid": {
      "version": "3.3.11",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.11.tgz",
      "integrity": "sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/natural-compare": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/natural-compare/-/natural-compare-1.4.0.tgz",
      "integrity": "sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/node-releases": {
      "version": "2.0.19",
      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.19.tgz",
      "integrity": "sha512-xxOWJsBKtzAq7DY0J+DTzuz58K8e7sJbdgwkbMWQe8UYB6ekmsQ45q0M/tJDsGaZmbC+l7n57UV8Hl5tHxO9uw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/optionator": {
      "version": "0.9.4",
      "resolved": "https://registry.npmjs.org/optionator/-/optionator-0.9.4.tgz",
      "integrity": "sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "deep-is": "^0.1.3",
        "fast-levenshtein": "^2.0.6",
        "levn": "^0.4.1",
        "prelude-ls": "^1.2.1",
        "type-check": "^0.4.0",
        "word-wrap": "^1.2.5"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/p-limit": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz",
      "integrity": "sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "yocto-queue": "^0.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/p-locate/-/p-locate-5.0.0.tgz",
      "integrity": "sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-limit": "^3.0.2"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/parent-module": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/parent-module/-/parent-module-1.0.1.tgz",
      "integrity": "sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "callsites": "^3.0.0"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz",
      "integrity": "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-key": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/path-key/-/path-key-3.1.1.tgz",
      "integrity": "sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.3.tgz",
      "integrity": "sha512-5gTmgEY/sqK6gFXLIsQNH19lWb4ebPDLA4SdLP7dsWkIXHWlG66oPuVvXSGFPppYZz8ZDZq0dYYrbHfBCVUb1Q==",
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pocketbase": {
      "version": "0.26.2",
      "resolved": "https://registry.npmjs.org/pocketbase/-/pocketbase-0.26.2.tgz",
      "integrity": "sha512-WA8EOBc3QnSJh8rJ3iYoi9DmmPOMFIgVfAmIGux7wwruUEIzXgvrO4u0W2htfQjGIcyezJkdZOy5Xmh7SxAftw==",
      "license": "MIT"
    },
    "node_modules/postcss": {
      "version": "8.5.6",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.6.tgz",
      "integrity": "sha512-3Ybi1tAuwAP9s0r1UQ2J4n5Y0G05bJkpUIO0/bI9MhwmD70S5aTWbXGBwxHrelT+XM1k6dM0pk+SwNkpTRN7Pg==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.11",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/prelude-ls": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/prelude-ls/-/prelude-ls-1.2.1.tgz",
      "integrity": "sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz",
      "integrity": "sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/react": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react/-/react-19.1.1.tgz",
      "integrity": "sha512-w8nqGImo45dmMIfljjMwOGtbmC/mk4CMYhWIicdSflH91J9TyCyczcPFXJzrZ/ZXcgGRFeP6BU0BEJTw6tZdfQ==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-chartjs-2": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/react-chartjs-2/-/react-chartjs-2-5.3.0.tgz",
      "integrity": "sha512-UfZZFnDsERI3c3CZGxzvNJd02SHjaSJ8kgW1djn65H1KK8rehwTjyrRKOG3VTMG8wtHZ5rgAO5oTHtHi9GCCmw==",
      "license": "MIT",
      "peerDependencies": {
        "chart.js": "^4.1.1",
        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.1.1.tgz",
      "integrity": "sha512-Dlq/5LAZgF0Gaz6yiqZCf6VCcZs1ghAJyrsu84Q/GT0gV+mCxbfmKNoGRKBYMJ8IEdGPqu49YWXD02GCknEDkw==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.26.0"
      },
      "peerDependencies": {
        "react": "^19.1.1"
      }
    },
    "node_modules/react-is": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react-is/-/react-is-19.1.1.tgz",
      "integrity": "sha512-tr41fA15Vn8p4X9ntI+yCyeGSf1TlYaY5vlTZfQmeLBrFo3psOPX6HhTDnFNL9uj3EhP0KAQ80cugCl4b4BERA==",
      "license": "MIT",
      "peer": true
    },
    "node_modules/react-redux": {
      "version": "9.2.0",
      "resolved": "https://registry.npmjs.org/react-redux/-/react-redux-9.2.0.tgz",
      "integrity": "sha512-ROY9fvHhwOD9ySfrF0wmvu//bKCQ6AeZZq1nJNtbDC+kk5DuSuNX/n6YWYF/SYy7bSba4D4FSz8DJeKY/S/r+g==",
      "license": "MIT",
      "dependencies": {
        "@types/use-sync-external-store": "^0.0.6",
        "use-sync-external-store": "^1.4.0"
      },
      "peerDependencies": {
        "@types/react": "^18.2.25 || ^19",
        "react": "^18.0 || ^19",
        "redux": "^5.0.0"
      },
      "peerDependenciesMeta": {
        "@types/react": {
          "optional": true
        },
        "redux": {
          "optional": true
        }
      }
    },
    "node_modules/react-refresh": {
      "version": "0.17.0",
      "resolved": "https://registry.npmjs.org/react-refresh/-/react-refresh-0.17.0.tgz",
      "integrity": "sha512-z6F7K9bV85EfseRCp2bzrpyQ0Gkw1uLoCel9XBVWPg/TjRj94SkJzUTGfOa4bs7iJvBWtQG0Wq7wnI0syw3EBQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-router": {
      "version": "7.7.1",
      "resolved": "https://registry.npmjs.org/react-router/-/react-router-7.7.1.tgz",
      "integrity": "sha512-jVKHXoWRIsD/qS6lvGveckwb862EekvapdHJN/cGmzw40KnJH5gg53ujOJ4qX6EKIK9LSBfFed/xiQ5yeXNrUA==",
      "license": "MIT",
      "dependencies": {
        "cookie": "^1.0.1",
        "set-cookie-parser": "^2.6.0"
      },
      "engines": {
        "node": ">=20.0.0"
      },
      "peerDependencies": {
        "react": ">=18",
        "react-dom": ">=18"
      },
      "peerDependenciesMeta": {
        "react-dom": {
          "optional": true
        }
      }
    },
    "node_modules/react-router-dom": {
      "version": "7.7.1",
      "resolved": "https://registry.npmjs.org/react-router-dom/-/react-router-dom-7.7.1.tgz",
      "integrity": "sha512-bavdk2BA5r3MYalGKZ01u8PGuDBloQmzpBZVhDLrOOv1N943Wq6dcM9GhB3x8b7AbqPMEezauv4PeGkAJfy7FQ==",
      "license": "MIT",
      "dependencies": {
        "react-router": "7.7.1"
      },
      "engines": {
        "node": ">=20.0.0"
      },
      "peerDependencies": {
        "react": ">=18",
        "react-dom": ">=18"
      }
    },
    "node_modules/recharts": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/recharts/-/recharts-3.1.0.tgz",
      "integrity": "sha512-NqAqQcGBmLrfDs2mHX/bz8jJCQtG2FeXfE0GqpZmIuXIjkpIwj8sd9ad0WyvKiBKPd8ZgNG0hL85c8sFDwascw==",
      "license": "MIT",
      "dependencies": {
        "@reduxjs/toolkit": "1.x.x || 2.x.x",
        "clsx": "^2.1.1",
        "decimal.js-light": "^2.5.1",
        "es-toolkit": "^1.39.3",
        "eventemitter3": "^5.0.1",
        "immer": "^10.1.1",
        "react-redux": "8.x.x || 9.x.x",
        "reselect": "5.1.1",
        "tiny-invariant": "^1.3.3",
        "use-sync-external-store": "^1.2.2",
        "victory-vendor": "^37.0.2"
      },
      "engines": {
        "node": ">=18"
      },
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        "react-dom": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        "react-is": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/redux": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/redux/-/redux-5.0.1.tgz",
      "integrity": "sha512-M9/ELqF6fy8FwmkpnF0S3YKOqMyoWJ4+CS5Efg2ct3oY9daQvd/Pc71FpGZsVsbl3Cpb+IIcjBDUnnyBdQbq4w==",
      "license": "MIT"
    },
    "node_modules/redux-thunk": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/redux-thunk/-/redux-thunk-3.1.0.tgz",
      "integrity": "sha512-NW2r5T6ksUKXCabzhL9z+h206HQw/NJkcLm1GPImRQ8IzfXwRGqjVhKJGauHirT0DAuyy6hjdnMZaRoAcy0Klw==",
      "license": "MIT",
      "peerDependencies": {
        "redux": "^5.0.0"
      }
    },
    "node_modules/reselect": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/reselect/-/reselect-5.1.1.tgz",
      "integrity": "sha512-K/BG6eIky/SBpzfHZv/dd+9JBFiS4SWV7FIujVyJRux6e45+73RaUHXLmIR1f7WOMaQ0U1km6qwklRQxpJJY0w==",
      "license": "MIT"
    },
    "node_modules/resolve-from": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/resolve-from/-/resolve-from-4.0.0.tgz",
      "integrity": "sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/rollup": {
      "version": "4.46.2",
      "resolved": "https://registry.npmjs.org/rollup/-/rollup-4.46.2.tgz",
      "integrity": "sha512-WMmLFI+Boh6xbop+OAGo9cQ3OgX9MIg7xOQjn+pTCwOkk+FNDAeAemXkJ3HzDJrVXleLOFVa1ipuc1AmEx1Dwg==",
      "license": "MIT",
      "dependencies": {
        "@types/estree": "1.0.8"
      },
      "bin": {
        "rollup": "dist/bin/rollup"
      },
      "engines": {
        "node": ">=18.0.0",
        "npm": ">=8.0.0"
      },
      "optionalDependencies": {
        "@rollup/rollup-android-arm-eabi": "4.46.2",
        "@rollup/rollup-android-arm64": "4.46.2",
        "@rollup/rollup-darwin-arm64": "4.46.2",
        "@rollup/rollup-darwin-x64": "4.46.2",
        "@rollup/rollup-freebsd-arm64": "4.46.2",
        "@rollup/rollup-freebsd-x64": "4.46.2",
        "@rollup/rollup-linux-arm-gnueabihf": "4.46.2",
        "@rollup/rollup-linux-arm-musleabihf": "4.46.2",
        "@rollup/rollup-linux-arm64-gnu": "4.46.2",
        "@rollup/rollup-linux-arm64-musl": "4.46.2",
        "@rollup/rollup-linux-loongarch64-gnu": "4.46.2",
        "@rollup/rollup-linux-ppc64-gnu": "4.46.2",
        "@rollup/rollup-linux-riscv64-gnu": "4.46.2",
        "@rollup/rollup-linux-riscv64-musl": "4.46.2",
        "@rollup/rollup-linux-s390x-gnu": "4.46.2",
        "@rollup/rollup-linux-x64-gnu": "4.46.2",
        "@rollup/rollup-linux-x64-musl": "4.46.2",
        "@rollup/rollup-win32-arm64-msvc": "4.46.2",
        "@rollup/rollup-win32-ia32-msvc": "4.46.2",
        "@rollup/rollup-win32-x64-msvc": "4.46.2",
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/scheduler": {
      "version": "0.26.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.26.0.tgz",
      "integrity": "sha512-NlHwttCI/l5gCPR3D1nNXtWABUmBwvZpEQiD4IXSbIDq8BzLIK/7Ir5gTFSGZDUu37K5cMNp0hFtzO38sC7gWA==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/set-cookie-parser": {
      "version": "2.7.1",
      "resolved": "https://registry.npmjs.org/set-cookie-parser/-/set-cookie-parser-2.7.1.tgz",
      "integrity": "sha512-IOc8uWeOZgnb3ptbCURJWNjWUPcO3ZnTTdzsurqERrP6nPyv+paC55vJM0LpOlT2ne+Ix+9+CRG1MNLlyZ4GjQ==",
      "license": "MIT"
    },
    "node_modules/shebang-command": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
      "integrity": "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "shebang-regex": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shebang-regex": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/shebang-regex/-/shebang-regex-3.0.0.tgz",
      "integrity": "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz",
      "integrity": "sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-3.1.1.tgz",
      "integrity": "sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/tailwindcss": {
      "version": "4.1.11",
      "resolved": "https://registry.npmjs.org/tailwindcss/-/tailwindcss-4.1.11.tgz",
      "integrity": "sha512-2E9TBm6MDD/xKYe+dvJZAmg3yxIEDNRc0jwlNyDg/4Fil2QcSLjFKGVff0lAf1jjeaArlG/M75Ey/EYr/OJtBA==",
      "license": "MIT"
    },
    "node_modules/tapable": {
      "version": "2.2.2",
      "resolved": "https://registry.npmjs.org/tapable/-/tapable-2.2.2.tgz",
      "integrity": "sha512-Re10+NauLTMCudc7T5WLFLAwDhQ0JWdrMK+9B2M8zR5hRExKmsRDCBA7/aV/pNJFltmBFO5BAMlQFi/vq3nKOg==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/tar": {
      "version": "7.4.3",
      "resolved": "https://registry.npmjs.org/tar/-/tar-7.4.3.tgz",
      "integrity": "sha512-5S7Va8hKfV7W5U6g3aYxXmlPoZVAwUMy9AOKyF2fVuZa2UD3qZjg578OrLRt8PcNN1PleVaL/5/yYATNL0ICUw==",
      "license": "ISC",
      "dependencies": {
        "@isaacs/fs-minipass": "^4.0.0",
        "chownr": "^3.0.0",
        "minipass": "^7.1.2",
        "minizlib": "^3.0.1",
        "mkdirp": "^3.0.1",
        "yallist": "^5.0.0"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/tar/node_modules/yallist": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-5.0.0.tgz",
      "integrity": "sha512-YgvUTfwqyc7UXVMrB+SImsVYSmTS8X/tSrtdNZMImM+n7+QTriRXyXim0mBrTXNeqzVF0KWGgHPeiyViFFrNDw==",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/tiny-invariant": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/tiny-invariant/-/tiny-invariant-1.3.3.tgz",
      "integrity": "sha512-+FbBPE1o9QAYvviau/qC5SE3caw21q3xkvWKBtja5vgqOWIHHJ3ioaq1VPfn/Szqctz2bU/oYeKd9/z5BL+PVg==",
      "license": "MIT"
    },
    "node_modules/tinyglobby": {
      "version": "0.2.14",
      "resolved": "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.14.tgz",
      "integrity": "sha512-tX5e7OM1HnYr2+a2C/4V0htOcSQcoSTH9KgJnVvNm5zm/cyEWKJ7j7YutsH9CxMdtOkkLFy2AHrMci9IM8IPZQ==",
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.4.4",
        "picomatch": "^4.0.2"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/type-check": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/type-check/-/type-check-0.4.0.tgz",
      "integrity": "sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/update-browserslist-db": {
      "version": "1.1.3",
      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.1.3.tgz",
      "integrity": "sha512-UxhIZQ+QInVdunkDAaiazvvT/+fXL5Osr0JZlJulepYu6Jd7qJtDZjlur0emRlT71EN3ScPoE7gvsuIKKNavKw==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/uri-js": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/uri-js/-/uri-js-4.4.1.tgz",
      "integrity": "sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "punycode": "^2.1.0"
      }
    },
    "node_modules/use-sync-external-store": {
      "version": "1.5.0",
      "resolved": "https://registry.npmjs.org/use-sync-external-store/-/use-sync-external-store-1.5.0.tgz",
      "integrity": "sha512-Rb46I4cGGVBmjamjphe8L/UnvJD+uPPtTkNvX5mZgqdbavhI4EbgIWJiIHXJ8bc/i9EQGPRh4DwEURJ552Do0A==",
      "license": "MIT",
      "peerDependencies": {
        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
      }
    },
    "node_modules/victory-vendor": {
      "version": "37.3.6",
      "resolved": "https://registry.npmjs.org/victory-vendor/-/victory-vendor-37.3.6.tgz",
      "integrity": "sha512-SbPDPdDBYp+5MJHhBCAyI7wKM3d5ivekigc2Dk2s7pgbZ9wIgIBYGVw4zGHBml/qTFbexrofXW6Gu4noGxrOwQ==",
      "license": "MIT AND ISC",
      "dependencies": {
        "@types/d3-array": "^3.0.3",
        "@types/d3-ease": "^3.0.0",
        "@types/d3-interpolate": "^3.0.1",
        "@types/d3-scale": "^4.0.2",
        "@types/d3-shape": "^3.1.0",
        "@types/d3-time": "^3.0.0",
        "@types/d3-timer": "^3.0.0",
        "d3-array": "^3.1.6",
        "d3-ease": "^3.0.1",
        "d3-interpolate": "^3.0.1",
        "d3-scale": "^4.0.2",
        "d3-shape": "^3.1.0",
        "d3-time": "^3.0.0",
        "d3-timer": "^3.0.1"
      }
    },
    "node_modules/vite": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/vite/-/vite-7.0.6.tgz",
      "integrity": "sha512-MHFiOENNBd+Bd9uvc8GEsIzdkn1JxMmEeYX35tI3fv0sJBUTfW5tQsoaOwuY4KhBI09A3dUJ/DXf2yxPVPUceg==",
      "license": "MIT",
      "dependencies": {
        "esbuild": "^0.25.0",
        "fdir": "^6.4.6",
        "picomatch": "^4.0.3",
        "postcss": "^8.5.6",
        "rollup": "^4.40.0",
        "tinyglobby": "^0.2.14"
      },
      "bin": {
        "vite": "bin/vite.js"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      },
      "funding": {
        "url": "https://github.com/vitejs/vite?sponsor=1"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.3"
      },
      "peerDependencies": {
        "@types/node": "^20.19.0 || >=22.12.0",
        "jiti": ">=1.21.0",
        "less": "^4.0.0",
        "lightningcss": "^1.21.0",
        "sass": "^1.70.0",
        "sass-embedded": "^1.70.0",
        "stylus": ">=0.54.8",
        "sugarss": "^5.0.0",
        "terser": "^5.16.0",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        },
        "jiti": {
          "optional": true
        },
        "less": {
          "optional": true
        },
        "lightningcss": {
          "optional": true
        },
        "sass": {
          "optional": true
        },
        "sass-embedded": {
          "optional": true
        },
        "stylus": {
          "optional": true
        },
        "sugarss": {
          "optional": true
        },
        "terser": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/which": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/which/-/which-2.0.2.tgz",
      "integrity": "sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "isexe": "^2.0.0"
      },
      "bin": {
        "node-which": "bin/node-which"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/word-wrap": {
      "version": "1.2.5",
      "resolved": "https://registry.npmjs.org/word-wrap/-/word-wrap-1.2.5.tgz",
      "integrity": "sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/yallist": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz",
      "integrity": "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz",
      "integrity": "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    }
  }
}
```


## package.json

```json
{
  "name": "project_name",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.1.11",
    "chart.js": "^4.5.0",
    "crypto-js": "^4.2.0",
    "dayjs": "^1.11.13",
    "emoji-picker-react": "^4.13.2",
    "pocketbase": "^0.26.2",
    "react": "^19.1.0",
    "react-chartjs-2": "^5.3.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.7.1",
    "recharts": "^3.1.0",
    "tailwindcss": "^4.1.11"
  },
  "devDependencies": {
    "@eslint/js": "^9.30.1",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "eslint": "^9.30.1",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "vite": "^7.0.4"
  }
}
```


## README.md

```md
# Daily — Journal positif chiffré

**Daily** est une application web pour écrire chaque jour trois points positifs, noter son humeur et répondre à une question originale.  
Toutes les données sont **chiffrées côté client** avant d’être envoyées au serveur : toi seul·e peux les lire, même l’admin n’y a jamais accès.

---

## Principes

- **Confidentialité réelle** : chiffrement de bout en bout, personne d’autre que toi ne peut lire tes écrits.
- **Journal quotidien** : trois points positifs obligatoires, humeur (score + emoji), question du jour aléatoire, commentaire libre.
- **Aucune analyse automatique, aucun tracking, aucun partage des données** : tu restes propriétaire de tout ce que tu écris.
- **Interface minimaliste, rapide et accessible.**

---

## Stack technique

- **Frontend** : React, TailwindCSS
- **Backend** : PocketBase auto-hébergé
- **Chiffrement** :  
  - AES (CryptoJS), clé dérivée du mot de passe utilisateur·ice (jamais stockée ni transmise).
  - Tous les contenus sensibles sont chiffrés côté client : positifs, humeur, emoji, question/réponse, commentaire.
  - La clé principale est stockée chiffrée (jamais en clair).
- **Pas de tracking, pas d’export CSV ni d’API publique.**

---

## Fonctionnement du chiffrement

- **Chiffrement local** dans le navigateur (AES).
- La clé de chiffrement est dérivée du mot de passe via un salt unique.
- Personne n’a accès aux données, même avec un accès serveur.
- L’export des données se fait déchiffré localement, jamais côté serveur.

---

## Fonctionnalités

- **Entrée quotidienne** (3 positifs, humeur, question, commentaire)
- **Historique** : filtrage, suppression d’entrées
- **Graphique** : humeur sur 6 mois glissants
- **Export** : téléchargement de toutes tes données en JSON
- **Gestion du compte** : email, mot de passe, suppression, export
- **Admin** : gestion utilisateurs et invitations

---

## Installation

### Prérequis

- Node.js >= 18
- PocketBase (serveur à installer localement ou sur un serveur dédié)

### Déploiement local

1. **Cloner le repo**  
   ```bash
   git clone https://github.com/aliceout/daily.git
   cd daily
   ```
2. **Installer les dépendances**
    Installer les dépendances
   ```bash
   npm install
   ```
3. **Installer et lancer PocketBase**
- Télécharger PocketBase depuis pocketbase.io
- Lancer PocketBase sur le port 8090
   ```bash
   ./pocketbase serve
   ```


4. **Configurer l’environnement**
- Créer un fichier .env à la racine avec :
   ```ini
   VITE_PB_URL=http://127.0.0.1:8090
   ```
5. **Lancer l’application**
   ```bash
   npm run dev
   ```
6. **Ouvrir dans ton navigateur**

   http://localhost:5173

   ---

## Sécurité et limites

- **La sécurité dépend de la force de ton mot de passe**.
- **Perte du mot de passe = perte irrémédiable des données** (aucune récupération possible).
- **Aucune sauvegarde serveur** : exporte régulièrement tes données si besoin.
- **Pas d’application mobile native** pour l’instant, mais utilisable sur mobile via navigateur.

---

## Améliorations possibles

- Import data
- Passage à WebCrypto et Argon2 pour un chiffrement/dérivation de clé encore plus robuste
- Fonction “bilan” ou export analytique
- Application mobile dédiée

---

## Crédits

Développé par aliceout
Projet open source, sous licence Mozilla Public License 2.0
```


## vite.config.js

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/ 
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // écoute sur 0.0.0.0
    port: 8089, // port forcé
    strictPort: true, // échoue si 8089 n'est pas libre
  },
});
```

